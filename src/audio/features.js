const EPSILON = 1e-8;
const BAND_COUNT = 16;
const CEPSTRAL_COUNT = 10;

export function downsampleTo16k(input, inputSampleRate) {
  if (inputSampleRate === 16000) {
    return new Float32Array(input);
  }

  const ratio = inputSampleRate / 16000;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = index * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(left + 1, input.length - 1);
    const weight = sourceIndex - left;
    output[index] = input[left] * (1 - weight) + input[right] * weight;
  }

  return output;
}

export function cosineSimilarity(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm) + EPSILON);
}

export function averageEmbeddings(embeddings) {
  if (!embeddings.length) {
    return new Float32Array(0);
  }

  const result = new Float32Array(embeddings[0].length);

  for (const embedding of embeddings) {
    for (let index = 0; index < embedding.length; index += 1) {
      result[index] += embedding[index] / embeddings.length;
    }
  }

  return normalizeVector(result);
}

export function createAudioEmbedding(samples, sampleRate) {
  const framed = createFrames(samples, Math.round(sampleRate * 0.032), Math.round(sampleRate * 0.016));
  const spectralCentroids = [];
  const spectralRolloffs = [];
  const spectralFlatnesses = [];
  const bandMeans = new Float32Array(BAND_COUNT);
  const bandSquares = new Float32Array(BAND_COUNT);
  const cepstralMeans = new Float32Array(CEPSTRAL_COUNT);
  const cepstralSquares = new Float32Array(CEPSTRAL_COUNT);
  const pitchBins = new Float32Array(12);
  const pitchValues = [];
  const pitchStrengths = [];
  let rmsTotal = 0;
  let zcrTotal = 0;

  for (const frame of framed) {
    const windowed = applyHann(frame);
    const spectrum = magnitudeSpectrum(windowed, 128);
    const frameEnergy = frameRms(frame);
    const zcr = zeroCrossingRate(frame);
    const centroid = spectralCentroid(spectrum, sampleRate);
    const rolloff = spectralRolloff(spectrum, sampleRate, 0.85);
    const bands = bandEnergiesForSpectrum(spectrum, BAND_COUNT);
    const cepstra = dct(Array.from(bands, (value) => Math.log1p(value)), CEPSTRAL_COUNT);
    const pitch = accumulatePitchBins(frame, sampleRate, pitchBins);

    rmsTotal += frameEnergy;
    zcrTotal += zcr;
    spectralCentroids.push(centroid / (sampleRate / 2));
    spectralRolloffs.push(rolloff / (sampleRate / 2));
    spectralFlatnesses.push(spectralFlatness(spectrum));

    for (let index = 0; index < BAND_COUNT; index += 1) {
      const value = Math.log1p(bands[index]);
      bandMeans[index] += value;
      bandSquares[index] += value * value;
    }

    for (let index = 0; index < CEPSTRAL_COUNT; index += 1) {
      cepstralMeans[index] += cepstra[index];
      cepstralSquares[index] += cepstra[index] * cepstra[index];
    }

    if (pitch.frequency > 0) {
      pitchValues.push(pitch.frequency / 400);
      pitchStrengths.push(pitch.strength);
    }
  }

  const frameCount = Math.max(framed.length, 1);
  const embeddingParts = [
    rmsTotal / frameCount,
    zcrTotal / frameCount,
    mean(spectralCentroids),
    standardDeviation(spectralCentroids),
    mean(spectralRolloffs),
    standardDeviation(spectralRolloffs),
    mean(spectralFlatnesses),
    standardDeviation(spectralFlatnesses),
    ...Array.from(bandMeans, (value) => value / frameCount),
    ...Array.from(bandSquares, (value, index) => Math.sqrt(Math.max(0, value / frameCount - (bandMeans[index] / frameCount) ** 2))),
    ...Array.from(cepstralMeans, (value) => value / frameCount),
    ...Array.from(cepstralSquares, (value, index) =>
      Math.sqrt(Math.max(0, value / frameCount - (cepstralMeans[index] / frameCount) ** 2))
    ),
    mean(pitchValues),
    standardDeviation(pitchValues),
    mean(pitchStrengths),
    pitchValues.length / frameCount,
    ...Array.from(pitchBins, (value) => value / frameCount)
  ];

  return normalizeVector(Float32Array.from(embeddingParts));
}

function createFrames(samples, frameSize, hopSize) {
  const frames = [];

  for (let offset = 0; offset + frameSize <= samples.length; offset += hopSize) {
    frames.push(samples.slice(offset, offset + frameSize));
  }

  if (!frames.length && samples.length) {
    const padded = new Float32Array(frameSize);
    padded.set(samples.slice(0, Math.min(samples.length, frameSize)));
    frames.push(padded);
  }

  return frames;
}

