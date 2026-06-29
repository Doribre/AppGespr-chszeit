export class EnergyVad {
  constructor() {
    this.noiseFloor = 0.004;
    this.lastSpeech = false;
    this.hangoverMs = 650;
    this.lastSpeechAt = 0;
  }

  analyze(samples, nowMs = performance.now()) {
    let sumSquares = 0;
    let zeroCrossings = 0;
    let previous = samples[0] ?? 0;

    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index];
      sumSquares += sample * sample;

      if ((sample >= 0 && previous < 0) || (sample < 0 && previous >= 0)) {
        zeroCrossings += 1;
      }

      previous = sample;
    }

    const rms = Math.sqrt(sumSquares / Math.max(samples.length, 1));
    const zcr = zeroCrossings / Math.max(samples.length, 1);
    const adaptiveThreshold = Math.max(0.008, this.noiseFloor * 2.2);
    const immediateSpeech = rms > adaptiveThreshold && zcr > 0.002 && zcr < 0.42;

    if (immediateSpeech) {
      this.lastSpeechAt = nowMs;
      this.noiseFloor = this.noiseFloor * 0.995 + Math.min(rms, 0.08) * 0.005;
    } else if (rms < this.noiseFloor * 1.5) {
      this.noiseFloor = this.noiseFloor * 0.98 + rms * 0.02;
    }

    const speech = immediateSpeech || nowMs - this.lastSpeechAt < this.hangoverMs;
    this.lastSpeech = speech;

    return {
      speech,
      rms,
      zcr,
      threshold: adaptiveThreshold,
      noiseFloor: this.noiseFloor
    };
  }
}
