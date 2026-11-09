// Original, synthesized sounds: no audio downloads, trackers or external assets.
export const AUDIO_DEFAULTS = { effectsEnabled: true, effectsVolume: 0.55, musicEnabled: false, musicVolume: 0.25 };
export function normalizeAudio(value = {}, legacyMuted = false) {
  const volume = (v, fallback) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
  return {
    effectsEnabled: typeof value?.effectsEnabled === 'boolean' ? value.effectsEnabled : !legacyMuted,
    effectsVolume: volume(value?.effectsVolume, AUDIO_DEFAULTS.effectsVolume),
    musicEnabled: value?.musicEnabled === true,
    musicVolume: volume(value?.musicVolume, AUDIO_DEFAULTS.musicVolume),
  };
}

const tone = (frequency, duration, volume, delay = 0, end = frequency, type = 'sine') => ({ frequency, duration, volume, delay, end, type });
export const SOUNDS = {
  click: [tone(650, 0.065, 0.12, 0, 470)],
  select: [tone(880, 0.09, 0.14, 0, 1100)],
  deselect: [tone(520, 0.09, 0.11, 0, 400)],
  countdown: [tone(580, 0.18, 0.15)],
  countdownLast: [tone(780, 0.18, 0.16)],
  start: [tone(660, 0.18, 0.15), tone(990, 0.25, 0.13, 0.12)],
  correct: [tone(1050, 0.115, 0.22, 0, 360)],
  wrong: [tone(190, 0.10, 0.075, 0, 125)],
  missed: [tone(480, 0.28, 0.15, 0, 160)],
  speed: [tone(260, 0.38, 0.08, 0, 900, 'triangle')],
  finish: [tone(660, 0.38, 0.13), tone(520, 0.38, 0.12, 0.35), tone(392, 0.5, 0.10, 0.7)],
  record: [tone(660, 0.28, 0.15), tone(830, 0.28, 0.14, 0.22), tone(990, 0.35, 0.14, 0.44), tone(1320, 0.65, 0.11, 0.85), tone(660, 0.65, 0.07, 0.85)],
};

export class GameAudio {
  constructor(createContext = () => new (window.AudioContext || window.webkitAudioContext)()) {
    this.createContext = createContext;
    this.preferences = { ...AUDIO_DEFAULTS };
    this.groups = [];
    this.musicVoices = new Set();
    this.active = false;
    this.destroyed = false;
    this.lastEffect = -Infinity;
  }

  unlock() {
    if (this.destroyed) return;
    try {
      if (!this.context) {
        this.context = this.createContext();
        this.effectsGain = this.context.createGain();
        this.musicGain = this.context.createGain();
        this.effectsGain.connect(this.context.destination);
        this.musicGain.connect(this.context.destination);
        this.configure(this.preferences);
      }
      const resumed = this.context.resume();
      Promise.resolve(resumed).then(() => this.syncMusic()).catch(() => {});
      this.syncMusic();
    } catch { /* Browsers without Web Audio can still play the game. */ }
  }

  configure(preferences) {
    this.preferences = normalizeAudio(preferences);
    if (this.context) {
      const now = this.context.currentTime;
      this.effectsGain.gain.setTargetAtTime(this.preferences.effectsEnabled ? this.preferences.effectsVolume * 0.65 : 0, now, 0.015);
      this.musicGain.gain.setTargetAtTime(this.preferences.musicEnabled ? this.preferences.musicVolume * 0.32 : 0, now, 0.02);
      if (!this.preferences.effectsEnabled || !this.preferences.effectsVolume) this.stopEffects();
    }
    this.syncMusic();
  }

  voice(note, destination, voices) {
    const ctx = this.context;
    const start = ctx.currentTime + (note.delay || 0);
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = note.type || 'sine';
    oscillator.frequency.setValueAtTime(note.frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(note.end || note.frequency, start + note.duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(note.volume, start + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    const voice = { oscillator, envelope };
    voices.add(voice);
    oscillator.onended = () => {
      oscillator.disconnect(); envelope.disconnect(); voices.delete(voice);
    };
    oscillator.start(start);
    oscillator.stop(start + note.duration + 0.01);
  }

  stopVoices(voices) {
    for (const { oscillator, envelope } of voices) {
      try { envelope.gain.cancelScheduledValues(this.context.currentTime); envelope.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.008); oscillator.stop(this.context.currentTime + 0.025); } catch { /* Already ended. */ }
    }
    voices.clear();
  }

  play(kind) {
    if (this.destroyed || !this.context || this.context.state !== 'running' || !this.preferences.effectsEnabled || !this.preferences.effectsVolume || !SOUNDS[kind]) return;
    const now = this.context.currentTime;
    this.groups = this.groups.filter(group => group.until > now);
    // Limit rapid input sounds as well as the total overlapping sound groups.
    if (['correct', 'wrong', 'click', 'select', 'deselect'].includes(kind) && now - this.lastEffect < 0.045) return;
    if (['finish', 'record', 'start'].includes(kind)) this.stopEffects();
    if (this.groups.length >= 4) this.stopVoices(this.groups.shift().voices);
    const voices = new Set();
    const notes = SOUNDS[kind];
    for (const note of notes) this.voice(note, this.effectsGain, voices);
    this.groups.push({ voices, until: now + Math.max(...notes.map(n => n.delay + n.duration)) + 0.02 });
    this.lastEffect = now;
  }

  stopEffects() { for (const group of this.groups) this.stopVoices(group.voices); this.groups = []; }
  setActive(active) { this.active = active; this.syncMusic(); }

  syncMusic() {
    const shouldPlay = !this.destroyed && this.active && this.preferences.musicEnabled && this.preferences.musicVolume > 0 && this.context?.state === 'running';
    if (!shouldPlay) { clearTimeout(this.musicTimer); this.musicTimer = null; this.stopVoices(this.musicVoices); return; }
    if (this.musicTimer) return;
    const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46, 440, 523.25, 659.25, 523.25, 392, 493.88, 587.33, 493.88];
    this.musicIndex ??= 0;
    const tick = () => {
      this.voice(tone(melody[this.musicIndex++ % melody.length], 0.7, 0.16), this.musicGain, this.musicVoices);
      this.musicTimer = setTimeout(tick, 450);
    };
    tick();
  }

  destroy() {
    this.destroyed = true;
    this.setActive(false);
    this.stopEffects();
    this.context?.close().catch(() => {});
  }
}
