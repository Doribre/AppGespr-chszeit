import { EnergyVad } from "./vad.js";
import { averageEmbeddings, cosineSimilarity, createAudioEmbedding, downsampleTo16k } from "./features.js";

const TARGET_SAMPLE_RATE = 16000;
const WINDOW_SECONDS = 1.25;
const LIVE_CONTEXT_SECONDS = 4;
const PROFILE_TARGET_SECONDS = 20;
const PROFILE_READY_SECONDS = 12;
const PROFILE_CONTEXT_SECONDS = 5;
const PROFILE_EMBEDDING_SECONDS = 2.5;
const PROFILE_EMBEDDING_HOP_SECONDS = 1.25;
const MAX_PROFILE_EMBEDDINGS = 14;
const SILENCE_GAP_SECONDS = 0.35;
const UNKNOWN_THRESHOLD = 0.56;
const MIN_MARGIN = 0.025;
const TENTATIVE_THRESHOLD = 0.42;
const TENTATIVE_MARGIN = 0.01;
const HOLD_LAST_SPEAKER_MS = 4000;
const CHANGE_SPEAKER_THRESHOLD = 0.5;
const MIN_PROFILE_PURITY = 0.62;
const PROFILE_COLLISION_THRESHOLD = 0.72;
const PROFILE_EMBEDDING_COLLISION_THRESHOLD = 0.985;
const PROFILE_EMBEDDING_HARD_COLLISION_THRESHOLD = 0.995;
const MIN_PROFILE_EMBEDDING_CONSISTENCY = 0.52;
const EMBEDDING_WEIGHT = 0.68;
const DIARIZATION_WEIGHT = 0.32;
const AGREEMENT_BOOST = 0.08;
const SHERPA_BASE = "./vendor/sherpa-onnx/";
const SHERPA_BROWSER_MAIN = "sherpa-onnx-wasm-main-speaker-diarization.js";
const SHERPA_BROWSER_WASM = "sherpa-onnx-wasm-main-speaker-diarization.wasm";
const SHERPA_BROWSER_DATA = "sherpa-onnx-wasm-main-speaker-diarization.data";

export class SpeakerShareEngine {
  async initialize() {
    throw new Error("initialize() is not implemented");
  }

  async enrollParticipant() {
    throw new Error("enrollParticipant() is not implemented");
  }

  async processAudio() {
    throw new Error("processAudio() is not implemented");
  }

  reset() {
    throw new Error("reset() is not implemented");
  }
}

export class SherpaOnnxWasmSpeakerEngine extends SpeakerShareEngine {
  constructor() {
    super();
    this.vad = new EnergyVad();
    this.module = null;
    this.diarizer = null;
    this.profiles = new Map();
    this.pendingSamples = new Float32Array(0);
    this.liveContextSamples = new Float32Array(0);
    this.framesProcessed = 0;
    this.ready = false;
    this.modelStatus = "Sherpa-ONNX WASM wird geladen";
    this.lastProfileAudit = null;
    this.lastKnownSpeakerId = null;
    this.lastKnownAt = 0;
  }

  async initialize() {
    const started = performance.now();

    try {
      await ensureSherpaBrowserAssets();
      await ensureSharedArrayBuffer();
      this.module = await loadSherpaBrowserRuntime((status) => {
        this.modelStatus = `Sherpa-ONNX Browser-WASM lädt: ${status}`;
      });

      if (typeof window.createOfflineSpeakerDiarization !== "function") {
        throw new Error("Sherpa-ONNX Speaker-Diarization-Wrapper wurde nicht gefunden.");
      }

      this.diarizer = window.createOfflineSpeakerDiarization(this.module, {
        segmentation: {
          pyannote: { model: "./segmentation.onnx" },
          numThreads: 1,
          debug: 0,
          provider: "cpu"
        },
        embedding: {
          model: "./embedding.onnx",
          numThreads: 1,
          debug: 0,
          provider: "cpu"
        },
        clustering: {
          numClusters: -1,
          threshold: 0.5
        },
        minDurationOn: 0.2,
        minDurationOff: 0.35
      });

      this.ready = true;
      this.modelStatus = `Sherpa-ONNX Browser-WASM bereit (${Math.round(performance.now() - started)} ms)`;
    } catch (error) {
      this.ready = false;
      this.modelStatus = `Sherpa-ONNX nicht bereit: ${error.message}`;
    }

    return {
      backend: "sherpa-onnx-wasm",
      stage: "stage-2-browser-profile-embedding",
      modelStatus: this.modelStatus,
      targetSampleRate: TARGET_SAMPLE_RATE,
      windowSeconds: WINDOW_SECONDS,
      liveContextSeconds: LIVE_CONTEXT_SECONDS,
      ready: this.ready
    };
  }

