# Process overview

## What I built

SHADOW COUNTER is a fixed-camera, side-view robot-boxing game controlled
entirely by webcam gestures read locally through MediaPipe Pose Landmarker:
leaning the torso forward or back sets range, bringing both hands together
for roughly 700ms charges a shield that visibly drains, and answering a
blocked lunge with the matching left or right punch inside a short opening
fractures one of eight stages of the opponent's visor before a 90-second
clock or three unguarded hits end the round. No control is ever explained in
text; the loop has to be discovered through direct motion correspondence.

## The moments that mattered

1. **Writing the harness before any game file existed.** The brief's
   open-endedness could easily have drifted toward a generic neon fighter or
   a keyboard-controlled placeholder. Instead of starting from code, I wrote
   CLAUDE.md's non-negotiables first — real left/right hand mapping, no
   dodge, torso-only movement, a fixed opponent mark, the win/loss condition,
   and named source boundaries — so every later commit had to satisfy an
   existing contract rather than invent its own scope. Re-reading it against
   the published brief before touching `game-state.ts` ruled out several
   combo/dodge ideas before they were written.
   [`cd87326`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-TarsWang02/commit/cd87326)

2. **Extracting pure rules before the camera existed.** Recognition and
   win/loss logic could easily have gone straight into a canvas loop tangled
   with MediaPipe callbacks, making "a held guard expires", "only a matching
   retracted hand can counter", and "three hits lose" untestable without a
   webcam in front of me. Instead, `src/game-state.ts` and `src/pose-rules.ts`
   were built as pure functions against synthetic landmark fixtures
   (`spec/fixtures/pose-samples.ts`), camera stubbed out entirely. `pnpm check`
   runs these headless, and they still pass unchanged once the real MediaPipe
   pipeline landed two commits later — the rules were never retrofitted
   around whatever the camera code happened to produce.
   [`ad94527`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-TarsWang02/commit/ad94527)

3. **Correcting the harness itself once real assets existed.** CLAUDE.md
   originally described art needs as an aspirational list ("expected asset
   groups") written before any sprite existed. Once the approved 3×3 atlases
   and arena plate were generated, I rewrote that section to name the actual
   files and frame order, and to forbid regenerating them without owner
   direction — moving the asset boundary from a wish list to an enforced
   contract. This is the harness-correction case rather than a retry: the
   next commit had to work within those named files and crop coordinates
   instead of re-deciding what assets should exist.
   [`f6a9841`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-TarsWang02/commit/f6a9841)

4. **A rendering bug visible only by watching the built game, not the diff.**
   After the approved sprites were wired in, glove and shield markers were
   still positioned from raw full-frame camera fractions while the player
   sprite is drawn at its own arena position — so the markers visibly floated
   away from the robot's hands as it advanced or retreated. No amount of
   reading `pose-rules.ts` or `renderer.ts` in isolation would have caught
   this; it only showed up in the rendered canvas. The fix converts wrist
   landmarks into player-local offsets from the shoulder midpoint
   (`toPlayerLocalPoint`) and maps them onto wherever the player sprite is
   actually drawn (`playerUpperBodyAnchor`), instead of patching the symptom
   with another canvas-space offset. `spec/renderer.test.ts` asserts the
   anchor tracks the sprite's x position rather than a fixed canvas fraction.
   [`7d3fcb0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-TarsWang02/commit/7d3fcb0)

## Honest status before shipping

`pnpm check` (typecheck + build + vitest) and `pnpm check:evidence` both pass
as of this commit. Not done, and not claimed here: a completed manual pass
with a real webcam across both marking viewports, varied lighting/
backgrounds, and a full round played to an actual win and loss. CLAUDE.md's
manual verification matrix and its required play-derived correction remain
open — moment 4's fix was verified with a unit test and a dev-preview visual
check, not a finished camera play session, and closing that gap is left to
the repository owner before this ships.
