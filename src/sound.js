// Cute 8-bit chiptune sound effects using Web Audio API (no external audio files needed)
class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('hammy_muted') === '1';
  }

  ensureCtx() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('hammy_muted', this.muted ? '1' : '0');
    return this.muted;
  }

  tone(freq, dur = 0.08, type = 'square', gainVal = 0.05, delay = 0) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  squeak() {
    this.tone(740, 0.06, 'square', 0.045, 0);
    this.tone(980, 0.08, 'square', 0.045, 0.055);
  }

  munch() {
    this.tone(320, 0.05, 'triangle', 0.06, 0);
    this.tone(420, 0.05, 'triangle', 0.06, 0.07);
    this.tone(360, 0.06, 'triangle', 0.06, 0.14);
  }

  heart() {
    this.tone(523, 0.07, 'sine', 0.06, 0);
    this.tone(659, 0.07, 'sine', 0.06, 0.06);
    this.tone(784, 0.12, 'sine', 0.06, 0.12);
  }

  splash() {
    this.tone(440, 0.05, 'sine', 0.04, 0);
    this.tone(587, 0.07, 'sine', 0.04, 0.05);
  }

  sweep() {
    this.tone(260, 0.07, 'triangle', 0.05, 0);
    this.tone(390, 0.08, 'triangle', 0.05, 0.06);
  }

  sleep() {
    this.tone(392, 0.1, 'sine', 0.04, 0);
    this.tone(330, 0.14, 'sine', 0.04, 0.1);
  }
}

export const sfx = new SoundFX();
