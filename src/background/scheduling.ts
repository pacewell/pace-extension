/**
 * Phase timing. `chrome.alarms` is the durable timer (it wakes a suspended
 * worker), but Chrome clamps alarms to a ~30 s minimum, so test-mode's
 * sub-30 s phases also get a service-worker `setTimeout` fast path with the
 * alarm as a crash fallback. The "phase is due" decision the timers trigger is
 * injected (`onDue`) so this module stays free of the state machine.
 */
import type { SessionState } from '../shared/types';

export const PHASE_ALARM = 'pace:phase';
export const TICK_ALARM = 'pace:tick';

let phaseTimer: ReturnType<typeof setTimeout> | undefined;

export function clearPhaseTimer(): void {
  clearTimeout(phaseTimer);
  phaseTimer = undefined;
}

export async function schedulePhaseEnd(
  state: SessionState,
  onDue: (expectedEnd: number) => void
): Promise<void> {
  await chrome.alarms.create(PHASE_ALARM, { when: state.phaseEndsAt });
  clearPhaseTimer();
  if (!(__ENABLE_TEST_MODE__ && state.settings.testMode)) return;
  const expectedEnd = state.phaseEndsAt;
  phaseTimer = setTimeout(
    () => onDue(expectedEnd),
    Math.max(0, state.phaseEndsAt - Date.now())
  );
}
