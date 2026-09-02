// Composition root: wires the camera pipeline, pose recognition trackers,
// the pure round reducer and the placeholder renderer. No game rules live
// here — this file only turns pose readings into FrameInput, steps
// game-state.ts, and hands the result to renderer.ts each frame.
import { loadAssetSet, type AssetSet } from "./src/assets.ts";
import { playActionCue, playPhaseCue, playRoundEvent, unlockAudioContext } from "./src/audio.ts";
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
  toPlayerLocalPoint,
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
const simulationEnabled = new URLSearchParams(window.location.search).has("simulate");

const SIMULATION_COPY = "SIMULATION · A/D RANGE · J/K LEFT/RIGHT · SPACE GUARD · R RESTART";
const SIMULATION_GUARD_DURATION_MS = 700;
const simulationKeys = new Set<string>();
let simulationPunches: Side[] = [];
let simulationGuardUntil = 0;
let simulationGuardArmed = true;

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
let guardWasActive = false;
let hitStopUntil = 0;

void loadAssetSet().then((loaded) => {
  assets = loaded;
});

const CAMERA_FAILURE_STATES = new Set<CameraState>(["cameraDenied", "cameraError", "modelError", "streamEnded"]);

function onStateChange(state: CameraState): void {
  status.textContent = STATUS_COPY[state];
  trackingOk = state === "tracking";
  // A failed start must not strand the player behind a hidden aperture with
  // no way to retry — cameraStarted only means "camera actually running".
  if (CAMERA_FAILURE_STATES.has(state)) cameraStarted = false;
  updateApertureVisibility();
}

function onPose(sample: PoseSample | null): void {
  latestPose = sample;
}

const pipeline = createVisionPipeline({ video, onStateChange, onPose });

if (simulationEnabled) {
  status.textContent = "CAMERA BYPASS · CLICK TO BEGIN KEYBOARD SIMULATION";
  status.classList.add("simulation-status");
}

function updateApertureVisibility(): void {
  if (!cameraStarted) {
    aperture.hidden = false;
    aperture.setAttribute("aria-label", simulationEnabled ? "Begin keyboard simulation" : "Activate camera and begin");
    return;
  }
  if (game.result !== null) {
    aperture.hidden = false;
    aperture.setAttribute("aria-label", "Play again");
    return;
  }
  aperture.hidden = true;
}

updateApertureVisibility();

aperture.addEventListener("click", () => {
  if (!cameraStarted) {
    cameraStarted = true;
    unlockAudioContext();
    if (simulationEnabled) {
      trackingOk = true;
      status.textContent = SIMULATION_COPY;
      updateApertureVisibility();
      return;
    }
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

const SIMULATION_CODES = new Set(["KeyA", "KeyD", "KeyJ", "KeyK", "Space", "KeyR"]);

window.addEventListener("keydown", (event) => {
  if (!simulationEnabled || !SIMULATION_CODES.has(event.code)) return;
  event.preventDefault();
  simulationKeys.add(event.code);
  if (!cameraStarted || event.repeat) return;

  if (event.code === "KeyJ") simulationPunches.push("left");
  if (event.code === "KeyK") simulationPunches.push("right");
  if (event.code === "Space" && simulationGuardArmed && performance.now() >= simulationGuardUntil) {
    simulationGuardUntil = performance.now() + SIMULATION_GUARD_DURATION_MS;
    simulationGuardArmed = false;
  }
  if (event.code === "KeyR") {
    game = createInitialGameState();
    simulationPunches = [];
    visualPunch = null;
    visualEvent = null;
    updateApertureVisibility();
  }
});

window.addEventListener("keyup", (event) => {
  if (!simulationEnabled || !SIMULATION_CODES.has(event.code)) return;
  event.preventDefault();
  simulationKeys.delete(event.code);
  if (event.code === "Space") simulationGuardArmed = true;
});

function resizeCanvas(): void {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function toGloveVisual(sample: PoseSample | null, point: PoseSample["leftWrist"] | undefined): GloveVisual | null {
  if (!sample || !point) return null;
  const local = toPlayerLocalPoint(sample, point);
  return { offsetX: local.offsetX, offsetY: local.offsetY, visible: local.visible };
}

let lastFrameTime = performance.now();

function loop(now: number): void {
  const dt = Math.min(100, now - lastFrameTime);
  lastFrameTime = now;

  let input: FrameInput = { advance: 0, guardActive: false, punches: [], trackingOk: false };
  let guardStrength = 0;
  let guardActive = false;
  let advance = 0;
  let leftGlove = toGloveVisual(latestPose, latestPose?.leftWrist);
  let rightGlove = toGloveVisual(latestPose, latestPose?.rightWrist);

  if (simulationEnabled && cameraStarted) {
    advance = Number(simulationKeys.has("KeyD")) - Number(simulationKeys.has("KeyA"));
    guardActive = now < simulationGuardUntil;
    guardStrength = guardActive ? Math.max(0, (simulationGuardUntil - now) / SIMULATION_GUARD_DURATION_MS) : 0;
    const punches = simulationPunches.splice(0);
    input = { advance, guardActive, punches, trackingOk: true };
    const guardingOffset = guardActive ? 0.14 : 0.42;
    leftGlove = { offsetX: -guardingOffset, offsetY: 0.08, visible: true };
    rightGlove = { offsetX: guardingOffset, offsetY: 0.08, visible: true };
    if (punches.length > 0) {
      visualPunch = punches[0] ?? null;
      visualPunchUntil = now + 170;
    }
  } else if (trackingOk && latestPose) {
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

  for (const punch of input.punches) playActionCue(punch === "left" ? "leftPunch" : "rightPunch");
  if (guardActive && !guardWasActive) playActionCue("guard");
  guardWasActive = guardActive;

  if (cameraStarted && game.result === null) {
    const previousPhase = game.phase;
    game = stepGameState(game, now < hitStopUntil ? 0 : dt, input);
    if (game.phase !== previousPhase && (game.phase === "telegraph" || game.phase === "lunge" || game.phase === "opening")) {
      playPhaseCue(game.phase);
    }
    if (game.lastEvent) {
      visualEvent = game.lastEvent;
      const heavyImpact = game.lastEvent === "guardMiss" || game.lastEvent === "counterLanded";
      visualEventUntil = now + (heavyImpact ? 210 : 140);
      if (heavyImpact) hitStopUntil = now + (game.lastEvent === "counterLanded" ? 68 : 54);
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
      leftGlove,
      rightGlove,
      assets,
      nowMs: now,
    });
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
