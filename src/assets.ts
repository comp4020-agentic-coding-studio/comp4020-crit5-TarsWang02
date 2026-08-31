// Explicit sprite/background asset loading and fallbacks. Every path below
// is a contract with the art-direction stage: drop a PNG at that exact path
// under public/ and the renderer switches from its placeholder shape to the
// real sprite automatically. Nothing here requires the files to exist —
// loadImage() resolves to null on a 404 so typecheck/build/tests never
// depend on art being present.
export type PlayerState =
  | "idle"
  | "advance"
  | "retreat"
  | "punch-left"
  | "punch-right"
  | "guard-charge"
  | "guard-active"
  | "hit"
  | "win"
  | "loss";

export type OpponentState =
  | "idle"
  | "telegraph"
  | "lunge"
  | "recoil"
  | "open-left"
  | "open-right"
  | "hit"
  | "win"
  | "loss";

export type ArenaLayer = "haze" | "skyline" | "midcity" | "rail" | "combat-plane" | "street";

const PLAYER_STATES: readonly PlayerState[] = [
  "idle",
  "advance",
  "retreat",
  "punch-left",
  "punch-right",
  "guard-charge",
  "guard-active",
  "hit",
  "win",
  "loss",
];

const OPPONENT_STATES: readonly OpponentState[] = [
  "idle",
  "telegraph",
  "lunge",
  "recoil",
  "open-left",
  "open-right",
  "hit",
  "win",
  "loss",
];

const ARENA_LAYERS: readonly ArenaLayer[] = ["haze", "skyline", "midcity", "rail", "combat-plane", "street"];

const VISOR_FRACTURE_STAGES = 8;

export interface AssetSet {
  readonly player: Readonly<Record<PlayerState, HTMLImageElement | null>>;
  readonly opponent: Readonly<Record<OpponentState, HTMLImageElement | null>>;
  readonly arena: Readonly<Record<ArenaLayer, HTMLImageElement | null>>;
  readonly visorFractures: readonly (HTMLImageElement | null)[]; // index 0 = stage 1 .. index 7 = stage 8
}

function loadImage(path: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = path;
  });
}

async function loadRecord<K extends string>(
  keys: readonly K[],
  pathFor: (key: K) => string,
): Promise<Record<K, HTMLImageElement | null>> {
  const entries = await Promise.all(keys.map(async (key) => [key, await loadImage(pathFor(key))] as const));
  return Object.fromEntries(entries) as Record<K, HTMLImageElement | null>;
}

export async function loadAssetSet(): Promise<AssetSet> {
  const [player, opponent, arena, visorFractures] = await Promise.all([
    loadRecord(PLAYER_STATES, (state) => `./sprites/player-${state}.png`),
    loadRecord(OPPONENT_STATES, (state) => `./sprites/opponent-${state}.png`),
    loadRecord(ARENA_LAYERS, (layer) => `./arena/arena-${layer}.png`),
    Promise.all(
      Array.from({ length: VISOR_FRACTURE_STAGES }, (_, i) => loadImage(`./sprites/opponent-visor-${i + 1}.png`)),
    ),
  ]);
  return { player, opponent, arena, visorFractures };
}