  async enrollParticipant(participant, samples, inputSampleRate) {
    this.assertReady();
    const started = performance.now();
    const speechSamples = this.extractSpeechSamples(downsampleTo16k(samples, inputSampleRate));
    const speechSeconds = speechSamples.length / TARGET_SAMPLE_RATE;

    if (speechSeconds < 4) {
      throw new Error("Zu wenig Stimme erkannt. Bitte ruhiger aufnehmen und die Person lauter sprechen lassen.");
    }

    const previous = this.profiles.get(participant.id);
    const combinedSamples = previous ? appendSamples(previous.samples, speechSamples) : speechSamples;
    const profile = {
      id: participant.id,
      name: participant.name,
      samples: trimToMaxSeconds(combinedSamples, PROFILE_TARGET_SECONDS + 16),
      speechSeconds: combinedSamples.length / TARGET_SAMPLE_RATE,
      createdAt: previous?.createdAt ?? Date.now(),
      updatedAt: Date.now()
    };
    profile.probe = selectProbeSamples(profile.samples, PROFILE_CONTEXT_SECONDS);
    Object.assign(profile, createProfileEmbedding(profile.samples));
    this.profiles.set(participant.id, profile);

    const audit = this.auditProfiles();
    const ownQuality = audit.byId[participant.id] ?? createDefaultProfileQuality(profile);
    profile.quality = ownQuality;
    this.lastProfileAudit = audit;

    return {
      profile,
      latencyMs: performance.now() - started,
      speechWindows: Math.max(1, Math.round(speechSeconds / WINDOW_SECONDS)),
      speechSeconds: profile.speechSeconds,
      neededSeconds: Math.max(0, PROFILE_READY_SECONDS - profile.speechSeconds),
      clear: ownQuality.clear,
      quality: ownQuality,
      profileAudit: audit
    };
  }

  async processAudio(samples, inputSampleRate) {
    this.assertReady();
    const started = performance.now();
    const mono16k = downsampleTo16k(samples, inputSampleRate);
    this.pendingSamples = appendSamples(this.pendingSamples, mono16k);
    const windowSize = Math.floor(TARGET_SAMPLE_RATE * WINDOW_SECONDS);
    const results = [];

    while (this.pendingSamples.length >= windowSize) {
      const window = this.pendingSamples.slice(0, windowSize);
      this.pendingSamples = this.pendingSamples.slice(windowSize);
      const vad = this.vad.analyze(window);

      if (!vad.speech) {
        this.liveContextSamples = new Float32Array(0);
        results.push({
          type: "silence",
          durationMs: WINDOW_SECONDS * 1000,
          vad,
          latencyMs: performance.now() - started,
          scores: {},
          embeddingScores: {},
          diarizationScores: {}
        });
        continue;
      }

      this.liveContextSamples = trimToMaxSeconds(
        appendSamples(this.liveContextSamples, window),
        LIVE_CONTEXT_SECONDS
      );
      const classified = this.applyDecisionSmoothing(this.classifyWindow(this.liveContextSamples));
      this.framesProcessed += 1;
      results.push({
        type: classified.isKnown ? "speaker" : "unknown",
        speakerId: classified.isKnown ? classified.bestId : null,
        confidence: classified.confidence,
        margin: classified.margin,
        durationMs: WINDOW_SECONDS * 1000,
        vad,
        scores: classified.scores,
        embeddingScores: classified.embeddingScores,
        embeddingRawScores: classified.embeddingRawScores,
        diarizationScores: classified.diarizationScores,
        embeddingMargin: classified.embeddingMargin,
        diarizationMargin: classified.diarizationMargin,
        decisionMode: classified.decisionMode,
        contextSeconds: this.liveContextSamples.length / TARGET_SAMPLE_RATE,
        latencyMs: performance.now() - started,
        framesProcessed: this.framesProcessed,
        rawClusters: classified.rawClusters,
        profileAudit: this.lastProfileAudit
      });
    }

    if (!results.length) {
      const vad = this.vad.analyze(mono16k);
      results.push({
        type: "buffering",
        durationMs: 0,
        vad,
        latencyMs: performance.now() - started,
        scores: {},
        embeddingScores: {},
        diarizationScores: {}
      });
    }

    return results;
  }

