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
const driverQualityValEl = document.getElementById('driver-quality-val');

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

// Real-time smoothed metrics
let smoothedFreq = 0;
let confidence = 0;
let signalWaveformBuffer = new Float32Array(SIGNAL_LEN);
let fftMagnitudesBuffer = new Float32Array(FFT_SIZE / 2);

// Calibration State
let isCalibrating = false;
let calTargetFreq = 100; // default 50Hz grid -> 100Hz flicker
let calPeaks = [];
const CAL_SAMPLES_NEEDED = 60;

// Load Skew from LocalStorage
const savedSkew = localStorage.getItem('rolling_shutter_skew');
if (savedSkew) {
  skewSeconds = parseFloat(savedSkew);
  skewSlider.value = (skewSeconds * 1000).toFixed(1);
  skewValEl.innerText = (skewSeconds * 1000).toFixed(1) + ' ms';
}

// ==========================================
// Signal Processing Helpers
// ==========================================

// O(n) detrending using moving average
function detrend(signal, windowSize) {
  const n = signal.length;
  const result = new Float32Array(n);
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
    result[i] = signal[i] - average;
  }
  return result;
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

// Analyze signal for dominant frequency
function analyzeSignal(rawSignal, skewSec) {
  // 1. Detrend signal (window size ~ 18ms to remove spatial gradients)
  const windowSamples = Math.max(16, Math.min(256, Math.round(SIGNAL_LEN * (0.015 / skewSec))));
  const detrended = detrend(rawSignal, windowSamples);
  
  // 2. Apply Hanning window
  const windowed = new Float32Array(SIGNAL_LEN);
  for (let i = 0; i < SIGNAL_LEN; i++) {
    windowed[i] = detrended[i] * hanningWindow[i];
  }
  
  // 3. Zero-pad to FFT size (4096)
  const realBuffer = new Float32Array(FFT_SIZE);
  realBuffer.set(windowed); // Zero-padding automatically occurs because remaining indices are 0
  
  // 4. Run FFT
  fft.forward(realBuffer);
  
  // 5. Compute Magnitudes (up to Nyquist frequency: FFT_SIZE/2)
  const halfFft = FFT_SIZE / 2;
  const magnitudes = new Float32Array(halfFft);
  for (let k = 0; k < halfFft; k++) {
    const r = realBuffer[k];
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
  
  return {
    freq,
    snr,
    peakBin,
    peakMag: maxMag,
    waveform: detrended,
    magnitudes
  };
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
    
    // Apply manual options if browser supports them
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    console.log('Camera capabilities:', capabilities);
    
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
  
  if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
    // 1. Draw frame to offscreen square canvas for mathematical analysis
    offscreenCtx.drawImage(videoEl, 0, 0, SIGNAL_LEN, SIGNAL_LEN);
    const imgData = offscreenCtx.getImageData(0, 0, SIGNAL_LEN, SIGNAL_LEN);
    const pixels = imgData.data;
    
    // 2. Sample horizontal (colAverages) and vertical (rowAverages) signals
    const colAverages = new Float32Array(SIGNAL_LEN);
    const rowAverages = new Float32Array(SIGNAL_LEN);
    
    const startIdx = 128; // Center 50% start
    const endIdx = 384;   // Center 50% end
    const span = endIdx - startIdx;
    
    // Row averages (corresponds to horizontal stripes / vertical scanning axis Y)
    for (let y = 0; y < SIGNAL_LEN; y++) {
      let sum = 0;
      for (let x = startIdx; x < endIdx; x++) {
        const idx = (y * SIGNAL_LEN + x) * 4;
        sum += 0.299 * pixels[idx] + 0.587 * pixels[idx+1] + 0.114 * pixels[idx+2];
      }
      rowAverages[y] = sum / span;
    }
    
    // Column averages (corresponds to vertical stripes / horizontal scanning axis X)
    for (let x = 0; x < SIGNAL_LEN; x++) {
      let sum = 0;
      for (let y = startIdx; y < endIdx; y++) {
        const idx = (y * SIGNAL_LEN + x) * 4;
        sum += 0.299 * pixels[idx] + 0.587 * pixels[idx+1] + 0.114 * pixels[idx+2];
      }
      colAverages[x] = sum / span;
    }
    
    // 3. Process signals for both axes
    const resY = analyzeSignal(rowAverages, skewSeconds);
    const resX = analyzeSignal(colAverages, skewSeconds);
    
    // 4. Select the winning axis (higher SNR)
    let winner = 'y';
    if (scanMode === 'auto') {
      winner = (resX.snr > resY.snr) ? 'x' : 'y';
    } else {
      winner = scanMode;
    }
    currentActiveAxis = winner;
    
    const result = (winner === 'y') ? resY : resX;
    
    // 5. Update state & perform calibration logging if active
    const validSignal = result.snr > 3.2;
    
    if (isCalibrating && validSignal) {
      calPeaks.push(result.peakBin);
      const progress = Math.min(100, Math.round((calPeaks.length / CAL_SAMPLES_NEEDED) * 100));
      calProgressBar.style.width = progress + '%';
      calStatusText.innerText = `Capturing signal... ${calPeaks.length} / ${CAL_SAMPLES_NEEDED} samples`;
      
      if (calPeaks.length >= CAL_SAMPLES_NEEDED) {
        finishCalibration();
      }
    }
    
    if (validSignal) {
      if (smoothedFreq === 0) {
        smoothedFreq = result.freq;
      } else {
        // Smooth changes
        smoothedFreq = smoothedFreq * 0.82 + result.freq * 0.18;
      }
      
      // Map SNR to confidence percentage (3.2 SNR -> 0%, 8+ SNR -> 100%)
      const calculatedConfidence = Math.min(100, Math.round((result.snr - 3.2) * 20));
      confidence = Math.max(confidence * 0.9 + calculatedConfidence * 0.1, calculatedConfidence);
      
      hzValEl.innerText = smoothedFreq.toFixed(1);
      statusTextEl.innerText = "STABLE FLICKER DETECTED";
      statusTextEl.style.color = "var(--color-primary)";
      
      // Calculate Percent Flicker (Modulation Depth)
      let sumRaw = 0;
      let minDetrended = 999999;
      let maxDetrended = -999999;
      const rawSignal = (winner === 'y') ? rowAverages : colAverages;
      
      for (let i = startIdx; i < endIdx; i++) {
        sumRaw += rawSignal[i];
        if (result.waveform[i] < minDetrended) minDetrended = result.waveform[i];
        if (result.waveform[i] > maxDetrended) maxDetrended = result.waveform[i];
      }
      
      const meanRaw = sumRaw / span;
      const peakToPeak = maxDetrended - minDetrended;
      const percentFlicker = meanRaw > 0 ? (peakToPeak / (2 * meanRaw)) * 100 : 0;
      
      // Classify Driver Quality based on IEEE 1789-2015
      const freq = result.freq;
      let lowRiskLimit = 8.0;
      let noelLimit = 3.3;
      
      if (freq < 90) {
        lowRiskLimit = freq * 0.025;
        noelLimit = freq * 0.01;
      } else {
        lowRiskLimit = freq * 0.08;
        noelLimit = freq * 0.033;
      }
      
      let driverQuality = "UNKNOWN";
      let ratingClass = "rating-none";
      
      if (percentFlicker < 3.0) {
        driverQuality = "EXCELLENT (FLICKER-FREE)";
        ratingClass = "rating-excellent";
      } else if (percentFlicker <= noelLimit) {
        driverQuality = "HIGH QUALITY (SAFE)";
        ratingClass = "rating-excellent";
      } else if (percentFlicker <= lowRiskLimit) {
        driverQuality = "STANDARD QUALITY (SAFE)";
        ratingClass = "rating-high-quality";
      } else {
        // Exceeds low-risk limit - low quality driver!
        if (freq >= 90 && freq <= 130) {
          // Double grid frequency range (typical cheap driver ripple)
          if (percentFlicker > 30.0) {
            driverQuality = "LOW QUALITY (HIGH AC RIPPLE)";
            ratingClass = "rating-hazard";
          } else {
            driverQuality = "LOW QUALITY (MODERATE AC RIPPLE)";
            ratingClass = "rating-low-quality";
          }
        } else if (freq > 130 && freq <= 500) {
          // Low frequency PWM dimmer
          driverQuality = "LOW QUALITY (LOW-FREQ PWM)";
          ratingClass = "rating-hazard";
        } else {
          // Other frequency, but high flicker depth
          driverQuality = "LOW QUALITY (UNSTABLE)";
          ratingClass = "rating-low-quality";
        }
      }
      
      // Update DOM sub-metrics
      flickerPctValEl.innerText = percentFlicker.toFixed(1) + '%';
      driverQualityValEl.innerText = driverQuality;
      driverQualityValEl.className = 'sub-metric-value ' + ratingClass;
      
    } else {
      // Decay smoothed metrics slowly
      confidence = Math.max(0, confidence - 3);
      if (confidence === 0) {
        hzValEl.innerText = "--.-";
        flickerPctValEl.innerText = "--.-%";
        driverQualityValEl.innerText = "UNKNOWN";
        driverQualityValEl.className = "sub-metric-value rating-none";
        statusTextEl.innerText = "NO FLICKER DETECTED";
        statusTextEl.style.color = "var(--color-muted)";
      } else {
        statusTextEl.innerText = "WEAK SIGNAL - HOLD STEADY";
        statusTextEl.style.color = "var(--color-secondary)";
      }
    }
    
    // Cache waveform and FFT magnitudes for diagnostic rendering
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
    
    // 6. Update Grid Match Status
    updateGridMatchTag(smoothedFreq, confidence);
    
    // 7. Render UI overlays on camera canvas
    renderScannerOverlay(winner, startIdx, endIdx);
    
    // 8. Render diagnostics graphs
    renderWaveformChart();
    renderSpectrumChart(result.peakBin, validSignal);
  }
  
  animationFrameId = requestAnimationFrame(processFrameLoop);
}

