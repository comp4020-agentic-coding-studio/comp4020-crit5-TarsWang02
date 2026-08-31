# SHADOW COUNTER — project harness

This repository is the Week 6 COMP4020/COMP8020 crit, **C5: A game**. The
working title is **SHADOW COUNTER / 影拳**: a short, camera-controlled,
side-on robot boxing game in a lonely cyberpunk city.

This file is the implementation contract for Claude Code. Read it before
planning or changing source. Grow it only when real implementation or play
testing reveals a durable constraint. Do not silently reinterpret the game
into a conventional keyboard fighter, an endless toy, a tutorial-led demo, or
a generic neon arcade scene.

## Authority

When sources disagree, use this order:

1. The user's latest explicit direction.
2. The published C5 brief and spec:
   <https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/05-game/>
3. This project harness.
4. Executable tests in `spec/`.
5. Existing implementation details.

The current source is untouched starter code. It is not a visual or
interaction reference.

## Cutoff and shipping contract

- The student is in the Yunlin group.
- Week 6 cutoff: **Wednesday 2 September 2026, 12:00 AEST**.
- The deliverable is the deployed public GitHub Pages site, not a local build.
- Keep the repository private while developing. Do not publish or ship without
  the owner's explicit instruction.
- Before shipping, `pnpm check` and `pnpm check:evidence` must pass, the link
  preview must resolve, and the deployed page must be tested at both marking
  viewports.

## Published brief translated into non-negotiables

The finished site must:

- be a game with rules, stakes, a possible wrong move, and a definite ending;
- make the first action obvious within ten seconds without tutorial copy;
- contain **no how-to-play text**, instruction modal, instruction page, control
  legend, or README explanation standing in for the design;
- let a stranger reach a win or loss inside five minutes;
- stay entirely client-side and deploy as a static GitHub Pages site;
- put at least one real game rule under a focused automated test;
- include at least one material change that came from playing the finished
  game rather than merely reading its code;
- preserve a legible process in commits, `PROCESS.md`, this file, and
  `reflections/crit-5.md`.

Error and permission recovery copy is allowed when required for accessibility
or browser failure, but it must diagnose the camera problem rather than teach
the game.

## The game in one sentence

Move your torso to control distance, bring both hands together to form a
short-lived guard, then answer each blocked strike with the correct left or
right counterpunch before the opponent's opening closes.

## Decisions already made

These are not open design questions:

- The game is a fixed-camera, side-view one-on-one fight. It does not scroll.
- The player's real **left hand produces the robot's left punch**; the real
  right hand produces the right punch.
- Bringing both hands together in front of the face/chest activates guard.
- There is no dodge mechanic.
- Torso weight shift controls continuous left/right movement: lean or move
  right to advance, left to retreat, return to neutral to stop.
- Movement controls range only. Retreating does not cancel an incoming hit;
  attacks must be guarded.
- The opponent does not slowly chase the player. It holds a fixed fighting
  mark, makes a short lunge only during an attack, then returns.
- The arena has a short boundary, so the player cannot retreat indefinitely.
- A round lasts at most 90 seconds. Three unguarded hits lose the round. Eight
  clean counterpunches break the opponent's mask and win. Reaching zero on the
  clock without breaking the mask is a loss.
- Raw camera imagery is not uploaded, stored, or sent anywhere. Recognition is
  performed locally in the browser.

## Core round loop

1. The opponent settles at its fixed mark.
2. It telegraphs one attack visually and sonically, then lunges.
3. The player closes both hands together during the impact window.
4. A successful guard produces an immediate shield impact and forces the
   opponent back to its mark.
5. One side of the opponent's face plate opens briefly. The opening must sit
   in the natural screen-space trajectory of the corresponding physical hand.
6. The player advances if needed and throws the matching left or right punch.
7. A clean counter adds one visible fracture stage. A wrong, early, late, or
   out-of-range punch deals no damage.
8. The opponent resets and the next exchange begins.

