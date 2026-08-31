// Composition root: wires the camera pipeline, pose recognition trackers and
// a minimal landmark/glove diagnostic. The full playable game (renderer,
// game-state loop, audio cues) lands in the playable-commit stage; this file
// only proves the camera + recognition pipeline end-to-end.
import { unlockAudioContext } from "./src/audio.ts";
import {
  createGuardTracker,
  createMovementTracker,
  createPunchTracker,
  type PoseSample,
} from "./src/pose-rules.ts";
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

function onStateChange(state: CameraState): void {
  status.textContent = STATUS_COPY[state];
  if (state === "tracking") {
    aperture.hidden = true;
  } else if (state !== "lost") {
    aperture.hidden = false;
  }
}

function onPose(sample: PoseSample | null): void {
  latestPose = sample;
}

const pipeline = createVisionPipeline({ video, onStateChange, onPose });

aperture.addEventListener("click", () => {
  unlockAudioContext();
  aperture.disabled = true;
  void pipeline.start().finally(() => {
    aperture.disabled = false;
  });
});

function resizeCanvas(): void {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function drawGlove(point: { x: number; y: number; visibility: number }, active: boolean): void {
  if (!ctx) return;
  const x = point.x * canvas.width;
  const y = point.y * canvas.height;
  const radius = Math.max(canvas.width, canvas.height) * 0.02;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = active ? "#5be2ff" : point.visibility < 0.5 ? "rgba(207, 232, 255, 0.3)" : "#cfe8ff";
  if (point.visibility < 0.5) ctx.setLineDash([3, 4]);
  else ctx.setLineDash([]);
  ctx.stroke();
}

function draw(): void {
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (latestPose) {
    const now = performance.now();
    movement.update(latestPose);
    const guardReading = guard.update(latestPose, now);
    leftPunch.update(latestPose, now);
    rightPunch.update(latestPose, now);
    drawGlove(latestPose.leftWrist, guardReading.active);
    drawGlove(latestPose.rightWrist, guardReading.active);
  }
  requestAnimationFrame(draw);
}

requestAnimationFrame(draw);