// Render scanner visualization onto preview canvas
function renderScannerOverlay(axis, startIdx, endIdx) {
  // Keep dimensions synced
  if (previewCanvas.width !== previewCanvas.clientWidth * window.devicePixelRatio ||
      previewCanvas.height !== previewCanvas.clientHeight * window.devicePixelRatio) {
    previewCanvas.width = previewCanvas.clientWidth * window.devicePixelRatio;
    previewCanvas.height = previewCanvas.clientHeight * window.devicePixelRatio;
  }
  
  const w = previewCanvas.width;
  const h = previewCanvas.height;
  
  // Clear and draw video
  previewCtx.drawImage(videoEl, 0, 0, w, h);
  
  const x1 = (startIdx / SIGNAL_LEN) * w;
  const x2 = (endIdx / SIGNAL_LEN) * w;
  const y1 = (startIdx / SIGNAL_LEN) * h;
  const y2 = (endIdx / SIGNAL_LEN) * h;
  
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
    const grid = parseInt(btn.getAttribute('data-grid'));
    calTargetFreq = grid * 2; // grid 50 -> 100Hz, 60 -> 120Hz
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
    
    // Update Slider
    const msValue = computedSkew * 1000;
    skewSlider.value = msValue.toFixed(1);
    skewValEl.innerText = msValue.toFixed(1) + ' ms';
    
    // Save
    localStorage.setItem('rolling_shutter_skew', computedSkew);
    
    // Populate step 3 fields
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