  reset() {
    this.resetLiveBuffer();
    this.profiles.clear();
    this.framesProcessed = 0;
    this.lastProfileAudit = null;
  }

  resetLiveBuffer() {
    this.vad = new EnergyVad();
    this.pendingSamples = new Float32Array(0);
    this.liveContextSamples = new Float32Array(0);
    this.lastKnownSpeakerId = null;
    this.lastKnownAt = 0;
  }

  removeParticipant(id) {
    this.profiles.delete(id);
    this.lastProfileAudit = this.ready ? this.auditProfiles() : null;
  }

  assertReady() {
    if (!this.ready || !this.diarizer) {
      throw new Error(this.modelStatus || "Sherpa-ONNX WASM ist noch nicht bereit.");
    }
  }

  extractSpeechSamples(samples) {
    const windowSize = Math.floor(TARGET_SAMPLE_RATE * 1);
    const chunks = [];

    for (let offset = 0; offset + windowSize <= samples.length; offset += windowSize) {
      const window = samples.slice(offset, offset + windowSize);
      if (this.vad.analyze(window).speech) {
        chunks.push(window);
      }
    }

    if (!chunks.length && this.vad.analyze(samples).speech) {
      return samples;
    }

    return concatenateSamples(chunks);
  }

  auditProfiles() {
    const profiles = Array.from(this.profiles.values());
    const byId = {};
    const collisions = [];

    for (const profile of profiles) {
      const quality = createDefaultProfileQuality(profile);
      quality.embeddingChunkCount = profile.embeddings?.length ?? 0;
      quality.embeddingConsistency = roundScore(profile.embeddingConsistency ?? 0);
      quality.embeddingSeparation = 1;
      quality.clear =
        quality.clear &&
        quality.embeddingChunkCount > 0 &&
        quality.embeddingConsistency >= MIN_PROFILE_EMBEDDING_CONSISTENCY;
      byId[profile.id] = quality;
    }

    if (profiles.length >= 2) {
      const regions = profiles.map((profile) => ({
        id: profile.id,
        samples: profile.probe
      }));
      const analysis = this.runDiarization(regions, { numClusters: -1, threshold: 0.5 });

      for (const region of analysis.regions) {
        const quality = byId[region.id];
        quality.cluster = region.primaryCluster;
        quality.purity = region.purity;
        quality.clusterMargin = region.margin;
        quality.clear =
          quality.clear && region.purity >= MIN_PROFILE_PURITY && region.margin >= 0.18 && region.primaryCluster !== null;
      }

      for (let leftIndex = 0; leftIndex < analysis.regions.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < analysis.regions.length; rightIndex += 1) {
          const left = analysis.regions[leftIndex];
          const right = analysis.regions[rightIndex];

          if (
            left.primaryCluster !== null &&
            left.primaryCluster === right.primaryCluster &&
            (left.purity >= PROFILE_COLLISION_THRESHOLD || right.purity >= PROFILE_COLLISION_THRESHOLD)
          ) {
            addProfileCollision(collisions, byId, {
              leftId: left.id,
              rightId: right.id,
              cluster: left.primaryCluster,
              reason: "sherpa-cluster"
            });
          }
        }
      }
    }

