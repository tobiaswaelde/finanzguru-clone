import { expect, test } from './owner-test.js';

const tabs = [
  ['/', 'Übersicht'],
  ['/investments', 'Investments'],
  ['/budget', 'Budget'],
  ['/insurance', 'Versicherung'],
] as const;

for (const theme of ['light', 'dark'] as const) {
  test(`keeps every tab within the viewport in ${theme} mode`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    const sizes = info.project.name === 'mobile' ? [360] : [768, 1280];
    for (const width of sizes) {
      await page.setViewportSize({ width, height: 800 });
      for (const [url, heading] of tabs) {
        await page.goto(url);
        await expect(page.getByRole('heading', { name: heading, exact: true, level: 1 })).toBeVisible();
        await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`, 'u'));
        await expect
          .poll(
            () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
            {
              message: `${url} overflows at ${width}px (${theme})`,
            },
          )
          .toBeLessThanOrEqual(0);
      }
    }
  });
}
