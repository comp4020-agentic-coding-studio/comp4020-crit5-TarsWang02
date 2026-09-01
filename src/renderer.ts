// Responsive HD-pixel stage renderer. Generated atlas art supplies the stable
// character identity; rain, haze, shield, telegraphs and impact light remain
// live Canvas effects so feedback can react within one frame.
import type { AssetSet, AtlasAsset } from "./assets.ts";
import {
  COUNTERS_TO_WIN,
  HITS_TO_LOSE,
  LUNGE_IMPACT_WINDOW_MS,
  PUNCH_RANGE_MAX,
  type GameState,
  type RoundEvent,
  type RoundResult,
} from "./game-state.ts";
import type { Side } from "./types.ts";

export interface GloveVisual {
  // Offset from the player's shoulder midpoint, in shoulder-width units
  // (see pose-rules.ts `toPlayerLocalPoint`). Mapped onto the player robot's
  // current on-screen upper body by `playerUpperBodyAnchor`, not onto raw
  // canvas fractions, so the glove tracks the sprite as it advances/retreats.
  readonly offsetX: number;
  readonly offsetY: number;
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

const PLAYER_SPRITE_HEIGHT_FRACTION_PORTRAIT = 0.44;
const PLAYER_SPRITE_HEIGHT_FRACTION_LANDSCAPE = 0.59;
// Matches drawAtlasFrame's `y - targetHeight * 0.64` placement, i.e. how far
// down from the sprite's top edge the fighterY anchor point sits.
const PLAYER_SPRITE_ANCHOR_FROM_TOP = 0.64;
// Where the shoulder line sits within the sprite, and the shoulder width as a
// fraction of sprite height — starting values for the current placeholder
// atlas, to retune once real play/art reveals better proportions.
const PLAYER_SHOULDER_LINE_FROM_TOP = 0.24;
const PLAYER_SHOULDER_WIDTH_FRACTION = 0.3;

export interface PlayerUpperBodyAnchor {
  readonly x: number;
  readonly y: number;
  readonly scale: number; // pixels per shoulder-width unit
}

function playerSpriteHeightFraction(portrait: boolean): number {
  return portrait ? PLAYER_SPRITE_HEIGHT_FRACTION_PORTRAIT : PLAYER_SPRITE_HEIGHT_FRACTION_LANDSCAPE;
}

// Maps the player's shoulder midpoint onto wherever the player robot is
// currently drawn on stage (it moves as the player advances/retreats), so
// glove/shield visuals track the sprite instead of raw camera-frame space.
export function playerUpperBodyAnchor(
  playerX: number,
  fighterY: number,
  stageHeight: number,
  portrait: boolean,
): PlayerUpperBodyAnchor {
  const spriteHeight = stageHeight * playerSpriteHeightFraction(portrait);
  return {
    x: playerX,
    y: fighterY - spriteHeight * (PLAYER_SPRITE_ANCHOR_FROM_TOP - PLAYER_SHOULDER_LINE_FROM_TOP),
    scale: spriteHeight * PLAYER_SHOULDER_WIDTH_FRACTION,
  };
}

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
  const source = atlas.frames[frame];
  if (!source) return false;
  const targetHeight = stageHeight * targetCellHeightFraction;
  const targetWidth = targetHeight * (source.width / source.height);
  ctx.drawImage(
    image,
    source.x,
    source.y,
    source.width,
    source.height,
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
  anchor: PlayerUpperBodyAnchor,
  width: number,
  height: number,
): void {
  const gloves = [left, right].filter((glove): glove is GloveVisual => glove !== null);
  if (gloves.length === 0) return;
  const radius = Math.max(width, height) * 0.025;

  for (const [index, glove] of gloves.entries()) {
    const x = anchor.x + glove.offsetX * anchor.scale;
    const y = anchor.y + glove.offsetY * anchor.scale;
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
    ? "rgba(132, 226, 255, 0.18)"
    : rejected
      ? "rgba(255, 133, 79, 0.07)"
      : "rgba(255, 46, 66, 0.2)";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawImpactBurst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  event: RoundEvent,
  nowMs: number,
): void {
  if (!event || event.startsWith("punchRejected")) return;
  const positive = event === "guardSuccess" || event === "counterLanded" || event === "roundWin";
  const color = positive ? "132, 226, 255" : "255, 67, 82";
  const radius = height * (event === "counterLanded" ? 0.13 : 0.09);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(x, y);
  ctx.rotate((nowMs % 1000) * 0.0004);
  ctx.strokeStyle = `rgba(${color}, 0.82)`;
  ctx.lineWidth = Math.max(2, height * 0.004);
  for (let index = 0; index < 12; index += 1) {
    const angle = (Math.PI * 2 * index) / 12;
    const inner = radius * (0.18 + (index % 3) * 0.035);
    const outer = radius * (0.62 + (index % 4) * 0.12);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  glow.addColorStop(0, `rgba(${color}, 0.5)`);
  glow.addColorStop(0.28, `rgba(${color}, 0.16)`);
  glow.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCombatCallout(ctx: CanvasRenderingContext2D, width: number, height: number, event: RoundEvent): void {
  if (!event || event === "roundWin" || event === "roundLoss") return;
  const copy: Record<Exclude<RoundEvent, null | "roundWin" | "roundLoss">, string> = {
    guardSuccess: "BLOCK",
    guardMiss: "ARMOUR HIT",
    counterLanded: "COUNTER +1",
    punchRejectedGuarded: "GUARDED",
    punchRejectedWrongSide: "WRONG SIDE",
    punchRejectedOutOfRange: "OUT OF RANGE",
  };
  const positive = event === "guardSuccess" || event === "counterLanded";
  const rejected = event.startsWith("punchRejected");
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.max(12, Math.round(height * 0.025))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.letterSpacing = `${height * 0.004}px`;
  ctx.fillStyle = positive ? "#c9f5ff" : rejected ? "#ffb17f" : "#ff6678";
  ctx.shadowColor = positive ? "#5be2ff" : "#c61432";
  ctx.shadowBlur = height * 0.025;
  ctx.fillText(copy[event], width / 2, height * 0.205);
  ctx.restore();
}

function phaseCopy(game: GameState): string {
  if (!game.calibrated && game.phase !== "opening") return "SYNC · GUARD THE IMPACT";
  if (game.phase === "telegraph") return "READ ATTACK";
  if (game.phase === "lunge") return "GUARD";
  if (game.phase === "opening" && game.openSide) return `${game.openSide.toUpperCase()} COUNTER`;
  return "HOLD RANGE";
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

  ctx.font = `600 ${Math.max(10, Math.round(height * 0.018))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.letterSpacing = `${Math.max(1, height * 0.0025)}px`;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(204, 238, 248, 0.8)";
  ctx.fillText(`COUNTER ${game.counters}/${COUNTERS_TO_WIN}`, width * 0.055, height * 0.075);
  ctx.textAlign = "right";
  ctx.fillStyle = game.playerHits > 1 ? "rgba(255, 93, 108, 0.9)" : "rgba(224, 239, 245, 0.78)";
  ctx.fillText(`ARMOUR ${HITS_TO_LOSE - game.playerHits}/${HITS_TO_LOSE}`, width * 0.945, height * 0.075);

  ctx.textAlign = "center";
  ctx.font = `600 ${Math.max(10, Math.round(height * 0.017))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillStyle = game.phase === "lunge" ? "rgba(255, 112, 124, 0.95)" : "rgba(209, 239, 247, 0.76)";
  ctx.fillText(phaseCopy(game), width / 2, height * 0.135);

  const railLeft = width * 0.38;
  const railRight = width * 0.62;
  const railY = height * 0.9;
  ctx.strokeStyle = "rgba(186, 218, 229, 0.24)";
  ctx.lineWidth = Math.max(1, height * 0.002);
  ctx.beginPath();
  ctx.moveTo(railLeft, railY);
  ctx.lineTo(railRight, railY);
  ctx.stroke();
  // playerPosition: 0 = engaged (right, matching the fighter sprite's own
  // advance direction), 1 = retreated (left) — so the low end of the lerp
  // range is railRight, not railLeft.
  const markerX = lerp(railRight, railLeft, game.playerPosition);
  ctx.fillStyle = game.playerPosition <= PUNCH_RANGE_MAX ? "#8feaff" : "#ff7a84";
  ctx.fillRect(markerX - height * 0.004, railY - height * 0.008, height * 0.008, height * 0.016);
  ctx.font = `500 ${Math.max(9, Math.round(height * 0.014))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillText(game.playerPosition <= PUNCH_RANGE_MAX ? "RANGE LOCK" : "CLOSE DISTANCE", width / 2, railY - height * 0.026);

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
  ctx.shadowBlur = 0;
  ctx.font = `600 ${Math.max(10, Math.round(height * 0.018))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.letterSpacing = `${height * 0.004}px`;
  ctx.fillStyle = "rgba(222, 239, 245, 0.76)";
  ctx.fillText("ACTIVATE CORE TO RESTART", width / 2, height * 0.55);
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
  const playerEngagedX = portrait ? 0.52 : 0.51;
  const playerRetreatX = portrait ? 0.29 : 0.18;
  const opponentMarkX = portrait ? 0.65 : 0.7;
  const opponentLungeX = portrait ? 0.58 : 0.56;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  drawArena(ctx, width, height, assets);
  drawAtmosphere(ctx, width, height, state.nowMs);

  const playerX = lerp(playerEngagedX, playerRetreatX, game.playerPosition) * width;
  const opponentX = lerp(opponentMarkX, opponentLungeX, lungeProgress(game)) * width;
  const fighterY = FIGHTER_Y * height;

  const shakeEvent = state.visualEvent === "counterLanded" || state.visualEvent === "guardMiss";
  const shakeX = shakeEvent ? Math.sin(state.nowMs * 1.73) * height * 0.008 : 0;
  const shakeY = shakeEvent ? Math.cos(state.nowMs * 1.31) * height * 0.004 : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawGroundShadow(ctx, playerX, width, height, 0.8);
  drawGroundShadow(ctx, opponentX, width, height, 0.92);

  const playerDrawn = drawAtlasFrame(
    ctx,
    assets?.player,
    playerFrame(state),
    playerX,
    fighterY,
    height,
    playerSpriteHeightFraction(portrait),
  );
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

  const playerAnchor = playerUpperBodyAnchor(playerX, fighterY, height, portrait);
  drawGuardShield(ctx, state.leftGlove, state.rightGlove, state.guardActive, clamp01(state.guardStrength), playerAnchor, width, height);
  const impactX = state.visualEvent === "guardMiss" ? playerX : state.visualEvent === "guardSuccess" ? (playerX + opponentX) / 2 : opponentX;
  drawImpactBurst(ctx, impactX, fighterY - height * 0.15, height, state.visualEvent, state.nowMs);
  ctx.restore();
  drawRain(ctx, width, height, state.nowMs);
  drawImpactLight(ctx, width, height, state.visualEvent);
  drawCombatCallout(ctx, width, height, state.visualEvent);
  drawHud(ctx, width, height, game);
  if (game.result) drawResult(ctx, width, height, game.result);
}