    for (let leftIndex = 0; leftIndex < profiles.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < profiles.length; rightIndex += 1) {
        const left = profiles[leftIndex];
        const right = profiles[rightIndex];
        const similarity = compareProfileEmbeddings(left, right);

        byId[left.id].embeddingNearest = Math.max(byId[left.id].embeddingNearest ?? 0, roundScore(similarity));
        byId[right.id].embeddingNearest = Math.max(byId[right.id].embeddingNearest ?? 0, roundScore(similarity));
        byId[left.id].embeddingSeparation = roundScore(Math.min(byId[left.id].embeddingSeparation, 1 - similarity));
        byId[right.id].embeddingSeparation = roundScore(Math.min(byId[right.id].embeddingSeparation, 1 - similarity));

        if (similarity >= PROFILE_EMBEDDING_HARD_COLLISION_THRESHOLD) {
          addProfileCollision(collisions, byId, {
            leftId: left.id,
            rightId: right.id,
            similarity: roundScore(similarity),
            reason: "embedding-too-similar"
          });
        } else if (similarity >= PROFILE_EMBEDDING_COLLISION_THRESHOLD) {
          byId[left.id].similarWith.push(right.id);
          byId[right.id].similarWith.push(left.id);
        }
      }
    }

    return {
      byId,
      collisions,
      clear: Object.values(byId).every((entry) => entry.clear)
    };
  }

  classifyWindow(window) {
    const scores = Object.fromEntries(Array.from(this.profiles.keys()).map((id) => [id, 0]));
    const profiles = Array.from(this.profiles.values()).filter(
      (profile) => profile.quality?.clear && profile.embedding?.length
    );

    if (!profiles.length) {
      return {
        isKnown: false,
        bestId: null,
        confidence: 0,
        margin: 0,
        scores,
        embeddingScores: scores,
        embeddingRawScores: scores,
        diarizationScores: scores,
        embeddingMargin: 0,
        diarizationMargin: 0,
        rawClusters: [],
        decisionMode: "no-profiles"
      };
    }

    const allIds = Array.from(this.profiles.keys());
    const embedding = this.scoreWithEmbeddings(window, profiles, allIds);
    const diarization = this.scoreWithDiarization(window, profiles, allIds);
    const combinedScores = combineHybridScores(allIds, embedding, diarization);
    const ranked = rankScores(combinedScores);
    const best = ranked[0];
    const second = ranked[1];
    const margin = best && second ? best[1] - second[1] : best ? best[1] : 0;
    const confidence = best ? best[1] : 0;
    const bestId = confidence > 0 ? best?.[0] ?? null : null;

    return {
      isKnown: Boolean(best && confidence >= UNKNOWN_THRESHOLD && margin >= MIN_MARGIN),
      bestId,
      confidence,
      margin,
      scores: combinedScores,
      embeddingScores: embedding.scores,
      embeddingRawScores: embedding.rawScores,
      diarizationScores: diarization.scores,
      embeddingMargin: embedding.margin,
      diarizationMargin: diarization.margin,
      rawClusters: diarization.rawClusters,
      decisionMode: decisionSource(bestId, embedding, diarization)
    };
  }

  scoreWithDiarization(window, profiles, allIds) {
    const scores = zeroScores(allIds);
    const liveId = "__live__";
    const regions = [
      ...profiles.map((profile) => ({
        id: profile.id,
        samples: profile.probe
      })),
      { id: liveId, samples: window }
    ];
    let analysis;

    try {
      analysis = this.runDiarization(regions, { numClusters: Math.max(1, profiles.length), threshold: 0.5 });
    } catch (error) {
      return {
        scores,
        bestId: null,
        confidence: 0,
        margin: 0,
        rawClusters: [],
        error: error.message
      };
    }

    const liveRegion = analysis.regions.find((region) => region.id === liveId);

    if (!liveRegion || liveRegion.primaryCluster === null) {
      return {
        bestId: null,
        confidence: 0,
        margin: 0,
        scores,
        rawClusters: analysis.segments
      };
    }

    for (const profileRegion of analysis.regions.filter((region) => region.id !== liveId)) {
      if (profileRegion.primaryCluster === liveRegion.primaryCluster) {
        scores[profileRegion.id] = Math.min(1, liveRegion.purity * profileRegion.purity);
      }
    }

    const ranked = rankScores(scores);
    const best = ranked[0];
    const second = ranked[1];
    const margin = best && second ? best[1] - second[1] : best ? best[1] : 0;
    const confidence = best ? best[1] : 0;

    return {
      bestId: confidence > 0 ? best?.[0] ?? null : null,
      confidence,
      margin,
      scores,
      rawClusters: analysis.segments
    };
  }

  scoreWithEmbeddings(window, profiles, allIds) {
    const scores = zeroScores(allIds);
    const rawScores = zeroScores(allIds);
    const liveEmbedding = createAudioEmbedding(window, TARGET_SAMPLE_RATE);

    for (const profile of profiles) {
      const rawScore = compareLiveEmbeddingToProfile(liveEmbedding, profile);
      rawScores[profile.id] = roundScore(rawScore);
      scores[profile.id] = roundScore(calibrateEmbeddingScore(rawScore));
    }

    const ranked = rankScores(scores);
    const best = ranked[0];
    const second = ranked[1];
    const margin = best && second ? best[1] - second[1] : best ? best[1] : 0;
    const confidence = best ? best[1] : 0;

    return {
      bestId: confidence > 0 ? best?.[0] ?? null : null,
      confidence,
      margin,
      scores,
      rawScores
    };
  }

  applyDecisionSmoothing(classified) {
    const now = performance.now();
    const bestId = classified.bestId;
    const confidence = classified.confidence ?? 0;
    const margin = classified.margin ?? 0;

    if (classified.isKnown && bestId) {
      this.lastKnownSpeakerId = bestId;
      this.lastKnownAt = now;
      return { ...classified, decisionMode: classified.decisionMode ?? "direct" };
    }

    const tentative =
      bestId &&
      confidence >= TENTATIVE_THRESHOLD &&
      margin >= TENTATIVE_MARGIN &&
      (!this.lastKnownSpeakerId ||
        bestId === this.lastKnownSpeakerId ||
        confidence >= CHANGE_SPEAKER_THRESHOLD ||
        now - this.lastKnownAt > HOLD_LAST_SPEAKER_MS);

    if (tentative) {
      this.lastKnownSpeakerId = bestId;
      this.lastKnownAt = now;
      return {
        ...classified,
        isKnown: true,
        bestId,
        decisionMode: `tentative-${classified.decisionMode ?? "unknown"}`
      };
    }

    const canHold =
      this.lastKnownSpeakerId &&
      now - this.lastKnownAt <= HOLD_LAST_SPEAKER_MS &&
      (!bestId || bestId === this.lastKnownSpeakerId || confidence < CHANGE_SPEAKER_THRESHOLD);

    if (canHold) {
      const scores = { ...classified.scores };
      scores[this.lastKnownSpeakerId] = Math.max(scores[this.lastKnownSpeakerId] ?? 0, 0.24);
      return {
        ...classified,
        isKnown: true,
        bestId: this.lastKnownSpeakerId,
        confidence: Math.max(confidence, 0.24),
        scores,
        decisionMode: "hold-last"
      };
    }

    return {
      ...classified,
      isKnown: false,
      decisionMode:
        classified.decisionMode && !classified.decisionMode.startsWith("no-")
          ? `unknown-${classified.decisionMode}`
          : classified.decisionMode
    };
  }

  runDiarization(regions, config) {
    const { samples, regionSpans } = buildDiarizationInput(regions);
    const previousConfig = this.diarizer.config;
    this.diarizer.setConfig({
      ...previousConfig,
      clustering: config
    });
    const segments = this.diarizer.process(samples) ?? [];
    const analyzedRegions = regionSpans.map((region) => summarizeRegion(region, segments));
    return { regions: analyzedRegions, segments };
  }
}

