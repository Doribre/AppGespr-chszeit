import { colorForIndex, drawPieChart, formatDuration } from "./charts.js";
import { SherpaOnnxWasmSpeakerEngine } from "./audio/engine.js";

const ENROLLMENT_MIN_SECONDS = 10;
const ENROLLMENT_MAX_SECONDS = 30;
const ENROLLMENT_MIN_SPEECH_SECONDS = 10;
const ENROLLMENT_TARGET_SPEECH_SECONDS = 14;
const ENROLLMENT_LOW_LEVEL = 0.012;
const ENROLLMENT_GOOD_LEVEL = 0.026;
const ENROLLMENT_VARIETY_SEGMENTS = 4;
const ENROLLMENT_SILENCE_RESET_MS = 420;
const MAX_PARTICIPANTS = 7;
const MIN_PARTICIPANTS = 1;
const UNKNOWN_ID = "unknown";
const LIVE_PROCESS_BATCH_SECONDS = 2.5;

const elements = {
  micButton: document.querySelector("#micButton"),
  resetButton: document.querySelector("#resetButton"),
  addParticipantButton: document.querySelector("#addParticipantButton"),
  participantCapacity: document.querySelector("#participantCapacity"),
  nextAction: document.querySelector("#nextAction"),
  currentOptions: document.querySelector("#currentOptions"),
  participantList: document.querySelector("#participantList"),
  startEnrollmentButton: document.querySelector("#startEnrollmentButton"),
  skipEnrollmentButton: document.querySelector("#skipEnrollmentButton"),
  enrollmentStateBadge: document.querySelector("#enrollmentStateBadge"),
  enrollmentPrompt: document.querySelector("#enrollmentPrompt"),
  enrollmentHelp: document.querySelector("#enrollmentHelp"),
  enrollmentTimer: document.querySelector("#enrollmentTimer"),
  enrollmentVoiceFeedback: document.querySelector("#enrollmentVoiceFeedback"),
  enrollmentTimeText: document.querySelector("#enrollmentTimeText"),
  enrollmentSpeechText: document.querySelector("#enrollmentSpeechText"),
  enrollmentProgress: document.querySelector("#enrollmentProgress"),
  enrollmentSpeechProgress: document.querySelector("#enrollmentSpeechProgress"),
  enrollmentChecklist: document.querySelector("#enrollmentChecklist"),
  enrollmentLevelBar: document.querySelector("#enrollmentLevelBar"),
  enrollmentLevelName: document.querySelector("#enrollmentLevelName"),
  enrollmentDetails: document.querySelector("#enrollmentDetails"),
  listenToggleButton: document.querySelector("#listenToggleButton"),
  engineStatus: document.querySelector("#engineStatus"),
  micStatus: document.querySelector("#micStatus"),
  liveClock: document.querySelector("#liveClock"),
  currentSpeaker: document.querySelector("#currentSpeaker"),
  liveSpeaker: document.querySelector("#liveSpeaker"),
  liveConfidence: document.querySelector("#liveConfidence"),
  displayCountdown: document.querySelector("#displayCountdown"),
  unknownState: document.querySelector("#unknownState"),
  scores: document.querySelector("#scores"),
  shareChart: document.querySelector("#shareChart"),
  shareLegend: document.querySelector("#shareLegend"),
  shareBars: document.querySelector("#shareBars"),
  timeline: document.querySelector("#timeline"),
  debugSampleRate: document.querySelector("#debugSampleRate"),
  debugModel: document.querySelector("#debugModel"),
  debugLatency: document.querySelector("#debugLatency"),
  debugVad: document.querySelector("#debugVad"),
  debugRms: document.querySelector("#debugRms"),
  debugFrames: document.querySelector("#debugFrames"),
  debugScores: document.querySelector("#debugScores")
};

const state = {
  audioContext: null,
  mediaStream: null,
  sourceNode: null,
  processorNode: null,
  engine: null,
  engineInfo: null,
  participants: [],
  activeEnrollmentId: null,
  checkingEnrollmentId: null,
  enrollmentStartedAt: 0,
  enrollmentSamples: [],
  enrollmentLevel: 0,
  enrollmentSpeechMs: 0,
  enrollmentLastRms: 0,
  enrollmentSpeechSegments: 0,
  enrollmentWasSpeaking: false,
  enrollmentSilenceMs: 0,
  live: false,
  liveStartedAt: 0,
  liveAccumulatedMs: 0,
  processingLive: false,
  finalizingLive: false,
  liveAudioQueue: [],
  liveQueuedSamples: 0,
  liveRunId: 0,
  speakingSeconds: new Map(),
  timeline: [],
  lastDebug: null,
  lastProfileAudit: null
};

let participantCounter = 0;
let renderTimer = null;

init();

async function init() {
  state.engine = createEngine();
  state.engineInfo = await state.engine.initialize();
  elements.engineStatus.textContent = state.engineInfo.ready ? "Stufe 2 bereit" : "nicht bereit";
  elements.debugModel.textContent = state.engineInfo.modelStatus;

  addParticipant("Person 1");
  bindEvents();
  render();
}

function createEngine() {
  return new SherpaOnnxWasmSpeakerEngine();
}

function bindEvents() {
  elements.micButton.addEventListener("click", startMicrophone);
  elements.resetButton.addEventListener("click", resetSession);
  elements.addParticipantButton.addEventListener("click", () => addParticipant());
  elements.startEnrollmentButton.addEventListener("click", startEnrollment);
  elements.skipEnrollmentButton.addEventListener("click", stopEnrollment);
  elements.listenToggleButton.addEventListener("click", toggleListening);
}

function addParticipant(defaultName = "") {
  if (state.participants.length >= MAX_PARTICIPANTS) {
    return;
  }

  participantCounter += 1;
  state.participants.push({
    id: crypto.randomUUID(),
    name: defaultName || `Person ${participantCounter}`,
    enrolled: false,
    enrolling: false,
    needsMoreAudio: false,
    profileSpeechSeconds: 0,
    profileQuality: null
  });
  render();
}

function removeParticipant(id) {
  if (state.participants.length <= MIN_PARTICIPANTS) {
    return;
  }

  state.participants = state.participants.filter((participant) => participant.id !== id);
  state.speakingSeconds.delete(id);
  state.engine?.removeParticipant?.(id);
  render();
}

