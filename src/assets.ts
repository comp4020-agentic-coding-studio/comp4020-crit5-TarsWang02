// Runtime art contract. The generated fighters live in compact atlases so
// every pose keeps one identity, material treatment and lighting direction.
// Missing images resolve to null and the renderer retains geometric fallbacks.

export interface AtlasAsset {
  readonly image: HTMLImageElement | null;
  readonly columns: number;
  readonly rows: number;
}

export interface AssetSet {
  readonly arena: HTMLImageElement | null;
  readonly player: AtlasAsset;
  readonly opponent: AtlasAsset;
  readonly visorFractures: AtlasAsset;
}

function loadImage(path: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = path;
  });
}

export async function loadAssetSet(): Promise<AssetSet> {
  const [arena, player, opponent, visorFractures] = await Promise.all([
    loadImage("./arena/arena-master.png"),
    loadImage("./sprites/player-atlas.png"),
    loadImage("./sprites/opponent-atlas.png"),
    loadImage("./sprites/opponent-visor-atlas.png"),
  ]);

  return {
    arena,
    player: { image: player, columns: 3, rows: 3 },
    opponent: { image: opponent, columns: 3, rows: 3 },
    visorFractures: { image: visorFractures, columns: 4, rows: 2 },
  };
}