function createDefaultProfileQuality(profile) {
  const neededSeconds = Math.max(0, PROFILE_READY_SECONDS - profile.speechSeconds);

  return {
    clear: neededSeconds <= 0,
    speechSeconds: profile.speechSeconds,
    neededSeconds,
    purity: 1,
    clusterMargin: 1,
    cluster: null,
    ambiguousWith: [],
    similarWith: [],
    embeddingChunkCount: profile.embeddings?.length ?? 0,
    embeddingConsistency: roundScore(profile.embeddingConsistency ?? 0),
    embeddingNearest: 0,
    embeddingSeparation: 1
  };
}

function createProfileEmbedding(samples) {
  const chunks = createOverlappingChunks(samples, PROFILE_EMBEDDING_SECONDS, PROFILE_EMBEDDING_HOP_SECONDS)
    .map((chunk) => createAudioEmbedding(chunk, TARGET_SAMPLE_RATE))
    .filter((embedding) => embedding.length > 0)
    .slice(-MAX_PROFILE_EMBEDDINGS);
  const embedding = averageEmbeddings(chunks);
  const consistency = embedding.length
    ? average(chunks.map((chunkEmbedding) => normalizedCosineSimilarity(chunkEmbedding, embedding)))
    : 0;

  return {
    embedding,
    embeddings: chunks,
    embeddingConsistency: consistency
  };
}