async function startMicrophone() {
  if (state.mediaStream) {
    return;
  }

  elements.micButton.textContent = "Mikrofon wird geöffnet";
  elements.micButton.disabled = true;

  let stream;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  } catch (error) {
    elements.micStatus.textContent = "Fehler";
    elements.micButton.textContent = "Mikrofon starten";
    elements.micButton.disabled = false;
    elements.enrollmentDetails.textContent = "Mikrofon konnte nicht geöffnet werden. Bitte Browser-Freigabe prüfen.";
    throw error;
  }

  const audioContext = new AudioContext();
  const sourceNode = audioContext.createMediaStreamSource(stream);
  const processorNode = audioContext.createScriptProcessor(4096, 1, 1);

  processorNode.onaudioprocess = handleAudioProcess;
  sourceNode.connect(processorNode);
  processorNode.connect(audioContext.destination);

  state.mediaStream = stream;
  state.audioContext = audioContext;
  state.sourceNode = sourceNode;
  state.processorNode = processorNode;
  elements.micStatus.textContent = "aktiv";
  elements.micButton.textContent = "Mikrofon aktiv";
  elements.micButton.classList.add("state-ok");
  elements.debugSampleRate.textContent = `${audioContext.sampleRate} Hz`;
  render();
}

function handleAudioProcess(event) {
  const samples = new Float32Array(event.inputBuffer.getChannelData(0));

  if (state.activeEnrollmentId) {
    state.enrollmentSamples.push(samples);
    const rms = computeRms(samples);
    const chunkMs = (samples.length / (state.audioContext?.sampleRate ?? 48000)) * 1000;
    const speaking = rms >= ENROLLMENT_LOW_LEVEL;
    state.enrollmentLastRms = rms;
    state.enrollmentLevel = smoothLevel(state.enrollmentLevel, rms);

    if (speaking) {
      state.enrollmentSpeechMs += chunkMs;

      if (
        !state.enrollmentWasSpeaking &&
        (state.enrollmentSpeechSegments === 0 || state.enrollmentSilenceMs >= ENROLLMENT_SILENCE_RESET_MS)
      ) {
        state.enrollmentSpeechSegments += 1;
      }

      state.enrollmentWasSpeaking = true;
      state.enrollmentSilenceMs = 0;
    } else {
      state.enrollmentSilenceMs += chunkMs;
      if (state.enrollmentSilenceMs >= ENROLLMENT_SILENCE_RESET_MS) {
        state.enrollmentWasSpeaking = false;
      }
    }

    updateEnrollmentProgress();
  }

  if (state.live) {
    enqueueLiveSamples(samples);
    processLiveQueue();
  }
}

function enqueueLiveSamples(samples) {
  state.liveAudioQueue.push(samples);
  state.liveQueuedSamples += samples.length;
}

function processLiveQueue() {
  if ((!state.live && !state.finalizingLive) || state.processingLive || !state.liveAudioQueue.length) {
    return;
  }

  const runId = state.liveRunId;
  const sampleRate = state.audioContext?.sampleRate ?? 48000;
  const maxSamples = Math.floor(sampleRate * LIVE_PROCESS_BATCH_SECONDS);
  const samples = takeQueuedLiveSamples(maxSamples);

  state.processingLive = true;
  state.engine
    .processAudio(samples, sampleRate)
    .then((results) => {
      if (runId === state.liveRunId) {
        handleEngineResults(results);
      }
    })
    .catch((error) => {
      if (runId === state.liveRunId) {
        handleEngineError(error);
      }
    })
    .finally(() => {
      state.processingLive = false;

      if ((state.live || state.finalizingLive) && runId === state.liveRunId && state.liveAudioQueue.length) {
        window.setTimeout(processLiveQueue, 0);
      } else if (state.finalizingLive && runId === state.liveRunId) {
        finishListeningStop();
      }
    });
}

function takeQueuedLiveSamples(maxSamples) {
  const sampleCount = Math.min(state.liveQueuedSamples, maxSamples);
  const output = new Float32Array(sampleCount);
  let offset = 0;

  while (state.liveAudioQueue.length && offset < sampleCount) {
    const chunk = state.liveAudioQueue[0];
    const needed = sampleCount - offset;

    if (chunk.length <= needed) {
      output.set(chunk, offset);
      offset += chunk.length;
      state.liveAudioQueue.shift();
      state.liveQueuedSamples -= chunk.length;
    } else {
      output.set(chunk.slice(0, needed), offset);
      state.liveAudioQueue[0] = chunk.slice(needed);
      state.liveQueuedSamples -= needed;
      offset = sampleCount;
    }
  }

  return output;
}

function clearLiveAudioQueue() {
  state.liveAudioQueue = [];
  state.liveQueuedSamples = 0;
}

function startEnrollment() {
  const next = state.participants.find((participant) => !participant.enrolled);

  if (!next || !state.mediaStream || !state.engineInfo?.ready) {
    return;
  }

  state.activeEnrollmentId = next.id;
  state.checkingEnrollmentId = null;
  state.enrollmentStartedAt = performance.now();
  state.enrollmentSamples = [];
  state.enrollmentLevel = 0;
  state.enrollmentSpeechMs = 0;
  state.enrollmentLastRms = 0;
  state.enrollmentSpeechSegments = 0;
  state.enrollmentWasSpeaking = false;
  state.enrollmentSilenceMs = ENROLLMENT_SILENCE_RESET_MS;
  elements.enrollmentProgress.style.width = "0%";
  elements.enrollmentSpeechProgress.style.width = "0%";
  next.enrolling = true;
  elements.skipEnrollmentButton.disabled = false;
  render();
}

