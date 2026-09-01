// Sparse procedural sound bed. Everything is synthesized locally after the
// camera-entry gesture, so there are no downloads, recordings or autoplay.
import type { RoundEvent } from "./game-state.ts";

type AudibleEvent = Exclude<RoundEvent, null>;

let context: AudioContext | null = null;
let master: GainNode | null = null;
let ambience: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let ambienceStarted = false;

function createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.ceil(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function startAmbience(ctx: AudioContext): void {
  if (ambienceStarted || !master) return;
  ambienceStarted = true;
  ambience = ctx.createGain();
  ambience.gain.value = 0.22;
  ambience.connect(master);

  const hum = ctx.createOscillator();
  const humFilter = ctx.createBiquadFilter();
  const humGain = ctx.createGain();
  hum.type = "sine";
  hum.frequency.value = 46;
  humFilter.type = "lowpass";
  humFilter.frequency.value = 95;
  humGain.gain.value = 0.09;
  hum.connect(humFilter).connect(humGain).connect(ambience);
  hum.start();

  const rain = ctx.createBufferSource();
  const rainFilter = ctx.createBiquadFilter();
  const rainGain = ctx.createGain();
  rain.buffer = createNoiseBuffer(ctx, 2.5);
  rain.loop = true;
  rainFilter.type = "bandpass";
  rainFilter.frequency.value = 3100;
  rainFilter.Q.value = 0.45;
  rainGain.gain.value = 0.045;
  rain.connect(rainFilter).connect(rainGain).connect(ambience);
  rain.start();
}

export function unlockAudioContext(): AudioContext {
  context ??= new AudioContext();
  if (!master) {
    master = context.createGain();
    master.gain.value = 0.62;
    compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;
    master.connect(compressor).connect(context.destination);
  }
  if (context.state === "suspended") void context.resume();
  startAmbience(context);
  return context;
}

function tone(
  frequency: number,
  duration: number,
  gain: number,
  type: OscillatorType,
  delay = 0,
  pan = 0,
  endRatio = 0.68,
): void {
  if (!context || !master) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, frequency * endRatio), start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  const panner = context.createStereoPanner();
  panner.pan.value = pan;
  oscillator.connect(envelope).connect(panner).connect(master);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noiseBurst(duration: number, gain: number, frequency: number, delay = 0, pan = 0): void {
  if (!context || !master) return;
  const start = context.currentTime + delay;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();
  source.buffer = createNoiseBuffer(context, duration + 0.04);
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 0.9;
  envelope.gain.setValueAtTime(gain, start);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  const panner = context.createStereoPanner();
  panner.pan.value = pan;
  source.connect(filter).connect(envelope).connect(panner).connect(master);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function duckAmbience(amount: number, duration: number): void {
  if (!context || !ambience) return;
  const now = context.currentTime;
  ambience.gain.cancelScheduledValues(now);
  ambience.gain.setValueAtTime(ambience.gain.value, now);
  ambience.gain.exponentialRampToValueAtTime(amount, now + 0.015);
  ambience.gain.exponentialRampToValueAtTime(0.22, now + duration);
}

export type ActionCue = "leftPunch" | "rightPunch" | "guard";
export type PhaseCue = "telegraph" | "lunge" | "opening";

export function playActionCue(action: ActionCue): void {
  if (action === "guard") {
    tone(240, 0.16, 0.11, "sine", 0, 0, 1.7);
    tone(520, 0.1, 0.045, "triangle", 0.035, 0, 0.82);
    return;
  }
  const pan = action === "leftPunch" ? -0.46 : 0.46;
  tone(175, 0.11, 0.13, "sawtooth", 0, pan, 0.3);
  noiseBurst(0.075, 0.07, 1050, 0.012, pan);
}

export function playPhaseCue(phase: PhaseCue): void {
  if (phase === "telegraph") {
    tone(310, 0.07, 0.055, "square", 0, 0.3, 0.92);
    tone(310, 0.07, 0.045, "square", 0.11, 0.3, 0.92);
  } else if (phase === "lunge") {
    noiseBurst(0.16, 0.085, 620, 0, 0.35);
    tone(120, 0.16, 0.085, "sawtooth", 0, 0.25, 0.42);
  } else {
    tone(680, 0.12, 0.075, "triangle", 0, 0, 1.18);
  }
}

export function playRoundEvent(event: AudibleEvent): void {
  switch (event) {
    case "guardSuccess":
      duckAmbience(0.08, 0.22);
      tone(165, 0.18, 0.22, "square", 0, -0.08, 0.48);
      noiseBurst(0.13, 0.16, 1750);
      break;
    case "counterLanded":
      duckAmbience(0.045, 0.3);
      tone(76, 0.28, 0.42, "triangle", 0, 0.28, 0.38);
      tone(920, 0.075, 0.13, "square", 0.012, 0.34, 0.52);
      noiseBurst(0.11, 0.24, 2300, 0, 0.3);
      break;
    case "guardMiss":
      duckAmbience(0.07, 0.38);
      tone(48, 0.38, 0.42, "sine", 0, -0.32, 0.5);
      noiseBurst(0.2, 0.2, 680, 0, -0.28);
      break;
    case "punchRejectedGuarded":
    case "punchRejectedWrongSide":
    case "punchRejectedOutOfRange":
      tone(118, 0.09, 0.12, "square");
      noiseBurst(0.12, 0.055, 3600);
      break;
    case "roundWin":
      duckAmbience(0.08, 0.7);
      tone(110, 0.36, 0.24, "triangle");
      tone(165, 0.42, 0.2, "triangle", 0.12);
      tone(247, 0.5, 0.16, "sine", 0.25);
      break;
    case "roundLoss":
      duckAmbience(0.055, 0.8);
      tone(92, 0.46, 0.28, "sawtooth");
      tone(58, 0.62, 0.2, "sine", 0.12);
      break;
  }
}
