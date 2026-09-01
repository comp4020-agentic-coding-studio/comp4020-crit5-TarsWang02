# Process overview

## What I built

SHADOW COUNTER is a fixed-camera, side-view robot-boxing game controlled
entirely by webcam gestures read locally through MediaPipe Pose Landmarker:
leaning the torso sets range, joining both hands charges a draining shield,
and answering a blocked lunge with the matching punch inside a short opening
fractures one of eight visor stages before a 90-second clock or three
unguarded hits end the round. No control is explained in text; the loop is
discovered through direct motion correspondence.

## The moments that mattered

1. **Writing the harness before any game file existed.** The brief's
   open-endedness could easily have drifted toward a generic neon fighter or
   keyboard-controlled placeholder. Instead of starting from code, I wrote
   CLAUDE.md's non-negotiables first — real left/right hand mapping, no
   dodge, torso-only movement, a fixed opponent mark, the win/loss condition,
   and named source boundaries — so every later commit had to satisfy an
   existing contract instead of inventing its own scope. Re-reading it against
   the brief before touching `game-state.ts` ruled out several combo/dodge
   ideas before they were written.
   [`cd87326`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-TarsWang02/commit/cd87326)

2. **Extracting pure rules before the camera existed.** Recognition and
   win/loss logic could easily have gone straight into a canvas loop tangled
   with MediaPipe callbacks, making "a held guard expires" and "only a
   matching retracted hand can counter" untestable without a webcam. Instead,
   `src/game-state.ts` and `src/pose-rules.ts` were built as pure functions
   against synthetic landmark fixtures (`spec/fixtures/pose-samples.ts`),
   camera stubbed out entirely. `pnpm check` runs these headless, and they
   still pass unchanged once the real MediaPipe pipeline landed two commits
   later — never retrofitted around whatever the camera code produced.
   [`ad94527`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-TarsWang02/commit/ad94527)

3. **Correcting the harness itself once real assets existed.** CLAUDE.md
   originally described art needs as an aspirational list written before any
   sprite existed. Once the approved 3×3 atlases and arena plate were
   generated, I rewrote that section to name the actual files and frame
   order, and to forbid regenerating them without owner direction — moving
   the asset boundary from a wish list to an enforced contract. This is a
   harness correction rather than a retry: the next commit had to work within
   those named files and crop coordinates instead of re-deciding what assets
   should exist.
   [`f6a9841`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-TarsWang02/commit/f6a9841)

4. **A rendering bug visible only by watching the built game, not the diff.**
   After the approved sprites were wired in, glove and shield markers were
   still positioned from raw full-frame camera fractions while the player
   sprite is drawn at its own arena position — so markers visibly floated
   away from the robot's hands as it advanced or retreated. No amount of
   reading `pose-rules.ts` or `renderer.ts` in isolation would have caught
   this; it only showed up in the rendered canvas. The fix converts wrist
   landmarks into shoulder-relative offsets (`toPlayerLocalPoint`) and maps
   them onto wherever the player sprite is actually drawn
   (`playerUpperBodyAnchor`), instead of patching the symptom. `spec/renderer.test.ts`
   asserts the anchor tracks the sprite's x position, not a fixed fraction.
   [`7d3fcb0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-TarsWang02/commit/7d3fcb0)

5. **The play-derived correction: closing a hedging loophole a code review
   would not have flagged as urgent.** The owner's real webcam turned out too
   blurry for MediaPipe to track, so verification switched to the `?simulate=1`
   keyboard bypass and a live back-and-forth: distance felt capped short of
   the halfway line (`playerEngagedX` sat at 0.43, well under the screen's
   visual centre — pushed to 0.51 with the opponent's lunge mark moved out to
   match), the range-rail marker moved opposite to the fighter sprite it was
   meant to track (`markerX` was lerped backwards between the two), and after
   winning a round the owner asked "left and right make no difference,
   right?" — throwing both punches in the same tick matched whichever side
   was open, so `input.punches.find()` always found a hit and side-reading
   was cosmetic. None of these were visible from reading `game-state.ts` or
   `renderer.ts` in isolation; each one only surfaced from someone actually
   trying to win. The fourth is the fairness fix CLAUDE.md's "punch spam...
   must not work" rule implies but the original tests never encoded: a
   two-tick `input.punches.length > 1` check now forces a real side pick.
   [`8bdc899`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-TarsWang02/commit/8bdc899),
   [`7658b10`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-TarsWang02/commit/7658b10)

## Honest status before shipping

`pnpm check` and `pnpm check:evidence` both pass as of this commit. Still not
done: a verification pass with the real webcam itself, since the owner's
camera was too blurry for MediaPipe to track during this session — every
correction above was found and confirmed through the `?simulate=1` keyboard
bypass rather than the camera pipeline. `mirror()`'s coordinate math and
`pose-rules.ts`'s dead-zone/clamp tuning are reasoned from the code and from
how a typical laptop webcam frames a seated player (hips usually cut off,
falling back to shoulder-midpoint-only displacement), not confirmed against a
live tracked body. CLAUDE.md's manual verification matrix — real camera,
both marking viewports, varied lighting — remains open and is left to the
repository owner.