Later exchanges may shorten the telegraph, vary rhythm, alternate sides, or
include a visual feint. Do not add new controls, combos, projectiles, weapons,
inventory, dialogue, levels, or character selection. Depth comes from timing,
range and restraint, not feature count.

## Preventing degenerate play

### Permanent guard must not work

Joining the hands charges a guard pulse lasting about 650–750 ms. Its shield
begins bright and visibly drains. Keeping the hands together after it drains
does not block another hit. The player must separate the hands beyond the reset
threshold and join them again to recharge.

This rule must be communicated by the shield itself, never by text. A held
shield fades, crackles and disappears. Separating the hands restores the two
visible shield halves around the gloves.

### Punch spamming must not work

A hand cannot score twice until it has retracted to its ready zone. Punching
into the opponent's closed guard causes a short glove overheat/dim state and no
damage. Feedback must be immediate but short; never lock the player out for
long enough to feel like input lag.

### Retreating must not stall the game

The opponent remains fixed and does not pursue. Its attack lunge reaches the
entire legal player range, so movement is not a hidden dodge. The rear arena
boundary is firm but visually grounded. The 90-second clock guarantees an
ending, and a distant player may miss the counter window because they must
first close range.

## Wordless onboarding

The opening may show the title, but no visible control instructions.

1. A central camera-aperture control is the only obvious interactive object.
   Activating it requests the user-facing camera and unlocks audio. Its
   accessible label may identify its function, but no visible sentence should
   explain the controls.
2. Once tracking begins, two rendered robot gloves immediately attach to the
   player's hands. Moving either hand moves its glove with minimal latency.
3. The robot body mirrors the player's torso shift before the opponent attacks,
   allowing movement to be discovered through direct correspondence.
4. The first incoming attack is deliberately slow. As the player's hands
   approach each other, two shield halves visibly align; joining them completes
   the shield.
5. The first successful block is consequence-free and begins the scored round.
   The opponent's first opening is large, bright and long enough to invite a
   punch. Later windows become tighter.

If the player fails the calibration exchange, repeat it without removing
health. Do not display a hint. Make the visual cause and effect clearer on the
next repetition.

## Visual direction

### Overall style

- Modern high-definition pixel art, not a nostalgic low-detail 8-bit skin.
- Fixed side-view fighting composition with a low camera and readable
  silhouettes.
- Lonely, oppressive cyberpunk city at night: an abandoned wet street beneath
  an elevated rail line, distant towers dissolving into haze, restrained neon,
  rain, puddle reflections, intermittent signage and empty architecture.
- Combine cinematic pixel lighting and atmospheric depth with a disciplined
  fighting-game plane. Background richness must never compete with the hands,
  attack telegraph, opponent opening or guard state.
- Reference mixture: the modern lighting depth associated with *The Last
  Night*, the lonely rainy city mood of *SANABI*, and the clear side-on combat
  framing of contemporary pixel-action games. These are directional
  references, not assets to copy.

### Robots

- Human-scale industrial boxing units, not giant mechs.
- Near-human boxer proportions; modestly broad shoulders and fists only about
  15–20% larger than human boxing gloves.
- Heavy rectangular plates, worn paint, seams, rivets, small elbow/knee axes
  and restrained hydraulic details.
- No spikes, cannons, wings, giant shoulder armour, exposed weapon systems or
  heroic anime silhouettes.
- Their stance must read as boxing before it reads as machinery.
- Both fighters should look as though they came from the same industrial
  production line and were later modified for an illegal fight.
- Faces are blank black-glass visors with one horizontal sensor slit. The
  opponent visor accumulates eight pixel-fracture stages and serves as its
  health display.

### Colour and hierarchy

- Base world: near-black, blue-charcoal, wet gunmetal and desaturated concrete.
- Player: worn grey-white steel with cold cyan/white sensors.
- Opponent: deep iron with restrained warning-red and magenta sensors.
- Interactable/beneficial opening: bone white, not rainbow neon.
- Danger: dark red moving toward brighter red at impact.
- Keep the palette narrow. Cyan and magenta are identifiers, not ambient paint
  poured over the whole scene.

