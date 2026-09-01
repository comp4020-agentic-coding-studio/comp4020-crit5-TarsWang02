// Pure round reducer: timers, win/loss, attack and counter windows. No DOM,
// canvas, audio or pose/camera imports — main.ts feeds it FrameInput each
// tick and reacts to the resulting GameState and lastEvent.
import type { Side } from "./types.ts";

export const ROUND_DURATION_MS = 90_000;
export const HITS_TO_LOSE = 3;
export const COUNTERS_TO_WIN = 8;

const SETTLE_DURATION_MS = 650;
const BASE_TELEGRAPH_DURATION_MS = 1050;
const MIN_TELEGRAPH_DURATION_MS = 550;
const TELEGRAPH_STEP_MS = 60;
export const LUNGE_IMPACT_WINDOW_MS = 340;
const BASE_OPENING_DURATION_MS = 1700;
const MIN_OPENING_DURATION_MS = 800;
const OPENING_STEP_MS = 80;

// Player world position: 0 = fully engaged at the front boundary, 1 = fully
// retreated to the rear boundary. Counters only land at or inside this
// position, so retreating to stall the clock costs the ability to score.
export const PUNCH_RANGE_MAX = 0.5;
const MOVE_SPEED_PER_MS = 0.00045;

export type RoundPhase = "settle" | "telegraph" | "lunge" | "opening" | "roundOver";
export type RoundResult = "win" | "loss";

export type RoundEvent =
  | "guardSuccess"
  | "guardMiss"
  | "counterLanded"
  | "punchRejectedGuarded"
  | "punchRejectedWrongSide"
  | "punchRejectedOutOfRange"
  | "roundWin"
  | "roundLoss"
  | null;

export interface GameState {
  readonly phase: RoundPhase;
  readonly calibrated: boolean;
  readonly clockMs: number;
  readonly exchangeIndex: number;
  readonly phaseElapsedMs: number;
  readonly guardedDuringLunge: boolean;
  readonly playerPosition: number;
  readonly playerHits: number;
  readonly counters: number;
  readonly openSide: Side | null;
  readonly result: RoundResult | null;
  readonly trackingPaused: boolean;
  readonly lastEvent: RoundEvent;
}

export interface FrameInput {
  readonly advance: number; // -1..1 from the movement tracker, positive = advance
  readonly guardActive: boolean;
  readonly punches: readonly Side[];
  readonly trackingOk: boolean;
}

export function createInitialGameState(): GameState {
  return {
    phase: "settle",
    calibrated: false,
    clockMs: ROUND_DURATION_MS,
    exchangeIndex: 0,
    phaseElapsedMs: 0,
    guardedDuringLunge: false,
    playerPosition: 0.4,
    playerHits: 0,
    counters: 0,
    openSide: null,
    result: null,
    trackingPaused: false,
    lastEvent: null,
  };
}

export function telegraphDurationFor(exchangeIndex: number): number {
  return Math.max(MIN_TELEGRAPH_DURATION_MS, BASE_TELEGRAPH_DURATION_MS - exchangeIndex * TELEGRAPH_STEP_MS);
}

export function openingDurationFor(exchangeIndex: number): number {
  return Math.max(MIN_OPENING_DURATION_MS, BASE_OPENING_DURATION_MS - exchangeIndex * OPENING_STEP_MS);
}

// Alternates for the first few exchanges so the pattern is learnable, then
// varies with a fixed pseudo-random walk (not Math.random) so replays and
// tests stay deterministic.
export function openingSideFor(exchangeIndex: number): Side {
  if (exchangeIndex < 3) return exchangeIndex % 2 === 0 ? "left" : "right";
  const pseudoRandom = Math.sin(exchangeIndex * 12.9898) * 43758.5453;
  return pseudoRandom - Math.floor(pseudoRandom) < 0.5 ? "left" : "right";
}

