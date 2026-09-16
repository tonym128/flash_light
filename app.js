// ==========================================
// Application State & Globals
// (Core DSP math and FFT are imported from dsp.js)
// ==========================================

// ==========================================
// Application State & Globals
// ==========================================
const FFT_SIZE = 4096;
const SIGNAL_LEN = 512;

const fft = new FFT(FFT_SIZE);
const hanningWindow = new Float32Array(SIGNAL_LEN);
for (let i = 0; i < SIGNAL_LEN; i++) {
  hanningWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (SIGNAL_LEN - 1)));
}

// DOM Elements
const videoEl = document.getElementById('video-el');
const previewCanvas = document.getElementById('preview-canvas');
const previewCtx = previewCanvas.getContext('2d');
const laserLine = document.getElementById('laser-line');
const hzValEl = document.getElementById('hz-val');
const statusTextEl = document.getElementById('status-text');
const confidencePctEl = document.getElementById('confidence-pct');
const confidenceBarEl = document.getElementById('confidence-bar');
const gridMatchTagEl = document.getElementById('grid-match-tag');
const axisIndicatorEl = document.getElementById('axis-indicator');
const cameraOverlayMessage = document.getElementById('camera-overlay-message');
const flickerPctValEl = document.getElementById('flicker-pct-val');
const flickerIndexValEl = document.getElementById('flicker-index-val');
const thdValEl = document.getElementById('thd-val');
const svmValEl = document.getElementById('svm-val');
const driverQualityValEl = document.getElementById('driver-quality-val');

// New HUD & Lens Profile DOM elements
const exposureHudEl = document.getElementById('exposure-hud');
const shutterHudEl = document.getElementById('shutter-hud');
const roiHudEl = document.getElementById('roi-hud');
const cameraModeBadgeEl = document.getElementById('camera-mode-badge');
const sensorProfileInfoEl = document.getElementById('sensor-profile-info');
const testSignalSelect = document.getElementById('test-signal-select');
const roiSelect = document.getElementById('roi-select');

// Clinical & Ergonomic Health Feedback Elements
const healthFeedbackCard = document.getElementById('health-feedback-card');
const feedbackHeadline = document.getElementById('feedback-headline');
const feedbackRiskBadge = document.getElementById('feedback-risk-badge');
const feedbackSummary = document.getElementById('feedback-summary');
const feedbackComparison = document.getElementById('feedback-comparison');
const feedbackRecommendation = document.getElementById('feedback-recommendation');

// Session Recorder DOM elements
const startRecBtn = document.getElementById('start-rec-btn');
const startRecLabel = document.getElementById('start-rec-label');
const exportCardBtn = document.getElementById('export-card-btn');
const recProgressContainer = document.getElementById('rec-progress-container');
const recProgressBar = document.getElementById('rec-progress-bar');
const recTimerLabel = document.getElementById('rec-timer-label');
const recSamplesCount = document.getElementById('rec-samples-count');
const exportDownloadRow = document.getElementById('export-download-row');
const downloadCsvBtn = document.getElementById('download-csv-btn');
const downloadJsonBtn = document.getElementById('download-json-btn');
const recordStatusBadge = document.getElementById('record-status-badge');
const auditHashContainer = document.getElementById('audit-hash-container');
const auditHashBadge = document.getElementById('audit-hash-badge');
const auditHistoryContainer = document.getElementById('audit-history-container');
const auditHistoryTbody = document.getElementById('audit-history-tbody');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// Ambient Tare & Audio Sonification Elements
const ambientTareBadge = document.getElementById('ambient-tare-badge');
const clearTareBtn = document.getElementById('clear-tare-btn');
const tareAmbientBtn = document.getElementById('tare-ambient-btn');
const tareBtnLabel = document.getElementById('tare-btn-label');
const audioToggleBtn = document.getElementById('audio-toggle-btn');
const audioBtnLabel = document.getElementById('audio-btn-label');

// Facility Session Elements
const facilityNameInput = document.getElementById('facility-name-input');
const fixtureIdInput = document.getElementById('fixture-id-input');
const printFacilityReportBtn = document.getElementById('print-facility-report-btn');
const printableFacilityReport = document.getElementById('printable-facility-report');

// Strobe Generator Elements
const openStrobeBtn = document.getElementById('open-strobe-btn');
const strobeModal = document.getElementById('strobe-modal');
const strobeCanvas = document.getElementById('strobe-canvas');
const toggleStrobeBtn = document.getElementById('toggle-strobe-btn');
const closeStrobeBtn = document.getElementById('close-strobe-btn');
const strobeHzBtns = document.querySelectorAll('.strobe-hz-btn');

const cameraSelect = document.getElementById('camera-select');
const axisSelect = document.getElementById('axis-select');
const skewSlider = document.getElementById('skew-slider');
const skewValEl = document.getElementById('skew-val');
const freezeBtn = document.getElementById('freeze-btn');
const calibrateBtn = document.getElementById('calibrate-btn');

// Diagnostic Canvases
const waveformCanvas = document.getElementById('waveform-canvas');
const waveformCtx = waveformCanvas.getContext('2d');
const spectrumCanvas = document.getElementById('spectrum-canvas');
const spectrumCtx = spectrumCanvas.getContext('2d');

// Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabWrappers = document.querySelectorAll('.chart-wrapper');

