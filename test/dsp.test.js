const assert = require('assert');
const {
  FFT,
  detrendInPlace,
  interpolatePeak,
  calculatePercentFlicker,
  classifyDriverQuality
} = require('../dsp.js');

console.log('Running FlashyLight DSP Unit Test Suite...\n');

let testsPassed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ==========================================
// 1. FFT Transform & Peak Detection
// ==========================================
test('FFT accurately identifies 100 Hz sine wave in rolling shutter window', () => {
  const FFT_SIZE = 4096;
  const SIGNAL_LEN = 512;
  const skewSec = 0.030; // 30ms frame skew
  const samplingRate = SIGNAL_LEN / skewSec; // ~17066.67 Hz effective line rate
  const targetFreq = 100.0;

  const fft = new FFT(FFT_SIZE);
  const real = new Float32Array(FFT_SIZE);

  // Generate 100 Hz sine wave over SIGNAL_LEN
  for (let i = 0; i < SIGNAL_LEN; i++) {
    const t = i * (skewSec / SIGNAL_LEN);
    // Apply Hanning window
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (SIGNAL_LEN - 1)));
    real[i] = Math.sin(2 * Math.PI * targetFreq * t) * hann;
  }

  fft.forward(real);

  // Calculate magnitudes
  const halfFft = FFT_SIZE / 2;
  const magnitudes = new Float32Array(halfFft);
  let maxMag = 0;
  let peakBin = 0;

  for (let k = 0; k < halfFft; k++) {
    const mag = Math.sqrt(real[k] * real[k] + fft.imag[k] * fft.imag[k]);
    magnitudes[k] = mag;
    if (mag > maxMag) {
      maxMag = mag;
      peakBin = k;
    }
  }

  // With 8x zero-padding (4096 / 512 = 8), bin resolution = samplingRate / 4096 = 1 / (8 * skewSec)
  const interpBin = interpolatePeak(magnitudes, peakBin);
  const detectedFreq = interpBin / (8 * skewSec);

  const freqError = Math.abs(detectedFreq - targetFreq);
  assert(freqError < 0.25, `Detected freq ${detectedFreq.toFixed(3)}Hz deviates from ${targetFreq}Hz by ${freqError.toFixed(3)}Hz (> 0.25Hz)`);
});

test('FFT accurately identifies 120 Hz sine wave (North America grid ripple)', () => {
  const FFT_SIZE = 4096;
  const SIGNAL_LEN = 512;
  const skewSec = 0.032;
  const targetFreq = 120.0;

  const fft = new FFT(FFT_SIZE);
  const real = new Float32Array(FFT_SIZE);

  for (let i = 0; i < SIGNAL_LEN; i++) {
    const t = i * (skewSec / SIGNAL_LEN);
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (SIGNAL_LEN - 1)));
    real[i] = Math.sin(2 * Math.PI * targetFreq * t) * hann;
  }

  fft.forward(real);

  const halfFft = FFT_SIZE / 2;
  const magnitudes = new Float32Array(halfFft);
  let maxMag = 0;
  let peakBin = 0;

  for (let k = 0; k < halfFft; k++) {
    const mag = Math.sqrt(real[k] * real[k] + fft.imag[k] * fft.imag[k]);
    magnitudes[k] = mag;
    if (mag > maxMag) {
      maxMag = mag;
      peakBin = k;
    }
  }

  const interpBin = interpolatePeak(magnitudes, peakBin);
  const detectedFreq = interpBin / (8 * skewSec);
  const freqError = Math.abs(detectedFreq - targetFreq);
  assert(freqError < 0.25, `Detected freq ${detectedFreq.toFixed(3)}Hz deviates from ${targetFreq}Hz by ${freqError.toFixed(3)}Hz`);
});

// ==========================================
// 2. Parabolic Peak Interpolation Precision
// ==========================================
test('interpolatePeak calculates fractional vertex of quadratic peak', () => {
  // Peak at bin 10 with offset +0.3
  // y = -a*(x - 10.3)^2 + C
  const a = 2.0;
  const peak = 10;
  const mags = new Float32Array(20);
  for (let i = 0; i < 20; i++) {
    mags[i] = Math.max(0, 100 - a * Math.pow(i - 10.3, 2));
  }

  const vertex = interpolatePeak(mags, peak);
  const error = Math.abs(vertex - 10.3);
  assert(error < 0.001, `Interpolated vertex ${vertex} deviates from expected 10.3 (error: ${error})`);
});

