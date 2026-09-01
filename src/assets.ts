// Runtime art contract. The generated fighters live in compact atlases so
// every pose keeps one identity, material treatment and lighting direction.
// Missing images resolve to null and the renderer retains geometric fallbacks.

export interface AtlasAsset {
  readonly image: HTMLImageElement | null;
  readonly columns: number;
  readonly rows: number;
  readonly frames: readonly AtlasFrame[];
}

export interface AtlasFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
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

function cellFrames(image: HTMLImageElement | null, columns: number, rows: number): AtlasFrame[] {
  const width = image?.naturalWidth ?? columns;
  const height = image?.naturalHeight ?? rows;
  return Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = Math.floor((column * width) / columns);
    const y = Math.floor((row * height) / rows);
    return {
      x,
      y,
      width: Math.floor(((column + 1) * width) / columns) - x,
      height: Math.floor(((row + 1) * height) / rows) - y,
    };
  });
}

// Generated atlases rarely centre every pose perfectly. Tight alpha bounds
// prevent adjacent poses from leaking into a frame and keep each robot at a
// consistent visual height even when its source cell contains more padding.
function alphaFrames(image: HTMLImageElement | null, columns: number, rows: number): AtlasFrame[] {
  const fallback = cellFrames(image, columns, rows);
  if (!image) return fallback;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return fallback;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

    return fallback.map((cell) => {
      const visited = new Uint8Array(cell.width * cell.height);
      const queue = new Int32Array(cell.width * cell.height);
      let best = { count: 0, minX: cell.x, minY: cell.y, maxX: cell.x, maxY: cell.y };

      for (let localY = 0; localY < cell.height; localY += 1) {
        for (let localX = 0; localX < cell.width; localX += 1) {
          const seed = localY * cell.width + localX;
          const alpha = pixels[((cell.y + localY) * canvas.width + cell.x + localX) * 4 + 3];
          if (visited[seed] || alpha < 24) continue;

          let head = 0;
          let tail = 0;
          let count = 0;
          let minX = cell.x + localX;
          let minY = cell.y + localY;
          let maxX = minX;
          let maxY = minY;
          visited[seed] = 1;
          queue[tail++] = seed;

          while (head < tail) {
            const current = queue[head++];
            const cx = current % cell.width;
            const cy = Math.floor(current / cell.width);
            const x = cell.x + cx;
            const y = cell.y + cy;
            count += 1;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);

            for (let dy = -1; dy <= 1; dy += 1) {
              for (let dx = -1; dx <= 1; dx += 1) {
                if (dx === 0 && dy === 0) continue;
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx < 0 || nx >= cell.width || ny < 0 || ny >= cell.height) continue;
                const next = ny * cell.width + nx;
                if (visited[next]) continue;
                const nextAlpha = pixels[((cell.y + ny) * canvas.width + cell.x + nx) * 4 + 3];
                if (nextAlpha < 24) continue;
                visited[next] = 1;
                queue[tail++] = next;
              }
            }
          }

          if (count > best.count) best = { count, minX, minY, maxX, maxY };
        }
      }

      if (best.count === 0 || best.maxX <= best.minX || best.maxY <= best.minY) return cell;
      const padding = 3;
      const x = Math.max(cell.x, best.minX - padding);
      const y = Math.max(cell.y, best.minY - padding);
      const right = Math.min(cell.x + cell.width, best.maxX + padding + 1);
      const bottom = Math.min(cell.y + cell.height, best.maxY + padding + 1);
      return { x, y, width: right - x, height: bottom - y };
    });
  } catch {
    return fallback;
  }
}

function atlas(image: HTMLImageElement | null, columns: number, rows: number): AtlasAsset {
  return { image, columns, rows, frames: alphaFrames(image, columns, rows) };
}

export async function loadAssetSet(): Promise<AssetSet> {
  const [arena, player, opponent, visorFractures] = await Promise.all([
    loadImage("./arena/arena-master.png"),
    loadImage("./sprites/player-atlas.png"),
    loadImage("./sprites/opponent-atlas-v3.png"),
    loadImage("./sprites/opponent-visor-atlas.png"),
  ]);

  return {
    arena,
    player: atlas(player, 3, 3),
    opponent: atlas(opponent, 3, 3),
    visorFractures: atlas(visorFractures, 4, 2),
  };
}