async function stopEnrollment(force = false) {
  const participant = state.participants.find((entry) => entry.id === state.activeEnrollmentId);

  if (!participant) {
    return;
  }

  if (force !== true && !enrollmentCanBeChecked()) {
    renderEnrollmentStatus();
    return;
  }

  participant.enrolling = false;
  elements.skipEnrollmentButton.disabled = true;

  const samples = concatenateSamples(state.enrollmentSamples);
  state.checkingEnrollmentId = participant.id;
  state.activeEnrollmentId = null;
  state.enrollmentStartedAt = 0;
  state.enrollmentSamples = [];
  state.enrollmentLevel = 0;
  state.enrollmentLastRms = 0;
  state.enrollmentSpeechSegments = 0;
  state.enrollmentWasSpeaking = false;
  state.enrollmentSilenceMs = 0;
  render();

  try {
    const result = await state.engine.enrollParticipant(participant, samples, state.audioContext.sampleRate);
    applyProfileAudit(result.profileAudit);
    participant.profileWindows = result.speechWindows;
    participant.profileSpeechSeconds = result.speechSeconds;
    participant.profileQuality = result.quality;
    participant.needsMoreAudio = !result.clear;
    participant.enrolled = result.clear;
    state.lastProfileAudit = result.profileAudit;
    elements.enrollmentDetails.textContent = formatEnrollmentResult(participant, result);

    if (!result.profileAudit?.clear) {
      showMoreVoiceDialog(result.profileAudit);
    }
  } catch (error) {
    participant.enrolled = false;
    participant.needsMoreAudio = true;
    elements.enrollmentDetails.textContent = error.message;
  } finally {
    state.checkingEnrollmentId = null;
    state.enrollmentSpeechMs = 0;
    state.enrollmentSpeechSegments = 0;
    state.enrollmentWasSpeaking = false;
    state.enrollmentSilenceMs = 0;
  }

  render();
}

function updateEnrollmentProgress() {
  const elapsed = (performance.now() - state.enrollmentStartedAt) / 1000;
  const readiness = enrollmentReadiness();
  const progress = Math.min(1, elapsed / ENROLLMENT_MAX_SECONDS);
  elements.enrollmentProgress.style.width = `${progress * 100}%`;
  elements.enrollmentSpeechProgress.style.width = `${Math.min(
    100,
    (enrollmentSpeechSeconds() / ENROLLMENT_TARGET_SPEECH_SECONDS) * 100
  )}%`;
  renderEnrollmentStatus();

  if (readiness.strong || elapsed >= ENROLLMENT_MAX_SECONDS) {
    stopEnrollment(true);
  }
}

function toggleListening() {
  if (state.live) {
    stopListening();
    return;
  }

  startListening();
}

function startListening() {
  if (!allEnrolled() || state.live || state.activeEnrollmentId || !state.engineInfo?.ready) {
    return;
  }

  state.live = true;
  state.finalizingLive = false;
  state.liveStartedAt = performance.now();
  state.liveRunId += 1;
  clearLiveAudioQueue();
  state.engine.resetLiveBuffer?.();

  for (const participant of state.participants) {
    if (!state.speakingSeconds.has(participant.id)) {
      state.speakingSeconds.set(participant.id, 0);
    }
  }

  if (!state.speakingSeconds.has(UNKNOWN_ID)) {
    state.speakingSeconds.set(UNKNOWN_ID, 0);
  }

  renderTimer = window.setInterval(render, 250);
  render();
}

function stopListening() {
  if (state.finalizingLive) {
    return;
  }

  if (state.live && state.liveStartedAt) {
    state.liveAccumulatedMs += performance.now() - state.liveStartedAt;
  }

  state.live = false;
  state.liveStartedAt = 0;

  if (state.processingLive || state.liveAudioQueue.length) {
    state.finalizingLive = true;
    processLiveQueue();
  } else {
    finishListeningStop();
  }

  render();
}

function finishListeningStop() {
  state.finalizingLive = false;
  state.liveRunId += 1;
  clearLiveAudioQueue();

  if (renderTimer) {
    window.clearInterval(renderTimer);
    renderTimer = null;
  }

  render();
}

function handleEngineError(error) {
  stopListening();
  elements.enrollmentDetails.textContent = error.message;
  elements.debugModel.textContent = state.engineInfo?.modelStatus ?? error.message;
}

function handleEngineResults(results) {
  for (const result of results) {
    state.lastDebug = result;

    if ((!state.live && !state.finalizingLive) || result.durationMs <= 0) {
      continue;
    }

    if (result.type === "speaker" && result.speakerId) {
      const seconds = result.durationMs / 1000;
      state.speakingSeconds.set(result.speakerId, (state.speakingSeconds.get(result.speakerId) ?? 0) + seconds);
      appendTimeline(result.speakerId, seconds, result.confidence);
    } else if (result.type === "unknown") {
      const seconds = result.durationMs / 1000;
      state.speakingSeconds.set(UNKNOWN_ID, (state.speakingSeconds.get(UNKNOWN_ID) ?? 0) + seconds);
      appendTimeline(UNKNOWN_ID, seconds, result.confidence);
    }
  }

  render();
}

function appendTimeline(speakerId, seconds, confidence) {
  const last = state.timeline[state.timeline.length - 1];

  if (last && last.speakerId === speakerId) {
    last.seconds += seconds;
    last.confidence = confidence;
  } else {
    state.timeline.push({
      speakerId,
      seconds,
      confidence,
      startedAt: elapsedLiveSeconds()
    });
  }

  state.timeline = state.timeline.slice(-80);
}

function resetSession() {
  stopListening();
  state.engine.reset();
  state.participants = [];
  state.activeEnrollmentId = null;
  state.checkingEnrollmentId = null;
  state.enrollmentSamples = [];
  state.enrollmentLevel = 0;
  state.enrollmentSpeechMs = 0;
  state.enrollmentLastRms = 0;
  state.liveAccumulatedMs = 0;
  state.liveStartedAt = 0;
  state.processingLive = false;
  state.finalizingLive = false;
  state.liveRunId += 1;
  clearLiveAudioQueue();
  state.speakingSeconds.clear();
  state.timeline = [];
  state.lastDebug = null;
  state.lastProfileAudit = null;
  participantCounter = 0;
  addParticipant("Person 1");
  elements.enrollmentProgress.style.width = "0%";
  elements.enrollmentSpeechProgress.style.width = "0%";
  elements.enrollmentDetails.textContent = "Stimmprofile werden nur im Arbeitsspeicher gehalten.";
  render();
}

function render() {
  renderParticipants();
  renderDynamicSections();
}

function renderDynamicSections() {
  renderControls();
  renderGuide();
  renderEnrollmentStatus();
  renderLiveStatus();
  renderScores();
  renderChart();
  renderTimeline();
  renderDebug();
}

