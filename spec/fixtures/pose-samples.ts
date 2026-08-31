// Synthetic landmark sequences shaped like MediaPipe Pose Landmarker output,
// standing in for camera-recorded fixtures until the camera commit lands and
// real captured sequences can replace them.
import type { LandmarkPoint, PoseSample } from "../../src/pose-rules.ts";

export function point(x: number, y: number, visibility = 1): LandmarkPoint {
  return { x, y, visibility };
}

// Neutral standing pose, hands up near the chest, shoulder width == 0.2.
export function basePose(overrides: Partial<PoseSample> = {}, timestampMs = 0): PoseSample {
  return {
    timestampMs,
    leftShoulder: point(0.4, 0.3),
    rightShoulder: point(0.6, 0.3),
    leftHip: point(0.42, 0.55),
    rightHip: point(0.58, 0.55),
    leftElbow: point(0.38, 0.4),
    rightElbow: point(0.62, 0.4),
    leftWrist: point(0.42, 0.32),
    rightWrist: point(0.58, 0.32),
    ...overrides,
  };
}

export function guardPose(timestampMs: number): PoseSample {
  return basePose(
    {
      leftWrist: point(0.485, 0.28),
      rightWrist: point(0.515, 0.28),
    },
    timestampMs,
  );
}

export function apartPose(timestampMs: number): PoseSample {
  return basePose({}, timestampMs);
}

export function rightPunchReadyPose(timestampMs: number): PoseSample {
  return basePose({}, timestampMs);
}

export function rightPunchExtendedPose(timestampMs: number): PoseSample {
  return basePose(
    {
      rightElbow: point(0.72, 0.3),
      rightWrist: point(0.85, 0.28),
    },
    timestampMs,
  );
}

export function leftPunchExtendedPose(timestampMs: number): PoseSample {
  return basePose(
    {
      leftElbow: point(0.28, 0.3),
      leftWrist: point(0.15, 0.28),
    },
    timestampMs,
  );
}

export function leanPose(offset: number, timestampMs: number): PoseSample {
  return basePose(
    {
      leftShoulder: point(0.4 + offset, 0.3),
      rightShoulder: point(0.6 + offset, 0.3),
      leftHip: point(0.42 + offset, 0.55),
      rightHip: point(0.58 + offset, 0.55),
      leftWrist: point(0.42 + offset, 0.32),
      rightWrist: point(0.58 + offset, 0.32),
    },
    timestampMs,
  );
}
