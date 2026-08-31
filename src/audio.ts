// Web Audio lifecycle. Only the entry-gesture unlock exists so far; named
// feedback cues (guard, punch, hit, win/loss) land with the art-direction
// stage without moving this boundary.
let context: AudioContext | null = null;

export function unlockAudioContext(): AudioContext {
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}
