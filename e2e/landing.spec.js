import { test, expect } from '@playwright/test';

test.describe('landing', () => {
  test.use({ viewport: { width: 1280, height: 860 } });

  test('renders hero, live demo and gallery from the real engine', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Content in.');
    await expect(page.getByRole('img', { name: 'Live preview of your card' })).toBeVisible();
    await expect(page.locator('canvas.gallery-card')).toHaveCount(11);
    expect(errors).toEqual([]);
  });

  test('theme toggle cycles system → light → dark and persists', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const toggle = page.getByRole('button', { name: /^Theme:/ });
    await expect(html).not.toHaveAttribute('data-theme', /./);
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(18, 18, 20)');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.goto('/studio');
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('try-it text carries into the studio', async ({ page }) => {
    await page.goto('/');
    await page.locator('#tryit-text').fill('Make it simple, but significant.');
    await page.getByRole('radio', { name: 'Midnight' }).click();
    await page.getByRole('link', { name: /Continue in the studio/ }).click();
    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.locator('textarea').first()).toHaveValue('Make it simple, but significant.');
    await page.getByRole('tab', { name: 'Design' }).click();
    await expect(page.getByRole('radio', { name: 'Midnight' })).toHaveAttribute('aria-checked', 'true');
  });

  test('browser back returns to the landing page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Open studio' }).click();
    await expect(page).toHaveURL(/\/studio$/);
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Content in.');
  });
});

for (const [name, width] of [['mobile', 375], ['tablet', 820], ['desktop', 1440]]) {
  test(`landing ${name}: no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('canvas.gallery-card').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test.describe('custom styles', () => {
  test.use({ viewport: { width: 1280, height: 860 } });

  test('create, preview, persist and delete a palette', async ({ page }) => {
    await page.goto('/studio');
    await page.locator('textarea').first().fill('“Less, but better.”\n— Dieter Rams');
    await page.getByRole('tab', { name: 'Design' }).click();
    await page.getByRole('button', { name: 'New', exact: true }).click();
    const pixels = () => page.locator('canvas.preview-canvas').evaluate((c) => c.toDataURL());
    const before = await pixels();
    await page.getByLabel('Canvas colour picker').fill('#1f3d2b');
    await expect.poll(pixels).not.toBe(before); // live preview
    await page.getByRole('textbox', { name: 'Name' }).fill('Pine');
    await page.getByRole('button', { name: 'Save palette' }).click();
    await expect(page.getByRole('radio', { name: 'Pine' })).toHaveAttribute('aria-checked', 'true');
    await page.reload();
    await page.getByRole('tab', { name: 'Design' }).click();
    await expect(page.getByRole('radio', { name: 'Pine' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Edit “Pine”' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Click again to delete' }).click();
    await expect(page.getByRole('radio', { name: 'Pine' })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Warm paper' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('radio', { name: 'Pine' })).toHaveAttribute('aria-checked', 'true');
  });

  test('cancelling a new palette restores the previous look', async ({ page }) => {
    await page.goto('/studio');
    await page.locator('textarea').first().fill('Cancel check');
    await page.getByRole('tab', { name: 'Design' }).click();
    // Compare the bitmap itself (unaffected by CSS fade-in animations).
    const pixels = () => page.locator('canvas.preview-canvas').evaluate((c) => c.toDataURL());
    await page.waitForTimeout(300);
    const before = await pixels();
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByLabel('Canvas colour picker').fill('#000000');
    await expect.poll(pixels).not.toBe(before);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect.poll(pixels).toBe(before);
  });

  test('custom font pairing exports and persists', async ({ page }) => {
    await page.goto('/studio');
    await page.locator('textarea').first().fill('Typography check\n\nA custom pairing should flow through to the export.');
    await page.getByRole('tab', { name: 'Design' }).click();
    await page.getByRole('button', { name: /New pairing/ }).click();
    await page.getByRole('combobox', { name: 'Headline' }).selectOption('space-grotesk');
    await page.getByRole('combobox', { name: 'Body' }).selectOption('plex-sans');
    await page.getByRole('button', { name: 'Save pairing' }).click();
    await expect(page.getByRole('radio', { name: /My pairing 1/ })).toHaveAttribute('aria-checked', 'true');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.header-export .export-btn').click()]);
    expect(download.suggestedFilename()).toBe('typography-check-1080x1350.png');
    await page.reload();
    await page.getByRole('tab', { name: 'Design' }).click();
    await expect(page.getByRole('radio', { name: /My pairing 1/ })).toHaveAttribute('aria-checked', 'true');
  });
});

test('palette names must be unique', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/studio');
  await page.locator('textarea').first().fill('Name check');
  await page.getByRole('tab', { name: 'Design' }).click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('forest');
  await expect(page.getByText('That name is already used.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save palette' })).toBeDisabled();
});

test('social presets: platform filter and exact export size', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto('/studio');
  await page.locator('textarea').first().fill('A thumbnail that earns the click');
  await page.getByRole('tab', { name: 'Design' }).click();
  await page.getByRole('button', { name: 'YouTube' }).click();
  await page.getByRole('radio', { name: /Thumbnail/ }).click();
  await expect(page.locator('.preview-dims')).toContainText('YouTube · Thumbnail 1280 × 720');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.header-export .export-btn').click()]);
  expect(download.suggestedFilename()).toMatch(/1280x720\.png$/);
  const buf = (await import('node:fs')).readFileSync(await download.path());
  expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([1280, 720]);
});
