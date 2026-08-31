// Pure normalized-landmark geometry and recognition state machines for
// movement, guard and punches. No DOM, canvas, camera or MediaPipe imports —
// vision.ts is responsible for turning raw model output into PoseSample
// values already mirrored so screen-left matches the player's anatomical
// left hand.
import type { Side } from "./types.ts";

export interface LandmarkPoint {
  readonly x: number;
  readonly y: number;
  readonly visibility: number;
}

export interface PoseSample {
  readonly timestampMs: number;
  readonly leftShoulder: LandmarkPoint;
  readonly rightShoulder: LandmarkPoint;
  readonly leftHip: LandmarkPoint;
  readonly rightHip: LandmarkPoint;
  readonly leftElbow: LandmarkPoint;
  readonly rightElbow: LandmarkPoint;
  readonly leftWrist: LandmarkPoint;
  readonly rightWrist: LandmarkPoint;
}

const MIN_VISIBILITY = 0.5;

function isVisible(p: LandmarkPoint): boolean {
  return p.visibility >= MIN_VISIBILITY;
}

function dist(a: LandmarkPoint, b: LandmarkPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: LandmarkPoint, b: LandmarkPoint): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function shoulderWidth(sample: PoseSample): number {
  return dist(sample.leftShoulder, sample.rightShoulder);
}

export function hasReliableTracking(sample: PoseSample): boolean {
  return (
    isVisible(sample.leftShoulder) &&
    isVisible(sample.rightShoulder) &&
    shoulderWidth(sample) > 0.01
  );
}

// --- Movement -------------------------------------------------------------

const MOVEMENT_DEAD_ZONE = 0.1; // shoulder widths
const MOVEMENT_CLAMP = 0.4; // shoulder widths
const TORSO_SMOOTHING_MS = 150;
const IDLE_RECENTER_RATE = 0.02; // fraction of drift absorbed per idle update

export interface MovementReading {
  readonly advance: number; // -1 (retreat) .. 1 (advance), 0 inside the dead zone
}

export function createMovementTracker() {
  let neutralX: number | null = null;
  let smoothedX: number | null = null;
  let lastTimestampMs: number | null = null;

  function torsoX(sample: PoseSample): number {
    const shoulderMid = midpoint(sample.leftShoulder, sample.rightShoulder);
    if (isVisible(sample.leftHip) && isVisible(sample.rightHip)) {
      const hipMid = midpoint(sample.leftHip, sample.rightHip);
      return (shoulderMid.x + hipMid.x) / 2;
    }
    return shoulderMid.x;
  }

  return {
    update(sample: PoseSample): MovementReading {
      if (!hasReliableTracking(sample)) return { advance: 0 };

      const width = shoulderWidth(sample);
      const x = torsoX(sample);
      const dt = lastTimestampMs === null ? 0 : sample.timestampMs - lastTimestampMs;
      lastTimestampMs = sample.timestampMs;

      smoothedX ??= x;
      const alpha = dt <= 0 ? 1 : Math.min(1, dt / TORSO_SMOOTHING_MS);
      smoothedX = smoothedX + (x - smoothedX) * alpha;

      neutralX ??= smoothedX;

      const displacement = (smoothedX - neutralX) / width;
      const magnitude = Math.abs(displacement);

      if (magnitude < MOVEMENT_DEAD_ZONE) {
        // Only re-centre while idle so an active lean is never chased away.
        neutralX = neutralX + (smoothedX - neutralX) * IDLE_RECENTER_RATE;
        return { advance: 0 };
      }

      const clamped = Math.min(magnitude, MOVEMENT_CLAMP);
      const scaled = (clamped - MOVEMENT_DEAD_ZONE) / (MOVEMENT_CLAMP - MOVEMENT_DEAD_ZONE);
      return { advance: Math.sign(displacement) * scaled };
    },
  };
}

// --- Guard ------------------------------------------------------------------

const GUARD_CLOSE_THRESHOLD = 0.35; // shoulder widths between wrists to form guard
const GUARD_RESET_THRESHOLD = 0.6; // shoulder widths apart required before re-arming
const GUARD_ACTIVE_DURATION_MS = 700;
const GUARD_ZONE_VERTICAL_MIN = -1.2; // shoulder widths above the shoulder line
const GUARD_ZONE_VERTICAL_MAX = 0.6; // shoulder widths below the shoulder line
const GUARD_ZONE_HORIZONTAL_MAX = 0.8; // shoulder widths either side of centre

export interface GuardReading {
  readonly active: boolean;
  readonly strength: number; // 0..1 remaining charge while active
}