// Calibration Modal Elements
const calModal = document.getElementById('calibration-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const gridBtns = document.querySelectorAll('.grid-btn');
const calNext1 = document.getElementById('cal-next-1');
const calBack2 = document.getElementById('cal-back-2');
const calStartBtn = document.getElementById('cal-start-btn');
const calFinishBtn = document.getElementById('cal-finish-btn');
const calStep1 = document.getElementById('cal-step-1');
const calStep2 = document.getElementById('cal-step-2');
const calStep3 = document.getElementById('cal-step-3');
const calProgressBar = document.getElementById('cal-progress-bar');
const calStatusText = document.getElementById('cal-status-text');
const calResultSkew = document.getElementById('cal-result-skew');
const calResultLineRate = document.getElementById('cal-result-linerate');

// Offscreen Canvas for Pixel Analysis
const offscreenCanvas = document.createElement('canvas');
offscreenCanvas.width = SIGNAL_LEN;
offscreenCanvas.height = SIGNAL_LEN;
const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

// Settings & Variables
let currentStream = null;
let animationFrameId = null;
let isFrozen = false;
let skewSeconds = 0.030; // default rolling shutter skew (30ms)
let scanMode = 'auto'; // 'auto', 'x', 'y'
let currentActiveAxis = 'y'; // 'y' = horizontal bands (vertical scanning), 'x' = vertical bands (horizontal scanning)
let latestPeakBin = 0;
let latestValidSignal = false;
let roiMode = 'auto'; // 'auto' (bright bulb core), 'full' (full frame)
let currentRoi = { x: 128, y: 128, w: 256, h: 256 };

// Multi-Lens Profile state
let activeDeviceId = 'default';
let activeResolution = '1280x720';
let activeLensName = 'Default Camera';

// Signal Source & Synthetic Test Generator state
let signalSource = 'live'; // 'live', 'test-100', 'test-120', 'test-pwm250', 'test-dc'
let syntheticPhase = 0;

// Session Recording state
let isRecording = false;
let recordStartTime = 0;
let recordSamples = [];
const RECORD_DURATION_MS = 10000;

// Real-time smoothed metrics
let smoothedFreq = 0;
let confidence = 0;
let signalWaveformBuffer = new Float32Array(SIGNAL_LEN);
let fftMagnitudesBuffer = new Float32Array(FFT_SIZE / 2);

// ==========================================
// Pre-allocated Zero-GC Scratch Buffers
// ==========================================
const colAverages = new Float32Array(SIGNAL_LEN);
const rowAverages = new Float32Array(SIGNAL_LEN);
const detrendScratch = new Float32Array(SIGNAL_LEN);
const windowedScratch = new Float32Array(SIGNAL_LEN);
const realBufferScratch = new Float32Array(FFT_SIZE);

// Pre-allocated Analysis Result Objects
const analysisResultY = {
  freq: 0,
  snr: 0,
  peakBin: 0,
  peakMag: 0,
  waveform: new Float32Array(SIGNAL_LEN),
  magnitudes: new Float32Array(FFT_SIZE / 2)
};

const analysisResultX = {
  freq: 0,
  snr: 0,
  peakBin: 0,
  peakMag: 0,
  waveform: new Float32Array(SIGNAL_LEN),
  magnitudes: new Float32Array(FFT_SIZE / 2)
};

// Calibration State
let isCalibrating = false;
let calTargetFreq = 100; // default 50Hz grid -> 100Hz flicker
let calPeaks = [];
const CAL_SAMPLES_NEEDED = 60;

// Web Worker State
let dspWorker = null;
let isWorkerBusy = false;
let frameCounter = 0;

// Ambient Tare State
let isTaringAmbient = false;
let ambientTareCount = 0;
let ambientTareSum = 0;
let ambientBaselineLuminance = 0;
const AMBIENT_TARE_FRAMES = 45;

// Audio Sonification State (Web Audio API)
let audioCtx = null;
let isAudioEnabled = false;
let masterGain = null;
let fundamentalOsc = null;
let harmonicOsc2 = null;
let harmonicGain2 = null;
let harmonicOsc3 = null;
let harmonicGain3 = null;

// ==========================================
// Multi-Lens Profile Persistence
// ==========================================
function getLensStorageKey(deviceId, resolution) {
  return `rolling_shutter_skew_${deviceId || 'default'}_${resolution || 'default'}`;
}

// Pre-calibrated factory sensor profiles
const FACTORY_SKEW_PRESETS = [
  { match: /Pixel 8/i, name: 'Google Pixel 8 (ISOCELL GNV)', skew: 0.0284 },
  { match: /Pixel 7/i, name: 'Google Pixel 7 (ISOCELL GN1)', skew: 0.0286 },
  { match: /Pixel 6/i, name: 'Google Pixel 6 (ISOCELL GN1)', skew: 0.0290 },
  { match: /SM-S928/i, name: 'Galaxy S24 Ultra (ISOCELL HP2)', skew: 0.0292 },
  { match: /SM-S918/i, name: 'Galaxy S23 Ultra (ISOCELL HP2)', skew: 0.0294 },
  { match: /SM-S908/i, name: 'Galaxy S22 Ultra (ISOCELL HM3)', skew: 0.0298 },
  { match: /iPhone/i, name: 'Apple iPhone (Safari WebKit)', skew: 0.0255 },
  { match: /OnePlus/i, name: 'OnePlus Flagship (IMX890)', skew: 0.0295 },
  { match: /Xiaomi/i, name: 'Xiaomi Flagship (LYT-900)', skew: 0.0305 }
];

function detectFactoryPreset() {
  const ua = navigator.userAgent || '';
  for (const preset of FACTORY_SKEW_PRESETS) {
    if (preset.match.test(ua)) {
      return preset;
    }
  }
  return null;
}

function loadLensProfile(deviceId, resolution, lensName) {
  const key = getLensStorageKey(deviceId, resolution);
  const saved = localStorage.getItem(key) || localStorage.getItem('rolling_shutter_skew');
  let isFactory = false;
  let profileName = lensName;
  
  if (saved) {
    skewSeconds = parseFloat(saved);
  } else {
    const factory = detectFactoryPreset();
    if (factory) {
      skewSeconds = factory.skew;
      isFactory = true;
      profileName = factory.name;
    } else {
      skewSeconds = 0.030;
    }
  }
  
  skewSlider.value = (skewSeconds * 1000).toFixed(1);
  skewValEl.innerText = (skewSeconds * 1000).toFixed(1) + ' ms';
  if (sensorProfileInfoEl) {
    sensorProfileInfoEl.innerText = `${isFactory ? 'Factory ' : ''}${profileName}: ${(skewSeconds * 1000).toFixed(1)}ms`;
  }
}

function saveLensProfile(deviceId, resolution, skewVal, lensName) {
  const key = getLensStorageKey(deviceId, resolution);
  localStorage.setItem(key, skewVal);
  localStorage.setItem('rolling_shutter_skew', skewVal);
  if (sensorProfileInfoEl) {
    sensorProfileInfoEl.innerText = `${lensName}: ${(skewVal * 1000).toFixed(1)}ms`;
  }
}

// Initial profile load
loadLensProfile(activeDeviceId, activeResolution, activeLensName);

// ==========================================
// Signal Processing Helpers (Zero-Allocation)
// ==========================================

// In-place O(n) detrending using moving average
function detrendInPlace(signal, windowSize, outBuffer) {
  const n = signal.length;
  const half = Math.floor(windowSize / 2);
  
  let sum = 0;
  let count = 0;
  
  for (let i = 0; i < half; i++) {
    sum += signal[i];
    count++;
  }
  
  for (let i = 0; i < n; i++) {
    let addIdx = i + half;
    if (addIdx < n) {
      sum += signal[addIdx];
      count++;
    }
    
    let removeIdx = i - half - 1;
    if (removeIdx >= 0) {
      sum -= signal[removeIdx];
      count--;
    }
    
    let average = sum / count;
    outBuffer[i] = signal[i] - average;
  }
}

// Parabolic interpolation for sub-bin peak precision
function interpolatePeak(magnitudes, p) {
  if (p <= 0 || p >= magnitudes.length - 1) return p;
  const alpha = magnitudes[p - 1];
  const beta = magnitudes[p];
  const gamma = magnitudes[p + 1];
  
  const denom = alpha - 2 * beta + gamma;
  if (denom === 0) return p;
  
  const d = 0.5 * (alpha - gamma) / denom;
  return p + d;
}

// Analyze signal for dominant frequency in-place into outResult
function analyzeSignalInPlace(rawSignal, skewSec, outResult) {
  // 1. Detrend signal (window size ~ 25ms to preserve 50Hz/60Hz half-wave rectification)
  const windowSamples = Math.max(24, Math.min(320, Math.round(SIGNAL_LEN * (0.025 / skewSec))));
  detrendInPlace(rawSignal, windowSamples, outResult.waveform);
  
  // 2. Apply Hanning window
  for (let i = 0; i < SIGNAL_LEN; i++) {
    windowedScratch[i] = outResult.waveform[i] * hanningWindow[i];
  }
  
  // 3. Zero-pad to FFT size (4096)
  realBufferScratch.fill(0);
  realBufferScratch.set(windowedScratch);
  
  // 4. Run FFT
  fft.forward(realBufferScratch);
  
  // 5. Compute Magnitudes (up to Nyquist frequency: FFT_SIZE/2)
  const halfFft = FFT_SIZE / 2;
  const magnitudes = outResult.magnitudes;
  for (let k = 0; k < halfFft; k++) {
    const r = realBufferScratch[k];
    const im = fft.imag[k];
    magnitudes[k] = Math.sqrt(r * r + im * im);
  }
  
  // 6. Find peak in search range (35 Hz to 2000 Hz)
  const minBin = Math.max(4, Math.floor(35 * 8 * skewSec));
  const maxBin = Math.min(halfFft - 2, Math.ceil(2000 * 8 * skewSec));
  
  let maxMag = 0;
  let peakBin = minBin;
  let sumNoise = 0;
  
  for (let k = minBin; k <= maxBin; k++) {
    const mag = magnitudes[k];
    sumNoise += mag;
    if (mag > maxMag) {
      maxMag = mag;
      peakBin = k;
    }
  }
  
  const avgNoise = sumNoise / (maxBin - minBin + 1);
  const snr = maxMag / (avgNoise || 1);
  
  // 7. Interpolate peak and calculate frequency (f = bin / (8 * skew))
  const interpolatedBin = interpolatePeak(magnitudes, peakBin);
  const freq = interpolatedBin / (8 * skewSec);
  
  outResult.freq = freq;
  outResult.snr = snr;
  outResult.peakBin = peakBin;
  outResult.peakMag = maxMag;
}

// ==========================================
// Web Worker Initialization & Message Handling
// ==========================================
function initWebWorker() {
  if (typeof Worker === 'undefined') return;
  try {
    dspWorker = new Worker('dsp.worker.js');
    dspWorker.onmessage = handleWorkerMessage;
    dspWorker.onerror = (err) => {
      console.warn('DSP Web Worker encountered an error, falling back to main-thread DSP:', err);
      dspWorker = null;
      isWorkerBusy = false;
    };
    console.log('DSP Web Worker initialized successfully (Thread Decoupled)');
  } catch (err) {
    console.warn('Unable to initialize Web Worker (origin restriction / sandboxed), using main thread DSP:', err);
    dspWorker = null;
  }
}

function handleWorkerMessage(e) {
  const d = e.data;
  if (!d || d.type !== 'FRAME_RESULT') return;
  isWorkerBusy = false;

  // Restore transferred arrays
  if (d.rowAverages) rowAverages.set(d.rowAverages);
  if (d.colAverages) colAverages.set(d.colAverages);

  currentActiveAxis = d.winner;
  latestPeakBin = d.peakBin || 0;
  latestValidSignal = !!d.validSignal;
  const validSignal = d.validSignal;
  const freq = d.freq;
  const snr = d.snr;
  const percentFlicker = d.percentFlicker;
  const flickerIndex = d.flickerIndex;
  const thd = d.thd;
  const svm = d.svm;
  const driverQuality = d.driverQuality;
  const ratingClass = d.ratingClass;

  if (d.waveform) signalWaveformBuffer.set(d.waveform);
  if (d.magnitudes) fftMagnitudesBuffer.set(d.magnitudes);

  updateMetricsDisplay({
    validSignal,
    freq,
    snr,
    percentFlicker,
    flickerIndex,
    thd,
    svm,
    svmRatingClass: d.svmRatingClass,
    driverQuality,
    ratingClass,
    isSynthetic: signalSource !== 'live',
    meanRoiLuminance: d.meanRoiLuminance || 100
  });

  // Audio Sonification update
  updateAudioSonification(freq, percentFlicker, thd, snr);

  // Calibration logging
  if (isCalibrating && validSignal) {
    calPeaks.push(d.peakBin);
    const progress = Math.min(100, Math.round((calPeaks.length / CAL_SAMPLES_NEEDED) * 100));
    calProgressBar.style.width = progress + '%';
    calStatusText.innerText = `Capturing signal... ${calPeaks.length} / ${CAL_SAMPLES_NEEDED} samples`;
    if (calPeaks.length >= CAL_SAMPLES_NEEDED) {
      finishCalibration();
    }
  }

  // Session recording
  if (isRecording && validSignal) {
    recordSamples.push({
      timeMs: Date.now() - recordStartTime,
      freq,
      percentFlicker,
      flickerIndex,
      thd,
      svm,
      snr,
      driverQuality,
      confidence
    });
  }
}

// ==========================================
// Centralized Metrics UI Updater
// ==========================================
function updateMetricsDisplay(data) {
  const {
    validSignal,
    freq,
    snr,
    percentFlicker,
    flickerIndex,
    thd,
    svm,
    svmRatingClass,
    driverQuality,
    ratingClass,
    isSynthetic,
    meanRoiLuminance
  } = data;

  if (validSignal) {
    if (smoothedFreq === 0) {
      smoothedFreq = freq;
    } else {
      smoothedFreq = smoothedFreq * 0.82 + freq * 0.18;
    }

    const calculatedConfidence = Math.min(100, Math.round((snr - 3.2) * 20));
    confidence = Math.max(confidence * 0.9 + calculatedConfidence * 0.1, calculatedConfidence);

    hzValEl.innerText = smoothedFreq.toFixed(1);
    statusTextEl.innerText = isSynthetic ? "SYNTHETIC SIGNAL ACTIVE" : "STABLE FLICKER DETECTED";
    statusTextEl.style.color = "var(--color-primary)";

    flickerPctValEl.innerText = percentFlicker.toFixed(1) + '%';
    if (flickerIndexValEl) flickerIndexValEl.innerText = flickerIndex.toFixed(3);
    if (thdValEl) thdValEl.innerText = (thd > 0 && freq > 0) ? (thd.toFixed(1) + '%') : '--.-%';
    if (svmValEl) {
      svmValEl.innerText = svm.toFixed(2);
      svmValEl.className = 'sub-metric-value ' + (svmRatingClass || 'rating-none');
    }
    driverQualityValEl.innerText = driverQuality;
    driverQualityValEl.className = 'sub-metric-value ' + ratingClass;

    // Shutter speed attenuation heuristic
    if (shutterHudEl) {
      const isAutoExp = cameraModeBadgeEl && cameraModeBadgeEl.innerText.includes('Auto');
      if (isAutoExp && meanRoiLuminance < 45 && snr < 4.5 && !isSynthetic) {
        shutterHudEl.style.display = 'block';
        shutterHudEl.innerText = '⚠️ Shutter Slow (Averaging Flicker)';
      } else {
        shutterHudEl.style.display = 'none';
      }
    }

    // Real-Time Health, Neurological & Ergonomic Feedback
    if (healthFeedbackCard && typeof getHealthFeedback === 'function') {
      const fb = getHealthFeedback({ freq: smoothedFreq, percentFlicker, svm, thd });
      if (fb) {
        healthFeedbackCard.style.display = 'block';
        healthFeedbackCard.className = 'health-feedback-card ' + fb.badgeClass;
        if (feedbackHeadline) feedbackHeadline.innerText = fb.headline;
        if (feedbackRiskBadge) {
          feedbackRiskBadge.innerText = fb.riskLevel;
          const riskColorClass = (fb.riskLevel === 'NONE' || fb.riskLevel === 'LOW') ? 'print-pass' : (fb.riskLevel === 'MODERATE' ? 'badge-caution' : 'print-fail');
          feedbackRiskBadge.className = 'badge-tag-sm ' + riskColorClass;
        }
        if (feedbackSummary) feedbackSummary.innerText = fb.summary;
        if (feedbackComparison) feedbackComparison.innerText = fb.comparison;
        if (feedbackRecommendation) feedbackRecommendation.innerText = fb.recommendation;
      }
    }
  } else {
    confidence = Math.max(0, confidence * 0.92);
    if (confidence < 10) {
      hzValEl.innerText = '--.-';
      statusTextEl.innerText = "NO FLICKER DETECTED";
      statusTextEl.style.color = "var(--color-muted)";
      flickerPctValEl.innerText = '--.-%';
      if (flickerIndexValEl) flickerIndexValEl.innerText = '0.000';
      if (thdValEl) thdValEl.innerText = '--.-%';
      if (svmValEl) {
        svmValEl.innerText = '--.--';
        svmValEl.className = 'sub-metric-value rating-none';
      }
      driverQualityValEl.innerText = "UNKNOWN";
      driverQualityValEl.className = 'sub-metric-value rating-none';
      if (shutterHudEl) shutterHudEl.style.display = 'none';
      if (healthFeedbackCard) healthFeedbackCard.style.display = 'none';
    }
  }

  if (confidenceBarEl) confidenceBarEl.style.width = confidence + '%';
  if (confidencePctEl) confidencePctEl.innerText = Math.round(confidence) + '%';
  updateGridMatchTag(smoothedFreq, confidence);
}

// ==========================================
// Web Audio API Sonification ("Hear the Flicker")
// ==========================================
function initAudio() {
  if (audioCtx) return;
  try {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) return;
    audioCtx = new AudioCtxClass();

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    // Fundamental oscillator (triangle wave)
    fundamentalOsc = audioCtx.createOscillator();
    fundamentalOsc.type = 'triangle';
    fundamentalOsc.frequency.setValueAtTime(100, audioCtx.currentTime);
    fundamentalOsc.connect(masterGain);
    fundamentalOsc.start();

    // 2nd harmonic oscillator (sine wave)
    harmonicOsc2 = audioCtx.createOscillator();
    harmonicOsc2.type = 'sine';
    harmonicGain2 = audioCtx.createGain();
    harmonicGain2.gain.setValueAtTime(0.0, audioCtx.currentTime);
    harmonicOsc2.frequency.setValueAtTime(200, audioCtx.currentTime);
    harmonicOsc2.connect(harmonicGain2);
    harmonicGain2.connect(masterGain);
    harmonicOsc2.start();

    // 3rd harmonic oscillator (sawtooth wave)
    harmonicOsc3 = audioCtx.createOscillator();
    harmonicOsc3.type = 'sawtooth';
    harmonicGain3 = audioCtx.createGain();
    harmonicGain3.gain.setValueAtTime(0.0, audioCtx.currentTime);
    harmonicOsc3.frequency.setValueAtTime(300, audioCtx.currentTime);
    harmonicOsc3.connect(harmonicGain3);
    harmonicGain3.connect(masterGain);
    harmonicOsc3.start();
  } catch (e) {
    console.warn('AudioContext initialization failed:', e);
  }
}