function compareLiveEmbeddingToProfile(liveEmbedding, profile) {
  if (!liveEmbedding.length || !profile.embedding?.length) {
    return 0;
  }

  const profileScore = normalizedCosineSimilarity(liveEmbedding, profile.embedding);
  const chunkScores = (profile.embeddings ?? []).map((embedding) => normalizedCosineSimilarity(liveEmbedding, embedding));
  const topChunkScore = topKAverage(chunkScores, 3);

  return clamp01(profileScore * 0.58 + topChunkScore * 0.42);
}

function compareProfileEmbeddings(left, right) {
  if (!left.embedding?.length || !right.embedding?.length) {
    return 0;
  }

  const averageScore = normalizedCosineSimilarity(left.embedding, right.embedding);
  const crossScores = [];

  for (const leftEmbedding of left.embeddings ?? []) {
    for (const rightEmbedding of right.embeddings ?? []) {
      crossScores.push(normalizedCosineSimilarity(leftEmbedding, rightEmbedding));
    }
  }

  return clamp01(averageScore * 0.65 + topKAverage(crossScores, 5) * 0.35);
}

function createOverlappingChunks(samples, seconds, hopSeconds) {
  const size = Math.floor(seconds * TARGET_SAMPLE_RATE);
  const hop = Math.max(1, Math.floor(hopSeconds * TARGET_SAMPLE_RATE));
  const chunks = [];

  for (let offset = 0; offset + size <= samples.length; offset += hop) {
    chunks.push(samples.slice(offset, offset + size));
  }

  if (!chunks.length && samples.length) {
    chunks.push(samples);
  }

  return chunks;
}

function combineHybridScores(allIds, embedding, diarization) {
  const scores = {};

  for (const id of allIds) {
    const embeddingScore = embedding.scores[id] ?? 0;
    const diarizationScore = diarization.scores[id] ?? 0;
    const agrees = embedding.bestId === id && diarization.bestId === id && embeddingScore > 0 && diarizationScore > 0;
    const boosted = agrees ? AGREEMENT_BOOST * Math.min(1, embeddingScore + diarizationScore) : 0;
    scores[id] = roundScore(clamp01(embeddingScore * EMBEDDING_WEIGHT + diarizationScore * DIARIZATION_WEIGHT + boosted));
  }

  return scores;
}

