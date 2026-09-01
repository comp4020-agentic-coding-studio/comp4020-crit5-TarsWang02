import { describe, expect, it } from "vitest";
import {
  createGuardTracker,
  createMovementTracker,
  createPunchTracker,
  toPlayerLocalPoint,
} from "../src/pose-rules.ts";
import {
  apartPose,
  basePose,
  guardPose,
  leanPose,
  leftPunchExtendedPose,
  point,
  rightPunchExtendedPose,
  rightPunchReadyPose,
} from "./fixtures/pose-samples.ts";

describe("createMovementTracker", () => {
  it("produces zero movement for torso displacement inside the dead zone", () => {
    const tracker = createMovementTracker();
    tracker.update(leanPose(0, 0));
    // A shoulder-twist-sized wobble (well under the 0.10 shoulder-width dead
    // zone) must not register as movement.
    for (let i = 1; i <= 10; i++) {
      const reading = tracker.update(leanPose(i % 2 === 0 ? 0.01 : -0.01, i * 20));
      expect(reading.advance).toBe(0);
    }
  });

  it("reports a signed advance once displacement clears the dead zone", () => {
    const tracker = createMovementTracker();
    tracker.update(leanPose(0, 0));
    let reading = { advance: 0 };
    for (let i = 1; i <= 20; i++) {
      reading = tracker.update(leanPose(0.3, i * 20));
    }
    expect(reading.advance).toBeGreaterThan(0);
  });

  it("returns zero movement when tracking is unreliable", () => {
    const tracker = createMovementTracker();
    const lost = apartPose(0);
    const reading = tracker.update({
      ...lost,
      leftShoulder: { ...lost.leftShoulder, visibility: 0 },
    });
    expect(reading.advance).toBe(0);
  });
});

describe("createGuardTracker", () => {
  it("activates on hands-together, expires while still held, and needs a reset to re-arm", () => {
    const tracker = createGuardTracker();

    expect(tracker.update(apartPose(0), 0).active).toBe(false);

    const activated = tracker.update(guardPose(50), 50);
    expect(activated.active).toBe(true);
    expect(activated.strength).toBeGreaterThan(0.9);

    // Still held together, but past the ~700ms charge: must expire on its own.
    const expired = tracker.update(guardPose(800), 800);
    expect(expired.active).toBe(false);

    // Holding it together longer does not resurrect it.
    const stillExpired = tracker.update(guardPose(1200), 1200);
    expect(stillExpired.active).toBe(false);

    // Only separating past the reset threshold re-arms a new pulse.
    const separated = tracker.update(apartPose(1250), 1250);
    expect(separated.active).toBe(false);

    const reactivated = tracker.update(guardPose(1300), 1300);
    expect(reactivated.active).toBe(true);
  });

  it("does not activate on unreliable tracking", () => {
    const tracker = createGuardTracker();
    const pose = guardPose(0);
    const reading = tracker.update(
      { ...pose, leftWrist: { ...pose.leftWrist, visibility: 0 } },
      0,
    );
    expect(reading.active).toBe(false);
  });
});

describe("createPunchTracker", () => {
  it("emits a strike only once per extend-then-retract cycle", () => {
    const tracker = createPunchTracker("right");

    expect(tracker.update(rightPunchReadyPose(0), 0)).toBeNull();

    const first = tracker.update(rightPunchExtendedPose(80), 80);
    expect(first).toBe("strike");

    // Staying extended must not score again.
    const heldExtended = tracker.update(rightPunchExtendedPose(160), 160);
    expect(heldExtended).toBeNull();

    // Retract back to the ready zone before a new punch can count.
    expect(tracker.update(rightPunchReadyPose(240), 240)).toBeNull();

    const second = tracker.update(rightPunchExtendedPose(320), 320);
    expect(second).toBe("strike");
  });

  it("tracks left and right hands independently", () => {
    const left = createPunchTracker("left");
    const right = createPunchTracker("right");

    left.update(rightPunchReadyPose(0), 0);
    right.update(rightPunchReadyPose(0), 0);

    expect(right.update(rightPunchExtendedPose(80), 80)).toBe("strike");
    // The left tracker must not fire from the right hand's motion.
    expect(left.update(rightPunchExtendedPose(80), 80)).toBeNull();

    expect(left.update(leftPunchExtendedPose(160), 160)).toBe("strike");
  });
});

describe("toPlayerLocalPoint", () => {
  it("expresses a wrist as an offset from the shoulder midpoint in shoulder-width units", () => {
    // basePose: shoulders at (0.4, 0.3)/(0.6, 0.3) -> midpoint (0.5, 0.3),
    // shoulder width 0.2. Right wrist at (0.58, 0.32) is 0.4 widths right and
    // 0.1 widths below the shoulder line.
    const sample = basePose();
    const local = toPlayerLocalPoint(sample, sample.rightWrist);
    expect(local.offsetX).toBeCloseTo(0.4, 5);
    expect(local.offsetY).toBeCloseTo(0.1, 5);
    expect(local.visible).toBe(true);
  });

  it("is independent of where the player stands or how large they appear in frame", () => {
    // Same pose shifted and rescaled within the camera frame must yield the
    // same player-local offset — this is what lets the renderer place the
    // glove on the player's sprite instead of at a raw camera-frame fraction.
    // Both poses place the right wrist at the same (0.5, 0.3) shoulder-width
    // offset from the shoulder midpoint; only position and scale differ.
    const nearCorner = basePose({
      leftShoulder: point(0.05, 0.05),
      rightShoulder: point(0.15, 0.05),
      rightWrist: point(0.15, 0.08),
    });
    const centered = basePose({
      leftShoulder: point(0.4, 0.5),
      rightShoulder: point(0.6, 0.5),
      rightWrist: point(0.6, 0.56),
    });

    const a = toPlayerLocalPoint(nearCorner, nearCorner.rightWrist);
    const b = toPlayerLocalPoint(centered, centered.rightWrist);
    expect(a.offsetX).toBeCloseTo(b.offsetX, 5);
    expect(a.offsetY).toBeCloseTo(b.offsetY, 5);
  });

  it("reports not visible when the landmark itself has low confidence", () => {
    const sample = basePose();
    const local = toPlayerLocalPoint(sample, { ...sample.rightWrist, visibility: 0.1 });
    expect(local.visible).toBe(false);
  });

  it("reports not visible when shoulder tracking is unreliable, even if the wrist looks confident", () => {
    const sample = basePose({
      leftShoulder: point(0.4, 0.3, 0),
    });
    const local = toPlayerLocalPoint(sample, sample.rightWrist);
    expect(local.visible).toBe(false);
    expect(local.offsetX).toBe(0);
    expect(local.offsetY).toBe(0);
  });
});