function updateAudioSonification(freq, percentFlicker, thd, snr) {
  if (!isAudioEnabled || !audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;

  // Pure DC, low SNR, or outside audible range -> silence
  if (snr < 3.2 || freq < 25 || freq > 2500 || percentFlicker < 1.0) {
    masterGain.gain.setTargetAtTime(0.00001, now, 0.05);
    return;
  }

  // Set fundamental tone
  fundamentalOsc.frequency.setTargetAtTime(Math.max(20, Math.min(2500, freq)), now, 0.03);

  // Volume scaled by modulation depth
  const targetVol = Math.min(0.22, (percentFlicker / 100) * 0.18);
  masterGain.gain.setTargetAtTime(targetVol, now, 0.05);

  // Scale harmonics by THD
  const hRatio = Math.min(1.0, (thd || 0) / 50.0);
  harmonicOsc2.frequency.setTargetAtTime(Math.max(20, Math.min(5000, freq * 2)), now, 0.03);
  harmonicGain2.gain.setTargetAtTime(hRatio * 0.3, now, 0.05);

  harmonicOsc3.frequency.setTargetAtTime(Math.max(20, Math.min(7500, freq * 3)), now, 0.03);
  harmonicGain3.gain.setTargetAtTime(hRatio * 0.15, now, 0.05);
}

// Initialize worker
initWebWorker();

// ==========================================
// Frame Processing & Camera Logic
// ==========================================

async function initCamera() {
  if (cameraOverlayMessage) {
    cameraOverlayMessage.style.display = 'flex';
    cameraOverlayMessage.innerHTML = '<div class="spinner"></div><p>Requesting camera access...</p>';
  }
  
  try {
    // 1. Start streaming with ideal environment (back) camera first to trigger permission prompt
    await startStreaming();
    
    // 2. Once permissions are established, enumerate devices with full labels
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      
      if (cameraSelect && videoDevices.length > 0) {
        cameraSelect.innerHTML = '';
        videoDevices.forEach((device, index) => {
          const option = document.createElement('option');
          option.value = device.deviceId;
          option.text = device.label || `Camera ${index + 1}`;
          cameraSelect.appendChild(option);
        });
        
        // Match currently active stream track ID if available
        if (currentStream) {
          const activeTrack = currentStream.getVideoTracks()[0];
          const activeSettings = activeTrack ? activeTrack.getSettings() : null;
          if (activeSettings && activeSettings.deviceId) {
            cameraSelect.value = activeSettings.deviceId;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error listing cameras:', err);
    if (cameraOverlayMessage) {
      cameraOverlayMessage.innerHTML = `<p style="color:var(--color-error)">Failed to initialize cameras: ${err.message}</p>`;
    }
  }
}

async function configureOptimalCameraSettings(track) {
  if (!track || !track.getCapabilities) return;
  const capabilities = track.getCapabilities();
  const advancedConstraints = {};
  let manualExposureApplied = false;

  // 1. Check exposureMode
  if (capabilities.exposureMode && capabilities.exposureMode.includes('manual')) {
    advancedConstraints.exposureMode = 'manual';
    manualExposureApplied = true;
  }

  // 2. Request minimum exposure time to freeze rolling bands (target < 1ms or min available)
  if (capabilities.exposureTime) {
    advancedConstraints.exposureTime = capabilities.exposureTime.min || 1;
    manualExposureApplied = true;
  }

  // 3. Lock continuous focus to avoid focus hunting on high-contrast stripes
  if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
    advancedConstraints.focusMode = 'continuous';
  }

  // 4. Set continuous white balance
  if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes('continuous')) {
    advancedConstraints.whiteBalanceMode = 'continuous';
  }

  if (Object.keys(advancedConstraints).length > 0) {
    try {
      await track.applyConstraints({ advanced: [advancedConstraints] });
      console.log('Applied advanced camera constraints:', advancedConstraints);
    } catch (err) {
      console.warn('Advanced camera constraints rejected by HAL:', err);
      manualExposureApplied = false;
    }
  }

  if (cameraModeBadgeEl) {
    if (manualExposureApplied) {
      cameraModeBadgeEl.innerText = 'Manual Shutter';
      cameraModeBadgeEl.className = 'badge-sub manual';
    } else {
      cameraModeBadgeEl.innerText = 'Auto Exposure';
      cameraModeBadgeEl.className = 'badge-sub';
    }
  }
}

// Generate mathematically precise synthetic scanlines for test mode
function generateSyntheticFrame(mode, skewSec) {
  const w = SIGNAL_LEN;
  const h = SIGNAL_LEN;
  const imgData = offscreenCtx.createImageData(w, h);
  const data = imgData.data;
  
  syntheticPhase += 0.05;
  
  let targetHz = 100;
  let modulationDepth = 0.40; // 40% ripple
  let isSquare = false;
  
  if (mode === 'test-100') {
    targetHz = 100;
    modulationDepth = 0.40;
  } else if (mode === 'test-120') {
    targetHz = 120;
    modulationDepth = 0.40;
  } else if (mode === 'test-pwm250') {
    targetHz = 250;
    modulationDepth = 1.0;
    isSquare = true;
  } else if (mode === 'test-dc') {
    targetHz = 0;
    modulationDepth = 0.0;
  }
  
  const baseline = 128;
  
  for (let y = 0; y < h; y++) {
    const t = (y / h) * skewSec + (syntheticPhase / (2 * Math.PI * (targetHz || 1)));
    let osc = 0;
    if (targetHz > 0) {
      if (isSquare) {
        osc = Math.sin(2 * Math.PI * targetHz * t) >= 0 ? 1 : -1;
      } else {
        osc = Math.sin(2 * Math.PI * targetHz * t);
      }
    }
    const lum = Math.min(255, Math.max(0, Math.round(baseline + baseline * modulationDepth * osc)));
    
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      data[idx] = lum;
      data[idx+1] = lum;
      data[idx+2] = lum;
      data[idx+3] = 255;
    }
  }
  
  offscreenCtx.putImageData(imgData, 0, 0);
}

async function startStreaming(deviceId) {
  stopStream();
  if (cameraOverlayMessage) {
    cameraOverlayMessage.style.display = 'flex';
    cameraOverlayMessage.innerHTML = '<div class="spinner"></div><p>Connecting to camera feed...</p>';
  }
  
  const constraints = {
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      facingMode: deviceId ? undefined : { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  };
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentStream = stream;
    
    // Explicitly configure video attributes for mobile/desktop playback
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.autoplay = true;
    videoEl.srcObject = stream;
    
    // Explicitly trigger play
    try {
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        await playPromise;
      }
    } catch (playErr) {
      console.warn('videoEl.play() warning:', playErr);
    }
    
    // Wait for video metadata/frame arrival with a safe timeout
    if (videoEl.readyState < 2 || !videoEl.videoWidth) {
      await new Promise(resolve => {
        let done = false;
        const onReady = () => {
          if (!done) {
            done = true;
            videoEl.removeEventListener('loadeddata', onReady);
            videoEl.removeEventListener('loadedmetadata', onReady);
            videoEl.removeEventListener('canplay', onReady);
            resolve();
          }
        };
        videoEl.addEventListener('loadeddata', onReady, { once: true });
        videoEl.addEventListener('loadedmetadata', onReady, { once: true });
        videoEl.addEventListener('canplay', onReady, { once: true });
        setTimeout(onReady, 600); // 600ms safety guard
      });
    }
    
    activeDeviceId = deviceId || 'default';
    activeResolution = `${videoEl.videoWidth || 1280}x${videoEl.videoHeight || 720}`;
    
    const selectedOption = cameraSelect && cameraSelect.selectedIndex >= 0 ? cameraSelect.options[cameraSelect.selectedIndex] : null;
    activeLensName = selectedOption ? selectedOption.text : 'Default Camera';
    
    // Load profile specific to this camera lens & resolution
    loadLensProfile(activeDeviceId, activeResolution, activeLensName);
    
    // Apply optimal manual options if browser supports them
    const track = stream.getVideoTracks()[0];
    if (track) {
      await configureOptimalCameraSettings(track);
    }
    
    // Hide loading overlay
    if (cameraOverlayMessage) cameraOverlayMessage.style.display = 'none';
    
    // Make preview canvas match aspect ratio
    const dpr = window.devicePixelRatio || 1;
    previewCanvas.width = Math.max(320, Math.round((previewCanvas.clientWidth || 320) * dpr));
    previewCanvas.height = Math.max(240, Math.round((previewCanvas.clientHeight || 240) * dpr));
    
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(processFrameLoop);
    
  } catch (err) {
    console.error('Error starting video stream:', err);
    if (cameraOverlayMessage) {
      cameraOverlayMessage.style.display = 'flex';
      cameraOverlayMessage.innerHTML = `<p style="color:var(--color-error)">Failed to access camera: ${err.message}<br>Make sure camera permissions are enabled.</p>`;
    }
  }
}

