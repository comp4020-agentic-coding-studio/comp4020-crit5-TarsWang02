// Responsive pixel-stage rendering. Draws real sprites/arena layers from
// assets.ts when they've loaded, and falls back to placeholder shapes
// otherwise — the art-direction stage supplies PNGs at the paths named in
// assets.ts and this module picks them up automatically, with no change to
// GameState or pose-rules' tested contracts.
import type { AssetSet, ArenaLayer, OpponentState, PlayerState } from "./assets.ts";
import { LUNGE_IMPACT_WINDOW_MS, type GameState, type RoundResult } from "./game-state.ts";
import type { Side } from "./types.ts";

export interface GloveVisual {
  readonly x: number; // normalized 0..1 within the stage
  readonly y: number;
  readonly visible: boolean;
}

export interface RenderState {
  readonly game: GameState;
  readonly guardActive: boolean;
  readonly guardStrength: number; // 0..1
  readonly leftGlove: GloveVisual | null;
  readonly rightGlove: GloveVisual | null;
  readonly assets: AssetSet | null;
}

const PLAYER_ENGAGED_X = 0.58;
const PLAYER_RETREAT_X = 0.22;
const OPPONENT_MARK_X = 0.78;
const OPPONENT_LUNGE_X = 0.5;
const FIGHTER_Y = 0.62;
const RECOIL_MS = 220;
const FIGHTER_SPRITE_HEIGHT_FRACTION = 0.46;

const ARENA_DRAW_ORDER: readonly ArenaLayer[] = ["haze", "skyline", "midcity", "rail", "combat-plane", "street"];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lungeProgress(game: GameState): number {
  if (game.phase === "lunge") return Math.min(1, game.phaseElapsedMs / LUNGE_IMPACT_WINDOW_MS);
  if (game.phase === "opening") return Math.max(0, 1 - game.phaseElapsedMs / RECOIL_MS);
  return 0;
}

function pickPlayerState(game: GameState, guardActive: boolean): PlayerState {
  if (game.result === "win") return "win";
  if (game.result === "loss") return "loss";
  if (game.lastEvent === "guardMiss") return "hit";
  if (guardActive) return "guard-active";
  return "idle";
}

function pickOpponentState(game: GameState): OpponentState {
  if (game.result === "win") return "loss";
  if (game.result === "loss") return "win";
  if (game.lastEvent === "counterLanded") return "hit";
  switch (game.phase) {
    case "telegraph":
      return "telegraph";
    case "lunge":
      return "lunge";
    case "opening":
      return game.openSide === "left" ? "open-left" : "open-right";
    case "settle":
      return game.guardedDuringLunge ? "recoil" : "idle";
    default:
      return "idle";
  }
}

function drawArenaLayers(ctx: CanvasRenderingContext2D, width: number, height: number, assets: AssetSet): void {
  for (const layer of ARENA_DRAW_ORDER) {
    const image = assets.arena[layer];
    if (image) ctx.drawImage(image, 0, 0, width, height);
  }
}

function drawArenaPlaceholder(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.strokeStyle = "rgba(207, 232, 255, 0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, FIGHTER_Y * height + height * 0.12);
  ctx.lineTo(width, FIGHTER_Y * height + height * 0.12);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 180, 180, 0.25)";
  ctx.beginPath();
  ctx.moveTo(PLAYER_RETREAT_X * width - width * 0.04, 0);
  ctx.lineTo(PLAYER_RETREAT_X * width - width * 0.04, height);
  ctx.stroke();
}

function drawFighterSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  stageHeight: number,
): void {
  const targetHeight = stageHeight * FIGHTER_SPRITE_HEIGHT_FRACTION;
  const scale = targetHeight / image.naturalHeight;
  const targetWidth = image.naturalWidth * scale;
  ctx.drawImage(image, x - targetWidth / 2, y - targetHeight * 0.62, targetWidth, targetHeight);
}

function drawFighterPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  height: number,
  flash: boolean,
): void {
  const bodyWidth = height * 0.12;
  const bodyHeight = height * 0.32;
  const headRadius = height * 0.07;

  ctx.fillStyle = flash ? "#ff5c5c" : color;
  ctx.fillRect(x - bodyWidth / 2, y - bodyHeight / 2, bodyWidth, bodyHeight);
  ctx.beginPath();
  ctx.arc(x, y - bodyHeight / 2 - headRadius * 0.8, headRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawOpening(ctx: CanvasRenderingContext2D, x: number, y: number, side: Side, width: number): void {
  const offset = (side === "left" ? -1 : 1) * width * 0.045;
  ctx.beginPath();
  ctx.fillStyle = "#f5f7ff";
  ctx.arc(x + offset, y - width * 0.03, width * 0.018, 0, Math.PI * 2);
  ctx.fill();
}

function drawGuardShield(
  ctx: CanvasRenderingContext2D,
  glove: GloveVisual | null,
  active: boolean,
  strength: number,
  width: number,
  height: number,
): void {
  if (!glove) return;
  const x = glove.x * width;
  const y = glove.y * height;
  const radius = Math.max(width, height) * 0.022;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  if (active) {
    ctx.strokeStyle = `rgba(91, 226, 255, ${0.4 + 0.6 * strength})`;
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = glove.visible ? "rgba(207, 232, 255, 0.6)" : "rgba(207, 232, 255, 0.25)";
    ctx.setLineDash(glove.visible ? [] : [3, 4]);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawHud(ctx: CanvasRenderingContext2D, width: number, height: number, game: GameState): void {
  const seconds = Math.ceil(game.clockMs / 1000);
  ctx.fillStyle = "rgba(207, 232, 255, 0.8)";
  ctx.font = `${Math.round(height * 0.05)}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText(String(seconds).padStart(2, "0"), width / 2, height * 0.1);

  const pipRadius = height * 0.012;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(width * 0.08 + i * pipRadius * 3, height * 0.08, pipRadius, 0, Math.PI * 2);
    ctx.fillStyle = i < game.playerHits ? "#ff5c5c" : "rgba(255, 92, 92, 0.25)";
    ctx.fill();
  }
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.arc(width * 0.92 - i * pipRadius * 2.4, height * 0.08, pipRadius * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = i < game.counters ? "#f5f7ff" : "rgba(245, 247, 255, 0.2)";
    ctx.fill();
  }

  if (game.trackingPaused) {
    ctx.fillStyle = "rgba(255, 180, 180, 0.7)";
    ctx.font = `${Math.round(height * 0.035)}px monospace`;
    ctx.fillText("—", width / 2, height * 0.5);
  }
}

function drawResult(ctx: CanvasRenderingContext2D, width: number, height: number, result: RoundResult): void {
  ctx.fillStyle = "rgba(5, 7, 10, 0.55)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = result === "win" ? "#5be2ff" : "#ff5c5c";
  ctx.font = `${Math.round(height * 0.1)}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText(result === "win" ? "WIN" : "LOSS", width / 2, height * 0.45);
}

export function renderStage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: RenderState,
): void {
  const { game, assets } = state;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);

  const arenaLoaded = assets !== null && ARENA_DRAW_ORDER.some((layer) => assets.arena[layer]);
  if (assets && arenaLoaded) drawArenaLayers(ctx, width, height, assets);
  else drawArenaPlaceholder(ctx, width, height);

  const playerX = lerp(PLAYER_ENGAGED_X, PLAYER_RETREAT_X, game.playerPosition) * width;
  const opponentX = lerp(OPPONENT_MARK_X, OPPONENT_LUNGE_X, lungeProgress(game)) * width;
  const y = FIGHTER_Y * height;

  const playerSprite = assets?.player[pickPlayerState(game, state.guardActive)] ?? null;
  if (playerSprite) drawFighterSprite(ctx, playerSprite, playerX, y, height);
  else drawFighterPlaceholder(ctx, playerX, y, "#cfe8ff", height, game.lastEvent === "guardMiss");

  const opponentSprite = assets?.opponent[pickOpponentState(game)] ?? null;
  if (opponentSprite) {
    drawFighterSprite(ctx, opponentSprite, opponentX, y, height);
    if (game.counters > 0) {
      const visor = assets?.visorFractures[game.counters - 1] ?? null;
      if (visor) drawFighterSprite(ctx, visor, opponentX, y, height);
    }
  } else {
    drawFighterPlaceholder(ctx, opponentX, y, "#c85b5b", height, game.lastEvent === "counterLanded");
    if (game.phase === "opening" && game.openSide) drawOpening(ctx, opponentX, y, game.openSide, width);
  }

  drawGuardShield(ctx, state.leftGlove, state.guardActive, state.guardStrength, width, height);
  drawGuardShield(ctx, state.rightGlove, state.guardActive, state.guardStrength, width, height);

  drawHud(ctx, width, height, game);

  if (game.result) drawResult(ctx, width, height, game.result);
}
