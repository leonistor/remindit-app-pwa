import { chromium } from "playwright";
import { attachRecorder } from "playwright-recorder-plus";
import path from "node:path";

const OUTPUT = path.join(import.meta.dir, "demo-avatar-roll.mp4");

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 400, height: 720 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const recorder = await attachRecorder(page, { path: OUTPUT });

// Inject a visible cursor overlay (screencast doesn't capture system cursor)
await page.addInitScript(() => {
  const dot = document.createElement("div");
  Object.assign(dot.style, {
    position: "fixed",
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    background: "rgba(0,0,0,0.4)",
    border: "2px solid rgba(255,255,255,0.8)",
    pointerEvents: "none",
    zIndex: "2147483647",
    transform: "translate(-50%, -50%)",
    transition: "left 0.05s, top 0.05s",
  });
  document.addEventListener(
    "mousemove",
    (e) => {
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
    },
    { passive: true },
  );
  document.body.appendChild(dot);
});

try {
  await page.goto("http://localhost:3000");

  // --- Onboarding: pick avatar ---
  const diceButton = page.getByRole("button", {
    name: "Roll a new random name and avatar",
  });
  await diceButton.waitFor({ state: "visible", timeout: 10_000 });

  for (let i = 0; i < 3; i++) {
    await diceButton.click();
    await page.waitForTimeout(500);
  }

  // --- Onboarding: accept name & avatar ---
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForTimeout(300);

  // --- Onboarding: accept Minimal catalog ---
  await page.getByRole("button", { name: "Finish" }).click();

  // --- Dismiss install banner (if it appears) ---
  const noButton = page.getByRole("button", { name: "No" });
  try {
    await noButton.waitFor({ state: "visible", timeout: 3000 });
    await noButton.click();
  } catch {
    // banner didn't appear — continue
  }

  // --- Open Fridge and Snacks accordions ---
  await page.getByRole("button", { name: "fridge" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "snacks" }).click();
  await page.waitForTimeout(300);

  // --- Add items to shopping list ---
  for (const item of ["eggs", "pasta", "yogurt", "crackers"]) {
    await page.getByRole("button", { name: item }).click();
    await page.waitForTimeout(400);
  }

  await page.waitForTimeout(1000);
} finally {
  await recorder.stop();
  await context.close();
  await browser.close();
  await recorder.finalized;
  console.log(`Video saved to ${OUTPUT}`);
}
