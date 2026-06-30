import { expect, seedFastRun, test } from './fixtures';

const popupUrl = (id: string) =>
  `chrome-extension://${id}/src/popup/popup.html`;

test('popup drives a full run: plan → focus → break → next → complete → idle', async ({
  context,
  background,
  extensionId,
}) => {
  await seedFastRun(background, 2);

  const popup = await context.newPage();
  await popup.goto(popupUrl(extensionId));

  // Planning screen reflects the seeded two-session plan.
  await expect(popup.locator('#view-plan')).toBeVisible();
  await expect(popup.locator('#plan-count')).toHaveText('2');

  // Start → first focus session.
  await popup.click('#btn-start');
  await expect(popup.locator('#view-working')).toBeVisible();
  await expect(popup.locator('#working-progress')).toHaveText('Session 1 of 2');

  // The 1-minute focus compresses to ~1 s, then the unskippable break.
  await expect(popup.locator('#view-breaking')).toBeVisible();

  // Break ends → the wake handshake (mask not hidden).
  await expect(popup.locator('#view-waiting')).toBeVisible();
  await expect(popup.locator('#waiting-progress')).toHaveText('Session 2 of 2');

  // Keep going → second (final) focus session.
  await popup.click('#btn-resume-next');
  await expect(popup.locator('#view-working')).toBeVisible();
  await expect(popup.locator('#working-progress')).toHaveText('Session 2 of 2');

  // Last session has no trailing break → completion screen.
  await expect(popup.locator('#view-complete')).toBeVisible();
  await expect(popup.locator('#complete-summary')).toContainText('2 sessions');

  // Done → back to planning (idle).
  await popup.click('#btn-complete-done');
  await expect(popup.locator('#view-plan')).toBeVisible();
});

test('pause freezes the focus countdown and resume continues', async ({
  context,
  background,
  extensionId,
}) => {
  // A single, longer focus so the run doesn't advance mid-assertion.
  await background.evaluate(async () => {
    await chrome.storage.local.set({
      'pace:settings': {
        focusMin: 25,
        breakMin: 5,
        longBreakEnabled: false,
        longBreakInterval: 4,
        longBreakMin: 15,
        sound: 'silent',
        testMode: false,
      },
      'pace:prefs': { sessions: 1, ambientOn: false },
    });
    await chrome.storage.local.remove('pace:state');
  });

  const popup = await context.newPage();
  await popup.goto(popupUrl(extensionId));
  await popup.click('#btn-start');
  await expect(popup.locator('#view-working')).toBeVisible();

  await popup.click('#btn-pause');
  await expect(popup.locator('#btn-pause')).toHaveText('Resume');
  const frozen = await popup.locator('#working-timer').textContent();
  await popup.waitForTimeout(1200);
  expect(await popup.locator('#working-timer').textContent()).toBe(frozen);

  await popup.click('#btn-pause');
  await expect(popup.locator('#btn-pause')).toHaveText('Pause');
});