function applyHann(frame) {
  const output = new Float32Array(frame.length);
  const denominator = Math.max(frame.length - 1, 1);

  for (let index = 0; index < frame.length; index += 1) {
    const multiplier = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / denominator);
    output[index] = frame[index] * multiplier;
  }

  return output;
}

function magnitudeSpectrum(frame, bins) {
  const spectrum = new Float32Array(bins);

  for (let bin = 0; bin < bins; bin += 1) {
    let real = 0;
    let imaginary = 0;

    for (let index = 0; index < frame.length; index += 1) {
      const angle = (2 * Math.PI * bin * index) / frame.length;
      real += frame[index] * Math.cos(angle);
      imaginary -= frame[index] * Math.sin(angle);
    }

    spectrum[bin] = Math.sqrt(real * real + imaginary * imaginary);
  }

  return spectrum;
}

function spectralCentroid(spectrum, sampleRate) {
  let weighted = 0;
  let total = 0;

  for (let bin = 0; bin < spectrum.length; bin += 1) {
    const frequency = (bin / spectrum.length) * (sampleRate / 2);
    weighted += frequency * spectrum[bin];
    total += spectrum[bin];
  }

  return weighted / (total + EPSILON);
}

function spectralRolloff(spectrum, sampleRate, ratio) {
  const total = spectrum.reduce((sum, value) => sum + value, 0);
  const target = total * ratio;
  let cumulative = 0;

  for (let bin = 0; bin < spectrum.length; bin += 1) {
    cumulative += spectrum[bin];
    if (cumulative >= target) {
      return (bin / spectrum.length) * (sampleRate / 2);
    }
  }

  return sampleRate / 2;
}

function bandEnergiesForSpectrum(spectrum, bandCount) {
  const bands = new Float32Array(bandCount);

  for (let bin = 1; bin < spectrum.length; bin += 1) {
    const bandIndex = Math.min(
      bandCount - 1,
      Math.floor((Math.log2(bin + 1) / Math.log2(spectrum.length + 1)) * bandCount)
    );
    bands[bandIndex] += spectrum[bin] * spectrum[bin];
  }

  return bands;
}

function spectralFlatness(spectrum) {
  let logTotal = 0;
  let linearTotal = 0;
  let count = 0;

  for (let index = 1; index < spectrum.length; index += 1) {
    const value = spectrum[index] + EPSILON;
    logTotal += Math.log(value);
    linearTotal += value;
    count += 1;
  }

  return Math.exp(logTotal / Math.max(count, 1)) / (linearTotal / Math.max(count, 1) + EPSILON);
}

function dct(values, coefficientCount) {
  const output = new Float32Array(coefficientCount);
  const length = values.length;

  for (let coefficient = 0; coefficient < coefficientCount; coefficient += 1) {
    let sum = 0;

    for (let index = 0; index < length; index += 1) {
      sum += values[index] * Math.cos((Math.PI * coefficient * (index + 0.5)) / length);
    }

    output[coefficient] = sum / Math.sqrt(length);
  }

  return output;
}

function accumulatePitchBins(frame, sampleRate, bins) {
  const minLag = Math.floor(sampleRate / 320);
  const maxLag = Math.floor(sampleRate / 80);
  let bestLag = 0;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;

    for (let index = 0; index + lag < frame.length; index += 1) {
      correlation += frame[index] * frame[index + lag];
    }

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (bestLag > 0) {
    const frequency = sampleRate / bestLag;
    const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
    const energy = frameRms(frame) ** 2 * frame.length;
    bins[((midi % bins.length) + bins.length) % bins.length] += Math.max(bestCorrelation, 0);
    return {
      frequency,
      strength: Math.max(bestCorrelation, 0) / (energy + EPSILON)
    };
  }

  return { frequency: 0, strength: 0 };
}

function frameRms(frame) {
  let sumSquares = 0;

  for (const sample of frame) {
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / Math.max(frame.length, 1));
}

function zeroCrossingRate(frame) {
  let crossings = 0;
  let previous = frame[0] ?? 0;

  for (const sample of frame) {
    if ((sample >= 0 && previous < 0) || (sample < 0 && previous >= 0)) {
      crossings += 1;
    }

    previous = sample;
  }

  return crossings / Math.max(frame.length, 1);
}

function mean(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 0;
  }

  const average = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function normalizeVector(vector) {
  let norm = 0;

  for (const value of vector) {
    norm += value * value;
  }

  const denominator = Math.sqrt(norm) + EPSILON;

  for (let index = 0; index < vector.length; index += 1) {
    vector[index] /= denominator;
  }

  return vector;
}