function decisionSource(bestId, embedding, diarization) {
  if (!bestId) {
    return "unknown";
  }

  const embeddingMatches = embedding.bestId === bestId && embedding.confidence > 0;
  const diarizationMatches = diarization.bestId === bestId && diarization.confidence > 0;

  if (embeddingMatches && diarizationMatches) {
    return "hybrid";
  }

  if (embeddingMatches) {
    return "embedding";
  }

  if (diarizationMatches) {
    return "diarization";
  }

  return "unknown";
}

function calibrateEmbeddingScore(score) {
  return clamp01((score - 0.58) / 0.32);
}

function normalizedCosineSimilarity(left, right) {
  return clamp01((cosineSimilarity(left, right) + 1) / 2);
}

function zeroScores(ids) {
  return Object.fromEntries(ids.map((id) => [id, 0]));
}

function rankScores(scores) {
  return Object.entries(scores).sort((left, right) => right[1] - left[1]);
}

function topKAverage(values, k) {
  if (!values.length) {
    return 0;
  }

  return average([...values].sort((left, right) => right - left).slice(0, k));
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function addProfileCollision(collisions, byId, collision) {
  const exists = collisions.some(
    (entry) =>
      (entry.leftId === collision.leftId && entry.rightId === collision.rightId) ||
      (entry.leftId === collision.rightId && entry.rightId === collision.leftId)
  );

  if (!exists) {
    collisions.push(collision);
  }

  byId[collision.leftId].clear = false;
  byId[collision.rightId].clear = false;
  pushUnique(byId[collision.leftId].ambiguousWith, collision.rightId);
  pushUnique(byId[collision.rightId].ambiguousWith, collision.leftId);
}

function pushUnique(list, value) {
  if (!list.includes(value)) {
    list.push(value);
  }
}

function roundScore(value) {
  return Math.round(value * 1000) / 1000;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

async function ensureSharedArrayBuffer() {
  if (!window.isSecureContext) {
    throw new Error("Sicherer Browser-Kontext fehlt. Bitte ueber localhost oder HTTPS oeffnen.");
  }

  if (typeof SharedArrayBuffer === "undefined" || !window.crossOriginIsolated) {
    throw new Error(
      "SharedArrayBuffer fehlt. Bitte ueber den lokalen Server mit COOP/COEP-Headern in Chrome/Edge oeffnen."
    );
  }
}

async function ensureSherpaBrowserAssets() {
  const missing = [];

  for (const asset of [SHERPA_BROWSER_MAIN, SHERPA_BROWSER_WASM, SHERPA_BROWSER_DATA]) {
    const response = await fetch(`${SHERPA_BASE}${asset}`, { method: "HEAD", cache: "no-store" });

    if (!response.ok) {
      missing.push(asset);
    }
  }

  if (missing.length) {
    throw new Error(`Browser-WASM-Dateien fehlen: ${missing.join(", ")}.`);
  }
}

function loadSherpaBrowserRuntime(onStatus) {
  if (window.__sherpaSpeakerRuntime?.ready) {
    return Promise.resolve(window.__sherpaSpeakerRuntime.module);
  }

  if (window.__sherpaSpeakerRuntimePromise) {
    return window.__sherpaSpeakerRuntimePromise;
  }

  window.__sherpaSpeakerRuntimePromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Sherpa-ONNX Browser-WASM hat das Laden nach 120s nicht abgeschlossen."));
    }, 120000);

    const moduleConfig = {
      locateFile: (path) => `${SHERPA_BASE}${path}`,
      print: () => {},
      printErr: (message) => console.warn("[sherpa-onnx]", message),
      setStatus: (status) => onStatus?.(status || "initialisiert"),
      onRuntimeInitialized: () => {
        window.clearTimeout(timeout);
        window.__sherpaSpeakerRuntime = { ready: true, module: moduleConfig };
        resolve(moduleConfig);
      }
    };

    window.Module = moduleConfig;

    loadClassicScript(`${SHERPA_BASE}sherpa-onnx-speaker-diarization.js`)
      .then(() => loadClassicScript(`${SHERPA_BASE}${SHERPA_BROWSER_MAIN}`))
      .catch((error) => {
        window.clearTimeout(timeout);
        reject(error);
      });
  });

  return window.__sherpaSpeakerRuntimePromise;
}