function stopStream() {
  if (currentStream) {
    if (typeof currentStream.getTracks === 'function') {
      currentStream.getTracks().forEach(track => {
        if (track && typeof track.stop === 'function') track.stop();
      });
    } else if (typeof currentStream.getVideoTracks === 'function') {
      currentStream.getVideoTracks().forEach(track => {
        if (track && typeof track.stop === 'function') track.stop();
      });
    }
    currentStream = null;
  }
}

// Main 60fps frame loop
function processFrameLoop() {
  if (isFrozen) {
    animationFrameId = requestAnimationFrame(processFrameLoop);
    return;
  }
  
  const hasLiveVideo = Boolean(videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0);
  const isSynthetic = signalSource !== 'live';
  
  if (hasLiveVideo || isSynthetic) {
    // 1. Acquire frame (from live camera or synthetic generator)
    if (isSynthetic) {
      generateSyntheticFrame(signalSource, skewSeconds);
    } else {
      offscreenCtx.drawImage(videoEl, 0, 0, SIGNAL_LEN, SIGNAL_LEN);
    }
    
    const imgData = offscreenCtx.getImageData(0, 0, SIGNAL_LEN, SIGNAL_LEN);
    const pixels = imgData.data;
    
    // 2. Dynamic ROI (Region of Interest) Core Detection
    let startIdx = 128;
    let endIdx = 384;
    
    if (roiMode === 'auto') {
      let maxPixelLum = 0;
      let minX = SIGNAL_LEN, maxX = 0, minY = SIGNAL_LEN, maxY = 0;
      let samplePointsFound = 0;
      
      // Coarse grid search for bright core
      for (let y = 16; y < SIGNAL_LEN - 16; y += 16) {
        for (let x = 16; x < SIGNAL_LEN - 16; x += 16) {
          const idx = (y * SIGNAL_LEN + x) * 4;
          const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx+1] + 0.114 * pixels[idx+2];
          if (lum > maxPixelLum) maxPixelLum = lum;
        }
      }
      
      const coreThreshold = Math.max(35, maxPixelLum * 0.45);
      for (let y = 16; y < SIGNAL_LEN - 16; y += 16) {
        for (let x = 16; x < SIGNAL_LEN - 16; x += 16) {
          const idx = (y * SIGNAL_LEN + x) * 4;
          const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx+1] + 0.114 * pixels[idx+2];
          if (lum >= coreThreshold) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            samplePointsFound++;
          }
        }
      }
      
      if (samplePointsFound >= 4 && (maxX - minX) >= 48 && (maxY - minY) >= 48) {
        minX = Math.max(0, minX - 16);
        maxX = Math.min(SIGNAL_LEN, maxX + 16);
        minY = Math.max(0, minY - 16);
        maxY = Math.min(SIGNAL_LEN, maxY + 16);
        
        currentRoi.x = Math.round(currentRoi.x * 0.85 + minX * 0.15);
        currentRoi.y = Math.round(currentRoi.y * 0.85 + minY * 0.15);
        currentRoi.w = Math.round(currentRoi.w * 0.85 + (maxX - minX) * 0.15);
        currentRoi.h = Math.round(currentRoi.h * 0.85 + (maxY - minY) * 0.15);
      }
      
      startIdx = Math.max(0, currentRoi.y);
      endIdx = Math.min(SIGNAL_LEN, currentRoi.y + currentRoi.h);
    } else {
      currentRoi.x = 0;
      currentRoi.y = 0;
      currentRoi.w = SIGNAL_LEN;
      currentRoi.h = SIGNAL_LEN;
      startIdx = 0;
      endIdx = SIGNAL_LEN;
    }
    
    if (roiHudEl) {
      roiHudEl.innerText = (roiMode === 'auto') ? `ROI: Core [${currentRoi.w}×${currentRoi.h}]` : 'ROI: Full Frame';
    }
    
    const roiSpanX = Math.max(1, currentRoi.w);
    const roiSpanY = Math.max(1, currentRoi.h);
    const roiPixelCount = roiSpanX * roiSpanY;
    let saturatedCount = 0;
    let roiLuminanceSum = 0;
    
    for (let y = currentRoi.y; y < currentRoi.y + currentRoi.h && y < SIGNAL_LEN; y++) {
      for (let x = currentRoi.x; x < currentRoi.x + currentRoi.w && x < SIGNAL_LEN; x++) {
        const idx = (y * SIGNAL_LEN + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx+1];
        const b = pixels[idx+2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        roiLuminanceSum += lum;
        if (lum >= 250 || (r >= 250 && g >= 250 && b >= 250)) {
          saturatedCount++;
        }
      }
    }
    
    const meanRoiLuminance = roiLuminanceSum / (roiPixelCount || 1);
    const satPercent = (saturatedCount / (roiPixelCount || 1)) * 100;
    
    if (exposureHudEl) {
      if (satPercent > 8.0) {
        exposureHudEl.innerText = `⚠️ OVERFLOW (${satPercent.toFixed(0)}% clipped): Step back`;
        exposureHudEl.className = 'exposure-hud saturated';
      } else if (meanRoiLuminance < 25) {
        exposureHudEl.innerText = `⚠️ UNDEREXPOSED (${meanRoiLuminance.toFixed(0)} lum): Move closer`;
        exposureHudEl.className = 'exposure-hud underexposed';
      } else {
        exposureHudEl.innerText = `Exposure: Optimal (${Math.round(meanRoiLuminance)} lum)`;
        exposureHudEl.className = 'exposure-hud optimal';
      }
    }
    
    // 3. Pre-allocated sample horizontal and vertical signals (Zero-GC)
    const rx1 = currentRoi.x;
    const rx2 = Math.min(SIGNAL_LEN, currentRoi.x + currentRoi.w);
    const ry1 = currentRoi.y;
    const ry2 = Math.min(SIGNAL_LEN, currentRoi.y + currentRoi.h);
    
    for (let y = 0; y < SIGNAL_LEN; y++) {
      let sum = 0;
      for (let x = rx1; x < rx2; x++) {
        const idx = (y * SIGNAL_LEN + x) * 4;
        const photopicLuma = 0.2126 * pixels[idx] + 0.7152 * pixels[idx+1] + 0.0722 * pixels[idx+2];
        sum += linearizeLuminance(photopicLuma);
      }
      rowAverages[y] = sum / roiSpanX;
    }
    
    for (let x = 0; x < SIGNAL_LEN; x++) {
      let sum = 0;
      for (let y = ry1; y < ry2; y++) {
        const idx = (y * SIGNAL_LEN + x) * 4;
        const photopicLuma = 0.2126 * pixels[idx] + 0.7152 * pixels[idx+1] + 0.0722 * pixels[idx+2];
        sum += linearizeLuminance(photopicLuma);
      }
      colAverages[x] = sum / roiSpanY;
    }

    // Handle Ambient Tare accumulation
    if (isTaringAmbient) {
      ambientTareSum += meanRoiLuminance;
      ambientTareCount++;
      if (ambientTareCount >= AMBIENT_TARE_FRAMES) {
        ambientBaselineLuminance = Math.round(ambientTareSum / ambientTareCount);
        isTaringAmbient = false;
        if (tareBtnLabel) tareBtnLabel.innerText = 'Tare Active';
        if (ambientTareBadge) {
          ambientTareBadge.style.display = 'flex';
          ambientTareBadge.querySelector('span').innerText = `Tare: ${ambientBaselineLuminance} lum`;
        }
      }
    }
    
    // 4. Process signals via Web Worker (offloaded) or Main-Thread Fallback
    if (dspWorker) {
      if (!isWorkerBusy) {
        isWorkerBusy = true;
        const rowCopy = new Float32Array(rowAverages);
        const colCopy = new Float32Array(colAverages);
        dspWorker.postMessage({
          type: 'ANALYZE_FRAME',
          rowAverages: rowCopy,
          colAverages: colCopy,
          skewSeconds,
          scanMode,
          meanRoiLuminance,
          ambientBaseline: ambientBaselineLuminance,
          rx1, rx2, ry1, ry2,
          frameId: ++frameCounter
        }, [rowCopy.buffer, colCopy.buffer]);
      }
    } else {
      // Inline Fallback
      analyzeSignalInPlace(rowAverages, skewSeconds, analysisResultY);
      analyzeSignalInPlace(colAverages, skewSeconds, analysisResultX);
      
      let winner = 'y';
      if (scanMode === 'auto') {
        winner = (analysisResultX.snr > analysisResultY.snr) ? 'x' : 'y';
      } else {
        winner = scanMode;
      }
      currentActiveAxis = winner;
      
      const result = (winner === 'y') ? analysisResultY : analysisResultX;
      const validSignal = result.snr > 3.2;
      latestPeakBin = result.peakBin;
      latestValidSignal = validSignal;
      
      let percentFlicker = 0;
      let flickerIndex = 0;
      let thd = 0;
      let svm = 0;
      let svmRatingClass = "rating-none";
      let driverQuality = "UNKNOWN";
      let ratingClass = "rating-none";
      
      if (validSignal) {
        const rawSignal = (winner === 'y') ? rowAverages : colAverages;
        const metricStart = (winner === 'y') ? ry1 : rx1;
        const metricEnd = (winner === 'y') ? ry2 : rx2;
        
        percentFlicker = calculatePercentFlicker(rawSignal, result.waveform, metricStart, metricEnd, ambientBaselineLuminance);
        flickerIndex = calculateFlickerIndex(rawSignal, result.waveform, metricStart, metricEnd, ambientBaselineLuminance);
        
        const harmonicResult = calculateHarmonicsAndTHD(result.magnitudes, result.peakBin, skewSeconds);
        thd = harmonicResult.thd;
        
        const svmResult = calculateSVM(result.magnitudes, result.peakBin, skewSeconds, meanRoiLuminance, ambientBaselineLuminance);
        svm = svmResult.svm;
        svmRatingClass = svmResult.ratingClass;
        
        const classification = classifyDriverQuality(result.freq, percentFlicker);
        driverQuality = classification.quality;
        ratingClass = classification.ratingClass;
        
        if (isCalibrating) {
          calPeaks.push(result.peakBin);
          const progress = Math.min(100, Math.round((calPeaks.length / CAL_SAMPLES_NEEDED) * 100));
          calProgressBar.style.width = progress + '%';
          calStatusText.innerText = `Capturing signal... ${calPeaks.length} / ${CAL_SAMPLES_NEEDED} samples`;
          if (calPeaks.length >= CAL_SAMPLES_NEEDED) finishCalibration();
        }

        if (isRecording) {
          recordSamples.push({
            timeMs: Date.now() - recordStartTime,
            freq: result.freq,
            percentFlicker,
            flickerIndex,
            thd,
            svm,
            snr: result.snr,
            driverQuality,
            confidence
          });
        }
      }
      
      signalWaveformBuffer.set(result.waveform);
      fftMagnitudesBuffer.set(result.magnitudes);
      
      updateMetricsDisplay({
        validSignal,
        freq: result.freq,
        snr: result.snr,
        percentFlicker,
        flickerIndex,
        thd,
        svm,
        svmRatingClass,
        driverQuality,
        ratingClass,
        isSynthetic: signalSource !== 'live',
        meanRoiLuminance
      });
      
      updateAudioSonification(result.freq, percentFlicker, thd, result.snr);
    }
    
    // Session recording progress update
    if (isRecording) {
      const elapsed = Date.now() - recordStartTime;
      const progress = Math.min(100, (elapsed / RECORD_DURATION_MS) * 100);
      recProgressBar.style.width = `${progress}%`;
      recTimerLabel.innerText = `Recording: ${(elapsed / 1000).toFixed(1)}s / 10.0s`;
      recSamplesCount.innerText = `${recordSamples.length} samples`;
      
      if (elapsed >= RECORD_DURATION_MS) {
        finishRecording();
      }
    }
    if (confidenceBarEl) {
      if (confidence > 75) {
        confidenceBarEl.style.background = 'linear-gradient(90deg, #00f2fe, #00e676)';
      } else if (confidence > 35) {
        confidenceBarEl.style.background = 'linear-gradient(90deg, #00f2fe, #ffe600)';
      } else {
        confidenceBarEl.style.background = 'linear-gradient(90deg, #00f2fe, #ff1744)';
      }
    }
    
    // Grid Match & Overlays
    updateGridMatchTag(smoothedFreq, confidence);
    renderScannerOverlay(currentActiveAxis, 0, SIGNAL_LEN, signalSource !== 'live');
    renderWaveformChart();
    renderSpectrumChart(latestPeakBin, latestValidSignal);
  } else {
    // Render scanner grid and HUD even before camera frames arrive so canvas is never blank
    renderScannerOverlay(currentActiveAxis, 0, SIGNAL_LEN, false);
  }
  
  animationFrameId = requestAnimationFrame(processFrameLoop);
}