### Pixel treatment

- Render the authored game art on a deliberate logical pixel grid and upscale
  with nearest-neighbour sampling (`image-rendering: pixelated`).
- Keep silhouette edges and sprite frames crisp. Do not blur the fighters.
- High-resolution lighting, mist, rain, reflection and restrained bloom may sit
  above or behind the pixel layer, but they must not erase the pixel structure.
- Avoid generic AI-neon clutter, dozens of signs, chromatic aberration across
  the whole frame, scanlines strong enough to reduce readability, and fake CRT
  curvature.

### Composition and responsive behaviour

- Desktop and phone use the same game rules and state, not separate games.
- Keep both fighters and all gameplay hit regions inside a responsive safe
  area expressed in normalized coordinates.
- Desktop may reveal more city at the sides. Portrait phone composition crops
  background depth, moves fighters slightly closer and uses more vertical city
  space. Never ask the marker to rotate the device.
- Raw webcam video should not dominate the game. Prefer a processed silhouette,
  scan texture or no persistent camera picture once tracking is trusted.
- The player must always understand which robot is theirs through immediate
  motion correspondence and cyan/white identity, not a label.

## HUD and feedback

- No conventional instruction panel or control legend.
- Avoid large traditional health bars. The opponent visor fractures across
  eight successful counters; the player's state appears as up to three red
  edge fractures/impact scars in the frame.
- A compact pixel clock may be shown because it states game state rather than
  teaching controls.
- The guard shield is made of two halves attached to the gloves. Joining the
  hands completes it; its brightness shows remaining active time.
- A valid tracked left/right hand receives a quiet glove outline. Lost or
  low-confidence tracking makes that outline fragment rather than pretending
  the input is valid.
- Every accepted punch, rejected punch, guard, hit and lost-tracking pause must
  have distinct visual and audio feedback.
- Gameplay feedback begins immediately. Cosmetic settling may use inertia, but
  never delay acknowledgement of the user's gesture.

## Motion language

- Fighters are heavy: short anticipation, fast impact, slow mechanical settle.
- Input feedback should begin within one rendered frame after a recognized
  gesture. Most UI feedback stays under 300 ms.
- Gameplay telegraphs may be longer because their duration is the rule, not
  decoration.
- Use interruptible transitions or the Web Animations API for rapidly
  retargeted effects. Avoid long keyframes that restart awkwardly during rapid
  punches.
- Animate transforms and opacity where possible. Camera shake, bloom and
  afterimage must be brief and proportional to impact.
- `prefers-reduced-motion` removes camera shake, parallax and long afterimages,
  but keeps colour/opacity telegraphs needed to play fairly.

## Sound direction

- Sparse rain and distant electrical hum establish the city.
- The camera-entry gesture may also unlock a Web Audio context.
- Movement uses quiet servo/weight sounds, not a sound on every inference
  update.
- Guard: compressed metal impact plus a short electrical shield crack.
- Clean punch: low mechanical strike, small high-frequency plate snap and
  stereo placement matching the hand.
- Rejected punch: dull armour contact and a brief glove overheat fizz.
- Player hit: heavier sub impact and momentary ambience ducking.
- Win/loss must sound conclusive without needing written explanation.
- Keep levels conservative and never let ambience mask gesture feedback.

## Camera and recognition architecture

Use MediaPipe Tasks Vision Pose Landmarker for browser/JavaScript unless a
measured prototype proves another local solution substantially better.

- Request `facingMode: "user"` only after the central entry gesture.
- Mirror both the visual representation and landmark coordinates so movement
  feels like a mirror while anatomical left/right identity remains correct.
- Keep all frames local. No backend, upload, recording, analytics or image
  persistence.
- Run synchronous video inference away from the render loop, preferably in a
  Web Worker. Target roughly 20–30 inference updates per second and render at
  the browser's available frame cadence.
- Load the model once and show a visual loading state through the aperture;
  never allow a half-initialized round to start.
