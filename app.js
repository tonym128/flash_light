// ==========================================
// Radix-2 Cooley-Tukey FFT Implementation
// ==========================================
class FFT {
  constructor(size) {
    this.size = size;
    this.cosTable = new Float32Array(size);
    this.sinTable = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      let angle = -2 * Math.PI * i / size;
      this.cosTable[i] = Math.cos(angle);
      this.sinTable[i] = Math.sin(angle);
    }
    this.imag = new Float32Array(size);
    this.reversedIndices = new Int32Array(size);
    this._precomputeReversedIndices();
  }

  _precomputeReversedIndices() {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      let rev = 0;
      let temp = i;
      for (let j = 1; j < n; j <<= 1) {
        rev = (rev << 1) | (temp & 1);
        temp >>= 1;
      }
      this.reversedIndices[i] = rev;
    }
  }

  forward(real) {
    const n = this.size;
    const imag = this.imag;
    imag.fill(0);

    // Bit-reversal permutation
    const rev = this.reversedIndices;
    for (let i = 0; i < n; i++) {
      let rIdx = rev[i];
      if (i < rIdx) {
        let temp = real[i];
        real[i] = real[rIdx];
        real[rIdx] = temp;
      }
    }

    // Cooley-Tukey decimation-in-time
    for (let size = 2; size <= n; size <<= 1) {
      let halfSize = size >> 1;
      let tabStep = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + halfSize; j++, k += tabStep) {
          let l = j + halfSize;
          let c = this.cosTable[k];
          let s = this.sinTable[k];
          let tReal = real[l] * c - imag[l] * s;
          let tImag = real[l] * s + imag[l] * c;
          real[l] = real[j] - tReal;
          imag[l] = imag[j] - tImag;
          real[j] += tReal;
          imag[j] += tImag;
        }
      }
    }
  }
}

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
const driverQualityValEl = document.getElementById('driver-quality-val');

// New HUD & Lens Profile DOM elements
const exposureHudEl = document.getElementById('exposure-hud');
const shutterHudEl = document.getElementById('shutter-hud');
const roiHudEl = document.getElementById('roi-hud');
const cameraModeBadgeEl = document.getElementById('camera-mode-badge');
const sensorProfileInfoEl = document.getElementById('sensor-profile-info');
const testSignalSelect = document.getElementById('test-signal-select');
const roiSelect = document.getElementById('roi-select');

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

// ==========================================
// Multi-Lens Profile Persistence
// ==========================================
function getLensStorageKey(deviceId, resolution) {
  return `rolling_shutter_skew_${deviceId || 'default'}_${resolution || 'default'}`;
}