// Render scanner visualization onto preview canvas
function renderScannerOverlay(axis, startIdx, endIdx, isSynthetic) {
  // Keep dimensions synced
  const dpr = window.devicePixelRatio || 1;
  const targetW = Math.max(320, Math.round((previewCanvas.clientWidth || 320) * dpr));
  const targetH = Math.max(240, Math.round((previewCanvas.clientHeight || 240) * dpr));
  if (previewCanvas.width !== targetW || previewCanvas.height !== targetH) {
    previewCanvas.width = targetW;
    previewCanvas.height = targetH;
  }
  
  const w = previewCanvas.width;
  const h = previewCanvas.height;
  
  // Clear and draw video or synthetic canvas
  if (isSynthetic) {
    previewCtx.drawImage(offscreenCanvas, 0, 0, w, h);
  } else if (videoEl && videoEl.videoWidth > 0 && videoEl.readyState >= 2) {
    try {
      previewCtx.drawImage(videoEl, 0, 0, w, h);
    } catch (drawErr) {
      console.warn('Unable to draw video to previewCanvas:', drawErr);
    }
  } else {
    previewCtx.fillStyle = '#0a0f1d';
    previewCtx.fillRect(0, 0, w, h);
  }
  
  const x1 = (currentRoi.x / SIGNAL_LEN) * w;
  const x2 = (Math.min(SIGNAL_LEN, currentRoi.x + currentRoi.w) / SIGNAL_LEN) * w;
  const y1 = (currentRoi.y / SIGNAL_LEN) * h;
  const y2 = (Math.min(SIGNAL_LEN, currentRoi.y + currentRoi.h) / SIGNAL_LEN) * h;
  
  // Draw glowing ROI bounding box when auto-tracking is active
  if (roiMode === 'auto') {
    previewCtx.strokeStyle = 'rgba(0, 242, 254, 0.45)';
    previewCtx.lineWidth = 1.5;
    previewCtx.setLineDash([6, 4]);
    previewCtx.strokeRect(x1, y1, Math.max(10, x2 - x1), Math.max(10, y2 - y1));
    previewCtx.setLineDash([]);
  }
  
  if (axis === 'y') {
    axisIndicatorEl.innerText = 'HORIZONTAL BANDS';
    axisIndicatorEl.style.color = 'var(--color-primary)';
    
    // Draw columns boundary lines
    previewCtx.strokeStyle = 'rgba(0, 242, 254, 0.2)';
    previewCtx.lineWidth = 1.5;
    previewCtx.setLineDash([5, 5]);
    previewCtx.beginPath();
    previewCtx.moveTo(x1, 0); previewCtx.lineTo(x1, h);
    previewCtx.moveTo(x2, 0); previewCtx.lineTo(x2, h);
    previewCtx.stroke();
    previewCtx.setLineDash([]);
    
    // Draw scanning laser line moving vertically
    const pulse = ((Math.sin(Date.now() / 250) + 1) / 2);
    const laserY = pulse * h;
    previewCtx.strokeStyle = 'rgba(255, 23, 68, 0.75)';
    previewCtx.lineWidth = 3;
    previewCtx.shadowColor = 'rgba(255, 23, 68, 0.8)';
    previewCtx.shadowBlur = 6;
    previewCtx.beginPath();
    previewCtx.moveTo(x1, laserY);
    previewCtx.lineTo(x2, laserY);
    previewCtx.stroke();
    previewCtx.shadowBlur = 0;
    
    // Update scanner laser CSS classes
    if (laserLine) {
      laserLine.className = 'scan-laser-line vertical-scan';
      laserLine.style.display = 'none'; // handled on canvas
    }
  } else {
    if (axisIndicatorEl) {
      axisIndicatorEl.innerText = 'VERTICAL BANDS';
      axisIndicatorEl.style.color = 'var(--color-secondary)';
    }
    
    // Draw rows boundary lines
    previewCtx.strokeStyle = 'rgba(255, 230, 0, 0.2)';
    previewCtx.lineWidth = 1.5;
    previewCtx.setLineDash([5, 5]);
    previewCtx.beginPath();
    previewCtx.moveTo(0, y1); previewCtx.lineTo(w, y1);
    previewCtx.moveTo(0, y2); previewCtx.lineTo(w, y2);
    previewCtx.stroke();
    previewCtx.setLineDash([]);
    
    // Draw scanning laser line moving horizontally
    const pulse = ((Math.sin(Date.now() / 250) + 1) / 2);
    const laserX = pulse * w;
    previewCtx.strokeStyle = 'rgba(255, 23, 68, 0.75)';
    previewCtx.lineWidth = 3;
    previewCtx.shadowColor = 'rgba(255, 23, 68, 0.8)';
    previewCtx.shadowBlur = 6;
    previewCtx.beginPath();
    previewCtx.moveTo(laserX, y1);
    previewCtx.lineTo(laserX, y2);
    previewCtx.stroke();
    previewCtx.shadowBlur = 0;
    
    if (laserLine) {
      laserLine.className = 'scan-laser-line horizontal-scan';
      laserLine.style.display = 'none'; // handled on canvas
    }
  }
}

// Update the match tag for AC frequencies
function updateGridMatchTag(freq, conf) {
  if (conf < 25) {
    gridMatchTagEl.innerText = 'No Match';
    gridMatchTagEl.className = 'match-tag none';
    return;
  }
  
  if (freq >= 97.0 && freq <= 103.0) {
    gridMatchTagEl.innerText = '50Hz Grid Match (100Hz Flicker)';
    gridMatchTagEl.className = 'match-tag grid50';
  } else if (freq >= 117.0 && freq <= 123.0) {
    gridMatchTagEl.innerText = '60Hz Grid Match (120Hz Flicker)';
    gridMatchTagEl.className = 'match-tag grid60';
  } else if (freq > 130.0) {
    gridMatchTagEl.innerText = `PWM Dimming / High Frequency`;
    gridMatchTagEl.className = 'match-tag pwm';
  } else {
    gridMatchTagEl.innerText = 'Other Oscillator Source';
    gridMatchTagEl.className = 'match-tag none';
  }
}

// ==========================================
// Chart Rendering Logic (Direct Canvas)
// ==========================================

function drawGrid(ctx, w, h) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  
  // Vertical Grid Lines
  for (let x = 0; x < w; x += w / 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  
  // Horizontal Grid Lines
  for (let y = 0; y < h; y += h / 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function renderWaveformChart() {
  if (waveformCanvas.width !== waveformCanvas.clientWidth || 
      waveformCanvas.height !== waveformCanvas.clientHeight) {
    waveformCanvas.width = waveformCanvas.clientWidth;
    waveformCanvas.height = waveformCanvas.clientHeight;
  }
  
  const w = waveformCanvas.width;
  const h = waveformCanvas.height;
  
  waveformCtx.fillStyle = '#050811';
  waveformCtx.fillRect(0, 0, w, h);
  
  drawGrid(waveformCtx, w, h);
  
  // Find min/max for scaling
  let min = 99999;
  let max = -99999;
  for (let i = 0; i < SIGNAL_LEN; i++) {
    const v = signalWaveformBuffer[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  
  const range = max - min;
  const scale = range === 0 ? 1 : (h - 20) / range;
  const midY = h / 2;
  
  waveformCtx.strokeStyle = '#00f2fe';
  waveformCtx.lineWidth = 2.5;
  waveformCtx.shadowColor = 'rgba(0, 242, 254, 0.5)';
  waveformCtx.shadowBlur = 6;
  
  waveformCtx.beginPath();
  for (let i = 0; i < SIGNAL_LEN; i++) {
    const x = (i / (SIGNAL_LEN - 1)) * w;
    // Detrended signal centered around midY
    const val = signalWaveformBuffer[i];
    const y = midY - (val * scale * 0.8);
    
    if (i === 0) {
      waveformCtx.moveTo(x, y);
    } else {
      waveformCtx.lineTo(x, y);
    }
  }
  waveformCtx.stroke();
  waveformCtx.shadowBlur = 0; // reset
}

function renderSpectrumChart(peakBin, isValid) {
  if (spectrumCanvas.width !== spectrumCanvas.clientWidth || 
      spectrumCanvas.height !== spectrumCanvas.clientHeight) {
    spectrumCanvas.width = spectrumCanvas.clientWidth;
    spectrumCanvas.height = spectrumCanvas.clientHeight;
  }
  
  const w = spectrumCanvas.width;
  const h = spectrumCanvas.height;
  
  spectrumCtx.fillStyle = '#050811';
  spectrumCtx.fillRect(0, 0, w, h);
  
  drawGrid(spectrumCtx, w, h);
  
  // We plot frequencies up to 500 Hz for readability
  // Maximum bin index for 500 Hz:
  const maxPlotBin = Math.min(FFT_SIZE / 2 - 1, Math.round(500 * 8 * skewSeconds));
  const minPlotBin = Math.max(1, Math.floor(10 * 8 * skewSeconds));
  const numPlotBins = maxPlotBin - minPlotBin + 1;
  
  // Find max magnitude in plot range for scaling
  let maxMag = 0.0001;
  for (let k = minPlotBin; k <= maxPlotBin; k++) {
    if (fftMagnitudesBuffer[k] > maxMag) {
      maxMag = fftMagnitudesBuffer[k];
    }
  }
  
  // Draw Area Gradient under curve
  spectrumCtx.beginPath();
  spectrumCtx.moveTo(0, h);
  for (let i = 0; i < numPlotBins; i++) {
    const k = minPlotBin + i;
    const x = (i / (numPlotBins - 1)) * w;
    const mag = fftMagnitudesBuffer[k];
    const y = h - (mag / maxMag) * (h - 25);
    spectrumCtx.lineTo(x, y);
  }
  spectrumCtx.lineTo(w, h);
  spectrumCtx.closePath();
  
  const areaGrad = spectrumCtx.createLinearGradient(0, h, 0, 0);
  areaGrad.addColorStop(0, 'rgba(255, 230, 0, 0.0)');
  areaGrad.addColorStop(1, 'rgba(255, 230, 0, 0.15)');
  spectrumCtx.fillStyle = areaGrad;
  spectrumCtx.fill();
  
  // Draw Spectrum Line
  spectrumCtx.strokeStyle = '#ffe600';
  spectrumCtx.lineWidth = 2;
  spectrumCtx.shadowColor = 'rgba(255, 230, 0, 0.4)';
  spectrumCtx.shadowBlur = 4;
  spectrumCtx.beginPath();
  for (let i = 0; i < numPlotBins; i++) {
    const k = minPlotBin + i;
    const x = (i / (numPlotBins - 1)) * w;
    const mag = fftMagnitudesBuffer[k];
    const y = h - (mag / maxMag) * (h - 25);
    
    if (i === 0) {
      spectrumCtx.moveTo(x, y);
    } else {
      spectrumCtx.lineTo(x, y);
    }
  }
  spectrumCtx.stroke();
  spectrumCtx.shadowBlur = 0; // reset
  
  // Draw Peak Marker if valid
  if (isValid && peakBin >= minPlotBin && peakBin <= maxPlotBin) {
    const iPeak = peakBin - minPlotBin;
    const peakX = (iPeak / (numPlotBins - 1)) * w;
    const peakMagValue = fftMagnitudesBuffer[peakBin];
    const peakY = h - (peakMagValue / maxMag) * (h - 25);
    
    // Draw vertical dotted line
    spectrumCtx.strokeStyle = 'rgba(0, 242, 254, 0.5)';
    spectrumCtx.lineWidth = 1;
    spectrumCtx.setLineDash([3, 3]);
    spectrumCtx.beginPath();
    spectrumCtx.moveTo(peakX, peakY);
    spectrumCtx.lineTo(peakX, h);
    spectrumCtx.stroke();
    spectrumCtx.setLineDash([]);
    
    // Draw glowing node on top of peak
    spectrumCtx.fillStyle = '#00f2fe';
    spectrumCtx.shadowColor = 'rgba(0, 242, 254, 0.8)';
    spectrumCtx.shadowBlur = 8;
    spectrumCtx.beginPath();
    spectrumCtx.arc(peakX, peakY, 5, 0, 2 * Math.PI);
    spectrumCtx.fill();
    spectrumCtx.shadowBlur = 0;
    
    // Draw frequency readout text
    const freq = peakBin / (8 * skewSeconds);
    spectrumCtx.fillStyle = '#ffffff';
    spectrumCtx.font = 'bold 9px var(--font-sans)';
    spectrumCtx.textAlign = 'center';
    
    // Keep label within boundary
    let textX = peakX;
    if (peakX < 40) textX = 40;
    if (peakX > w - 40) textX = w - 40;
    
    spectrumCtx.fillText(freq.toFixed(1) + ' Hz', textX, peakY - 8);
  }
}

// ==========================================
// User Interaction & Calibration Wizard
// ==========================================

// Tab Switching
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabWrappers.forEach(w => w.classList.remove('active'));
    
    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab');
    document.getElementById(`tab-${tabId}`).classList.add('active');
  });
});

