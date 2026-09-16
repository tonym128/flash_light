// ==========================================
// FlashyLight - Dedicated DSP Web Worker
// Decouples FFT, Detrending, Harmonics, and SVM
// computations from the 60fps UI thread.
// ==========================================

importScripts('dsp.js');

const SIGNAL_LEN = 512;
const FFT_SIZE = 4096;

const fft = new FFT(FFT_SIZE);

// Precompute Hanning window
const hanningWindow = new Float32Array(SIGNAL_LEN);
for (let i = 0; i < SIGNAL_LEN; i++) {
  hanningWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (SIGNAL_LEN - 1)));
}

// Pre-allocated scratch buffers
const windowedScratch = new Float32Array(SIGNAL_LEN);
const realBufferScratch = new Float32Array(FFT_SIZE);

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

function analyzeSignalInPlace(rawSignal, skewSec, outResult) {
  // 1. Detrend signal (~25ms window)
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
  
  // 5. Compute Magnitudes
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
  
  // 7. Parabolic interpolation
  const interpolatedBin = interpolatePeak(magnitudes, peakBin);
  const freq = interpolatedBin / (8 * skewSec);
  
  outResult.freq = freq;
  outResult.snr = snr;
  outResult.peakBin = peakBin;
  outResult.peakMag = maxMag;
}

self.onmessage = function(e) {
  const data = e.data;
  if (!data || data.type !== 'ANALYZE_FRAME') return;
  
  const rowAverages = data.rowAverages;
  const colAverages = data.colAverages;
  const skewSec = data.skewSeconds || 0.030;
  const scanMode = data.scanMode || 'auto';
  const meanRoiLuminance = data.meanRoiLuminance || 100;
  const ambientBaseline = data.ambientBaseline || 0;
  const ry1 = data.ry1 || 0;
  const ry2 = data.ry2 || SIGNAL_LEN;
  const rx1 = data.rx1 || 0;
  const rx2 = data.rx2 || SIGNAL_LEN;
  const frameId = data.frameId;

  // Execute in-place analysis
  analyzeSignalInPlace(rowAverages, skewSec, analysisResultY);
  analyzeSignalInPlace(colAverages, skewSec, analysisResultX);

  let winner = 'y';
  if (scanMode === 'auto') {
    winner = (analysisResultX.snr > analysisResultY.snr) ? 'x' : 'y';
  } else {
    winner = scanMode;
  }

  const result = (winner === 'y') ? analysisResultY : analysisResultX;
  const validSignal = result.snr > 3.2;

  let percentFlicker = 0;
  let flickerIndex = 0;
  let thd = 0;
  let svm = 0;
  let svmRating = "N/A";
  let svmRatingClass = "rating-none";
  let isEcodesignCompliant = false;
  let driverQuality = "UNKNOWN";
  let ratingClass = "rating-none";

  if (validSignal) {
    const rawSignal = (winner === 'y') ? rowAverages : colAverages;
    const metricStart = (winner === 'y') ? ry1 : rx1;
    const metricEnd = (winner === 'y') ? ry2 : rx2;

    percentFlicker = calculatePercentFlicker(rawSignal, result.waveform, metricStart, metricEnd, ambientBaseline);
    flickerIndex = calculateFlickerIndex(rawSignal, result.waveform, metricStart, metricEnd, ambientBaseline);

    const harmonicResult = calculateHarmonicsAndTHD(result.magnitudes, result.peakBin, skewSec);
    thd = harmonicResult.thd;

    const svmResult = calculateSVM(result.magnitudes, result.peakBin, skewSec, meanRoiLuminance, ambientBaseline);
    svm = svmResult.svm;
    svmRating = svmResult.rating;
    svmRatingClass = svmResult.ratingClass;
    isEcodesignCompliant = svmResult.isEcodesignCompliant;

    const classification = classifyDriverQuality(result.freq, percentFlicker);
    driverQuality = classification.quality;
    ratingClass = classification.ratingClass;
  }

  // Transfer waveform & magnitudes buffers for zero-copy rendering
  const outWaveform = new Float32Array(result.waveform);
  const outMagnitudes = new Float32Array(result.magnitudes);

  const response = {
    type: 'FRAME_RESULT',
    frameId,
    winner,
    validSignal,
    freq: result.freq,
    snr: result.snr,
    peakBin: result.peakBin,
    peakMag: result.peakMag,
    percentFlicker,
    flickerIndex,
    thd,
    svm,
    svmRating,
    svmRatingClass,
    isEcodesignCompliant,
    driverQuality,
    ratingClass,
    waveform: outWaveform,
    magnitudes: outMagnitudes,
    rowAverages,
    colAverages
  };

  self.postMessage(response, [
    outWaveform.buffer,
    outMagnitudes.buffer,
    rowAverages.buffer,
    colAverages.buffer
  ]);
};
