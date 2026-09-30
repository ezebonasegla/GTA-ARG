// Tiny synthesized audio (no asset files): engine hum, horn, siren, impacts.
export class Audio {
  constructor() {
    this.ctx = null;
  }

  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(ctx.destination);

    this.engine = ctx.createOscillator();
    this.engine.type = 'sawtooth';
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 500;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engine.connect(filt).connect(this.engineGain).connect(this.master);
    this.engine.start();

    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();

    this.hornOsc = ctx.createOscillator();
    this.hornOsc.type = 'square';
    this.hornOsc.frequency.value = 415;
    const hf = ctx.createBiquadFilter();
    hf.type = 'lowpass';
    hf.frequency.value = 1400;
    this.hornGain = ctx.createGain();
    this.hornGain.gain.value = 0;
    this.hornOsc.connect(hf).connect(this.hornGain).connect(this.master);
    this.hornOsc.start();
  }

  update({ inCar, speed, throttle, horn, sirenDist, time }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = inCar ? 40 + Math.abs(speed) * 3.2 + throttle * 25 : 0;
    this.engine.frequency.setTargetAtTime(Math.max(30, rpm), t, 0.05);
    this.engineGain.gain.setTargetAtTime(inCar ? 0.12 + throttle * 0.1 : 0, t, 0.1);
    this.hornGain.gain.setTargetAtTime(horn ? 0.25 : 0, t, 0.02);
    const sv = sirenDist < 250 ? (1 - sirenDist / 250) * 0.12 : 0;
    this.sirenGain.gain.setTargetAtTime(sv, t, 0.1);
    this.sirenOsc.frequency.setTargetAtTime(Math.sin(time * 3) > 0 ? 950 : 700, t, 0.05);
  }

  thump(strength) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = Math.min(1, strength / 15);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }
}