// Camera Select Change
cameraSelect.addEventListener('change', () => {
  const deviceId = cameraSelect.value;
  if (deviceId) {
    startStreaming(deviceId);
  }
});

// Scan Axis Change
axisSelect.addEventListener('change', () => {
  scanMode = axisSelect.value;
});

// ROI Mode Change
if (roiSelect) {
  roiSelect.addEventListener('change', () => {
    roiMode = roiSelect.value;
    if (roiMode === 'full') {
      currentRoi.x = 0;
      currentRoi.y = 0;
      currentRoi.w = SIGNAL_LEN;
      currentRoi.h = SIGNAL_LEN;
    }
  });
}

// Skew Manual Adjustment
skewSlider.addEventListener('input', () => {
  const ms = parseFloat(skewSlider.value);
  skewSeconds = ms / 1000.0;
  skewValEl.innerText = ms.toFixed(1) + ' ms';
  
  // Save to localStorage
  localStorage.setItem('rolling_shutter_skew', skewSeconds);
  
  // Reset smoothed average so it settles to new scale quickly
  smoothedFreq = 0;
});

// Freeze Stream Button
freezeBtn.addEventListener('click', () => {
  isFrozen = !isFrozen;
  if (isFrozen) {
    freezeBtn.classList.add('frozen');
    freezeBtn.querySelector('span').innerText = 'Unfreeze Stream';
  } else {
    freezeBtn.classList.remove('frozen');
    freezeBtn.querySelector('span').innerText = 'Freeze Stream';
  }
});

// Calibration Wizard Handlers
calibrateBtn.addEventListener('click', () => {
  calModal.classList.add('open');
  showCalibrationStep(1);
});

modalCloseBtn.addEventListener('click', () => {
  calModal.classList.remove('open');
  isCalibrating = false;
});

// Grid Selector buttons in step 1
gridBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    gridBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const gridAttr = btn.getAttribute('data-grid');
    if (gridAttr === '60screen') {
      calTargetFreq = 60.0;
    } else if (gridAttr === '120screen') {
      calTargetFreq = 120.0;
    } else {
      const grid = parseInt(gridAttr);
      calTargetFreq = grid * 2; // grid 50 -> 100Hz, 60 -> 120Hz
    }
  });
});

calNext1.addEventListener('click', () => {
  showCalibrationStep(2);
});

calBack2.addEventListener('click', () => {
  showCalibrationStep(1);
  isCalibrating = false;
});

calStartBtn.addEventListener('click', () => {
  calPeaks = [];
  isCalibrating = true;
  calProgressBar.style.width = '0%';
  calStatusText.innerText = 'Searching for stable light signal...';
  calStartBtn.disabled = true;
  calBack2.disabled = true;
});

function showCalibrationStep(stepNum) {
  calStep1.classList.add('hidden');
  calStep2.classList.add('hidden');
  calStep3.classList.add('hidden');
  
  document.getElementById(`cal-step-${stepNum}`).classList.remove('hidden');
  
  if (stepNum === 1) {
    calStartBtn.disabled = false;
    calBack2.disabled = false;
  }
}

function finishCalibration() {
  isCalibrating = false;
  
  // Sort peaks and compute median to reject noise anomalies
  calPeaks.sort((a, b) => a - b);
  const medianBin = calPeaks[Math.floor(calPeaks.length / 2)];
  
  // f = bin / (8 * skew) => skew = bin / (8 * f)
  const computedSkew = medianBin / (8 * calTargetFreq);
  
  if (computedSkew >= 0.008 && computedSkew <= 0.050) {
    skewSeconds = computedSkew;
    
    // Save to multi-lens profile & global storage
    saveLensProfile(activeDeviceId, activeResolution, computedSkew, activeLensName);
    
    // Populate step 3 fields
    const msValue = computedSkew * 1000;
    calResultSkew.innerText = msValue.toFixed(2) + ' ms';
    // Line Rate = Skew / Line count (512 analysis lines)
    const lineRateUs = (computedSkew * 1000000) / SIGNAL_LEN;
    calResultLineRate.innerText = lineRateUs.toFixed(2) + ' μs';
    
    showCalibrationStep(3);
  } else {
    // Computed skew is physically impossible, indicating a bad reading
    alert(`Calibration failed: Captured an invalid sensor skew of ${(computedSkew*1000).toFixed(1)}ms. Please ensure you are holding the phone steady, pointing directly at an AC bulb (which creates distinct horizontal bands), and try again.`);
    showCalibrationStep(2);
    calStartBtn.disabled = false;
    calBack2.disabled = false;
  }
}

calFinishBtn.addEventListener('click', () => {
  calModal.classList.remove('open');
  smoothedFreq = 0; // reset smoothing to recalculate instantly
});

// Close modal when tapping background
window.addEventListener('click', (e) => {
  if (e.target === calModal) {
    calModal.classList.remove('open');
    isCalibrating = false;
  }
});

// ==========================================
// Signal Source (Live vs Synthetic Test Mode)
// ==========================================
if (testSignalSelect) {
  testSignalSelect.addEventListener('change', () => {
    signalSource = testSignalSelect.value;
    smoothedFreq = 0;
    confidence = 0;
    if (signalSource !== 'live') {
      if (cameraOverlayMessage) cameraOverlayMessage.style.display = 'none';
      if (axisIndicatorEl) axisIndicatorEl.innerText = 'SYNTHETIC 512 LINES';
    } else {
      if (axisIndicatorEl) axisIndicatorEl.innerText = 'AUTO SCANNING';
    }
  });
}

// ==========================================
// Session Recording & Data Export (10s Audit)
// ==========================================
function startRecording() {
  if (isRecording) return;
  isRecording = true;
  recordStartTime = Date.now();
  recordSamples = [];
  
  if (startRecBtn) {
    startRecBtn.classList.add('recording');
    startRecLabel.innerText = 'Recording Audit...';
  }
  if (recordStatusBadge) {
    recordStatusBadge.innerText = 'RECORDING';
    recordStatusBadge.style.color = 'var(--color-error)';
  }
  if (recProgressContainer) {
    recProgressContainer.style.display = 'flex';
  }
  if (exportDownloadRow) {
    exportDownloadRow.style.display = 'none';
  }
}

function finishRecording() {
  isRecording = false;
  if (startRecBtn) {
    startRecBtn.classList.remove('recording');
    startRecLabel.innerText = 'Record New Sample';
  }
  if (recordStatusBadge) {
    recordStatusBadge.innerText = 'COMPLETE';
    recordStatusBadge.style.color = 'var(--color-success)';
  }
  if (exportDownloadRow) {
    exportDownloadRow.style.display = 'grid';
  }
  
  const audit = calculateAuditStability(recordSamples);
  const auditHash = generateAuditChecksum(recordSamples);
  
  if (auditHashBadge && auditHashContainer) {
    auditHashBadge.innerText = 'SHA-256: ' + auditHash;
    auditHashContainer.style.display = 'block';
  }
  
  const fixtureId = (fixtureIdInput && fixtureIdInput.value.trim()) || 'Fixture #1';
  const facilityName = (facilityNameInput && facilityNameInput.value.trim()) || 'Main Facility';

  // Save to audit history in localStorage
  saveAuditToHistory({
    fixtureId,
    facilityName,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    freq: parseFloat(hzValEl ? hzValEl.innerText : 0) || 0,
    percentFlicker: parseFloat(flickerPctValEl ? flickerPctValEl.innerText : 0) || 0,
    svm: parseFloat(svmValEl ? svmValEl.innerText : 0) || 0,
    thd: parseFloat(thdValEl ? thdValEl.innerText : 0) || 0,
    grade: qualTextToGrade(driverQualityValEl ? driverQualityValEl.innerText : ''),
    stability: audit.stabilityGrade.includes('Class A') ? 'Class A' : (audit.stabilityGrade.includes('Class B') ? 'Class B' : 'Class C'),
    hash: auditHash
  });
  renderAuditHistory();

  // Auto-increment Fixture ID (e.g. Fixture #1 -> Fixture #2)
  if (fixtureIdInput) {
    const match = fixtureId.match(/^(.*?)(\d+)$/);
    if (match) {
      const nextNum = parseInt(match[2], 10) + 1;
      fixtureIdInput.value = `${match[1]}${nextNum}`;
    }
  }
}

