import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants';
import type { SessionState, Settings, ViewMessage } from '../shared/types';

const toggle = document.getElementById('testmode-toggle') as HTMLInputElement;

async function currentSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const settings = stored[STORAGE_KEYS.settings] as
    | Partial<Settings>
    | undefined;
  return { ...DEFAULT_SETTINGS, ...settings };
}

toggle.addEventListener('change', () => {
  void (async () => {
    const settings = await currentSettings();
    settings.testMode = toggle.checked;
    // Route through the background so an idle session snapshot is
    // refreshed and open views get the stateChanged broadcast.
    await chrome.runtime.sendMessage<ViewMessage, SessionState>({
      type: 'saveSettings',
      settings,
    });
  })();
});

void (async () => {
  toggle.checked = (await currentSettings()).testMode;
})();
