import { chromium } from "playwright";
import { attachRecorder } from "playwright-recorder-plus";
import path from "node:path";

const OUTPUT = path.join(import.meta.dir, "demo-avatar-roll.mp4");

// --force-device-scale-factor=1 keeps the window's backing buffer at 1 device
// pixel per CSS pixel. Without it, on a Retina host the headful window surface
// is 800x1440 physical while the emulated viewport paints only 400x720 into
// its top-left corner — the recorder then scales the buffer down and the app
// content ends up quarter-size in the first quadrant of the video. Which
// display the window lands on varies per launch, so this bug appears
// intermittently without the flag.
const browser = await chromium.launch({
  headless: false,
  args: ["--force-device-scale-factor=1"],
});
const context = await browser.newContext({
  viewport: { width: 400, height: 720 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const recorder = await attachRecorder(page, { path: OUTPUT });

// Inject a visible cursor overlay (screencast doesn't capture system cursor).
// Init scripts run at document-start when <body> doesn't exist yet, so defer
// mounting until DOMContentLoaded.
await page.addInitScript(() => {
  const mount = () => {
    // High-visibility cursor: 70%-opaque red fill pops against the colorful
    // category chips; the near-solid white ring keeps it visible on white
    // backgrounds.
    const dot = document.createElement("div");
    Object.assign(dot.style, {
      position: "fixed",
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      background: "rgba(220, 38, 38, 0.7)",
      border: "3px solid rgba(255, 255, 255, 0.9)",
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

    // Screencast keep-alive. CDP screencast only delivers frames on compositor
    // damage, and playwright-recorder-plus pads frame gaps by repeating the
    // last received frame. If a long main-thread task (e.g. the synchronous
    // onboarding seeding) invalidates the content raster, the recorder's last
    // frame becomes a white capture and every subsequent idle pause is padded
    // with it — a multi-second blank stretch in the video. A 2px, infinitely
    // animating overlay keeps compositor frames flowing so gaps never form.
    const keepalive = document.createElement("div");
    Object.assign(keepalive.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "2px",
      height: "2px",
      pointerEvents: "none",
      zIndex: "2147483647",
      background: "#fff",
    });
    keepalive.animate(
      [{ opacity: "1" }, { opacity: "0.99" }, { opacity: "1" }],
      { duration: 1000, iterations: Infinity },
    );
    document.body.appendChild(keepalive);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
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
