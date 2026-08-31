// Composition root: wires the camera pipeline, pose recognition trackers,
// the pure round reducer and the placeholder renderer. No game rules live
// here — this file only turns pose readings into FrameInput, steps
// game-state.ts, and hands the result to renderer.ts each frame.
import { loadAssetSet, type AssetSet } from "./src/assets.ts";
import { playRoundEvent, unlockAudioContext } from "./src/audio.ts";
import {
  createInitialGameState,
  stepGameState,
  type FrameInput,
  type GameState,
  type RoundEvent,
} from "./src/game-state.ts";
import {
  createGuardTracker,
  createMovementTracker,
  createPunchTracker,
  type PoseSample,
} from "./src/pose-rules.ts";
import { renderStage, type GloveVisual } from "./src/renderer.ts";
import type { Side } from "./src/types.ts";
import { createVisionPipeline, type CameraState } from "./src/vision.ts";

const video = document.getElementById("camera-feed") as HTMLVideoElement;
const canvas = document.getElementById("diagnostic-canvas") as HTMLCanvasElement;
const aperture = document.getElementById("aperture") as HTMLButtonElement;
const status = document.getElementById("camera-status") as HTMLParagraphElement;
const ctx = canvas.getContext("2d");

const STATUS_COPY: Record<CameraState, string> = {
  idle: "",
  requestingCamera: "Requesting camera access…",
  loadingModel: "Loading pose tracking…",
  tracking: "",
  lost: "Tracking lost — step back into frame.",
  cameraDenied: "Camera permission denied. Allow camera access in your browser's site settings and reload.",
  cameraError: "Camera unavailable. Check that no other app is using it and reload.",
  modelError: "Pose tracking failed to load. Reload to try again.",
  streamEnded: "Camera disconnected. Reload to reconnect.",
};

const movement = createMovementTracker();
const guard = createGuardTracker();
const leftPunch = createPunchTracker("left");
const rightPunch = createPunchTracker("right");

let latestPose: PoseSample | null = null;
let trackingOk = false;
let cameraStarted = false;
let game: GameState = createInitialGameState();
let assets: AssetSet | null = null;
let visualPunch: Side | null = null;
let visualPunchUntil = 0;
let visualEvent: RoundEvent = null;
let visualEventUntil = 0;

void loadAssetSet().then((loaded) => {
  assets = loaded;
});

function onStateChange(state: CameraState): void {
  status.textContent = STATUS_COPY[state];
  trackingOk = state === "tracking";
  updateApertureVisibility();
}

function onPose(sample: PoseSample | null): void {
  latestPose = sample;
}

const pipeline = createVisionPipeline({ video, onStateChange, onPose });

function updateApertureVisibility(): void {
  if (!cameraStarted) {
    aperture.hidden = false;
    aperture.setAttribute("aria-label", "Activate camera and begin");
    return;
  }
  if (game.result !== null) {
    aperture.hidden = false;
    aperture.setAttribute("aria-label", "Play again");
    return;
  }
  aperture.hidden = true;
}

aperture.addEventListener("click", () => {
  if (!cameraStarted) {
    cameraStarted = true;
    unlockAudioContext();
    aperture.disabled = true;
    void pipeline.start().finally(() => {
      aperture.disabled = false;
      updateApertureVisibility();
    });
    return;
  }
  if (game.result !== null) {
    game = createInitialGameState();
    visualPunch = null;
    visualEvent = null;
    updateApertureVisibility();
  }
});

function resizeCanvas(): void {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function toGloveVisual(point: PoseSample["leftWrist"] | undefined): GloveVisual | null {
  if (!point) return null;
  return { x: point.x, y: point.y, visible: point.visibility >= 0.5 };
}

let lastFrameTime = performance.now();

function loop(now: number): void {
  const dt = Math.min(100, now - lastFrameTime);
  lastFrameTime = now;

  let input: FrameInput = { advance: 0, guardActive: false, punches: [], trackingOk: false };
  let guardStrength = 0;
  let guardActive = false;
  let advance = 0;

  if (trackingOk && latestPose) {
    const movementReading = movement.update(latestPose);
    const guardReading = guard.update(latestPose, now);
    const punches: Side[] = [];
    if (leftPunch.update(latestPose, now) === "strike") punches.push("left");
    if (rightPunch.update(latestPose, now) === "strike") punches.push("right");
    input = { advance: movementReading.advance, guardActive: guardReading.active, punches, trackingOk: true };
    advance = movementReading.advance;
    guardActive = guardReading.active;
    guardStrength = guardReading.strength;
    if (punches.length > 0) {
      visualPunch = punches[0] ?? null;
      visualPunchUntil = now + 170;
    }
  }

  if (cameraStarted && game.result === null) {
    game = stepGameState(game, dt, input);
    if (game.lastEvent) {
      visualEvent = game.lastEvent;
      visualEventUntil = now + (game.lastEvent === "guardMiss" || game.lastEvent === "counterLanded" ? 190 : 120);
      playRoundEvent(game.lastEvent);
    }
    updateApertureVisibility();
  }

  if (now >= visualPunchUntil) visualPunch = null;
  if (now >= visualEventUntil) visualEvent = null;

  if (ctx) {
    renderStage(ctx, canvas.width, canvas.height, {
      game,
      guardActive,
      guardStrength,
      advance,
      visualPunch,
      visualEvent,
      leftGlove: toGloveVisual(latestPose?.leftWrist),
      rightGlove: toGloveVisual(latestPose?.rightWrist),
      assets,
      nowMs: now,
    });
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