function qualTextToGrade(qualText) {
  if (qualText.includes('EXCELLENT')) return 'A+';
  if (qualText.includes('SAFE') || qualText.includes('STANDARD')) return 'B+';
  if (qualText.includes('PWM')) return 'F';
  if (qualText.includes('LOW QUALITY')) return 'D';
  return 'N/A';
}

function saveAuditToHistory(entry) {
  try {
    let history = JSON.parse(localStorage.getItem('flickerhz_audit_history') || '[]');
    history.unshift(entry);
    if (history.length > 50) history = history.slice(0, 50);
    localStorage.setItem('flickerhz_audit_history', JSON.stringify(history));
  } catch (e) {
    console.warn('Failed to save audit history:', e);
  }
}

function renderAuditHistory() {
  if (!auditHistoryTbody || !auditHistoryContainer) return;
  try {
    const history = JSON.parse(localStorage.getItem('flickerhz_audit_history') || '[]');
    if (history.length === 0) {
      auditHistoryContainer.style.display = 'none';
      return;
    }
    auditHistoryContainer.style.display = 'block';
    auditHistoryTbody.innerHTML = '';
    history.forEach((item, idx) => {
      const row = document.createElement('tr');
      const gradeColor = item.grade.startsWith('A') ? 'var(--color-success)' : (item.grade === 'F' ? 'var(--color-error)' : 'var(--color-secondary)');
      const isPass = item.svm <= 0.40;
      row.innerHTML = `
        <td><strong>${item.fixtureId || ('Fixture #' + (idx + 1))}</strong></td>
        <td>${item.timestamp}</td>
        <td><strong>${item.freq.toFixed(1)} Hz</strong></td>
        <td>${item.percentFlicker.toFixed(1)}%</td>
        <td>${item.svm.toFixed(2)}</td>
        <td>${item.thd.toFixed(1)}%</td>
        <td style="color:${gradeColor};font-weight:bold;">${item.grade}</td>
        <td><span class="badge-tag-sm ${isPass ? 'print-pass' : 'print-fail'}" style="${isPass ? 'background:rgba(0,230,118,0.2);color:#00e676;' : 'background:rgba(255,23,68,0.2);color:#ff1744;'}">${isPass ? 'PASS' : 'FAIL'}</span></td>
        <td><code style="font-size:0.65rem;color:var(--color-muted);">${(item.hash || '').substring(0, 8)}</code></td>
      `;
      auditHistoryTbody.appendChild(row);
    });
  } catch (e) {
    console.warn('Failed to render audit history:', e);
  }
}

function generateAndPrintFacilityReport() {
  const history = JSON.parse(localStorage.getItem('flickerhz_audit_history') || '[]');
  if (history.length === 0) {
    alert('No audit runs in ledger to print. Complete at least one 10s audit first.');
    return;
  }

  const facilityName = (facilityNameInput && facilityNameInput.value.trim()) || 'Facility Lighting Inspection';
  const now = new Date().toLocaleString();
  const totalCount = history.length;
  const compliantCount = history.filter(h => h.svm <= 0.40).length;
  const passRate = ((compliantCount / totalCount) * 100).toFixed(1);
  const avgFreq = (history.reduce((acc, h) => acc + (h.freq || 0), 0) / totalCount).toFixed(1);
  const maxSvm = Math.max(...history.map(h => h.svm || 0)).toFixed(2);

  let rowsHtml = '';
  history.forEach((h, idx) => {
    const isPass = h.svm <= 0.40;
    rowsHtml += `
      <tr>
        <td><strong>${h.fixtureId || ('Fixture #' + (idx + 1))}</strong></td>
        <td>${h.timestamp}</td>
        <td>${h.freq.toFixed(1)} Hz</td>
        <td>${h.percentFlicker.toFixed(1)}%</td>
        <td>${h.svm.toFixed(2)}</td>
        <td>${h.thd.toFixed(1)}%</td>
        <td><strong>${h.grade}</strong></td>
        <td><span class="print-badge ${isPass ? 'print-pass' : 'print-fail'}">${isPass ? 'PASS (≤0.4)' : 'FAIL (>0.4)'}</span></td>
        <td><code>${(h.hash || '').substring(0, 8)}</code></td>
      </tr>
    `;
  });

  printableFacilityReport.innerHTML = `
    <div class="print-header">
      <div>
        <h1>⚡ Consolidated Lighting Audit & Ecodesign Compliance Report</h1>
        <p style="margin:2px 0 0 0;font-size:10pt;color:#64748b;">Facility: <strong>${facilityName}</strong> &bull; Generated: ${now}</p>
      </div>
      <div style="text-align:right;">
        <span style="font-size:12pt;font-weight:bold;color:#0284c7;">FlashyLight v1.5.0</span><br>
        <span style="font-size:8pt;color:#64748b;">Optical Rolling Shutter DSP Analyzer</span>
      </div>
    </div>

    <div class="print-meta-grid">
      <div class="print-meta-box">
        <strong>Total Fixtures Audited</strong>
        <span style="font-size:13pt;font-weight:bold;">${totalCount}</span>
      </div>
      <div class="print-meta-box">
        <strong>Ecodesign Pass Rate</strong>
        <span style="font-size:13pt;font-weight:bold;color:${passRate >= 80 ? '#16a34a' : '#dc2626'};">${passRate}%</span> (${compliantCount}/${totalCount})
      </div>
      <div class="print-meta-box">
        <strong>Avg Oscillation Freq</strong>
        <span style="font-size:13pt;font-weight:bold;">${avgFreq} Hz</span>
      </div>
      <div class="print-meta-box">
        <strong>Worst Stroboscopic Index</strong>
        <span style="font-size:13pt;font-weight:bold;color:${maxSvm <= 0.4 ? '#16a34a' : '#dc2626'};">SVM ${maxSvm}</span>
      </div>
    </div>

    <table class="print-table">
      <thead>
        <tr>
          <th>Fixture ID / Location</th>
          <th>Time</th>
          <th>Frequency</th>
          <th>Percent Flicker</th>
          <th>CIE SVM</th>
          <th>THD</th>
          <th>Grade</th>
          <th>EU Ecodesign</th>
          <th>SHA-256 Digest</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="print-footer">
      <div>
        <strong>Regulatory Compliance References:</strong> CIE TN 006:2016 (SVM ≤ 0.40) &bull; Commission Regulation (EU) 2019/2020 &bull; IEEE 1789-2015 &bull; IES RP-16-10.
      </div>
      <div>
        Camera Profile: ${activeLensName} (${(skewSeconds * 1000).toFixed(1)}ms readout skew)
      </div>
    </div>
  `;

  printableFacilityReport.style.display = 'block';
  window.print();
  setTimeout(() => {
    printableFacilityReport.style.display = 'none';
  }, 1000);
}

if (printFacilityReportBtn) {
  printFacilityReportBtn.addEventListener('click', generateAndPrintFacilityReport);
}

// Ambient Tare Button Handlers
if (tareAmbientBtn) {
  tareAmbientBtn.addEventListener('click', () => {
    if (isTaringAmbient) return;
    isTaringAmbient = true;
    ambientTareCount = 0;
    ambientTareSum = 0;
    if (tareBtnLabel) tareBtnLabel.innerText = 'Sampling...';
    tareAmbientBtn.classList.add('active');
    if (ambientTareBadge) {
      ambientTareBadge.style.display = 'flex';
      ambientTareBadge.querySelector('span').innerText = 'Measuring room light...';
    }
  });
}

if (clearTareBtn) {
  clearTareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ambientBaselineLuminance = 0;
    isTaringAmbient = false;
    if (ambientTareBadge) ambientTareBadge.style.display = 'none';
    if (tareBtnLabel) tareBtnLabel.innerText = 'Tare Ambient';
    if (tareAmbientBtn) tareAmbientBtn.classList.remove('active');
  });
}

// Audio Sonification Toggle Handler
if (audioToggleBtn) {
  audioToggleBtn.addEventListener('click', () => {
    initAudio();
    isAudioEnabled = !isAudioEnabled;
    if (isAudioEnabled) {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      audioToggleBtn.classList.add('active');
      if (audioBtnLabel) audioBtnLabel.innerText = 'Audio: ON';
    } else {
      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(0.00001, audioCtx.currentTime);
      }
      audioToggleBtn.classList.remove('active');
      if (audioBtnLabel) audioBtnLabel.innerText = 'Audio: OFF';
    }
  });
}

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem('flickerhz_audit_history');
    renderAuditHistory();
  });
}

if (startRecBtn) {
  startRecBtn.addEventListener('click', () => {
    startRecording();
  });
}