export function createGuardTracker() {
  let armed = true;
  let activatedAt: number | null = null;

  function inGuardZone(sample: PoseSample, width: number): boolean {
    const mid = midpoint(sample.leftWrist, sample.rightWrist);
    const shoulderMid = midpoint(sample.leftShoulder, sample.rightShoulder);
    const vertical = (mid.y - shoulderMid.y) / width;
    const horizontal = Math.abs(mid.x - shoulderMid.x) / width;
    return (
      vertical > GUARD_ZONE_VERTICAL_MIN &&
      vertical < GUARD_ZONE_VERTICAL_MAX &&
      horizontal < GUARD_ZONE_HORIZONTAL_MAX
    );
  }

  return {
    update(sample: PoseSample, now: number): GuardReading {
      const wristsVisible = isVisible(sample.leftWrist) && isVisible(sample.rightWrist);
      if (!hasReliableTracking(sample) || !wristsVisible) {
        return { active: false, strength: 0 };
      }

      const width = shoulderWidth(sample);
      const distNorm = dist(sample.leftWrist, sample.rightWrist) / width;

      if (activatedAt !== null && now - activatedAt >= GUARD_ACTIVE_DURATION_MS) {
        activatedAt = null;
      }

      if (distNorm > GUARD_RESET_THRESHOLD) {
        armed = true;
      }

      if (
        activatedAt === null &&
        armed &&
        distNorm <= GUARD_CLOSE_THRESHOLD &&
        inGuardZone(sample, width)
      ) {
        activatedAt = now;
        armed = false;
      }

      if (activatedAt === null) return { active: false, strength: 0 };
      const elapsed = now - activatedAt;
      return { active: true, strength: Math.max(0, 1 - elapsed / GUARD_ACTIVE_DURATION_MS) };
    },
  };
}

// --- Punches ----------------------------------------------------------------

const PUNCH_READY_MAX_REACH = 0.55; // shoulder widths, shoulder-to-wrist
const PUNCH_STRIKE_MIN_REACH = 1.0;
const PUNCH_MIN_EXTENSION = 0.75; // 0 (folded) .. 1 (straight elbow)
const PUNCH_MIN_OUTWARD_VELOCITY = 3; // shoulder widths / second
const PUNCH_TARGET_MIN_OFFSET = 0.6; // shoulder widths off centre, same side as the hand

export type PunchOutcome = "strike" | null;

export function createPunchTracker(side: Side) {
  let state: "ready" | "extended" = "ready";
  let lastReach: number | null = null;
  let lastTimestampMs: number | null = null;

  const wristOf = (s: PoseSample): LandmarkPoint => (side === "left" ? s.leftWrist : s.rightWrist);
  const elbowOf = (s: PoseSample): LandmarkPoint => (side === "left" ? s.leftElbow : s.rightElbow);
  const shoulderOf = (s: PoseSample): LandmarkPoint =>
    side === "left" ? s.leftShoulder : s.rightShoulder;

  function elbowExtension(sample: PoseSample): number {
    const s = shoulderOf(sample);
    const e = elbowOf(sample);
    const w = wristOf(sample);
    const v1 = { x: s.x - e.x, y: s.y - e.y };
    const v2 = { x: w.x - e.x, y: w.y - e.y };
    const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
    if (mag === 0) return 0;
    const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / mag));
    return Math.acos(cos) / Math.PI;
  }

  function inTargetZone(sample: PoseSample, width: number): boolean {
    const wrist = wristOf(sample);
    const shoulderMidX = (sample.leftShoulder.x + sample.rightShoulder.x) / 2;
    const offset = (wrist.x - shoulderMidX) / width;
    return side === "left" ? offset < -PUNCH_TARGET_MIN_OFFSET : offset > PUNCH_TARGET_MIN_OFFSET;
  }

  return {
    update(sample: PoseSample, now: number): PunchOutcome {
      const wrist = wristOf(sample);
      const elbow = elbowOf(sample);
      if (!hasReliableTracking(sample) || !isVisible(wrist) || !isVisible(elbow)) {
        return null;
      }

      const width = shoulderWidth(sample);
      const reach = dist(shoulderOf(sample), wrist) / width;
      const dt = lastTimestampMs === null ? 0 : now - lastTimestampMs;
      const velocity = lastReach === null || dt <= 0 ? 0 : (reach - lastReach) / (dt / 1000);
      lastReach = reach;
      lastTimestampMs = now;

      if (state === "extended") {
        if (reach <= PUNCH_READY_MAX_REACH) state = "ready";
        return null;
      }

      if (
        reach >= PUNCH_STRIKE_MIN_REACH &&
        elbowExtension(sample) >= PUNCH_MIN_EXTENSION &&
        velocity >= PUNCH_MIN_OUTWARD_VELOCITY &&
        inTargetZone(sample, width)
      ) {
        state = "extended";
        return "strike";
      }
      return null;
    },
  };
}