- Pause the opponent and round clock whenever required landmarks are lost or
  confidence falls below threshold. Tracking failure must never cost health.
- Handle tab visibility changes, stream interruption, camera revocation and
  retry cleanly.
- Pin package versions and keep any model URL/path explicit. Do not rely on a
  floating `latest` asset.

## Recognition rules

Keep recognition constants and pure geometry separate from DOM, rendering and
MediaPipe. Thresholds are starting values to tune through real play, not magic
truth.

### Coordinate normalization

- Normalize all distances and velocities by current shoulder width.
- Derive torso centre from hips plus shoulders when reliable, otherwise use a
  smoothed shoulder midpoint.
- Maintain a calibrated neutral torso x-position. Re-centre it only very slowly
  during confidently idle periods; never chase an active lean.

### Movement

- Torso displacement below about `0.10` shoulder widths is a dead zone.
- Between roughly `0.10` and `0.40`, map displacement continuously to movement
  speed; clamp beyond it.
- Smooth torso input over approximately 120–180 ms so a punch's shoulder twist
  does not move the fighter, while beginning visible response immediately.
- Apply short acceleration/deceleration and boundary friction to the rendered
  robot. Do not make functional collision depend on a decorative lagging body.

### Guard

- Both wrists must be close to each other and their midpoint must be in a
  generous face/upper-chest guard zone.
- Enter guard only when the hands have recently moved toward each other.
- Guard is active for approximately 650–750 ms and then drains even if held.
- Require the wrists to separate beyond a larger reset threshold before a new
  guard pulse can form; use hysteresis so boundary noise does not chatter.

### Left and right punches

- Track anatomical hands independently.
- A punch begins in a ready/guard region, shows outward wrist velocity and
  increasing elbow extension, enters the relevant screen-space hit region,
  then must retract before the same hand can score again.
- Do not rely only on z-depth or apparent hand size; a straight punch toward a
  monocular camera is too ambiguous. Combine elbow angle, normalized wrist
  displacement, velocity and target intersection.
- Place target openings slightly off-centre so each punch has a readable
  two-dimensional trajectory.
- Confidence loss or an incomplete gesture rejects neutrally; it must not
  become a hit against the player.

## Recommended source boundaries

Keep game rules testable without a camera, canvas or AudioContext.

- `src/game-state.ts`: pure state machine, timers, win/loss, attack and counter
  windows.
- `src/pose-rules.ts`: pure normalized landmark geometry and recognition state
  machines for movement, guard and punches.
- `src/vision.ts`: camera lifecycle, MediaPipe setup and worker messaging.
- `src/renderer.ts`: responsive pixel-stage rendering and visual effects.
- `src/audio.ts`: Web Audio lifecycle and named feedback cues.
- `src/assets.ts`: explicit sprite/background asset loading and fallbacks.
- `main.ts`: composition and input/event wiring only.

Names may change when implementation makes a better boundary obvious, but do
not collapse pure game rules into one giant canvas event loop.

## Asset workflow

Claude does not need to fake finished art with enormous hand-written pixel
arrays. Build an asset-driven renderer with clearly named placeholders, then
replace them with approved generated or hand-edited assets.

Expected asset groups:

- player robot sprite sheet: idle, advance, retreat, left punch, right punch,
  guard charge, guard active, hit, win and loss;
- opponent sprite sheet: idle, telegraph, lunge, recoil, open-left,
  open-right, hit, win and loss;
- eight opponent visor fracture states;
- fixed arena layers: foreground wet street, combat plane, elevated rail,
  middle city, distant skyline and haze;
- rain, reflection, impact, shield and glove-overheat effects;
- 1200×630 `public/card.png` matching the actual final art direction.

Use source assets only when their licence and provenance are recorded. Do not
copy imagery from the visual references.

## Tests and sensors

Preserve `spec/invariants.test.ts`. Add focused contract tests around pure
rules, not CSS class names or implementation details.

At minimum protect:

