import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ viewport: { width: 1280, height: 860 } });

const pixels = (page) => page.locator('canvas.preview-canvas').evaluate((c) => c.toDataURL());

test('shuffle changes the design, keeps the size, and can be undone', async ({ page }) => {
  await page.goto('/studio');
  await page.locator('textarea').first().fill('The quiet return of the small web\n\nPersonal sites are back, and they look nothing like they used to.');
  await page.getByRole('tab', { name: 'Design' }).click();
  await page.getByRole('button', { name: 'Instagram' }).click();
  await page.getByRole('radio', { name: /Story & Reels/ }).click();
  await page.waitForTimeout(300);
  const before = await pixels(page);
  const checkedPalette = () => page.locator('.swatch[aria-checked="true"] .swatch-label').textContent();
  const paletteBefore = await checkedPalette();

  await page.getByRole('button', { name: 'Shuffle design' }).click();
  await expect(page.locator('.toast')).toContainText('·');
  await expect.poll(() => pixels(page)).not.toBe(before);
  expect(await checkedPalette()).not.toBe(paletteBefore);
  await expect(page.locator('.preview-dims')).toContainText('1080 × 1920');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => checkedPalette()).toBe(paletteBefore);
  await expect.poll(() => pixels(page)).toBe(before);
});

test('every shuffle result can be exported', async ({ page }) => {
  await page.goto('/studio');
  await page.locator('textarea').first().fill('“Less, but better.”\n— Dieter Rams');
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Shuffle design' }).click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.header-export .export-btn').click()]);
    const buf = readFileSync(await download.path());
    expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([1080, 1350]);
  }
});

test('texture backgrounds render and export', async ({ page }) => {
  await page.goto('/studio');
  await page.locator('textarea').first().fill('Texture check');
  await page.getByRole('tab', { name: 'Design' }).click();
  const solid = await pixels(page);
  for (const name of ['Paper', 'Linen', 'Grain', 'Dots', 'Grid', 'Stripes']) {
    await page.getByRole('radio', { name: `${name} texture` }).click();
    await expect(page.getByRole('radio', { name: `${name} texture` })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(() => pixels(page)).not.toBe(solid);
  }
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.header-export .export-btn').click()]);
  expect(download.suggestedFilename()).toBe('texture-check-1080x1350.png');
});