function loadLensProfile(deviceId, resolution, lensName) {
  const key = getLensStorageKey(deviceId, resolution);
  const saved = localStorage.getItem(key) || localStorage.getItem('rolling_shutter_skew');
  if (saved) {
    skewSeconds = parseFloat(saved);
  } else {
    skewSeconds = 0.030;
  }
  skewSlider.value = (skewSeconds * 1000).toFixed(1);
  skewValEl.innerText = (skewSeconds * 1000).toFixed(1) + ' ms';
  if (sensorProfileInfoEl) {
    sensorProfileInfoEl.innerText = `${lensName}: ${(skewSeconds * 1000).toFixed(1)}ms`;
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
// Frame Processing & Camera Logic
// ==========================================

async function initCamera() {
  cameraOverlayMessage.style.display = 'flex';
  cameraOverlayMessage.innerHTML = '<div class="spinner"></div><p>Requesting camera access...</p>';
  
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    
    // Populate select dropdown
    cameraSelect.innerHTML = '';
    if (videoDevices.length === 0) {
      cameraOverlayMessage.innerHTML = '<p style="color:var(--color-error)">No camera found on this device.</p>';
      return;
    }
    
    videoDevices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Camera ${index + 1}`;
      cameraSelect.appendChild(option);
    });
    
    // Choose the back camera by default
    let defaultId = videoDevices[0].deviceId;
    const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment') || d.label.toLowerCase().includes('rear'));
    if (backCamera) {
      defaultId = backCamera.deviceId;
      cameraSelect.value = defaultId;
    }
    
    await startStreaming(defaultId);
    
  } catch (err) {
    console.error('Error listing cameras:', err);
    cameraOverlayMessage.innerHTML = `<p style="color:var(--color-error)">Failed to initialize cameras: ${err.message}</p>`;
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
  cameraOverlayMessage.style.display = 'flex';
  
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
    videoEl.srcObject = stream;
    
    // Wait for video metadata to load
    await new Promise(resolve => {
      videoEl.onloadedmetadata = () => resolve();
    });
    
    activeDeviceId = deviceId || 'default';
    activeResolution = `${videoEl.videoWidth || 1280}x${videoEl.videoHeight || 720}`;
    
    const selectedOption = cameraSelect.options[cameraSelect.selectedIndex];
    activeLensName = selectedOption ? selectedOption.text : 'Default Camera';
    
    // Load profile specific to this camera lens & resolution
    loadLensProfile(activeDeviceId, activeResolution, activeLensName);
    
    // Apply optimal manual options if browser supports them
    const track = stream.getVideoTracks()[0];
    await configureOptimalCameraSettings(track);
    
    // Hide loading overlay
    cameraOverlayMessage.style.display = 'none';
    
    // Make preview canvas match aspect ratio
    previewCanvas.width = previewCanvas.clientWidth * window.devicePixelRatio;
    previewCanvas.height = previewCanvas.clientHeight * window.devicePixelRatio;
    
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(processFrameLoop);
    
  } catch (err) {
    console.error('Error starting video stream:', err);
    cameraOverlayMessage.innerHTML = `<p style="color:var(--color-error)">Failed to access camera: ${err.message}<br>Make sure camera permissions are enabled.</p>`;
  }
}

function stopStream() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
}

// Main 60fps frame loop
function processFrameLoop() {
  if (isFrozen) {
    animationFrameId = requestAnimationFrame(processFrameLoop);
    return;
  }
  
  const hasLiveVideo = videoEl.readyState === videoEl.HAVE_ENOUGH_DATA;
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
        sum += 0.299 * pixels[idx] + 0.587 * pixels[idx+1] + 0.114 * pixels[idx+2];
      }
      rowAverages[y] = sum / roiSpanX;
    }
    
    for (let x = 0; x < SIGNAL_LEN; x++) {
      let sum = 0;
      for (let y = ry1; y < ry2; y++) {
        const idx = (y * SIGNAL_LEN + x) * 4;
        sum += 0.299 * pixels[idx] + 0.587 * pixels[idx+1] + 0.114 * pixels[idx+2];
      }
      colAverages[x] = sum / roiSpanY;
    }
    
    // 4. In-place process signals for both axes
    analyzeSignalInPlace(rowAverages, skewSeconds, analysisResultY);
    analyzeSignalInPlace(colAverages, skewSeconds, analysisResultX);
    
    // 5. Select winning axis (higher SNR)
    let winner = 'y';
    if (scanMode === 'auto') {
      winner = (analysisResultX.snr > analysisResultY.snr) ? 'x' : 'y';
    } else {
      winner = scanMode;
    }
    currentActiveAxis = winner;
    
    const result = (winner === 'y') ? analysisResultY : analysisResultX;
    const validSignal = result.snr > 3.2;
    
    // Calibration logging
    if (isCalibrating && validSignal) {
      calPeaks.push(result.peakBin);
      const progress = Math.min(100, Math.round((calPeaks.length / CAL_SAMPLES_NEEDED) * 100));
      calProgressBar.style.width = progress + '%';
      calStatusText.innerText = `Capturing signal... ${calPeaks.length} / ${CAL_SAMPLES_NEEDED} samples`;
      
      if (calPeaks.length >= CAL_SAMPLES_NEEDED) {
        finishCalibration();
      }
    }
    
    let percentFlicker = 0;
    let flickerIndex = 0;
    let thd = 0;
    let driverQuality = "UNKNOWN";
    let ratingClass = "rating-none";
    
    if (validSignal) {
      if (smoothedFreq === 0) {
        smoothedFreq = result.freq;
      } else {
        smoothedFreq = smoothedFreq * 0.82 + result.freq * 0.18;
      }
      
      const calculatedConfidence = Math.min(100, Math.round((result.snr - 3.2) * 20));
      confidence = Math.max(confidence * 0.9 + calculatedConfidence * 0.1, calculatedConfidence);
      
      hzValEl.innerText = smoothedFreq.toFixed(1);
      statusTextEl.innerText = isSynthetic ? "SYNTHETIC SIGNAL ACTIVE" : "STABLE FLICKER DETECTED";
      statusTextEl.style.color = "var(--color-primary)";
      
      const rawSignal = (winner === 'y') ? rowAverages : colAverages;
      const metricStart = (winner === 'y') ? ry1 : rx1;
      const metricEnd = (winner === 'y') ? ry2 : rx2;
      
      // Calculate Percent Flicker (Modulation Depth)
      percentFlicker = calculatePercentFlicker(rawSignal, result.waveform, metricStart, metricEnd);
      
      // Calculate IES Flicker Index (Area Above Mean / Total Area)
      flickerIndex = calculateFlickerIndex(rawSignal, result.waveform, metricStart, metricEnd);
      
      // Calculate Waveform Harmonics & THD
      const harmonicResult = calculateHarmonicsAndTHD(result.magnitudes, result.peakBin, skewSeconds);
      thd = harmonicResult.thd;
      
      // Classify Driver Quality based on IEEE 1789-2015
      const freq = result.freq;
      const classification = classifyDriverQuality(freq, percentFlicker);
      driverQuality = classification.quality;
      ratingClass = classification.ratingClass;
      
      // Update Metric UI elements
      flickerPctValEl.innerText = percentFlicker.toFixed(1) + '%';
      if (flickerIndexValEl) flickerIndexValEl.innerText = flickerIndex.toFixed(3);
      if (thdValEl) thdValEl.innerText = (thd > 0 && freq > 0) ? (thd.toFixed(1) + '%') : '--.-%';
      driverQualityValEl.innerText = driverQuality;
      driverQualityValEl.className = 'sub-metric-value ' + ratingClass;
      
      // Shutter speed attenuation heuristic
      if (shutterHudEl) {
        const isAutoExp = cameraModeBadgeEl && cameraModeBadgeEl.innerText.includes('Auto');
        if (isAutoExp && meanRoiLuminance < 45 && result.snr < 4.5 && !isSynthetic) {
          shutterHudEl.style.display = 'block';
          shutterHudEl.innerText = '⚠️ Shutter Slow (Averaging Flicker)';
        } else {
          shutterHudEl.style.display = 'none';
        }
      }
      
    } else {
      confidence = Math.max(0, confidence - 3);
      if (confidence === 0) {
        hzValEl.innerText = "--.-";
        flickerPctValEl.innerText = "--.-%";
        if (flickerIndexValEl) flickerIndexValEl.innerText = "-.---";
        if (thdValEl) thdValEl.innerText = "--.-%";
        driverQualityValEl.innerText = "UNKNOWN";
        driverQualityValEl.className = "sub-metric-value rating-none";
        statusTextEl.innerText = "NO FLICKER DETECTED";
        statusTextEl.style.color = "var(--color-muted)";
        if (shutterHudEl) shutterHudEl.style.display = 'none';
      } else {
        statusTextEl.innerText = "WEAK SIGNAL - HOLD STEADY";
        statusTextEl.style.color = "var(--color-secondary)";
      }
    }
    
    // Session recording sample accumulation
    if (isRecording) {
      const elapsed = Date.now() - recordStartTime;
      const progress = Math.min(100, (elapsed / RECORD_DURATION_MS) * 100);
      recProgressBar.style.width = `${progress}%`;
      recTimerLabel.innerText = `Recording: ${(elapsed / 1000).toFixed(1)}s / 10.0s`;
      recSamplesCount.innerText = `${recordSamples.length} samples`;
      
      recordSamples.push({
        timeMs: elapsed,
        freq: validSignal ? result.freq : 0,
        percentFlicker: validSignal ? percentFlicker : 0,
        flickerIndex: validSignal ? flickerIndex : 0,
        thd: validSignal ? thd : 0,
        snr: result.snr,
        driverQuality: driverQuality,
        confidence: confidence,
        peakBin: result.peakBin
      });
      
      if (elapsed >= RECORD_DURATION_MS) {
        finishRecording();
      }
    }
    
    // Cache waveform and FFT magnitudes
    signalWaveformBuffer.set(result.waveform);
    fftMagnitudesBuffer.set(result.magnitudes);
    
    // Update confidence bar UI
    confidencePctEl.innerText = Math.round(confidence) + '%';
    confidenceBarEl.style.width = confidence + '%';
    if (confidence > 75) {
      confidenceBarEl.style.background = 'linear-gradient(90deg, #00f2fe, #00e676)';
    } else if (confidence > 35) {
      confidenceBarEl.style.background = 'linear-gradient(90deg, #00f2fe, #ffe600)';
    } else {
      confidenceBarEl.style.background = 'linear-gradient(90deg, #00f2fe, #ff1744)';
    }
    
    // Grid Match & Overlays
    updateGridMatchTag(smoothedFreq, confidence);
    renderScannerOverlay(winner, startIdx, endIdx, isSynthetic);
    renderWaveformChart();
    renderSpectrumChart(result.peakBin, validSignal);
  }
  
  animationFrameId = requestAnimationFrame(processFrameLoop);
}

// Render scanner visualization onto preview canvas
function renderScannerOverlay(axis, startIdx, endIdx, isSynthetic) {
  // Keep dimensions synced
  if (previewCanvas.width !== previewCanvas.clientWidth * window.devicePixelRatio ||
      previewCanvas.height !== previewCanvas.clientHeight * window.devicePixelRatio) {
    previewCanvas.width = previewCanvas.clientWidth * window.devicePixelRatio;
    previewCanvas.height = previewCanvas.clientHeight * window.devicePixelRatio;
  }
  
  const w = previewCanvas.width;
  const h = previewCanvas.height;
  
  // Clear and draw video or synthetic canvas
  if (isSynthetic) {
    previewCtx.drawImage(offscreenCanvas, 0, 0, w, h);
  } else {
    previewCtx.drawImage(videoEl, 0, 0, w, h);
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
    laserLine.className = 'scan-laser-line vertical-scan';
    laserLine.style.display = 'none'; // handled on canvas
  } else {
    axisIndicatorEl.innerText = 'VERTICAL BANDS';
    axisIndicatorEl.style.color = 'var(--color-secondary)';
    
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
    
    laserLine.className = 'scan-laser-line horizontal-scan';
    laserLine.style.display = 'none'; // handled on canvas
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
  let csv = 'Timestamp_ms,Frequency_Hz,Percent_Flicker,Flicker_Index,Waveform_THD,SNR,Driver_Quality,Confidence_Pct\n';
  recordSamples.forEach(s => {
    csv += `${s.timeMs},${s.freq.toFixed(2)},${s.percentFlicker.toFixed(2)},${(s.flickerIndex || 0).toFixed(3)},${(s.thd || 0).toFixed(1)},${s.snr.toFixed(2)},"${s.driverQuality}",${s.confidence.toFixed(0)}\n`;
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
  const payload = {
    app: 'FlickerHz',
    version: '1.3.0',
    exportTimestamp: new Date().toISOString(),
    cameraLens: activeLensName,
    sensorResolution: activeResolution,
    calibratedSkewSeconds: skewSeconds,
    totalSamplesRecorded: recordSamples.length,
    finalFrequencyHz: parseFloat(hzValEl ? hzValEl.innerText : 0) || 0,
    finalPercentFlicker: parseFloat(flickerPctValEl ? flickerPctValEl.innerText : 0) || 0,
    finalFlickerIndex: parseFloat(flickerIndexValEl ? flickerIndexValEl.innerText : 0) || 0,
    finalTHD: parseFloat(thdValEl ? thdValEl.innerText : 0) || 0,
    driverClassification: driverQualityValEl ? driverQualityValEl.innerText : 'UNKNOWN',
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
  card.height = 1060;
  const ctx = card.getContext('2d');
  
  // Outer gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, 840, 1060);
  bgGrad.addColorStop(0, '#0a0f1d');
  bgGrad.addColorStop(1, '#050811');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 840, 1060);
  
  // Neon Cyber Border
  ctx.strokeStyle = '#00f2fe';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 800, 1020);
  
  // Title Header
  ctx.fillStyle = '#00f2fe';
  ctx.font = 'bold 28px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FLICKERHZ LIGHT QUALITY & EYE SAFETY REPORT', 420, 70);
  
  ctx.fillStyle = '#8e9bb2';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText('IEEE 1789-2015 & IES RP-16-10 Optical Flicker Compliance Certificate', 420, 100);
  
  // Audit stability computation
  const audit = calculateAuditStability(recordSamples.length > 0 ? recordSamples : [{
    freq: parseFloat(hzValEl ? hzValEl.innerText : 0) || 0,
    percentFlicker: parseFloat(flickerPctValEl ? flickerPctValEl.innerText : 0) || 0,
    flickerIndex: parseFloat(flickerIndexValEl ? flickerIndexValEl.innerText : 0) || 0,
    thd: parseFloat(thdValEl ? thdValEl.innerText : 0) || 0,
    snr: 8.0
  }]);
  
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
    gradeDesc = 'EXCELLENT: No Observable Effect (IEEE 1789 NOEL compliant)';
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
  ctx.fillRect(50, 130, 740, 155);
  ctx.strokeStyle = gradeColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(50, 130, 740, 155);
  
  ctx.fillStyle = gradeColor;
  ctx.font = 'bold 68px Orbitron, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`GRADE ${grade}`, 75, 220);
  
  // Lab certification stamp
  if (audit.isCertifiedLabGrade) {
    ctx.fillStyle = '#00f2fe';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText('★ CLASS A LAB CERTIFIED STABILITY ★', 430, 175);
    ctx.fillStyle = '#8e9bb2';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(`Freq Jitter: ±${audit.stdDevFreq} Hz | Avg SNR: ${audit.meanSNR} dB`, 430, 200);
  }
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px Inter, sans-serif';
  ctx.fillText(gradeDesc, 75, 260);
  
  // Metrics Grid Row 1 (4 columns)
  ctx.fillStyle = '#8e9bb2';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('FREQUENCY', 75, 320);
  ctx.fillText('MODULATION DEPTH', 255, 320);
  ctx.fillText('IES FLICKER INDEX', 450, 320);
  ctx.fillText('WAVEFORM THD', 645, 320);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Orbitron, monospace';
  ctx.fillText(`${hzValEl ? hzValEl.innerText : '--'} Hz`, 75, 350);
  ctx.fillText(flickerPctValEl ? flickerPctValEl.innerText : '--%', 255, 350);
  ctx.fillText(flickerIndexValEl ? flickerIndexValEl.innerText : '-.---', 450, 350);
  ctx.fillText(thdValEl ? thdValEl.innerText : '--.-%', 645, 350);
  
  // Metrics Grid Row 2
  ctx.fillStyle = '#8e9bb2';
  ctx.font = '11px Inter, sans-serif';
  ctx.fillText('AC GRID / STROBE MATCH', 75, 395);
  ctx.fillText('AUDIT STABILITY RATING', 450, 395);
  
  ctx.font = 'bold 15px Inter, sans-serif';
  ctx.fillStyle = '#00f2fe';
  ctx.fillText(gridMatchTagEl ? gridMatchTagEl.innerText : 'No Match', 75, 420);
  ctx.fillText(audit.stabilityGrade, 450, 420);
  
  // Snapshots of Waveform and Spectrum
  ctx.fillStyle = '#8e9bb2';
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText('FLICKER WAVEFORM TRACE (TIME DOMAIN)', 75, 465);
  ctx.drawImage(waveformCanvas, 50, 480, 740, 200);
  
  ctx.fillText('FOURIER TRANSFORM SPECTRUM (FREQUENCY DOMAIN)', 75, 715);
  ctx.drawImage(spectrumCanvas, 50, 730, 740, 200);
  
  // Metadata Footer
  ctx.fillStyle = '#8e9bb2';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  ctx.fillText(`Sensor Profile: ${skewValEl ? skewValEl.innerText : '30ms'} skew (${activeLensName}) | Audit Date: ${dateStr}`, 420, 970);
  ctx.fillText('Verified with FlickerHz PWA | Scientific Rolling-Shutter Time Scanner', 420, 995);
  
  // Trigger PNG download
  const link = document.createElement('a');
  link.download = `flickerhz-report-card-${Date.now()}.png`;
  link.href = card.toDataURL('image/png');
  link.click();
}

if (exportCardBtn) exportCardBtn.addEventListener('click', generateReportCard);

// ==========================================
// Initialization & PWA Service Worker
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
  initCamera();
  
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