- the game always reaches win or loss within its time limit;
- exactly three accepted enemy hits lose the round;
- only the matching retracted-and-rethrown hand can damage the open side during
  the counter window;
- a permanently held guard expires and cannot block again until hands reset;
- torso movement inside the dead zone produces zero movement;
- tracking loss pauses time and cannot harm the player.

The published spec requires at least one focused test; these additional tests
are valuable because they protect fairness. Tests do not prove that camera
recognition feels fair. Real play is mandatory.

## Manual verification matrix

Before calling the game finished, inspect and play the built output, not just
the dev page.

- Desktop marking viewport: entry, permission, calibration, movement, both
  punches, guard expiry/reset, range, win, loss and restart.
- Phone marking viewport in portrait: no rotation request, safe-area layout,
  readable fighters, camera permission, touch entry and full round.
- Real webcam under bright and dim light, plain and cluttered backgrounds,
  standing and seated upper-body framing.
- Left/right identity using recorded landmark fixtures and a real mirrored
  camera pass.
- Camera denied, camera revoked, stream interrupted, model load failure, tab
  hidden/restored and landmarks temporarily lost.
- `prefers-reduced-motion`, keyboard focus for the camera/retry/restart
  controls, and useful accessible names without visible tutorial copy.
- Audio muted/autoplay-suspended and resumed after a valid user gesture.

Record at least one actual gameplay problem found during these passes and the
change made because of it. That moment belongs in `PROCESS.md` with the real
commit that fixes it.

## Implementation order and commit shape

Do not attempt the whole game in one generation. Preserve a history that grew
with the work.

1. **Harness commit:** this direction plus any focused spec skeletons; no fake
   claims that unbuilt behaviour exists.
2. **Rules commit:** pure round reducer and recognition geometry with focused
   tests and recorded landmark fixtures.
3. **Camera commit:** permission flow, local MediaPipe pipeline, tracking-loss
   pause and a minimal visible landmark/glove diagnostic.
4. **Playable commit:** placeholder side-view fighters, movement, guard,
   attacks, counter windows, win/loss and restart.
5. **Art-direction commit(s):** approved pixel assets, responsive arena,
   lighting, rain, feedback and audio without changing the tested contracts.
6. **Play-test correction commit:** a concrete fairness/usability change found
   by playing at the marking viewports with the real camera.
7. **Evidence and ship:** concise `PROCESS.md`, `reflections/crit-5.md`, final
   card, `pnpm check`, `pnpm check:evidence`, public Pages deployment and live
   HTTP verification.

Commit messages should name the decision or behaviour, not say "updates" or
"final polish". Never cite commits in evidence before they exist.

## Definition of done

The project is done only when all are true:

- A first-time player can enter and discover movement, guard and both punches
  without instruction text.
- Left/right recognition is stable and mirrored correctly.
- A held guard expires; punch spam and endless retreat do not solve the game.
- A full round reaches a clear win or loss in no more than 90 seconds.
- The rainy cyberpunk city, human-scale industrial robots and modern HD pixel
  treatment match this direction without sacrificing gameplay readability.
- Camera/tracking failure pauses fairly and can recover.
- Desktop and portrait phone marking viewports are playable.
- Focused game-rule tests, invariant tests, typecheck, build and evidence all
  pass.
- `PROCESS.md` cites 3–4 real, resolvable moments and the requested
  play-derived correction is among them.
- The repository is public only after explicit owner approval, GitHub Pages is
  live, CI is green, and the deployed URL returns HTTP 200.

## Explicitly out of scope

- No backend, accounts, leaderboard, multiplayer, uploads or stored video.
- No keyboard-controlled substitute as the primary game.
- No dodge, jump, crouch, kick, weapons, special moves or combo notation.
- No scrolling level, story cutscene, character select, settings maze or
  tutorial.
- No giant mechs or exaggerated anime armour.
- No permanent guard, auto-chasing opponent or hidden movement-as-dodge.
- No instruction copy used to compensate for weak visual affordance.
- No ship, repository visibility change or public deployment without the
  owner's explicit instruction.
