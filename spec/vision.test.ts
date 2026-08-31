import { describe, expect, it } from "vitest";
import { mapLandmarksToPoseSample, type RawLandmark } from "../src/vision.ts";

function landmarks(): RawLandmark[] {
  const points: RawLandmark[] = [];
  for (let i = 0; i < 25; i++) {
    points.push({ x: i / 100, y: i / 200, visibility: 1 });
  }
  return points;
}

describe("mapLandmarksToPoseSample", () => {
  it("mirrors x while preserving anatomical left/right identity", () => {
    const sample = mapLandmarksToPoseSample(landmarks(), 1234);
    expect(sample).not.toBeNull();
    // left shoulder is raw index 11, x = 0.11 -> mirrored 1 - 0.11
    expect(sample?.leftShoulder.x).toBeCloseTo(1 - 0.11);
    expect(sample?.rightShoulder.x).toBeCloseTo(1 - 0.12);
    expect(sample?.leftWrist.x).toBeCloseTo(1 - 0.15);
    expect(sample?.rightWrist.x).toBeCloseTo(1 - 0.16);
    // y is untouched by mirroring
    expect(sample?.leftShoulder.y).toBeCloseTo(11 / 200);
  });

  it("carries the timestamp through unchanged", () => {
    const sample = mapLandmarksToPoseSample(landmarks(), 4321);
    expect(sample?.timestampMs).toBe(4321);
  });

  it("returns null when landmarks are missing", () => {
    expect(mapLandmarksToPoseSample(null, 0)).toBeNull();
  });

  it("returns null when landmarks are too short to include a hip", () => {
    expect(mapLandmarksToPoseSample(landmarks().slice(0, 20), 0)).toBeNull();
  });
});
