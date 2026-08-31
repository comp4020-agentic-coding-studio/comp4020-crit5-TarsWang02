// Responsive HD-pixel stage renderer. Generated atlas art supplies the stable
// character identity; rain, haze, shield, telegraphs and impact light remain
// live Canvas effects so feedback can react within one frame.
import type { AssetSet, AtlasAsset } from "./assets.ts";
import { LUNGE_IMPACT_WINDOW_MS, type GameState, type RoundEvent, type RoundResult } from "./game-state.ts";
import type { Side } from "./types.ts";

export interface GloveVisual {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

export interface RenderState {
  readonly game: GameState;
  readonly guardActive: boolean;
  readonly guardStrength: number;
  readonly advance: number;
  readonly visualPunch: Side | null;
  readonly visualEvent: RoundEvent;
  readonly leftGlove: GloveVisual | null;
  readonly rightGlove: GloveVisual | null;
  readonly assets: AssetSet | null;
  readonly nowMs: number;
}

const PLAYER_FRAMES = {
  idle: 0,
  advance: 1,
  retreat: 2,
  punchLeft: 3,
  punchRight: 4,
  guard: 5,
  hit: 6,
  win: 7,
  loss: 8,
} as const;

const OPPONENT_FRAMES = {
  idle: 0,
  telegraph: 1,
  lunge: 2,
  recoil: 3,
  openLeft: 4,
  openRight: 5,
  hit: 6,
  win: 7,
  loss: 8,
} as const;

const FIGHTER_Y = 0.635;
const RECOIL_MS = 220;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lungeProgress(game: GameState): number {
  if (game.phase === "lunge") return Math.min(1, game.phaseElapsedMs / LUNGE_IMPACT_WINDOW_MS);
  if (game.phase === "opening") return Math.max(0, 1 - game.phaseElapsedMs / RECOIL_MS);
  return 0;
}

function playerFrame(state: RenderState): number {
  if (state.game.result === "win") return PLAYER_FRAMES.win;
  if (state.game.result === "loss") return PLAYER_FRAMES.loss;
  if (state.visualEvent === "guardMiss") return PLAYER_FRAMES.hit;
  if (state.visualPunch === "left") return PLAYER_FRAMES.punchLeft;
  if (state.visualPunch === "right") return PLAYER_FRAMES.punchRight;
  if (state.guardActive) return PLAYER_FRAMES.guard;
  if (state.advance > 0.12) return PLAYER_FRAMES.advance;
  if (state.advance < -0.12) return PLAYER_FRAMES.retreat;
  return PLAYER_FRAMES.idle;
}

function opponentFrame(game: GameState, event: RoundEvent): number {
  if (game.result === "win") return OPPONENT_FRAMES.loss;
  if (game.result === "loss") return OPPONENT_FRAMES.win;
  if (event === "counterLanded") return OPPONENT_FRAMES.hit;
  switch (game.phase) {
    case "telegraph":
      return OPPONENT_FRAMES.telegraph;
    case "lunge":
      return OPPONENT_FRAMES.lunge;
    case "opening":
      return game.openSide === "left" ? OPPONENT_FRAMES.openLeft : OPPONENT_FRAMES.openRight;
    case "settle":
      return game.guardedDuringLunge ? OPPONENT_FRAMES.recoil : OPPONENT_FRAMES.idle;
    default:
      return OPPONENT_FRAMES.idle;
  }
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number): void {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
}

function drawArena(ctx: CanvasRenderingContext2D, width: number, height: number, assets: AssetSet | null): void {
  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, width, height);
  if (assets?.arena) {
    drawCover(ctx, assets.arena, width, height);
    return;
  }

  const fallback = ctx.createLinearGradient(0, 0, 0, height);
  fallback.addColorStop(0, "#08131d");
  fallback.addColorStop(0.62, "#0d1720");
  fallback.addColorStop(1, "#05070a");
  ctx.fillStyle = fallback;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(154, 205, 225, 0.18)";
  ctx.beginPath();
  ctx.moveTo(0, height * 0.81);
  ctx.lineTo(width, height * 0.81);
  ctx.stroke();
}