function renderParticipants() {
  elements.participantList.replaceChildren(
    ...state.participants.map((participant, index) => {
      const item = document.createElement("div");
      item.className = `participant ${participant.enrolling ? "is-active" : ""}`;
      item.style.setProperty("--participant-color", colorForIndex(index));

      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = colorForIndex(index);

      const input = document.createElement("input");
      input.value = participant.name;
      input.ariaLabel = "Teilnehmername";
      input.title = "Name per Tastatur eingeben";
      input.style.color = colorForIndex(index);
      input.addEventListener("input", () => {
        participant.name = input.value.trim() || `Person ${index + 1}`;
        renderDynamicSections();
      });
      input.addEventListener("blur", () => {
        input.value = participant.name;
        renderDynamicSections();
      });

      const badge = document.createElement("span");
      badge.className = participant.enrolled ? "badge ok" : participant.needsMoreAudio ? "badge warning" : "badge";
      badge.textContent = participant.enrolled ? "klar" : participant.needsMoreAudio ? "mehr Stimme" : "offen";
      badge.title = profileStatusText(participant);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-button";
      remove.ariaLabel = "Teilnehmer entfernen";
      remove.textContent = "x";
      remove.disabled = state.participants.length <= MIN_PARTICIPANTS || state.live;
      remove.addEventListener("click", () => removeParticipant(participant.id));

      item.append(swatch, input, badge, remove);
      return item;
    })
  );
}

function renderControls() {
  const engineReady = Boolean(state.engineInfo?.ready);
  const next = state.participants.find((participant) => !participant.enrolled);
  const checkingEnrollment = Boolean(state.checkingEnrollmentId);
  const canEnroll = Boolean(engineReady && state.mediaStream && next && !checkingEnrollment);
  elements.micButton.disabled = Boolean(state.mediaStream) || !engineReady;
  elements.micButton.textContent = state.mediaStream ? "Mikrofon aktiv" : "Mikrofon starten";
  elements.micButton.classList.toggle("state-ok", Boolean(state.mediaStream));
  elements.participantCapacity.textContent = `${state.participants.length}/${MAX_PARTICIPANTS}`;
  elements.startEnrollmentButton.disabled = !canEnroll || Boolean(state.activeEnrollmentId) || state.live;
  elements.startEnrollmentButton.textContent = state.activeEnrollmentId
    ? "Stimmprobe läuft"
    : checkingEnrollment
      ? "Profil wird geprüft"
      : next?.needsMoreAudio
        ? "Mehr Stimme aufnehmen"
        : "Stimme kennenlernen starten";
  elements.skipEnrollmentButton.textContent =
    state.activeEnrollmentId && !enrollmentCanBeChecked() ? "Noch aufnehmen" : "Jetzt prüfen";
  elements.addParticipantButton.disabled = state.participants.length >= MAX_PARTICIPANTS || state.live || checkingEnrollment;
  elements.listenToggleButton.disabled =
    state.finalizingLive || checkingEnrollment || ((!allEnrolled() || Boolean(state.activeEnrollmentId)) && !state.live);
  elements.listenToggleButton.textContent = state.finalizingLive
    ? "Zuhören wird beendet"
    : state.live
      ? "Zuhören stoppen"
      : "Zuhören und Zeiten ermitteln";
  elements.listenToggleButton.classList.toggle("state-danger", state.live || state.finalizingLive);

  elements.skipEnrollmentButton.disabled = !state.activeEnrollmentId || !enrollmentCanBeChecked();
}

function renderGuide() {
  const canAdd = state.participants.length < MAX_PARTICIPANTS && !state.live;

  if (!state.engineInfo?.ready) {
    elements.nextAction.textContent =
      "Sherpa-ONNX-WASM ist nicht bereit. Bitte lokalen Server in Chrome/Edge öffnen und Debug Model Load prüfen.";
    renderOptions(["Lokalen Server nutzen", "Chrome/Edge verwenden", "COOP/COEP oder Modell-Dateien prüfen"]);
    return;
  }

  if (!state.mediaStream) {
    elements.nextAction.textContent = "Mikrofon starten und die Browser-Freigabe erlauben.";
    renderOptions(["Mikrofon starten", "Namen per Tastatur eingeben", canAdd ? "Person hinzufügen" : null]);
    return;
  }

  if (state.checkingEnrollmentId) {
    const participant = state.participants.find((entry) => entry.id === state.checkingEnrollmentId);
    elements.nextAction.textContent = `${participant?.name ?? "Die Stimme"} wird geprüft. Danach zeigt Schwätzometer direkt, ob das Profil reicht oder mehr Stimme nötig ist.`;
    renderOptions(["Kurz warten", "Ergebnis im Feld Stimme kennenlernen ansehen", canAdd ? "Danach weitere Person hinzufügen" : null]);
    return;
  }

  if (state.activeEnrollmentId) {
    const participant = state.participants.find((entry) => entry.id === state.activeEnrollmentId);
    const addHint =
      state.participants.length < MAX_PARTICIPANTS ? " Bei Bedarf kannst du währenddessen noch eine Person hinzufügen." : "";
    const readiness = enrollmentReadiness();
    const action = enrollmentGuidance(readiness, enrollmentLevelFeedback());
    elements.nextAction.textContent = `${participant?.name ?? "Die aktuelle Person"} spricht jetzt. ${action.help}${addHint}`;
    renderOptions([action.label, readiness.canCheck ? "Jetzt prüfen möglich" : "Weiter aufnehmen", canAdd ? "Weitere Person hinzufügen" : null]);
    return;
  }

  const next = state.participants.find((participant) => !participant.enrolled);

  if (next) {
    const addHint =
      state.participants.length < MAX_PARTICIPANTS ? " Du kannst vorher oder danach weitere Personen hinzufügen." : "";
    elements.nextAction.textContent = next.needsMoreAudio
      ? `${next.name}: Bitte noch einmal Stimme aufnehmen. Die App zeigt währenddessen, ob Pegel, Menge und Abwechslung reichen.${addHint}`
      : `${next.name}: Namen prüfen, dann Stimme kennenlernen starten. Die Person spricht normal, meist 10 bis 30 Sekunden.${addHint}`;
    renderOptions(["Namen im Textfeld prüfen", "Stimme kennenlernen starten", canAdd ? "Weitere Person hinzufügen" : null]);
    return;
  }

  if (state.finalizingLive) {
    elements.nextAction.textContent = "Zuhören wird beendet. Die letzten aufgenommenen Audiodaten werden noch in die Zeiten eingerechnet.";
    renderOptions(["Kurz warten", "Redeanteile finalisieren", "Danach Session zurücksetzen oder neu starten"]);
    return;
  }

  if (!state.live) {
    const addHint =
      state.participants.length < MAX_PARTICIPANTS ? " Oder noch eine weitere Person hinzufügen und die Stimme kennenlernen." : "";
    elements.nextAction.textContent = `Alle vorbereiteten Profile sind bereit. Zum Messen den Zuhören-Button starten.${addHint}`;
    renderOptions(["Zuhören und Zeiten ermitteln", canAdd ? "Weitere Person hinzufügen" : null, "Session zurücksetzen"]);
    return;
  }

  elements.nextAction.textContent = "Zuhören läuft. Zeiten, Timeline und Diagramme werden jetzt verändert.";
  renderOptions(["Zuhören stoppen und Zeiten einfrieren", "Redeanteile beobachten", "Bei neuem Setup Session zurücksetzen"]);
}

