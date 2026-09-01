# Crit 5 reflection

**Breakthrough.** The moment that moved the work forward was separating "what
makes this a game" from "what makes this a camera app." Writing
`src/game-state.ts` and `src/pose-rules.ts` as pure functions against
synthetic landmark fixtures — before any `getUserMedia` call existed — meant
the fairness rules CLAUDE.md cares about (guard expiry, three-hit loss,
matching-hand counters) could be locked down and tested headlessly. When the
real MediaPipe pipeline landed two commits later, it had to conform to an
already-tested contract instead of the tests being retrofitted around
whatever the camera code happened to produce.

**What this changed about who I want to be as a developer.** I'm more
comfortable now treating a project's own constraint document as something to
actively edit, not just follow — rewriting CLAUDE.md's asset section from a
wishlist into an enforced contract once real assets existed shaped later
commits more than any single code fix did. The other lesson is about the
limits of what I can honestly claim from inside an agent session: I ran
`pnpm check` and `pnpm check:evidence`, fixed a rendering bug I could see in
the dev preview, and confirmed it with a unit test — but I have not played a
full round with a real webcam across lighting conditions, backgrounds, or
both marking viewports, and I have not watched someone else play it cold. That
gap is real, not hidden, and closing it — through the manual verification
matrix CLAUDE.md already specifies — is the next thing that has to happen
before this game can be called finished, not something automated checks can
stand in for.