export function stepGameState(state: GameState, dt: number, input: FrameInput): GameState {
  if (state.phase === "roundOver") return { ...state, lastEvent: null };

  // Tracking loss must never cost health or burn the clock.
  if (!input.trackingOk) return { ...state, trackingPaused: true, lastEvent: null };

  let next: GameState = { ...state, trackingPaused: false, lastEvent: null };

  next = { ...next, clockMs: Math.max(0, next.clockMs - dt) };
  next = {
    ...next,
    playerPosition: Math.min(1, Math.max(0, next.playerPosition - input.advance * MOVE_SPEED_PER_MS * dt)),
  };
  next = { ...next, phaseElapsedMs: next.phaseElapsedMs + dt };

  if (next.phase === "lunge" && input.guardActive && !next.guardedDuringLunge) {
    next = { ...next, guardedDuringLunge: true };
  }

  // A punch resolves within the same tick it arrives, pre-empting the
  // opening phase's own timeout below.
  if (input.punches.length > 0) {
    if (next.phase !== "opening") {
      next = { ...next, lastEvent: "punchRejectedGuarded" };
    } else if (next.playerPosition > PUNCH_RANGE_MAX) {
      next = { ...next, lastEvent: "punchRejectedOutOfRange" };
    } else {
      const matching = input.punches.find((side) => side === next.openSide);
      if (!matching) {
        next = { ...next, lastEvent: "punchRejectedWrongSide" };
      } else {
        const counters = next.counters + 1;
        next =
          counters >= COUNTERS_TO_WIN
            ? { ...next, phase: "roundOver", result: "win", counters, openSide: null, lastEvent: "roundWin" }
            : {
                ...next,
                phase: "settle",
                phaseElapsedMs: 0,
                exchangeIndex: next.exchangeIndex + 1,
                counters,
                openSide: null,
                lastEvent: "counterLanded",
              };
      }
    }
  }

  switch (next.phase) {
    case "settle": {
      if (next.phaseElapsedMs >= SETTLE_DURATION_MS) {
        next = { ...next, phase: "telegraph", phaseElapsedMs: 0 };
      }
      break;
    }
    case "telegraph": {
      if (next.phaseElapsedMs >= telegraphDurationFor(next.exchangeIndex)) {
        next = { ...next, phase: "lunge", phaseElapsedMs: 0, guardedDuringLunge: false };
      }
      break;
    }
    case "lunge": {
      if (next.phaseElapsedMs >= LUNGE_IMPACT_WINDOW_MS) {
        if (next.guardedDuringLunge) {
          next = {
            ...next,
            phase: "opening",
            phaseElapsedMs: 0,
            calibrated: true,
            openSide: openingSideFor(next.exchangeIndex),
            lastEvent: "guardSuccess",
          };
        } else if (!next.calibrated) {
          // The calibration exchange repeats for free until the player finds
          // the guard gesture; only calibrated exchanges cost a hit.
          next = { ...next, phase: "settle", phaseElapsedMs: 0 };
        } else {
          const playerHits = next.playerHits + 1;
          next =
            playerHits >= HITS_TO_LOSE
              ? { ...next, phase: "roundOver", result: "loss", playerHits, lastEvent: "roundLoss" }
              : {
                  ...next,
                  phase: "settle",
                  phaseElapsedMs: 0,
                  exchangeIndex: next.exchangeIndex + 1,
                  playerHits,
                  lastEvent: "guardMiss",
                };
        }
      }
      break;
    }
    case "opening": {
      if (next.phaseElapsedMs >= openingDurationFor(next.exchangeIndex)) {
        next = {
          ...next,
          phase: "settle",
          phaseElapsedMs: 0,
          exchangeIndex: next.exchangeIndex + 1,
          openSide: null,
        };
      }
      break;
    }
  }

  if (next.clockMs <= 0 && next.phase !== "roundOver") {
    const win = next.counters >= COUNTERS_TO_WIN;
    next = { ...next, phase: "roundOver", result: win ? "win" : "loss", lastEvent: win ? "roundWin" : "roundLoss" };
  }

  return next;
}
