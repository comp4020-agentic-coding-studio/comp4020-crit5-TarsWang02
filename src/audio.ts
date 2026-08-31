// Sparse procedural sound bed. Everything is synthesized locally after the
// camera-entry gesture, so there are no downloads, recordings or autoplay.
import type { RoundEvent } from "./game-state.ts";

type AudibleEvent = Exclude<RoundEvent, null>;

let context: AudioContext | null = null;
let master: GainNode | null = null;
let ambience: GainNode | null = null;
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
  ambience.gain.value = 0.32;
  ambience.connect(master);

  const hum = ctx.createOscillator();
  const humFilter = ctx.createBiquadFilter();
  const humGain = ctx.createGain();
  hum.type = "sine";
  hum.frequency.value = 46;
  humFilter.type = "lowpass";
  humFilter.frequency.value = 95;
  humGain.gain.value = 0.07;
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
  rainGain.gain.value = 0.032;
  rain.connect(rainFilter).connect(rainGain).connect(ambience);
  rain.start();
}

export function unlockAudioContext(): AudioContext {
  context ??= new AudioContext();
  if (!master) {
    master = context.createGain();
    master.gain.value = 0.28;
    master.connect(context.destination);
  }
  if (context.state === "suspended") void context.resume();
  startAmbience(context);
  return context;
}

function tone(frequency: number, duration: number, gain: number, type: OscillatorType, delay = 0): void {
  if (!context || !master || context.state !== "running") return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, frequency * 0.68), start + duration);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope).connect(master);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noiseBurst(duration: number, gain: number, frequency: number, delay = 0): void {
  if (!context || !master || context.state !== "running") return;
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
  source.connect(filter).connect(envelope).connect(master);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function duckAmbience(amount: number, duration: number): void {
  if (!context || !ambience) return;
  const now = context.currentTime;
  ambience.gain.cancelScheduledValues(now);
  ambience.gain.setValueAtTime(ambience.gain.value, now);
  ambience.gain.exponentialRampToValueAtTime(amount, now + 0.015);
  ambience.gain.exponentialRampToValueAtTime(0.32, now + duration);
}

export function playRoundEvent(event: AudibleEvent): void {
  switch (event) {
    case "guardSuccess":
      tone(185, 0.13, 0.18, "square");
      noiseBurst(0.11, 0.09, 1900);
      break;
    case "counterLanded":
      duckAmbience(0.1, 0.24);
      tone(92, 0.22, 0.3, "triangle");
      tone(760, 0.08, 0.09, "square", 0.015);
      noiseBurst(0.08, 0.12, 2500);
      break;
    case "guardMiss":
      duckAmbience(0.07, 0.38);
      tone(54, 0.34, 0.36, "sine");
      noiseBurst(0.16, 0.13, 720);
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