function loadClassicScript(src) {
  const absoluteSrc = new URL(src, window.location.href).href;
  const existing = document.querySelector(`script[data-sherpa-src="${absoluteSrc}"]`);

  if (existing?.dataset.loaded === "true") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    script.src = absoluteSrc;
    script.async = false;
    script.dataset.sherpaSrc = absoluteSrc;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Konnte ${src} nicht laden.`)));

    if (!existing) {
      document.head.append(script);
    }
  });
}

function buildDiarizationInput(regions) {
  const gap = new Float32Array(Math.floor(SILENCE_GAP_SECONDS * TARGET_SAMPLE_RATE));
  const totalLength =
    regions.reduce((sum, region) => sum + region.samples.length, 0) + gap.length * Math.max(0, regions.length - 1);
  const samples = new Float32Array(totalLength);
  const regionSpans = [];
  let offset = 0;

  for (const region of regions) {
    const start = offset / TARGET_SAMPLE_RATE;
    samples.set(region.samples, offset);
    offset += region.samples.length;
    regionSpans.push({
      id: region.id,
      start,
      end: offset / TARGET_SAMPLE_RATE
    });

    if (offset < totalLength) {
      samples.set(gap, offset);
      offset += gap.length;
    }
  }

  return { samples, regionSpans };
}

function summarizeRegion(region, segments) {
  const overlaps = new Map();
  let total = 0;

  for (const segment of segments) {
    const overlap = Math.max(0, Math.min(region.end, segment.end) - Math.max(region.start, segment.start));

    if (overlap > 0) {
      overlaps.set(segment.speaker, (overlaps.get(segment.speaker) ?? 0) + overlap);
      total += overlap;
    }
  }

  const ranked = Array.from(overlaps.entries()).sort((left, right) => right[1] - left[1]);
  const primary = ranked[0];
  const secondary = ranked[1];
  const purity = primary ? primary[1] / Math.max(total, 0.001) : 0;
  const margin = primary ? (primary[1] - (secondary?.[1] ?? 0)) / Math.max(total, 0.001) : 0;

  return {
    ...region,
    primaryCluster: primary?.[0] ?? null,
    purity,
    margin,
    overlaps: Object.fromEntries(ranked)
  };
}

function selectProbeSamples(samples, seconds) {
  const maxLength = Math.floor(seconds * TARGET_SAMPLE_RATE);

  if (samples.length <= maxLength) {
    return samples;
  }

  const chunkCount = 5;
  const chunkLength = Math.floor(maxLength / chunkCount);
  const output = new Float32Array(chunkLength * chunkCount);

  for (let index = 0; index < chunkCount; index += 1) {
    const start = Math.floor((samples.length - chunkLength) * (index / Math.max(1, chunkCount - 1)));
    output.set(samples.slice(start, start + chunkLength), index * chunkLength);
  }

  return output;
}

function trimToMaxSeconds(samples, seconds) {
  const maxLength = Math.floor(seconds * TARGET_SAMPLE_RATE);

  if (samples.length <= maxLength) {
    return samples;
  }

  return samples.slice(samples.length - maxLength);
}

function appendSamples(left, right) {
  const output = new Float32Array(left.length + right.length);
  output.set(left, 0);
  output.set(right, left.length);
  return output;
}

function concatenateSamples(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}
