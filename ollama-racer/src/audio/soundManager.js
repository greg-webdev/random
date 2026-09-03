/**
 * Procedural Web Audio Engine & Synthwave Sound Generator for Ollama Hyperdrive
 */
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.ttsEnabled = true;
    this.musicPlaying = false;

    // Player Engine sound nodes
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;

    // AI Engine sound nodes
    this.aiEngineGain = null;
    this.aiEngineOsc = null;

    // Drift screech node
    this.driftGain = null;
    this.driftFilter = null;

    // Music interval
    this.musicInterval = null;
    this.currentStep = 0;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.setupEngineSound();
    this.setupDriftSound();
    this.startSynthwaveMusic();
  }

  setupEngineSound() {
    if (!this.ctx) return;

    // Engine Gain
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.05, this.ctx.currentTime);

    // Engine Filter (RPM roar)
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(220, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    // Osc 1: Deep rumble (sawtooth)
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(45, this.ctx.currentTime);

    // Osc 2: Sub-octave grit (square)
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(90, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  setupDriftSound() {
    if (!this.ctx) return;

    // Drift noise generator
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.driftFilter = this.ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.setValueAtTime(900, this.ctx.currentTime);
    this.driftFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    this.driftGain = this.ctx.createGain();
    this.driftGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    whiteNoise.connect(this.driftFilter);
    this.driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.ctx.destination);

    whiteNoise.start();
  }

  updateEngine(speed, maxSpeed, isAccelerating) {
    if (!this.ctx || !this.enabled || !this.engineGain) return;

    const ratio = Math.min(Math.abs(speed) / maxSpeed, 1.0);
    const targetFreq = 40 + ratio * 180 + (isAccelerating ? 25 : 0);
    const filterFreq = 180 + ratio * 1400;
    const targetVolume = isAccelerating ? 0.12 : 0.04;

    const t = this.ctx.currentTime + 0.05;
    this.engineOsc1.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(targetFreq * 1.5, this.ctx.currentTime, 0.05);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.05);
  }

  setDrifting(isDrifting, driftFactor = 1.0) {
    if (!this.ctx || !this.enabled || !this.driftGain) return;
    const targetVol = isDrifting ? Math.min(0.08 * driftFactor, 0.15) : 0.0;
    this.driftGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.06);
  }

  playBoost() {
    if (!this.ctx || !this.enabled) return;

    // Nitro whoosh + sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';

    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.7);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.7);
  }

  playBoostPad() {
    if (!this.ctx || !this.enabled) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc2.frequency.setValueAtTime(880.00, now); // A5

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  }

  playCheckpoint() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.setValueAtTime(987.77, now + 0.1); // B5

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  playCountdown(number) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const isGo = number === 0;
    osc.type = isGo ? 'square' : 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.7 : 0.25));

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + (isGo ? 0.7 : 0.25));
  }

  playRadioGlitch() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.setValueAtTime(400, now + 0.04);
    osc.frequency.setValueAtTime(1600, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  speakOllama(text) {
    if (!this.ttsEnabled || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.15;
      utterance.pitch = 0.85; // Slightly robotic/synthetic
      utterance.volume = 0.9;

      // Prefer robotic or English voices
      const voices = window.speechSynthesis.getVoices();
      const cyberVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('David') || v.name.includes('Zira')));
      if (cyberVoice) utterance.voice = cyberVoice;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS playback issue:', e);
    }
  }

  startSynthwaveMusic() {
    if (this.musicInterval) return;

    // 124 BPM synth bassline
    const bpm = 124;
    const sixteenthNoteMs = (60 / bpm / 4) * 1000;

    // Bass notes in D minor synthwave progression
    const bassline = [
      73.42, 73.42, 146.83, 73.42,  // D2, D2, D3, D2
      73.42, 73.42, 110.00, 130.81, // D2, D2, A2, C3
      65.41, 65.41, 130.81, 65.41,  // C2, C2, C3, C2
      55.00, 55.00, 110.00, 98.00   // A1, A1, A2, G2
    ];

    this.musicInterval = setInterval(() => {
      if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;

      const note = bassline[this.currentStep % bassline.length];
      const now = this.ctx.currentTime;

      // Bass synth note
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(note, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.12);

      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.14);

      // Kick drum every 4 steps
      if (this.currentStep % 4 === 0) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(140, now);
        kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.09);

        kickGain.gain.setValueAtTime(0.09, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        kickOsc.connect(kickGain);
        kickGain.connect(this.ctx.destination);
        kickOsc.start(now);
        kickOsc.stop(now + 0.12);
      }

      this.currentStep++;
    }, sixteenthNoteMs);
  }

  toggleSound() {
    this.enabled = !this.enabled;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setValueAtTime(this.enabled ? 0.05 : 0, this.ctx.currentTime);
    }
    return this.enabled;
  }

  toggleTTS() {
    this.ttsEnabled = !this.ttsEnabled;
    if (!this.ttsEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    return this.ttsEnabled;
  }
}