function downloadCSV() {
  if (recordSamples.length === 0) {
    alert('No recording data available to export. Run a 10s audit first.');
    return;
  }
  let csv = 'Timestamp_ms,Frequency_Hz,Percent_Flicker,Flicker_Index,Waveform_THD,SVM,SNR,Driver_Quality,Confidence_Pct\n';
  recordSamples.forEach(s => {
    csv += `${s.timeMs},${s.freq.toFixed(2)},${s.percentFlicker.toFixed(2)},${(s.flickerIndex || 0).toFixed(3)},${(s.thd || 0).toFixed(1)},${(s.svm || 0).toFixed(2)},${s.snr.toFixed(2)},"${s.driverQuality}",${s.confidence.toFixed(0)}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `flickerhz-audit-${Date.now()}.csv`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadJSON() {
  if (recordSamples.length === 0) {
    alert('No recording data available to export. Run a 10s audit first.');
    return;
  }
  const audit = calculateAuditStability(recordSamples);
  const auditHash = generateAuditChecksum(recordSamples);
  const svm = parseFloat(svmValEl ? svmValEl.innerText : 0) || 0;
  const currentHz = parseFloat(hzValEl ? hzValEl.innerText : 0) || 0;
  const currentFlickerPct = parseFloat(flickerPctValEl ? flickerPctValEl.innerText : 0) || 0;
  const healthFeedback = typeof getHealthFeedback === 'function' ? getHealthFeedback({
    freq: currentHz,
    percentFlicker: currentFlickerPct,
    svm: svm,
    confidence: confidence
  }) : null;
  
  const payload = {
    app: 'FlickerHz',
    version: '1.4.0',
    exportTimestamp: new Date().toISOString(),
    auditChecksumSHA256: auditHash,
    cameraLens: activeLensName,
    sensorResolution: activeResolution,
    calibratedSkewSeconds: skewSeconds,
    totalSamplesRecorded: recordSamples.length,
    finalFrequencyHz: currentHz,
    finalPercentFlicker: currentFlickerPct,
    finalFlickerIndex: parseFloat(flickerIndexValEl ? flickerIndexValEl.innerText : 0) || 0,
    finalTHD: parseFloat(thdValEl ? thdValEl.innerText : 0) || 0,
    finalSVM: svm,
    isEcodesignCompliant: svm <= 0.40,
    driverClassification: driverQualityValEl ? driverQualityValEl.innerText : 'UNKNOWN',
    clinicalHealthFeedback: healthFeedback,
    auditStability: audit,
    samples: recordSamples
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `flickerhz-audit-${Date.now()}.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

if (downloadCsvBtn) downloadCsvBtn.addEventListener('click', downloadCSV);
if (downloadJsonBtn) downloadJsonBtn.addEventListener('click', downloadJSON);

// ==========================================
// Shareable Bulb Health Report Card (PNG Generator)
// ==========================================
function generateReportCard() {
  const card = document.createElement('canvas');
  card.width = 840;
  card.height = 1140;
  const ctx = card.getContext('2d');
  
  // Outer gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, 840, 1140);
  bgGrad.addColorStop(0, '#0a0f1d');
  bgGrad.addColorStop(1, '#050811');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 840, 1140);
  
  // Neon Cyber Border
  ctx.strokeStyle = '#00f2fe';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 800, 1100);
  
  // Title Header
  ctx.fillStyle = '#00f2fe';
  ctx.font = 'bold 28px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FLICKERHZ LIGHT QUALITY & EYE SAFETY REPORT', 420, 65);
  
  ctx.fillStyle = '#8e9bb2';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText('IEEE 1789-2015, IES RP-16-10 & EU 2019/2020 Compliance Certificate', 420, 92);
  
  // Audit stability computation
  const audit = calculateAuditStability(recordSamples.length > 0 ? recordSamples : [{
    freq: parseFloat(hzValEl ? hzValEl.innerText : 0) || 0,
    percentFlicker: parseFloat(flickerPctValEl ? flickerPctValEl.innerText : 0) || 0,
    flickerIndex: parseFloat(flickerIndexValEl ? flickerIndexValEl.innerText : 0) || 0,
    thd: parseFloat(thdValEl ? thdValEl.innerText : 0) || 0,
    svm: parseFloat(svmValEl ? svmValEl.innerText : 0) || 0,
    snr: 8.0
  }]);
  const auditHash = generateAuditChecksum(recordSamples.length > 0 ? recordSamples : [{ timeMs: 0, freq: 100, percentFlicker: 0, flickerIndex: 0, thd: 0 }]);
  const curSvm = parseFloat(svmValEl ? svmValEl.innerText : 0) || 0;
  const curFreq = parseFloat(hzValEl ? hzValEl.innerText : 0) || 0;
  const curFlickerPct = parseFloat(flickerPctValEl ? flickerPctValEl.innerText : 0) || 0;

  // Clinical health feedback
  const health = typeof getHealthFeedback === 'function' ? getHealthFeedback({
    freq: curFreq,
    percentFlicker: curFlickerPct,
    svm: curSvm,
    confidence: confidence
  }) : null;
  
  // Grade Card Calculation
  let grade = 'A+';
  let gradeColor = '#00e676';
  let gradeDesc = 'EXCELLENT: Flicker-Free Constant-Current DC Driver';
  const qualText = driverQualityValEl ? driverQualityValEl.innerText : '';
  
  if (confidence < 25) {
    grade = 'N/A';
    gradeColor = '#8e9bb2';
    gradeDesc = 'NO STABLE FLICKER DETECTED (Ambient / Constant DC)';
  } else if (qualText.includes('EXCELLENT')) {
    grade = 'A+';
    gradeColor = '#00e676';
    gradeDesc = 'EXCELLENT: No Observable Effect (IEEE 1789 & EU Ecodesign Pass)';
  } else if (qualText.includes('SAFE') || qualText.includes('STANDARD')) {
    grade = 'B+';
    gradeColor = '#00f2fe';
    gradeDesc = 'STANDARD: Low Health Risk Boundary (IEEE 1789 compliant)';
  } else if (qualText.includes('PWM')) {
    grade = 'F';
    gradeColor = '#ff1744';
    gradeDesc = 'HAZARD: Low-Frequency PWM Stroboscopic Eye Strain Risk';
  } else {
    grade = 'D';
    gradeColor = '#ffe600';
    gradeDesc = 'POOR QUALITY: Undersized Capacitors / Severe AC Grid Ripple';
  }
  
  // Draw Grade Box
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.fillRect(50, 115, 740, 140);
  ctx.strokeStyle = gradeColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(50, 115, 740, 140);
  
  ctx.fillStyle = gradeColor;
  ctx.font = 'bold 62px Orbitron, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`GRADE ${grade}`, 75, 195);
  
  // Lab certification stamp
  if (audit.isCertifiedLabGrade) {
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText('★ CLASS A LAB CERTIFIED AUDIT ★', 430, 160);
    ctx.fillStyle = '#8e9bb2';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(`Freq Jitter: ±${audit.stdDevFreq} Hz | Avg SNR: ${audit.meanSNR} dB`, 430, 185);
  }
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText(gradeDesc, 75, 235);
  
  // Metrics Grid Row 1 (5 columns)
  ctx.fillStyle = '#8e9bb2';
  ctx.font = '10px Inter, sans-serif';
  ctx.fillText('FREQUENCY', 75, 280);
  ctx.fillText('MODULATION', 225, 280);
  ctx.fillText('FLICKER INDEX', 375, 280);
  ctx.fillText('WAVEFORM THD', 525, 280);
  ctx.fillText('EU ECODESIGN (SVM)', 675, 280);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px Orbitron, monospace';
  ctx.fillText(`${curFreq > 0 ? curFreq.toFixed(1) : '--'} Hz`, 75, 305);
  ctx.fillText(flickerPctValEl ? flickerPctValEl.innerText : '--%', 225, 305);
  ctx.fillText(flickerIndexValEl ? flickerIndexValEl.innerText : '-.---', 375, 305);
  ctx.fillText(thdValEl ? thdValEl.innerText : '--.-%', 525, 305);
  ctx.fillStyle = curSvm <= 0.40 ? '#00e676' : '#ff1744';
  ctx.fillText(curSvm.toFixed(2), 675, 305);
  
  // Metrics Grid Row 2
  ctx.fillStyle = '#8e9bb2';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('AC GRID / STROBE MATCH', 75, 340);
  ctx.fillText('AUDIT STABILITY RATING', 350, 340);
  ctx.fillText('CRYPTOGRAPHIC AUDIT HASH', 580, 340);
  
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillStyle = '#00f2fe';
  ctx.fillText(gridMatchTagEl ? gridMatchTagEl.innerText : 'No Match', 75, 362);
  ctx.fillText(audit.stabilityGrade, 350, 362);
  ctx.font = '11px Orbitron, monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`sha256-${auditHash.substring(0, 12)}`, 580, 362);
  
  // Clinical Health & Incandescent Comparison Card
  if (health) {
    const healthBorderColor = health.riskLevel === 'NONE' ? '#00e676' :
                              health.riskLevel === 'LOW' ? '#00f2fe' :
                              health.riskLevel === 'MODERATE' ? '#ffe600' : '#ff1744';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(50, 385, 740, 105);
    ctx.strokeStyle = healthBorderColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(50, 385, 740, 105);
    
    ctx.fillStyle = healthBorderColor;
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText(`CLINICAL EYE SAFETY: ${health.headline.toUpperCase()} [${health.riskLevel} RISK]`, 65, 408);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(health.summary, 65, 430);
    
    ctx.fillStyle = '#8e9bb2';
    ctx.fillText(`Incandescent Benchmark: ${health.incandescentComparison}`, 65, 452);
    ctx.fillText(`Ergonomic Advice: ${health.recommendation}`, 65, 474);
  }

  // Snapshots of Waveform and Spectrum
  ctx.fillStyle = '#8e9bb2';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('FLICKER WAVEFORM TRACE (TIME DOMAIN)', 75, 515);
  ctx.drawImage(waveformCanvas, 50, 525, 740, 180);
  
  ctx.fillText('FOURIER TRANSFORM SPECTRUM (FREQUENCY DOMAIN)', 75, 730);
  ctx.drawImage(spectrumCanvas, 50, 740, 740, 180);
  
  // Metadata Footer
  ctx.fillStyle = '#8e9bb2';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  ctx.fillText(`Sensor Profile: ${skewValEl ? skewValEl.innerText : '30ms'} skew (${activeLensName}) | Audit Date: ${dateStr}`, 420, 960);
  ctx.fillText('Verified with FlickerHz PWA | Scientific Rolling-Shutter Time Scanner', 420, 985);
  
  // Trigger PNG download
  const link = document.createElement('a');
  link.download = `flickerhz-report-card-${Date.now()}.png`;
  link.href = card.toDataURL('image/png');
  link.click();
}

if (exportCardBtn) exportCardBtn.addEventListener('click', generateReportCard);

// ==========================================
// Interactive Screen Refresh Strobe Generator
// ==========================================
let isStrobing = false;
let strobeTargetHz = 60;
let strobeAnimId = null;
let lastStrobeToggleTime = 0;
let strobeColor = 0; // 0 = black, 255 = white

function startScreenStrobe(hz) {
  strobeTargetHz = hz;
  isStrobing = true;
  if (toggleStrobeBtn) toggleStrobeBtn.innerText = 'Pause Strobe';
  if (!strobeCanvas) return;
  const ctx = strobeCanvas.getContext('2d');
  const periodMs = 1000.0 / (hz * 2); // alternate every half-cycle
  lastStrobeToggleTime = performance.now();
  
  function loop(now) {
    if (!isStrobing) return;
    if (now - lastStrobeToggleTime >= periodMs) {
      strobeColor = strobeColor === 0 ? 255 : 0;
      ctx.fillStyle = strobeColor === 0 ? '#000000' : '#ffffff';
      ctx.fillRect(0, 0, strobeCanvas.width, strobeCanvas.height);
      lastStrobeToggleTime = now;
    }
    strobeAnimId = requestAnimationFrame(loop);
  }
  
  strobeCanvas.width = window.innerWidth;
  strobeCanvas.height = window.innerHeight;
  strobeAnimId = requestAnimationFrame(loop);
}

function stopScreenStrobe() {
  isStrobing = false;
  if (strobeAnimId) cancelAnimationFrame(strobeAnimId);
  if (toggleStrobeBtn) toggleStrobeBtn.innerText = 'Resume Strobe';
}

if (openStrobeBtn) {
  openStrobeBtn.addEventListener('click', () => {
    if (strobeModal) {
      strobeModal.classList.add('open');
      startScreenStrobe(strobeTargetHz);
    }
  });
}

if (closeStrobeBtn) {
  closeStrobeBtn.addEventListener('click', () => {
    stopScreenStrobe();
    if (strobeModal) strobeModal.classList.remove('open');
  });
}

if (toggleStrobeBtn) {
  toggleStrobeBtn.addEventListener('click', () => {
    if (isStrobing) {
      stopScreenStrobe();
    } else {
      startScreenStrobe(strobeTargetHz);
    }
  });
}

strobeHzBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    strobeHzBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const hz = parseInt(btn.getAttribute('data-hz')) || 60;
    strobeTargetHz = hz;
    if (isStrobing) {
      stopScreenStrobe();
      startScreenStrobe(hz);
    }
  });
});

// ==========================================
// Initialization & PWA Service Worker
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
  initCamera();
  renderAuditHistory();
  
  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('ServiceWorker registered successfully with scope:', reg.scope);
        const pwaBadge = document.getElementById('pwa-status');
        pwaBadge.innerText = 'Offline Ready';
        pwaBadge.className = 'status-badge offline';
      })
      .catch(err => {
        console.error('ServiceWorker registration failed:', err);
        const pwaBadge = document.getElementById('pwa-status');
        pwaBadge.innerText = 'Online Mode';
        pwaBadge.className = 'status-badge online';
      });
  }
});
