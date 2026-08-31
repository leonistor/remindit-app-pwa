import { chromium, type Locator } from "playwright";
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

// Assigned once the app has settled (see inside the try block below).
let recorder: Awaited<ReturnType<typeof attachRecorder>> | undefined;

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

// --- Humanized input -------------------------------------------------------
// Random think-time delays, curved pointer travel and click-point jitter so
// the recording reads as a person performing the scenario instead of a test
// runner teleporting between elements.
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** "Thinking" pause between scenario actions, in ms. */
const think = (min: number, max: number) => page.waitForTimeout(rand(min, max));

// Playwright doesn't expose the live pointer position; track it so moves can
// arc from where the cursor actually is.
let cursor = { x: 0, y: 0 };

/** Move the pointer to (x, y) via an arced two-leg path with eased steps. */
async function humanMove(x: number, y: number) {
  const distance = Math.hypot(x - cursor.x, y - cursor.y);
  // Arc waypoint: jitter off the straight-line midpoint so paths curve.
  const midX = (cursor.x + x) / 2 + rand(-40, 40);
  const midY = (cursor.y + y) / 2 + rand(-40, 40);
  // Step density scales with distance (~10-18px per step) so long sweeps
  // aren't visibly linear but short hops stay snappy.
  const steps = Math.max(6, Math.round(distance / rand(10, 18)));
  await page.mouse.move(midX, midY, { steps: Math.ceil(steps / 2) });
  await page.mouse.move(x, y, { steps: Math.ceil(steps / 2) });
  cursor = { x, y };
  // Settle before acting — nobody clicks the instant the pointer arrives.
  await page.waitForTimeout(rand(40, 120));
}

/** Humanized click: jitter within the element, arc over, press with duration. */
async function humanClick(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`click target not visible: ${locator}`);
  // Aim inside the middle ~40% of the element — humans rarely hit dead-center.
  const x = box.x + box.width * rand(0.3, 0.7);
  const y = box.y + box.height * rand(0.3, 0.7);
  await humanMove(x, y);
  await page.mouse.down();
  // Press-and-release takes a human ~60-130ms.
  await page.waitForTimeout(rand(60, 130));
  await page.mouse.up();
}

try {
  await page.goto("http://localhost:3000");

  // --- Onboarding: pick avatar ---
  const diceButton = page.getByRole("button", {
    name: "Roll a new random name and avatar",
  });
  await diceButton.waitFor({ state: "visible", timeout: 10_000 });

  // Attach only after the app has settled. Attaching earlier races the
  // window-manager resize: the first screencast frame can arrive while the
  // headful window still has its pre-viewport size (400x257) and the
  // recorder's one-shot size validation rejects it. Attaching here also keeps
  // the blank page-load lead-in out of the video.
  const attached = await attachRecorder(page, { path: OUTPUT });
  recorder = attached;
  await think(600, 1200);

  for (let i = 0; i < 3; i++) {
    await humanClick(diceButton);
    // "Evaluating" the rolled avatar before rolling again.
    await think(700, 1400);
  }

  // --- Onboarding: accept name & avatar ---
  await think(400, 900);
  await humanClick(page.getByRole("button", { name: "Next" }));
  await think(500, 1100);

  // --- Onboarding: accept Minimal catalog ---
  await humanClick(page.getByRole("button", { name: "Finish" }));

  // --- Dismiss install banner (if it appears) ---
  const noButton = page.getByRole("button", { name: "No" });
  try {
    await noButton.waitFor({ state: "visible", timeout: 3000 });
    await think(500, 1000);
    await humanClick(noButton);
  } catch {
    // banner didn't appear — continue
  }
  await think(800, 1500);

  // --- Open Fridge and Snacks accordions ---
  await humanClick(page.getByRole("button", { name: "fridge" }));
  await think(500, 1000);
  await humanClick(page.getByRole("button", { name: "snacks" }));
  await think(400, 900);

  // --- Add items to shopping list ---
  for (const item of ["eggs", "pasta", "yogurt", "crackers"]) {
    await humanClick(page.getByRole("button", { name: item }));
    // Scanning for the next item between picks.
    await think(500, 1200);
  }

  // Let the last action breathe before cutting the recording.
  await think(1200, 2000);
} finally {
  if (recorder) {
    await recorder.stop();
    await recorder.finalized;
  }
  await context.close();
  await browser.close();
  console.log(`Video saved to ${OUTPUT}`);
}
