import { chromium } from "playwright";
import { attachRecorder } from "playwright-recorder-plus";
import path from "node:path";

const OUTPUT = path.join(import.meta.dir, "demo-avatar-roll.mp4");

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 400, height: 700 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const recorder = await attachRecorder(page, {
  path: OUTPUT,
  size: { width: 400, height: 700 },
});

try {
  await page.goto("http://localhost:3000");

  const diceButton = page.locator(
    'button[aria-label="Roll a new random name and avatar"]',
  );
  await diceButton.waitFor({ state: "visible", timeout: 10_000 });

  for (let i = 0; i < 3; i++) {
    await diceButton.click();
    await page.waitForTimeout(500);
  }

  await page.waitForTimeout(1000);
} finally {
  await recorder.stop();
  await context.close();
  await browser.close();
  await recorder.finalized;
  console.log(`Video saved to ${OUTPUT}`);
}
