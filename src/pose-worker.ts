// Runs pose inference off the render loop. Receives transferred ImageBitmap
// frames from the main thread and posts back plain landmark data (never the
// frame itself) so no camera imagery leaves this worker.
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { POSE_MODEL_PATH, WASM_BASE_PATH, type RawLandmark } from "./vision.ts";

interface FrameMessage {
  readonly type: "frame";
  readonly bitmap: ImageBitmap;
  readonly timestampMs: number;
}

type WorkerResponse =
  | { readonly type: "ready" }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "result"; readonly landmarks: RawLandmark[] | null; readonly timestampMs: number };

let landmarker: PoseLandmarker | null = null;

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

async function init(): Promise<void> {
  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);
    landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_MODEL_PATH, delegate: "CPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    post({ type: "ready" });
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
}

self.onmessage = (event: MessageEvent<FrameMessage>) => {
  const { data } = event;
  if (data.type !== "frame") return;

  if (!landmarker) {
    data.bitmap.close();
    return;
  }

  try {
    const result = landmarker.detectForVideo(data.bitmap, data.timestampMs);
    const landmarks = result.landmarks[0]
      ? result.landmarks[0].map((p) => ({ x: p.x, y: p.y, visibility: p.visibility }))
      : null;
    post({ type: "result", landmarks, timestampMs: data.timestampMs });
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  } finally {
    data.bitmap.close();
  }
};

void init();