function renderOptions(options) {
  elements.currentOptions.replaceChildren(
    ...options.filter(Boolean).map((option) => {
      const item = document.createElement("li");
      item.textContent = option;
      return item;
    })
  );
}

function applyProfileAudit(audit) {
  if (!audit?.byId) {
    return;
  }

  for (const participant of state.participants) {
    const quality = audit.byId[participant.id];

    if (!quality) {
      continue;
    }

    participant.profileQuality = quality;
    participant.profileSpeechSeconds = quality.speechSeconds;
    participant.needsMoreAudio = !quality.clear;
    participant.enrolled = quality.clear;
  }
}

function formatEnrollmentResult(participant, result) {
  const seconds = Math.round(result.speechSeconds ?? participant.profileSpeechSeconds ?? 0);

  if (result.clear && result.profileAudit?.clear) {
    return `${participant.name}: Fertig. Die Stimme ist klar genug (${seconds}s verwertbare Stimme, ${result.speechWindows} Sprachfenster, ${Math.round(
      result.latencyMs
    )} ms Prüfung).`;
  }

  const needed = Math.ceil(result.neededSeconds ?? participant.profileQuality?.neededSeconds ?? 0);
  const moreAudio = needed > 0 ? ` Bitte noch etwa ${needed}s zusätzliche Stimme aufnehmen.` : " Bitte noch mehr Stimme aufnehmen.";
  const ambiguous = ambiguousNames(participant).join(", ");
  const similar = ambiguous ? ` Die Stimme ist noch zu ähnlich mit: ${ambiguous}.` : "";
  return `${participant.name}: Noch nicht startklar (${seconds}s verwertbare Stimme erkannt).${moreAudio}${similar}`;
}

function showMoreVoiceDialog(audit) {
  const lines = [];

  for (const participant of state.participants) {
    if (participant.enrolled) {
      continue;
    }

    lines.push(`${participant.name}: ${profileStatusText(participant)}`);
  }

  if (!lines.length) {
    return;
  }

  elements.enrollmentDetails.textContent = `Noch nicht startklar. ${lines.join(" ")}`;
}

function profileStatusText(participant) {
  const quality = participant.profileQuality;

  if (participant.enrolled) {
    return `Profil klar (${Math.round(participant.profileSpeechSeconds ?? 0)}s Stimme).`;
  }

  if (!quality) {
    return "Stimme noch nicht kennengelernt.";
  }

  const needed = Math.ceil(quality.neededSeconds ?? 0);
  const ambiguous = ambiguousNames(participant);

  if (ambiguous.length) {
    return `Zu ähnlich mit ${ambiguous.join(", ")}. Bitte weitere Stimme aufnehmen.`;
  }

  if (needed > 0) {
    return `Noch etwa ${needed}s zusätzliche Stimme nötig.`;
  }

  return "Bitte weitere Stimme aufnehmen, damit das Profil klarer wird.";
}

function ambiguousNames(participant) {
  return (participant.profileQuality?.ambiguousWith ?? [])
    .map((id) => state.participants.find((entry) => entry.id === id)?.name)
    .filter(Boolean);
}

