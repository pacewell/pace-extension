import {
  DEFAULT_PUSH,
  NTFY_BASE,
  NTFY_PRIORITY,
  STORAGE_KEYS,
} from '../shared/constants';
import {
  breakOverPushMessage,
  breakPushMessage,
  completePushMessage,
  type PushMessage,
} from '../shared/push';
import type {
  BreakKind,
  PushConfig,
  SessionState,
  Settings,
} from '../shared/types';

/* Cross-device break push (ntfy), opt-in. We POST in *real time* at the boundary
   (from enterBreak/finishRun) rather than scheduling a delayed message, so
   Pause/End never leave a spurious buzz — at the cost of only working while the
   browser runs. Every send is best-effort: the local mask/timer is the authority
   and must never wait on or fail with the push. */

async function getPushConfig(): Promise<PushConfig> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.push);
  return { ...DEFAULT_PUSH, ...(stored[STORAGE_KEYS.push] as Partial<PushConfig>) };
}

async function send(topic: string, msg: PushMessage): Promise<void> {
  await fetch(`${NTFY_BASE}/${encodeURIComponent(topic)}`, {
    method: 'POST',
    headers: {
      Title: msg.title,
      Priority: NTFY_PRIORITY,
      Tags: msg.tags,
    },
    body: msg.body,
  });
}

/** Gate on the opt-in flag (the sole guarantee of no-network-until-enabled;
    ntfy is reachable under the existing `<all_urls>` grant), then send. Never
    throws — a network hiccup must not affect the local run. */
async function maybePush(build: () => PushMessage): Promise<void> {
  try {
    const cfg = await getPushConfig();
    if (!cfg.enabled || !cfg.topic) return;
    await send(cfg.topic, build());
  } catch {
    // Best-effort.
  }
}

export async function pushBreak(
  kind: BreakKind,
  settings: Settings
): Promise<void> {
  await maybePush(() => breakPushMessage(kind, settings));
}

export async function pushBreakOver(state: SessionState): Promise<void> {
  await maybePush(() => breakOverPushMessage(state));
}

export async function pushComplete(): Promise<void> {
  await maybePush(() => completePushMessage());
}
