import { describe, expect, it } from "vitest";
import {
  COUNTERS_TO_WIN,
  HITS_TO_LOSE,
  ROUND_DURATION_MS,
  createInitialGameState,
  stepGameState,
  type FrameInput,
  type GameState,
} from "../src/game-state.ts";

const idleInput: FrameInput = { advance: 0, guardActive: false, punches: [], trackingOk: true };

function tick(state: GameState, dt: number, input: Partial<FrameInput> = {}): GameState {
  return stepGameState(state, dt, { ...idleInput, ...input });
}

function runFor(
  state: GameState,
  totalMs: number,
  input: Partial<FrameInput> = {},
  stepMs = 16,
): GameState {
  let s = state;
  let elapsed = 0;
  while (elapsed < totalMs && s.phase !== "roundOver") {
    s = tick(s, stepMs, input);
    elapsed += stepMs;
  }
  return s;
}

// Holds guard through settle -> telegraph -> lunge until the opening begins
// (or gives up after a generous number of ticks so a bug can't hang a test).
function guardThroughOneLunge(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 500 && s.phase !== "opening" && s.phase !== "roundOver"; i++) {
    s = tick(s, 16, { guardActive: true });
  }
  return s;
}

describe("stepGameState", () => {
  it("always reaches a win or loss within the 90s round limit, even for a player who never engages", () => {
    const s = runFor(createInitialGameState(), ROUND_DURATION_MS + 5_000);
    expect(s.phase).toBe("roundOver");
    expect(s.result).toBe("loss");
  });

  it("repeats a missed calibration guard for free instead of costing a hit", () => {
    const s = runFor(createInitialGameState(), 5_000); // never guards
    expect(s.calibrated).toBe(false);
    expect(s.playerHits).toBe(0);
    expect(s.phase).not.toBe("roundOver");
  });

  it("loses the round after exactly three accepted hits, once calibrated", () => {
    let s = guardThroughOneLunge(createInitialGameState());
    expect(s.calibrated).toBe(true);
    expect(s.playerHits).toBe(0);

    for (let i = 0; i < HITS_TO_LOSE && s.phase !== "roundOver"; i++) {
      s = runFor(s, 5_000); // idle input: settle -> telegraph -> lunge -> miss
    }

    expect(s.phase).toBe("roundOver");
    expect(s.result).toBe("loss");
    expect(s.playerHits).toBe(HITS_TO_LOSE);
  });

  it("only lets the matching, retracted-and-rethrown hand damage the open side", () => {
    const opened = guardThroughOneLunge(createInitialGameState());
    expect(opened.phase).toBe("opening");
    const wrongSide = opened.openSide === "left" ? "right" : "left";

    const afterWrong = tick(opened, 16, { punches: [wrongSide] });
    expect(afterWrong.lastEvent).toBe("punchRejectedWrongSide");
    expect(afterWrong.counters).toBe(0);
    expect(afterWrong.phase).toBe("opening");

    const afterRight = tick(afterWrong, 16, { punches: [opened.openSide!] });
    expect(afterRight.lastEvent).toBe("counterLanded");
    expect(afterRight.counters).toBe(1);
  });

  it("wins after eight clean counters", () => {
    let s = createInitialGameState();
    for (let i = 0; i < COUNTERS_TO_WIN; i++) {
      s = guardThroughOneLunge(s);
      expect(s.phase).toBe("opening");
      s = tick(s, 16, { punches: [s.openSide!] });
    }
    expect(s.phase).toBe("roundOver");
    expect(s.result).toBe("win");
    expect(s.counters).toBe(COUNTERS_TO_WIN);
  });

  it("rejects a counter thrown while the player has retreated out of range", () => {
    let s = guardThroughOneLunge(createInitialGameState());
    expect(s.phase).toBe("opening");
    for (let i = 0; i < 60; i++) s = tick(s, 16, { advance: -1 });
    expect(s.playerPosition).toBeGreaterThan(0.5);
    expect(s.phase).toBe("opening");

    const result = tick(s, 16, { punches: [s.openSide!] });
    expect(result.lastEvent).toBe("punchRejectedOutOfRange");
    expect(result.counters).toBe(0);
  });

  it("rejects a punch thrown while the opponent's guard is up (not in the opening window)", () => {
    const s = tick(createInitialGameState(), 16, { punches: ["left"] });
    expect(s.lastEvent).toBe("punchRejectedGuarded");
    expect(s.counters).toBe(0);
  });

  it("pauses time and cannot be harmed while tracking is lost", () => {
    let s = guardThroughOneLunge(createInitialGameState());
    // Drive a guard-miss lunge underway, then lose tracking mid-window.
    s = runFor(s, 1_600); // settle -> telegraph, now approaching lunge
    const before = s;
    for (let i = 0; i < 50; i++) s = tick(s, 16, { trackingOk: false });
    expect(s.trackingPaused).toBe(true);
    expect(s.clockMs).toBe(before.clockMs);
    expect(s.playerHits).toBe(before.playerHits);
    expect(s.phase).toBe(before.phase);
    expect(s.phaseElapsedMs).toBe(before.phaseElapsedMs);
  });
});