function renderEnrollmentStatus() {
  const active = state.participants.find((entry) => entry.id === state.activeEnrollmentId);
  const checking = state.participants.find((entry) => entry.id === state.checkingEnrollmentId);
  const next = state.participants.find((participant) => !participant.enrolled);
  const participant = active ?? checking ?? next;
  const color = participant ? colorForParticipant(participant.id) : "#9aa5b1";
  const level = active ? state.enrollmentLevel : 0;
  const readiness = active ? enrollmentReadiness() : null;
  const elapsed = readiness?.elapsed ?? 0;
  const speechSeconds = readiness?.speechSeconds ?? 0;
  const timeProgress = active ? Math.min(1, elapsed / ENROLLMENT_MAX_SECONDS) : 0;
  const speechProgress = active ? Math.min(1, speechSeconds / ENROLLMENT_TARGET_SPEECH_SECONDS) : 0;

  elements.enrollmentLevelName.textContent = participant ? participant.name : "wartet";
  elements.enrollmentLevelName.style.color = color;
  elements.enrollmentLevelBar.style.width = `${Math.round(level * 100)}%`;
  elements.enrollmentLevelBar.style.background = color;
  elements.enrollmentProgress.style.width = `${Math.round(timeProgress * 100)}%`;
  elements.enrollmentSpeechProgress.style.width = `${Math.round(speechProgress * 100)}%`;
  elements.enrollmentProgress.style.background = participant ? color : "#27ae60";
  elements.enrollmentSpeechProgress.style.background = speechProgress >= 1 ? "#1e7942" : color;
  elements.enrollmentTimeText.textContent = active
    ? `${Math.floor(elapsed)} / ${ENROLLMENT_MAX_SECONDS}s`
    : `0 / ${ENROLLMENT_MAX_SECONDS}s`;
  elements.enrollmentSpeechText.textContent = active
    ? `${Math.floor(speechSeconds)} / ${ENROLLMENT_TARGET_SPEECH_SECONDS}s`
    : `0 / ${ENROLLMENT_TARGET_SPEECH_SECONDS}s`;

  if (checking) {
    elements.enrollmentStateBadge.textContent = "Prüft";
    elements.enrollmentStateBadge.className = "status-badge is-busy";
    elements.enrollmentTimer.textContent = "...";
    elements.enrollmentVoiceFeedback.textContent = "Profil wird berechnet";
    elements.enrollmentVoiceFeedback.style.color = color;
    elements.enrollmentPrompt.textContent = `${checking.name}: Stimme wird geprüft.`;
    elements.enrollmentHelp.textContent =
      "Schwätzometer vergleicht die Stimmprobe lokal mit den anderen Profilen. Gleich steht hier, ob es reicht.";
    renderEnrollmentChecklist([
      { label: "Aufnahme abgeschlossen", ok: true },
      { label: "Profil wird lokal erstellt", ok: false, busy: true },
      { label: "Danach Ergebnis lesen", ok: false }
    ]);
    return;
  }

  if (active) {
    const feedback = enrollmentLevelFeedback();
    const action = enrollmentGuidance(readiness, feedback);
    elements.enrollmentStateBadge.textContent = "Nimmt auf";
    elements.enrollmentStateBadge.className = "status-badge is-recording";
    elements.enrollmentTimer.textContent = action.timer;
    elements.enrollmentVoiceFeedback.textContent = action.label;
    elements.enrollmentVoiceFeedback.style.color = action.color;
    elements.enrollmentPrompt.textContent = `${active.name} spricht jetzt.`;
    elements.enrollmentHelp.textContent = action.help;
    renderEnrollmentChecklist([
      { label: `${active.name} ist ausgewählt`, ok: true },
      { label: feedback.checkLabel, ok: feedback.ok, warning: feedback.warning },
      {
        label: `Mindestens ${ENROLLMENT_MIN_SECONDS}s aufnehmen (${Math.floor(elapsed)}s da)`,
        ok: readiness.enoughTime
      },
      {
        label: `${Math.floor(speechSeconds)}s verwertbare Stimme gesammelt`,
        ok: readiness.enoughSpeech
      },
      {
        label: `${state.enrollmentSpeechSegments}/${ENROLLMENT_VARIETY_SEGMENTS} unterschiedliche Sprachabschnitte`,
        ok: readiness.enoughVariety,
        warning: readiness.enoughSpeech && !readiness.enoughVariety
      },
      { label: readiness.canCheck ? "Jetzt prüfbar" : "Noch aufnehmen", ok: readiness.canCheck, busy: !readiness.canCheck }
    ]);
    return;
  }

  if (!state.engineInfo?.ready) {
    elements.enrollmentStateBadge.textContent = "Wartet";
    elements.enrollmentStateBadge.className = "status-badge";
    elements.enrollmentTimer.textContent = "--";
    elements.enrollmentVoiceFeedback.textContent = "Engine lädt";
    elements.enrollmentVoiceFeedback.style.color = "#5d6975";
    elements.enrollmentPrompt.textContent = "Sherpa-ONNX wird geladen.";
    elements.enrollmentHelp.textContent = "Sobald die Engine bereit ist, geht es mit Mikrofon und Namen weiter.";
    renderEnrollmentChecklist([
      { label: "Engine bereit", ok: false, busy: true },
      { label: "Mikrofon freigeben", ok: false },
      { label: "Erste Stimme kennenlernen", ok: false }
    ]);
    return;
  }

  if (!state.mediaStream) {
    elements.enrollmentStateBadge.textContent = "Wartet";
    elements.enrollmentStateBadge.className = "status-badge";
    elements.enrollmentTimer.textContent = "--";
    elements.enrollmentVoiceFeedback.textContent = "Mikrofon fehlt";
    elements.enrollmentVoiceFeedback.style.color = "#5d6975";
    elements.enrollmentPrompt.textContent = "Zuerst Mikrofon starten.";
    elements.enrollmentHelp.textContent = "Danach Namen eintippen und pro Person die Stimme kennenlernen lassen.";
    renderEnrollmentChecklist([
      { label: "Engine bereit", ok: true },
      { label: "Mikrofon freigeben", ok: false },
      { label: "Namen prüfen", ok: false }
    ]);
    return;
  }

  if (next) {
    elements.enrollmentStateBadge.textContent = next.needsMoreAudio ? "Mehr nötig" : "Bereit";
    elements.enrollmentStateBadge.className = next.needsMoreAudio ? "status-badge is-warning" : "status-badge is-ready";
    elements.enrollmentTimer.textContent = "10-30s";
    elements.enrollmentVoiceFeedback.textContent = next.needsMoreAudio ? "Noch nicht klar genug" : "Bereit für Stimmprobe";
    elements.enrollmentVoiceFeedback.style.color = color;
    elements.enrollmentPrompt.textContent = next.needsMoreAudio
      ? `${next.name}: bitte noch einmal Stimme aufnehmen.`
      : `${next.name}: Namen prüfen, dann Stimmprobe starten.`;
    elements.enrollmentHelp.textContent = next.needsMoreAudio
      ? profileStatusText(next)
      : "Die Person spricht in ganzen, abwechslungsreichen Sätzen. Namen kommen aus dem Textfeld, nicht aus Sprache.";
    renderEnrollmentChecklist([
      { label: "Mikrofon aktiv", ok: true },
      { label: `${next.name} ist als nächste Person dran`, ok: true },
      { label: "Stimmprobe starten", ok: false }
    ]);
    return;
  }

  elements.enrollmentStateBadge.textContent = "Fertig";
  elements.enrollmentStateBadge.className = "status-badge is-ready";
  elements.enrollmentTimer.textContent = "ok";
  elements.enrollmentVoiceFeedback.textContent = "Alle Profile bereit";
  elements.enrollmentVoiceFeedback.style.color = "#1e7942";
  elements.enrollmentPrompt.textContent = "Alle Stimmen sind kennengelernt.";
  elements.enrollmentHelp.textContent = "Du kannst jetzt die Zeitmessung starten oder vorher weitere Personen hinzufügen.";
  renderEnrollmentChecklist([
    { label: "Alle sichtbaren Personen haben ein Profil", ok: true },
    { label: "Zuhören und Zeiten ermitteln ist bereit", ok: true }
  ]);
}

function renderEnrollmentChecklist(items) {
  elements.enrollmentChecklist.replaceChildren(
    ...items.map((item) => {
      const entry = document.createElement("li");
      entry.className = item.ok ? "is-ok" : item.warning ? "is-warning" : item.busy ? "is-busy" : "";
      entry.textContent = item.label;
      return entry;
    })
  );
}

function enrollmentElapsedSeconds() {
  return state.activeEnrollmentId && state.enrollmentStartedAt ? (performance.now() - state.enrollmentStartedAt) / 1000 : 0;
}

