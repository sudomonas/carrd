import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PHOTO = fileURLToPath(new URL('./fixtures/photo.png', import.meta.url));

function pngSize(buf) {
  expect(buf.subarray(1, 4).toString('latin1')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error('no SOF marker');
}

async function enterText(page, text) {
  await page.goto('/studio');
  await page.locator('textarea').first().fill(text);
  await expect(page.locator('canvas.preview-canvas')).toBeVisible();
}

async function exportFile(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.header-export .export-btn').click()]);
  const path = await download.path();
  return { name: download.suggestedFilename(), buf: readFileSync(path) };
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('creates and exports a card without opening settings', async ({ page }) => {
    await enterText(page, 'Why small tools win\n\nSmall, focused tools tend to outlast sprawling suites.');
    const { name, buf } = await exportFile(page);
    expect(name).toBe('why-small-tools-win-1080x1350.png');
    expect(pngSize(buf)).toEqual({ width: 1080, height: 1350 });
    await expect(page.locator('.toast')).toContainText('Saved');
  });

  const presets = [['Square', 1080, 1080], ['Portrait', 1080, 1350], ['Story', 1080, 1920], ['Landscape', 1200, 675]];
  for (const [label, w, h] of presets) {
    test(`exports ${label} at exactly ${w}×${h}`, async ({ page }) => {
      await enterText(page, '“Simplicity is prerequisite for reliability.”\n— Edsger W. Dijkstra');
      await page.getByRole('tab', { name: 'Design' }).click();
      await page.getByRole('radio', { name: new RegExp(`^${label}`) }).click();
      await expect(page.locator('.preview-dims')).toContainText(`${w} × ${h}`);
      expect(pngSize((await exportFile(page)).buf)).toEqual({ width: w, height: h });
    });
  }

  test('custom size validates and exports exact dimensions as JPEG', async ({ page }) => {
    await enterText(page, 'A note about custom sizes and how they reflow.');
    await page.getByRole('tab', { name: 'Design' }).click();
    await page.getByRole('radio', { name: /^Custom/ }).click();
    await page.getByLabel('Width').fill('90000');
    await expect(page.getByRole('alert')).toContainText('Keeping 1080 × 1080');
    await page.getByLabel('Width').fill('1600');
    await page.getByLabel('Height').fill('900');
    await expect(page.locator('.preview-dims')).toContainText('1600 × 900');
    await page.locator('.header-export').getByRole('radio', { name: 'JPEG' }).click();
    const { name, buf } = await exportFile(page);
    expect(name).toMatch(/1600x900\.jpg$/);
    expect(jpegSize(buf)).toEqual({ width: 1600, height: 900 });
  });

  test('bundled fonts are loaded before rendering', async ({ page }) => {
    await enterText(page, 'Fonts check');
    const ok = await page.evaluate(() => ['400 16px "Carrd Inter"', '600 16px "Carrd Source Serif"', '400 16px "Carrd JetBrains Mono"'].every((f) => document.fonts.check(f)));
    expect(ok).toBe(true);
  });

  test('image upload produces a cinematic card that exports with the photo', async ({ page }) => {
    await page.goto('/studio');
    await page.getByRole('radio', { name: 'Image' }).click();
    await page.locator('input[type=file]').setInputFiles(PHOTO);
    await page.getByLabel('Caption').fill('Morning light over the harbour');
    await expect(page.locator('.preview-layout')).toHaveText('Cinematic');
    const { buf } = await exportFile(page);
    expect(pngSize(buf)).toEqual({ width: 1080, height: 1350 });
  });

  test('rejects unsupported uploads with a clear message', async ({ page }) => {
    await page.goto('/studio');
    await page.getByRole('radio', { name: 'Image' }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
    await expect(page.locator('.note-error')).toContainText('Unsupported image format');
  });

  test('palette changes keep layout; resolution changes reflow', async ({ page }) => {
    await enterText(page, 'The quiet return of the small web\n\nPersonal sites are back, and they look nothing like they used to.');
    const layout = await page.locator('.preview-layout').textContent();
    await page.getByRole('tab', { name: 'Design' }).click();
    for (const p of ['Ink', 'Sage', 'Blackout']) {
      await page.getByRole('radio', { name: p }).click();
      await expect(page.locator('.preview-layout')).toHaveText(layout);
    }
    const before = await page.locator('canvas.preview-canvas').getAttribute('style');
    await page.getByRole('radio', { name: /^Landscape/ }).click();
    await expect(page.locator('canvas.preview-canvas')).not.toHaveAttribute('style', before);
  });

  test('blocked link shows a manual fallback and keeps the URL', async ({ page }) => {
    await page.goto('/studio');
    await page.getByRole('radio', { name: 'Link' }).click();
    await page.getByLabel('Article URL').fill('http://127.0.0.1/admin');
    await page.getByRole('button', { name: 'Fetch' }).click();
    await expect(page.getByRole('alert')).toContainText('can’t be fetched');
    await expect(page.getByLabel('Article URL')).toHaveValue('http://127.0.0.1/admin');
    await page.getByLabel('Title').fill('Manual title');
    await expect(page.locator('canvas.preview-canvas')).toBeVisible();
  });

  test('draft survives reload; clear can be undone', async ({ page }) => {
    await enterText(page, 'Persist me please');
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator('textarea').first()).toHaveValue('Persist me please');
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Clear card' }).click();
    await expect(page.locator('.composer')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('textarea').first()).toHaveValue('Persist me please');
  });

  test('visual: centered quote card', async ({ page }) => {
    await enterText(page, '“The details are not the details. They make the design.”\n— Charles Eames');
    await page.waitForTimeout(300);
    await expect(page.locator('canvas.preview-canvas')).toHaveScreenshot('quote-centered.png');
  });

  test('visual: code card', async ({ page }) => {
    await page.goto('/studio');
    await page.getByRole('radio', { name: 'Code' }).click();
    await page.locator('textarea').first().fill('function add(a, b) {\n  return a + b; // simple\n}');
    await page.getByLabel('Title').fill('Addition');
    await page.waitForTimeout(300);
    await expect(page.locator('canvas.preview-canvas')).toHaveScreenshot('code.png');
  });
});

for (const [name, width, height] of [['mobile', 375, 740], ['tablet', 820, 1180], ['desktop', 1440, 900]]) {
  test(`${name}: no horizontal overflow and export reachable`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await enterText(page, 'Responsive check\n\nThe export action must stay reachable on every screen size.');
    await page.getByRole('tab', { name: 'Design' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const btn = page.locator(width < 768 ? '.mobile-bar .export-btn' : '.header-export .export-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toBeInViewport();
  });
}
