// Camera lifecycle, MediaPipe worker messaging and the mirrored-landmark
// mapping into pose-rules.ts's PoseSample. This is the impure boundary: it
// owns getUserMedia, the video element, the worker and browser visibility —
// everything pose-rules.ts and game-state.ts stay decoupled from.
import { hasReliableTracking, type PoseSample } from "./pose-rules.ts";

export type CameraState =
  | "idle"
  | "requestingCamera"
  | "loadingModel"
  | "tracking"
  | "lost"
  | "cameraDenied"
  | "cameraError"
  | "modelError"
  | "streamEnded";

export interface RawLandmark {
  readonly x: number;
  readonly y: number;
  readonly visibility: number;
}

interface FrameMessage {
  readonly type: "frame";
  readonly bitmap: ImageBitmap;
  readonly timestampMs: number;
}

type WorkerResponse =
  | { readonly type: "ready" }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "result"; readonly landmarks: RawLandmark[] | null; readonly timestampMs: number };

// Pinned to the installed @mediapipe/tasks-vision version — never "latest".
export const WASM_BASE_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
export const POSE_MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const FRAME_INTERVAL_MS = 40; // ~25 inference updates per second

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_ELBOW = 13;
const RIGHT_ELBOW = 14;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

function mirror(landmark: RawLandmark): { x: number; y: number; visibility: number } {
  return { x: 1 - landmark.x, y: landmark.y, visibility: landmark.visibility };
}

// MediaPipe names each landmark by the subject's own anatomical side, so
// flipping x turns the raw "video call" view into a natural mirror without
// ever swapping which index is which hand.
export function mapLandmarksToPoseSample(
  landmarks: readonly RawLandmark[] | null,
  timestampMs: number,
): PoseSample | null {
  if (!landmarks || landmarks.length <= RIGHT_HIP) return null;
  return {
    timestampMs,
    leftShoulder: mirror(landmarks[LEFT_SHOULDER]),
    rightShoulder: mirror(landmarks[RIGHT_SHOULDER]),
    leftElbow: mirror(landmarks[LEFT_ELBOW]),
    rightElbow: mirror(landmarks[RIGHT_ELBOW]),
    leftWrist: mirror(landmarks[LEFT_WRIST]),
    rightWrist: mirror(landmarks[RIGHT_WRIST]),
    leftHip: mirror(landmarks[LEFT_HIP]),
    rightHip: mirror(landmarks[RIGHT_HIP]),
  };
}

export interface VisionPipelineOptions {
  readonly video: HTMLVideoElement;
  readonly onStateChange: (state: CameraState) => void;
  readonly onPose: (sample: PoseSample | null) => void;
}

export interface VisionPipeline {
  start(): Promise<void>;
  stop(): void;
}

export function createVisionPipeline(options: VisionPipelineOptions): VisionPipeline {
  const { video, onStateChange, onPose } = options;
  let stream: MediaStream | null = null;
  let worker: Worker | null = null;
  let frameTimer: ReturnType<typeof setInterval> | null = null;
  let modelReady = false;
  let awaitingResult = false;
  let stopped = false;

  function pauseFrameLoop(): void {
    if (frameTimer !== null) {
      clearInterval(frameTimer);
      frameTimer = null;
    }
  }

  function resumeFrameLoop(): void {
    if (frameTimer !== null || stopped) return;
    frameTimer = setInterval(captureFrame, FRAME_INTERVAL_MS);
  }

  function handleVisibilityChange(): void {
    if (document.hidden) {
      pauseFrameLoop();
      onStateChange("lost");
      onPose(null);
    } else if (!stopped && modelReady) {
      resumeFrameLoop();
    }
  }

  function handleTrackEnded(): void {
    if (stopped) return;
    onStateChange("streamEnded");
    onPose(null);
    stop();
  }

  function captureFrame(): void {
    if (awaitingResult || !worker || video.readyState < 2 || video.videoWidth === 0) return;
    awaitingResult = true;
    const timestampMs = performance.now();
    createImageBitmap(video)
      .then((bitmap) => {
        const message: FrameMessage = { type: "frame", bitmap, timestampMs };
        worker?.postMessage(message, [bitmap]);
      })
      .catch(() => {
        awaitingResult = false;
      });
  }

  function handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
    const message = event.data;
    if (message.type === "ready") {
      modelReady = true;
      resumeFrameLoop();
      return;
    }
    if (message.type === "error") {
      onStateChange("modelError");
      return;
    }
    awaitingResult = false;
    const sample = mapLandmarksToPoseSample(message.landmarks, message.timestampMs);
    onPose(sample);
    onStateChange(sample && hasReliableTracking(sample) ? "tracking" : "lost");
  }

  async function start(): Promise<void> {
    stopped = false;
    onStateChange("requestingCamera");
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    } catch {
      onStateChange("cameraDenied");
      return;
    }

    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      onStateChange("cameraError");
      stop();
      return;
    }

    stream.getVideoTracks()[0]?.addEventListener("ended", handleTrackEnded);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    onStateChange("loadingModel");
    worker = new Worker(new URL("./pose-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = handleWorkerMessage;
    worker.onerror = () => onStateChange("modelError");
  }

  function stop(): void {
    stopped = true;
    pauseFrameLoop();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    worker?.terminate();
    worker = null;
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    video.srcObject = null;
  }

  return { start, stop };
}