function enrollmentSpeechSeconds() {
  return state.enrollmentSpeechMs / 1000;
}

function enrollmentReadiness() {
  const elapsed = enrollmentElapsedSeconds();
  const speechSeconds = enrollmentSpeechSeconds();
  const enoughTime = elapsed >= ENROLLMENT_MIN_SECONDS;
  const enoughSpeech = speechSeconds >= ENROLLMENT_MIN_SPEECH_SECONDS;
  const enoughVariety = state.enrollmentSpeechSegments >= ENROLLMENT_VARIETY_SEGMENTS;
  const goodLevel = state.enrollmentLastRms >= ENROLLMENT_GOOD_LEVEL;
  const voiceDetected = state.enrollmentLastRms >= ENROLLMENT_LOW_LEVEL;
  const strong = enoughTime && speechSeconds >= ENROLLMENT_TARGET_SPEECH_SECONDS && enoughVariety && goodLevel;
  const canCheck = enoughTime && enoughSpeech && state.enrollmentSpeechSegments >= 2;

  return {
    elapsed,
    speechSeconds,
    enoughTime,
    enoughSpeech,
    enoughVariety,
    goodLevel,
    voiceDetected,
    strong,
    canCheck,
    neededTime: Math.max(0, ENROLLMENT_MIN_SECONDS - elapsed),
    neededSpeech: Math.max(0, ENROLLMENT_MIN_SPEECH_SECONDS - speechSeconds),
    neededTargetSpeech: Math.max(0, ENROLLMENT_TARGET_SPEECH_SECONDS - speechSeconds),
    neededSegments: Math.max(0, ENROLLMENT_VARIETY_SEGMENTS - state.enrollmentSpeechSegments)
  };
}

function enrollmentCanBeChecked() {
  return Boolean(state.activeEnrollmentId) && enrollmentReadiness().canCheck;
}

function enrollmentLevelFeedback() {
  const rms = state.enrollmentLastRms;

  if (rms >= ENROLLMENT_GOOD_LEVEL) {
    return {
      label: "Pegel passt",
      checkLabel: "Stimme kommt klar an",
      color: "#1e7942",
      ok: true
    };
  }

  if (rms >= ENROLLMENT_LOW_LEVEL) {
    return {
      label: "Stimme erkannt",
      checkLabel: "Stimme erkannt, etwas lauter ist besser",
      color: "#9a5b00",
      ok: true,
      warning: true
    };
  }

  return {
    label: "Zu leise oder Pause",
    checkLabel: "Bitte näher ans Mikrofon oder weiter sprechen",
    color: "#b42318",
    ok: false,
    warning: true
  };
}

function enrollmentGuidance(readiness, levelFeedback) {
  const remainingMax = Math.max(0, ENROLLMENT_MAX_SECONDS - readiness.elapsed);
  const usefulMissing = Math.ceil(Math.max(readiness.neededTime, readiness.neededSpeech, readiness.neededTargetSpeech));

  if (!readiness.voiceDetected) {
    return {
      label: "Lauter sprechen",
      help: "Die Stimme ist gerade zu leise oder es ist Pause. Bitte näher ans Mikrofon und normal weiter sprechen.",
      timer: `${Math.ceil(remainingMax)}s max`,
      color: "#b42318"
    };
  }

  if (!readiness.goodLevel) {
    return {
      label: "Etwas lauter",
      help: "Stimme kommt an, aber knapp. Bitte etwas lauter oder näher am Mikrofon sprechen.",
      timer: `${Math.ceil(remainingMax)}s max`,
      color: "#9a5b00"
    };
  }

  if (!readiness.enoughTime) {
    return {
      label: `${Math.ceil(readiness.neededTime)}s weiter sprechen`,
      help: `Ich brauche mindestens ${ENROLLMENT_MIN_SECONDS}s Aufnahme, damit das Profil nicht zu dünn wird. Bitte normal weiter sprechen.`,
      timer: `${Math.ceil(readiness.neededTime)}s min`,
      color: levelFeedback.color
    };
  }

  if (!readiness.enoughSpeech) {
    return {
      label: `${Math.ceil(readiness.neededSpeech)}s Stimme fehlen`,
      help: "Es gab noch zu viel Pause oder zu wenig verwertbare Stimme. Bitte durchgehend in ganzen Sätzen sprechen.",
      timer: `${Math.ceil(readiness.neededSpeech)}s Stimme`,
      color: "#9a5b00"
    };
  }

  if (!readiness.enoughVariety) {
    return {
      label: "Unterschiedlicher sprechen",
      help: "Bitte noch ein paar andere Sätze sprechen, mit normaler Betonung. Das hilft, ähnliche Stimmen besser zu trennen.",
      timer: "mehr Abwechslung",
      color: "#9a5b00"
    };
  }

  if (readiness.strong) {
    return {
      label: "Genug Stimme, prüfe",
      help: "Das Profil hat genug verwertbare Stimme. Die App beendet die Stimmprobe jetzt automatisch und prüft das Profil.",
      timer: "prüft",
      color: "#1e7942"
    };
  }

  return {
    label: "Schon prüfbar",
    help: `Die Mindestqualität ist erreicht. Noch etwa ${Math.max(1, usefulMissing)}s mit unterschiedlichen Sätzen können das Profil verbessern.`,
    timer: `${Math.max(1, usefulMissing)}s besser`,
    color: "#1f6fba"
  };
}

function renderLiveStatus() {
  const elapsed = elapsedLiveSeconds();
  const last = state.timeline[state.timeline.length - 1];
  const speakerName = last ? displayName(last.speakerId) : state.live ? "Hört zu" : "Wartet";
  const speakerColor = last?.speakerId ? colorForParticipant(last.speakerId) : "";

  elements.liveClock.textContent = formatDuration(elapsed);
  elements.displayCountdown.textContent = state.live
    ? "zuhören"
    : state.finalizingLive
      ? "beendet..."
    : state.liveAccumulatedMs > 0
      ? "gestoppt"
      : allEnrolled()
        ? "bereit"
        : "Stimme fehlt";
  elements.liveSpeaker.textContent = speakerName;
  elements.currentSpeaker.textContent = state.live || state.finalizingLive ? speakerName : "-";
  elements.liveSpeaker.style.color = speakerColor;
  elements.currentSpeaker.style.color = state.live || state.finalizingLive ? speakerColor : "";
  elements.liveConfidence.textContent = last ? `${Math.round(last.confidence * 100)}% Confidence` : "-";
  elements.unknownState.textContent = last?.speakerId === UNKNOWN_ID ? "Unknown" : "Schwellwert aktiv";
}