// ==========================================
// 3. Detrending Filter
// ==========================================
test('detrendInPlace removes DC baseline and spatial illumination gradient', () => {
  const n = 512;
  const raw = new Float32Array(n);
  const detrended = new Float32Array(n);

  // Generate signal with steep DC gradient from 100 to 200 plus 100Hz sine oscillation
  for (let i = 0; i < n; i++) {
    const gradient = 100 + (100 * i / n);
    const oscillation = 15 * Math.sin(2 * Math.PI * 5 * i / n); // 5 cycles in frame
    raw[i] = gradient + oscillation;
  }

  detrendInPlace(raw, 64, detrended);

  // Check interior region (excluding boundary filter ramp)
  let sumDetrended = 0;
  const start = 40;
  const end = n - 40;
  for (let i = start; i < end; i++) {
    sumDetrended += detrended[i];
  }
  const meanDetrended = sumDetrended / (end - start);

  assert(Math.abs(meanDetrended) < 0.2, `Detrended interior mean ${meanDetrended} should be ~0.0`);
});

// ==========================================
// 4. Percent Flicker Calculation
// ==========================================
test('calculatePercentFlicker correctly computes modulation depth', () => {
  const n = 512;
  const raw = new Float32Array(n);
  const waveform = new Float32Array(n);

  // Mean = 100, AC amplitude = 10 -> min = 90, max = 110. Peak-to-peak = 20.
  // Expected percent flicker = 20 / (2 * 100) * 100 = 10.0%
  for (let i = 0; i < n; i++) {
    const ac = 10 * Math.sin(2 * Math.PI * 4 * i / n);
    raw[i] = 100 + ac;
    waveform[i] = ac;
  }

  const pct = calculatePercentFlicker(raw, waveform, 30, n - 30);
  assert(Math.abs(pct - 10.0) < 0.2, `Calculated flicker ${pct.toFixed(2)}% deviates from 10.0%`);
});

test('calculatePercentFlicker returns 0% for pure DC flicker-free light', () => {
  const n = 512;
  const raw = new Float32Array(n).fill(150);
  const waveform = new Float32Array(n).fill(0);

  const pct = calculatePercentFlicker(raw, waveform, 0, n);
  assert.strictEqual(pct, 0, 'DC light should report 0% flicker');
});

// ==========================================
// 5. IEEE 1789-2015 Classification
// ==========================================
test('classifyDriverQuality adheres to IEEE 1789-2015 boundaries', () => {
  // 1. Excellent (flicker < 3%)
  const exc = classifyDriverQuality(100, 1.8);
  assert.strictEqual(exc.quality, 'EXCELLENT (FLICKER-FREE)');
  assert.strictEqual(exc.ratingClass, 'rating-excellent');

  // 2. High Quality Safe (flicker <= NOEL = 100 * 0.033 = 3.3%)
  const hq = classifyDriverQuality(100, 3.2);
  assert.strictEqual(hq.quality, 'HIGH QUALITY (SAFE)');
  assert.strictEqual(hq.ratingClass, 'rating-excellent');

  // 3. Standard Quality Safe (flicker <= Low Risk = 100 * 0.08 = 8.0%)
  const sq = classifyDriverQuality(100, 7.5);
  assert.strictEqual(sq.quality, 'STANDARD QUALITY (SAFE)');
  assert.strictEqual(sq.ratingClass, 'rating-high-quality');

  // 4. Low Quality Moderate AC Ripple (100Hz, flicker <= 30%)
  const modAc = classifyDriverQuality(100, 18.0);
  assert.strictEqual(modAc.quality, 'LOW QUALITY (MODERATE AC RIPPLE)');
  assert.strictEqual(modAc.ratingClass, 'rating-low-quality');

  // 5. Low Quality High AC Ripple (100Hz, flicker > 30%)
  const highAc = classifyDriverQuality(100, 45.0);
  assert.strictEqual(highAc.quality, 'LOW QUALITY (HIGH AC RIPPLE)');
  assert.strictEqual(highAc.ratingClass, 'rating-hazard');

  // 6. Low-Frequency PWM (250Hz, flicker > 250 * 0.08 = 20%)
  const pwm = classifyDriverQuality(250, 35.0);
  assert.strictEqual(pwm.quality, 'LOW QUALITY (LOW-FREQ PWM)');
  assert.strictEqual(pwm.ratingClass, 'rating-hazard');

  // 7. 60Hz Low-Frequency Boundary (lowRisk = 60 * 0.025 = 1.5%)
  const halfWave = classifyDriverQuality(60, 2.5);
  assert.strictEqual(halfWave.quality, 'LOW QUALITY (UNSTABLE)');
});

console.log(`\nAll ${testsPassed} DSP unit tests passed successfully!\n`);
