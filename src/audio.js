// Create/resume synchronously in a trusted gesture, before delayed swing/network audio.
export class GolfAudio {
  constructor(enabled, createContext = () => {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    return Context ? new Context({ latencyHint: 'interactive' }) : null;
  }) {
    this.enabled = enabled; this.createContext = createContext;
    this.context = null; this.noise = null; this.pending = null;
  }
  unlock() {
    if (!this.enabled()) return Promise.resolve(false);
    try {
      if (!this.context || this.context.state === 'closed') {
        this.context = this.createContext(); this.noise = null;
      }
      const ctx = this.context;
      if (!ctx) return Promise.resolve(false);
      if (ctx.state === 'running') return Promise.resolve(true);
      // Also handle mobile interruptions, not only the initial 'suspended' state.
      const resumed = ctx.resume();
      const silent = ctx.createBufferSource();
      silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      silent.connect(ctx.destination); silent.onended = () => silent.disconnect(); silent.start(0);
      const pending = Promise.resolve(resumed).then(() => ctx.state === 'running').catch(() => false);
      this.pending = pending;
      pending.finally(() => { if (this.pending === pending) this.pending = null; });
      return pending;
    } catch { return Promise.resolve(false); }
  }
  play(callback) {
    if (!this.enabled()) return;
    const ctx = this.context;
    if (ctx?.state === 'running') { try { callback(ctx); } catch {} }
    else if (this.pending) this.pending.then(ok => {
      if (ok && this.enabled() && this.context === ctx) { try { callback(ctx); } catch {} }
    });
  }
  tone(frequency = 500, duration = .15, type = 'sine', volume = .065) {
    this.play(ctx => {
      const start = ctx.currentTime, oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * .6), start + duration);
      gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(.001, start + duration);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start); oscillator.stop(start + duration);
    });
  }
  noiseBurst({ delay = 0, duration = .12, lowpass = 1200, highpass = 180, type = 'bandpass', volume = .09, q = .8 } = {}) {
    this.play(ctx => {
      if (!this.noise) {
        this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .42), ctx.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      const start = ctx.currentTime + delay, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = this.noise; filter.type = type; filter.Q.setValueAtTime(q, start);
      filter.frequency.setValueAtTime(lowpass, start); filter.frequency.exponentialRampToValueAtTime(Math.max(80, highpass), start + duration);
      gain.gain.setValueAtTime(.0001, start); gain.gain.linearRampToValueAtTime(volume, start + Math.min(.018, duration * .22));
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      source.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
      source.start(start); source.stop(start + duration);
    });
  }
}