function renderScores() {
  const scores = state.lastDebug?.scores ?? {};

  elements.scores.replaceChildren(
    ...state.participants.map((participant) => {
      const score = scores[participant.id] ?? 0;
      const color = colorForParticipant(participant.id);
      const row = document.createElement("div");
      row.className = "score-row";
      row.innerHTML = `
        <span style="color: ${color}">${escapeHtml(participant.name)}</span>
        <div class="score-bar"><i style="width: ${Math.max(0, Math.min(100, score * 100))}%; background: ${color}"></i></div>
        <strong>${score.toFixed(3)}</strong>
      `;
      return row;
    })
  );
}

function renderChart() {
  const shares = shareRows();

  drawPieChart(elements.shareChart, shares);

  elements.shareLegend.replaceChildren(
    ...shares.map((share) => {
      const item = document.createElement("div");
      item.className = "legend-item";
      item.innerHTML = `
        <span class="swatch" style="background:${share.color}"></span>
        <span style="color:${share.color}">${escapeHtml(share.name)}</span>
        <strong>${formatDuration(share.seconds)}</strong>
      `;
      return item;
    })
  );

  renderBarChart(shares);
}

function renderBarChart(shares) {
  const maxSeconds = Math.max(...shares.map((share) => share.seconds), 1);

  elements.shareBars.replaceChildren(
    ...shares.map((share) => {
      const column = document.createElement("div");
      column.className = "bar-column";
      const height = Math.max(3, (share.seconds / maxSeconds) * 100);
      column.innerHTML = `
        <div class="bar-track">
          <div class="bar-fill" style="height:${height}%; background:${share.color}"></div>
        </div>
        <strong style="color:${share.color}">${escapeHtml(share.name)}</strong>
        <span>${formatDuration(share.seconds)}</span>
      `;
      return column;
    })
  );
}

function shareRows() {
  const rows = state.participants.map((participant, index) => ({
    id: participant.id,
    name: participant.name,
    seconds: state.speakingSeconds.get(participant.id) ?? 0,
    color: colorForIndex(index)
  }));
  const unknownSeconds = state.speakingSeconds.get(UNKNOWN_ID) ?? 0;

  if (unknownSeconds > 0 || state.live) {
    rows.push({
      id: UNKNOWN_ID,
      name: "Unknown",
      seconds: unknownSeconds,
      color: colorForParticipant(UNKNOWN_ID)
    });
  }

  return rows;
}

function renderTimeline() {
  const total = state.timeline.reduce((sum, item) => sum + item.seconds, 0);

  if (!state.timeline.length) {
    elements.timeline.innerHTML = `<div class="empty">Noch keine Segmente.</div>`;
    return;
  }

  elements.timeline.replaceChildren(
    ...state.timeline.map((item) => {
      const segment = document.createElement("div");
      segment.className = `segment ${item.speakerId === UNKNOWN_ID ? "unknown" : ""}`;
      segment.style.flexBasis = `${Math.max(4, (item.seconds / Math.max(total, 1)) * 100)}%`;
      segment.title = `${displayName(item.speakerId)} ${formatDuration(item.seconds)}`;
      segment.textContent = displayName(item.speakerId);

      if (item.speakerId !== UNKNOWN_ID) {
        segment.style.background = colorForIndex(state.participants.findIndex((entry) => entry.id === item.speakerId));
      }

      return segment;
    })
  );
}

function renderDebug() {
  const debug = state.lastDebug;

  elements.debugLatency.textContent = debug ? `${Math.round(debug.latencyMs)} ms` : "-";
  elements.debugVad.textContent = debug?.vad ? (debug.vad.speech ? "speech" : "silence") : "-";
  elements.debugRms.textContent = debug?.vad ? debug.vad.rms.toFixed(4) : "-";
  elements.debugFrames.textContent = String(debug?.framesProcessed ?? 0);
  elements.debugModel.textContent = state.engineInfo?.modelStatus ?? "-";
  elements.debugScores.textContent = JSON.stringify(
    {
      scores: debug?.scores ?? {},
      embeddingScores: debug?.embeddingScores ?? {},
      embeddingRawScores: debug?.embeddingRawScores ?? {},
      diarizationScores: debug?.diarizationScores ?? {},
      margin: debug?.margin ?? 0,
      embeddingMargin: debug?.embeddingMargin ?? 0,
      diarizationMargin: debug?.diarizationMargin ?? 0,
      decisionMode: debug?.decisionMode ?? "-",
      engineStage: state.engineInfo?.stage ?? "-",
      contextSeconds: debug?.contextSeconds ?? 0,
      profileAudit: debug?.profileAudit ?? state.lastProfileAudit ?? null,
      rawClusters: debug?.rawClusters ?? []
    },
    null,
    2
  );
}

function allEnrolled() {
  return (
    state.engineInfo?.ready &&
    state.participants.length >= MIN_PARTICIPANTS &&
    state.participants.every((participant) => participant.enrolled && !participant.needsMoreAudio)
  );
}

function elapsedLiveSeconds() {
  const activeMs = state.live && state.liveStartedAt ? performance.now() - state.liveStartedAt : 0;
  return Math.floor((state.liveAccumulatedMs + activeMs) / 1000);
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

function computeRms(samples) {
  let sumSquares = 0;

  for (const sample of samples) {
    sumSquares += sample * sample;
  }

  return Math.sqrt(sumSquares / Math.max(samples.length, 1));
}

function smoothLevel(previous, rms) {
  const target = Math.max(0, Math.min(1, rms * 14));
  return previous * 0.68 + target * 0.32;
}

function colorForParticipant(id) {
  if (id === UNKNOWN_ID) {
    return "#687482";
  }

  const index = state.participants.findIndex((participant) => participant.id === id);
  return index >= 0 ? colorForIndex(index) : "#17202a";
}

function displayName(id) {
  if (id === UNKNOWN_ID) {
    return "Unknown";
  }

  return state.participants.find((participant) => participant.id === id)?.name ?? "-";
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[character];
  });
}