function drawGroundShadow(ctx: CanvasRenderingContext2D, x: number, width: number, height: number, strength: number): void {
  const gradient = ctx.createRadialGradient(x, height * 0.81, 0, x, height * 0.81, width * 0.11);
  gradient.addColorStop(0, `rgba(0, 0, 0, ${0.5 * strength})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(x, height * 0.81, width * 0.11, height * 0.028, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAtlasFrame(
  ctx: CanvasRenderingContext2D,
  atlas: AtlasAsset | undefined,
  frame: number,
  x: number,
  y: number,
  stageHeight: number,
  targetCellHeightFraction = 0.59,
): boolean {
  const image = atlas?.image;
  if (!image) return false;
  const cellWidth = image.naturalWidth / atlas.columns;
  const cellHeight = image.naturalHeight / atlas.rows;
  const column = frame % atlas.columns;
  const row = Math.floor(frame / atlas.columns);
  const targetHeight = stageHeight * targetCellHeightFraction;
  const targetWidth = targetHeight * (cellWidth / cellHeight);
  ctx.drawImage(
    image,
    column * cellWidth,
    row * cellHeight,
    cellWidth,
    cellHeight,
    x - targetWidth / 2,
    y - targetHeight * 0.64,
    targetWidth,
    targetHeight,
  );
  return true;
}

function drawFighterFallback(
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
  ctx.fillStyle = flash ? "#f2f6ff" : color;
  ctx.fillRect(x - bodyWidth / 2, y - bodyHeight / 2, bodyWidth, bodyHeight);
  ctx.beginPath();
  ctx.arc(x, y - bodyHeight / 2 - headRadius * 0.8, headRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawVisorDamage(
  ctx: CanvasRenderingContext2D,
  atlas: AtlasAsset | undefined,
  stage: number,
  opponentX: number,
  stageHeight: number,
): void {
  const image = atlas?.image;
  if (!image || stage <= 0) return;
  const frame = Math.min(7, stage - 1);
  const cellWidth = image.naturalWidth / atlas.columns;
  const cellHeight = image.naturalHeight / atlas.rows;
  const column = frame % atlas.columns;
  const row = Math.floor(frame / atlas.columns);
  const targetWidth = stageHeight * 0.105;
  const targetHeight = targetWidth * (cellHeight / cellWidth);
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.drawImage(
    image,
    column * cellWidth,
    row * cellHeight,
    cellWidth,
    cellHeight,
    opponentX - targetWidth * 0.5,
    stageHeight * 0.405,
    targetWidth,
    targetHeight,
  );
  ctx.restore();
}

function drawOpening(ctx: CanvasRenderingContext2D, x: number, y: number, side: Side, width: number, height: number): void {
  const direction = side === "left" ? -1 : 1;
  const targetX = x + direction * width * 0.035;
  const targetY = y - height * 0.12;
  const pulse = 0.82 + Math.sin(performance.now() * 0.012) * 0.18;
  ctx.save();
  ctx.strokeStyle = `rgba(245, 247, 239, ${pulse})`;
  ctx.lineWidth = Math.max(2, height * 0.005);
  ctx.beginPath();
  ctx.arc(targetX, targetY, height * 0.035, -Math.PI * 0.42, Math.PI * 0.42);
  ctx.stroke();
  ctx.fillStyle = "rgba(245, 247, 239, 0.9)";
  ctx.fillRect(targetX - height * 0.008, targetY - height * 0.008, height * 0.016, height * 0.016);
  ctx.restore();
}

function drawGuardShield(
  ctx: CanvasRenderingContext2D,
  left: GloveVisual | null,
  right: GloveVisual | null,
  active: boolean,
  strength: number,
  width: number,
  height: number,
): void {
  const gloves = [left, right].filter((glove): glove is GloveVisual => glove !== null);
  if (gloves.length === 0) return;
  const radius = Math.max(width, height) * 0.025;

  for (const [index, glove] of gloves.entries()) {
    const x = glove.x * width;
    const y = glove.y * height;
    ctx.save();
    ctx.lineWidth = Math.max(2, height * 0.004);
    ctx.strokeStyle = active
      ? `rgba(91, 226, 255, ${0.45 + 0.55 * strength})`
      : glove.visible
        ? "rgba(207, 232, 255, 0.58)"
        : "rgba(207, 232, 255, 0.2)";
    if (!glove.visible) ctx.setLineDash([3, 5]);
    ctx.beginPath();
    const start = index === 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    ctx.arc(x, y, radius, start, start + Math.PI);
    ctx.stroke();
    if (active) {
      ctx.shadowBlur = height * 0.035;
      ctx.shadowColor = "#5be2ff";
      ctx.globalAlpha = 0.14 * strength;
      ctx.fillStyle = "#5be2ff";
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.82, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawRain(ctx: CanvasRenderingContext2D, width: number, height: number, nowMs: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(168, 214, 231, 0.18)";
  ctx.lineWidth = Math.max(1, width / 1200);
  const travel = (nowMs * 0.32) % (height + 80);
  for (let i = 0; i < 64; i++) {
    const seed = (i * 83.17) % 997;
    const x = ((seed / 997) * (width + 120) + nowMs * (0.012 + (i % 5) * 0.002)) % (width + 120) - 60;
    const y = ((i * 137 + travel * (0.72 + (i % 4) * 0.13)) % (height + 80)) - 40;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - width * 0.006, y + height * 0.04);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAtmosphere(ctx: CanvasRenderingContext2D, width: number, height: number, nowMs: number): void {
  const drift = Math.sin(nowMs * 0.00012) * width * 0.05;
  const fog = ctx.createRadialGradient(width * 0.5 + drift, height * 0.58, 0, width * 0.5 + drift, height * 0.58, width * 0.58);
  fog.addColorStop(0, "rgba(91, 151, 178, 0.055)");
  fog.addColorStop(0.55, "rgba(22, 48, 61, 0.035)");
  fog.addColorStop(1, "rgba(5, 7, 10, 0)");
  ctx.fillStyle = fog;
  ctx.fillRect(0, height * 0.18, width, height * 0.72);

  const vignette = ctx.createRadialGradient(width / 2, height * 0.52, height * 0.08, width / 2, height * 0.52, Math.max(width, height) * 0.72);
  vignette.addColorStop(0.55, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function drawImpactLight(ctx: CanvasRenderingContext2D, width: number, height: number, event: RoundEvent): void {
  if (!event) return;
  const positive = event === "guardSuccess" || event === "counterLanded" || event === "roundWin";
  const rejected = event.startsWith("punchRejected");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = positive
    ? "rgba(132, 226, 255, 0.11)"
    : rejected
      ? "rgba(255, 133, 79, 0.07)"
      : "rgba(255, 46, 66, 0.12)";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, width: number, height: number, game: GameState): void {
  const seconds = Math.ceil(game.clockMs / 1000);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.max(14, Math.round(height * 0.045))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillStyle = "rgba(224, 239, 245, 0.82)";
  ctx.shadowColor = "rgba(91, 226, 255, 0.28)";
  ctx.shadowBlur = height * 0.015;
  ctx.fillText(String(seconds).padStart(2, "0"), width / 2, height * 0.075);
  ctx.shadowBlur = 0;

  // Player health is expressed as frame-edge fractures rather than a bar.
  ctx.strokeStyle = "rgba(255, 53, 73, 0.72)";
  ctx.lineWidth = Math.max(2, height * 0.004);
  for (let i = 0; i < game.playerHits; i++) {
    const y = height * (0.17 + i * 0.085);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width * (0.032 + i * 0.006), y + height * 0.028);
    ctx.lineTo(width * 0.012, y + height * 0.052);
    ctx.stroke();
  }

  if (game.trackingPaused) {
    ctx.strokeStyle = "rgba(225, 236, 241, 0.54)";
    ctx.setLineDash([5, 7]);
    ctx.strokeRect(width * 0.42, height * 0.42, width * 0.16, height * 0.16);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawResult(ctx: CanvasRenderingContext2D, width: number, height: number, result: RoundResult): void {
  ctx.save();
  ctx.fillStyle = "rgba(3, 5, 8, 0.62)";
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.max(28, Math.round(height * 0.105))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.letterSpacing = `${height * 0.016}px`;
  ctx.fillStyle = result === "win" ? "#dff8ff" : "#ff3c55";
  ctx.shadowColor = result === "win" ? "#5be2ff" : "#c61432";
  ctx.shadowBlur = height * 0.045;
  ctx.fillText(result === "win" ? "COUNTERED" : "SHUT DOWN", width / 2, height * 0.42);
  ctx.restore();
}

export function renderStage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: RenderState,
): void {
  const { game, assets } = state;
  const portrait = width / height < 0.9;
  const playerEngagedX = portrait ? 0.44 : 0.43;
  const playerRetreatX = portrait ? 0.29 : 0.18;
  const opponentMarkX = portrait ? 0.65 : 0.7;
  const opponentLungeX = portrait ? 0.53 : 0.48;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  drawArena(ctx, width, height, assets);
  drawAtmosphere(ctx, width, height, state.nowMs);

  const playerX = lerp(playerEngagedX, playerRetreatX, game.playerPosition) * width;
  const opponentX = lerp(opponentMarkX, opponentLungeX, lungeProgress(game)) * width;
  const fighterY = FIGHTER_Y * height;

  drawGroundShadow(ctx, playerX, width, height, 0.8);
  drawGroundShadow(ctx, opponentX, width, height, 0.92);

  const playerDrawn = drawAtlasFrame(ctx, assets?.player, playerFrame(state), playerX, fighterY, height, portrait ? 0.44 : 0.59);
  if (!playerDrawn) {
    drawFighterFallback(ctx, playerX, fighterY, "#cfe8ff", height, state.visualEvent === "guardMiss");
  }

  const opponentDrawn = drawAtlasFrame(
    ctx,
    assets?.opponent,
    opponentFrame(game, state.visualEvent),
    opponentX,
    fighterY,
    height,
    portrait ? 0.44 : 0.59,
  );
  if (!opponentDrawn) {
    drawFighterFallback(ctx, opponentX, fighterY, "#8f343f", height, state.visualEvent === "counterLanded");
  }

  drawVisorDamage(ctx, assets?.visorFractures, game.counters, opponentX, height);
  if (game.phase === "opening" && game.openSide) drawOpening(ctx, opponentX, fighterY, game.openSide, width, height);

  drawGuardShield(ctx, state.leftGlove, state.rightGlove, state.guardActive, clamp01(state.guardStrength), width, height);
  drawRain(ctx, width, height, state.nowMs);
  drawImpactLight(ctx, width, height, state.visualEvent);
  drawHud(ctx, width, height, game);
  if (game.result) drawResult(ctx, width, height, game.result);
}
