# SHADOW COUNTER — generated art record

The runtime images in `public/` were generated with Codex's built-in image
generation tool on 2026-08-31. They are original project assets. The approved
production keyframe established one shared identity, palette and camera before
the runtime images were derived.

## Shared visual constraints

- Modern high-definition pixel art with crisp deliberate pixel clusters.
- Fixed, orthographic-feeling side view with compressed long-lens depth.
- Abandoned rain-soaked street beneath elevated rail; distant towers in cold
  haze; wet asphalt; restrained cyan and dirty amber practical light.
- Player: worn grey-white human-scale industrial boxer, cyan-white visor.
- Opponent: charcoal/deep-iron human-scale industrial boxer, dark-red visor.
- Near-human proportions, modest broadness, fists only 15–20% oversized.
- No weapons, spikes, wings, giant mech parts, anime armour, neon clutter,
  logos or copied reference imagery.

## Arena master

Path: `public/arena/arena-master.png`

Prompt:

> Remove only the two boxing robots from the approved production keyframe and
> reconstruct the wet street, railing, distant city and rain behind them
> naturally. Keep the exact camera, perspective, crop, elevated rail, skyline,
> cold cyan night lighting, restrained amber lamps, pixel rendering, haze and
> empty horizontal fighting plane. No characters, text, UI, logos or new props.

## Player atlas

Path: `public/sprites/player-atlas.png`

Prompt:

> Create a genuine-transparent 3×3 pixel-art atlas of the same grey-white
> industrial boxing robot, strict side profile facing screen-right, identical
> scale, baseline and cold rim light. Reading order: idle; controlled step
> forward; controlled step backward; left-arm straight punch; right-arm
> straight punch; both fists joined at face/chest in compact guard; hit recoil;
> restrained victory; defeated kneel. Full body and both feet visible, no floor,
> shadows, grid, labels or extra body parts.

The initial generation drew a checkerboard. A background-extraction pass
removed only that checkerboard and preserved the nine figures as real alpha.

## Opponent atlas

Path: `public/sprites/opponent-atlas.png`

Prompt:

> Create a genuine-transparent 3×3 pixel-art atlas of the same deep-iron
> industrial boxing opponent, strict side profile facing screen-left, identical
> scale, baseline and lighting. Reading order: idle; coiled attack telegraph;
> short lunge; blocked recoil; left-side opening with small pale vulnerability;
> mirrored right-side opening; counter-hit recoil; restrained victory; defeated
> kneel with cracked visor. Keep red light controlled. No weapons, floor, grid,
> labels or extra body parts.

The initial generation drew a checkerboard. A background-extraction pass
removed only that checkerboard and preserved the nine figures as real alpha.

## Visor fracture atlas

Path: `public/sprites/opponent-visor-atlas.png`

Prompt:

> Create eight identical black-glass visor plates in a genuine-transparent 4×2
> atlas. Progress from one hairline crack to heavily branched but still intact
> glass, adding restrained crimson light only inside the cracks. Preserve the
> same silhouette, side orientation, size and position. No full head, shards,
> explosion, grid, labels or text.

The initial generation drew a checkerboard. A background-extraction pass
removed only that checkerboard and preserved the eight visors as real alpha.

## Social card

Path: `public/card.png` (1200×630)

Prompt:

> Recompose the approved rainy cyberpunk boxing keyframe as a 1.904:1 social
> card. Keep the grey-white player on the left, deep-iron opponent on the right
> and empty wet street between them. Center exactly two title lines: “影拳” and
> “SHADOW COUNTER”, solemn condensed industrial monospace, off-white with a
> subtle cold-cyan glow. No other copy, UI, aperture, logos or watermark.

The selected result was deterministically resized to the required 1200×630
delivery size without changing its content.
