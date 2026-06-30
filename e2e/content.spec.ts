import { expect, seedFastRun, test } from './fixtures';

const popupUrl = (id: string) =>
  `chrome-extension://${id}/src/popup/popup.html`;

test('the break mask is injected into a normal tab on break', async ({
  context,
  background,
  extensionId,
}) => {
  await seedFastRun(background, 2);

  // A stubbed https page (fulfilled offline) so the <all_urls> content script
  // injects without hitting the network.
  const page = await context.newPage();
  await page.route('https://example.test/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>host</title><h1>host page</h1>',
    })
  );
  await page.goto('https://example.test/');
  // No mask while focusing / idle.
  await expect(page.locator('.pace-mask')).toHaveCount(0);

  // Start a run from the popup; the focus compresses to ~1 s, then the break
  // broadcast reaches this tab and the content script masks it.
  const popup = await context.newPage();
  await popup.goto(popupUrl(extensionId));
  await popup.click('#btn-start');

  // The mask lives in an open shadow root, which Playwright CSS locators pierce.
  await expect(page.locator('.pace-mask')).toBeVisible();
});
