import type { Page } from 'playwright';
export const pause = () => new Promise<void>(resolve => setTimeout(resolve, 300 + Math.random() * 500));
export async function humanClick(page: Page, selector: string): Promise<void> {
  await pause();
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 15 });
  await locator.click();
}
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await pause();
  await page.locator(selector).fill('');
  await page.locator(selector).pressSequentially(text, { delay: 60 });
}
