/**
 * Storage + messaging I/O. The service worker is stateless, so every handler
 * reads the persisted state/settings through here; `persist` only writes (the
 * presentation/broadcast side effects are composed in `index.ts`'s commit).
 */
import { DEFAULT_SETTINGS, PACKS, STORAGE_KEYS } from '../shared/constants';
import { idleState } from '../shared/state';
import type { BroadcastMessage, SessionState, Settings } from '../shared/types';

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const settings = stored[STORAGE_KEYS.settings] as
    | Partial<Settings>
    | undefined;
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  // A stored pack that no longer exists (e.g. the removed Waterfall) falls back.
  if (!(merged.sound in PACKS)) merged.sound = DEFAULT_SETTINGS.sound;
  return merged;
}

export async function getState(): Promise<SessionState> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.state);
  const state = stored[STORAGE_KEYS.state] as SessionState | undefined;
  if (!state) return idleState(await getSettings());
  // Older persisted states may predate newly added settings fields, or name a
  // sound pack that no longer exists (e.g. the removed Waterfall). Sanitize both,
  // else PACKS[sound] is undefined and every lookup throws (here and in the popup).
  const settings = { ...DEFAULT_SETTINGS, ...state.settings };
  if (!(settings.sound in PACKS)) settings.sound = DEFAULT_SETTINGS.sound;
  return { ...state, settings };
}

/** Write the canonical state to storage (no side effects). */
export async function persist(state: SessionState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.state]: state });
}

export async function sendToTabs(msg: BroadcastMessage): Promise<void> {
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map((tab) =>
      tab.id !== undefined
        ? chrome.tabs.sendMessage(tab.id, msg).catch(() => undefined)
        : Promise.resolve()
    )
  );
}

export async function broadcast(msg: BroadcastMessage): Promise<void> {
  await chrome.runtime.sendMessage(msg).catch(() => undefined);
  await sendToTabs(msg);
}
