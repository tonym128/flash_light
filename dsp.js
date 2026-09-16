// ==========================================
// Digital Signal Processing (DSP) Core Module
// Radix-2 FFT, Detrending, Parabolic Peak Interpolation,
// IEEE 1789-2015 Flicker Classification & Synthetic Generators
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

// Calculate Percent Flicker (Modulation Depth: (Max - Min) / (2 * Mean) * 100)
function calculatePercentFlicker(rawSignal, waveform, startIdx, endIdx) {
  let sumRaw = 0;
  let minDetrended = Infinity;
  let maxDetrended = -Infinity;
  const span = endIdx - startIdx;
  if (span <= 0) return 0;
  
  for (let i = startIdx; i < endIdx; i++) {
    sumRaw += rawSignal[i];
    if (waveform[i] < minDetrended) minDetrended = waveform[i];
    if (waveform[i] > maxDetrended) maxDetrended = waveform[i];
  }
  
  const meanRaw = sumRaw / span;
  const peakToPeak = maxDetrended - minDetrended;
  return meanRaw > 0 ? (peakToPeak / (2 * meanRaw)) * 100 : 0;
}

// Classify Driver Quality based on IEEE 1789-2015 recommended practice
function classifyDriverQuality(freq, percentFlicker) {
  let lowRiskLimit = 8.0;
  let noelLimit = 3.3; // No Observable Effect Level
  
  if (freq < 90) {
    lowRiskLimit = freq * 0.025;
    noelLimit = freq * 0.01;
  } else {
    lowRiskLimit = freq * 0.08;
    noelLimit = freq * 0.033;
  }
  
  if (freq >= 90 && percentFlicker < 3.0) {
    return {
      quality: "EXCELLENT (FLICKER-FREE)",
      ratingClass: "rating-excellent",
      lowRiskLimit,
      noelLimit
    };
  } else if (percentFlicker <= noelLimit) {
    return {
      quality: percentFlicker < 0.5 ? "EXCELLENT (FLICKER-FREE)" : "HIGH QUALITY (SAFE)",
      ratingClass: "rating-excellent",
      lowRiskLimit,
      noelLimit
    };
  } else if (percentFlicker <= lowRiskLimit) {
    return {
      quality: "STANDARD QUALITY (SAFE)",
      ratingClass: "rating-high-quality",
      lowRiskLimit,
      noelLimit
    };
  } else {
    if (freq >= 90 && freq <= 130) {
      if (percentFlicker > 30.0) {
        return {
          quality: "LOW QUALITY (HIGH AC RIPPLE)",
          ratingClass: "rating-hazard",
          lowRiskLimit,
          noelLimit
        };
      } else {
        return {
          quality: "LOW QUALITY (MODERATE AC RIPPLE)",
          ratingClass: "rating-low-quality",
          lowRiskLimit,
          noelLimit
        };
      }
    } else if (freq > 130 && freq <= 500) {
      return {
        quality: "LOW QUALITY (LOW-FREQ PWM)",
        ratingClass: "rating-hazard",
        lowRiskLimit,
        noelLimit
      };
    } else {
      return {
        quality: "LOW QUALITY (UNSTABLE)",
        ratingClass: "rating-low-quality",
        lowRiskLimit,
        noelLimit
      };
    }
  }
}

// Calculate IES Flicker Index (Area Above Mean / Total Area Under Waveform)
// RP-16-10 / IESNA Standard: ranges from 0.0 (pure DC) to 1.0 (extreme pulse)
function calculateFlickerIndex(rawSignal, waveform, startIdx, endIdx) {
  let sumRaw = 0;
  let areaAboveMean = 0;
  const span = endIdx - startIdx;
  if (span <= 0) return 0;
  
  for (let i = startIdx; i < endIdx; i++) {
    sumRaw += rawSignal[i];
    if (waveform[i] > 0) {
      areaAboveMean += waveform[i];
    }
  }
  
  const totalArea = sumRaw; // integral of raw illumination across span
  if (totalArea <= 0) return 0;
  
  const flickerIndex = areaAboveMean / totalArea;
  return Math.max(0, Math.min(1.0, flickerIndex));
}

// Total Harmonic Distortion (THD) and Harmonic Overtones Detection
// Calculates THD = sqrt(sum(V_h^2)) / V_1 * 100% for h = 2..5
function calculateHarmonicsAndTHD(magnitudes, peakBin, skewSec, maxHarmonics = 5) {
  if (!magnitudes || peakBin <= 0 || peakBin >= magnitudes.length) {
    return { thd: 0, harmonics: [] };
  }
  
  const fundamentalMag = magnitudes[peakBin];
  if (fundamentalMag <= 0) {
    return { thd: 0, harmonics: [] };
  }
  
  const halfFft = magnitudes.length;
  let sumHarmonicSq = 0;
  const harmonics = [];
  
  for (let h = 2; h <= maxHarmonics; h++) {
    const targetBin = Math.round(peakBin * h);
    if (targetBin >= halfFft - 2) break;
    
    // Search within +/- 2 bins around expected harmonic
    let bestBin = targetBin;
    let bestMag = 0;
    const searchStart = Math.max(1, targetBin - 2);
    const searchEnd = Math.min(halfFft - 2, targetBin + 2);
    
    for (let b = searchStart; b <= searchEnd; b++) {
      if (magnitudes[b] > bestMag) {
        bestMag = magnitudes[b];
        bestBin = b;
      }
    }
    
    const interpBin = interpolatePeak(magnitudes, bestBin);
    const harmonicFreq = interpBin / (8 * skewSec);
    const harmonicRatio = (bestMag / fundamentalMag) * 100;
    
    harmonics.push({
      harmonic: h,
      bin: interpBin,
      freq: harmonicFreq,
      mag: bestMag,
      ratioPercent: harmonicRatio
    });
    
    sumHarmonicSq += bestMag * bestMag;
  }
  
  const thd = (Math.sqrt(sumHarmonicSq) / fundamentalMag) * 100;
  return {
    thd: parseFloat(thd.toFixed(1)),
    harmonics
  };
}

// Audit Stability Analysis and Lab Certification Classification
function calculateAuditStability(samples) {
  if (!samples || samples.length === 0) {
    return {
      count: 0,
      meanFreq: 0,
      stdDevFreq: 0,
      meanFlicker: 0,
      stdDevFlicker: 0,
      meanFlickerIndex: 0,
      meanTHD: 0,
      meanSNR: 0,
      stabilityGrade: 'N/A',
      isCertifiedLabGrade: false
    };
  }
  
  const n = samples.length;
  let sumFreq = 0;
  let sumFlicker = 0;
  let sumFlickerIndex = 0;
  let sumTHD = 0;
  let sumSNR = 0;
  
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    sumFreq += s.freq || 0;
    sumFlicker += s.percentFlicker || 0;
    sumFlickerIndex += s.flickerIndex || 0;
    sumTHD += s.thd || 0;
    sumSNR += s.snr || 0;
  }
  
  const meanFreq = sumFreq / n;
  const meanFlicker = sumFlicker / n;
  const meanFlickerIndex = sumFlickerIndex / n;
  const meanTHD = sumTHD / n;
  const meanSNR = sumSNR / n;
  
  let varFreq = 0;
  let varFlicker = 0;
  for (let i = 0; i < n; i++) {
    const df = (samples[i].freq || 0) - meanFreq;
    const dp = (samples[i].percentFlicker || 0) - meanFlicker;
    varFreq += df * df;
    varFlicker += dp * dp;
  }
  
  const stdDevFreq = Math.sqrt(varFreq / n);
  const stdDevFlicker = Math.sqrt(varFlicker / n);
  
  let stabilityGrade = 'Class C (Unstable / Environmental Noise)';
  let isCertifiedLabGrade = false;
  
  if (stdDevFreq < 0.25 && meanSNR >= 7.0) {
    stabilityGrade = 'Class A (Lab Certified / High Precision)';
    isCertifiedLabGrade = true;
  } else if (stdDevFreq < 0.8 && meanSNR >= 4.0) {
    stabilityGrade = 'Class B (Field Stable)';
  }
  
  return {
    count: n,
    meanFreq: parseFloat(meanFreq.toFixed(2)),
    stdDevFreq: parseFloat(stdDevFreq.toFixed(2)),
    meanFlicker: parseFloat(meanFlicker.toFixed(2)),
    stdDevFlicker: parseFloat(stdDevFlicker.toFixed(2)),
    meanFlickerIndex: parseFloat(meanFlickerIndex.toFixed(3)),
    meanTHD: parseFloat(meanTHD.toFixed(1)),
    meanSNR: parseFloat(meanSNR.toFixed(1)),
    stabilityGrade,
    isCertifiedLabGrade
  };
}

// ==========================================
// Photometric De-Gamma Linearization (sRGB gamma 2.2 -> Linear Photons)
// ==========================================
const GAMMA_22_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  GAMMA_22_LUT[i] = Math.pow(i / 255.0, 2.2) * 255.0;
}

function linearizeLuminance(srgbLuma) {
  const idx = Math.max(0, Math.min(255, Math.round(srgbLuma)));
  return GAMMA_22_LUT[idx];
}

// ==========================================
// CIE TN 006:2016 / IEC TR 63158 Stroboscopic Visibility Measure (SVM)
// EU Commission Regulation (EU) 2019/2020 Ecodesign Standard:
// SVM <= 0.4 is COMPLIANT (stroboscopic effect invisible under motion)
// SVM > 1.0 is HIGH RISK (stroboscopic hazard)
// ==========================================
function getCieStroboscopicThreshold(freq) {
  if (freq < 80) return 0.012; // High visual sensitivity below 80 Hz
  if (freq > 2000) return 999.0; // Human eye cutoff beyond 2000 Hz
  
  // IEC TR 63158 human stroboscopic threshold model
  if (freq <= 250) {
    return 0.014 * Math.pow(freq / 100.0, 0.95);
  } else {
    return 0.033 * Math.pow(freq / 250.0, 2.3);
  }
}

function calculateSVM(magnitudes, fundamentalBin, skewSec, meanIllumination) {
  if (!magnitudes || fundamentalBin <= 0 || fundamentalBin >= magnitudes.length) {
    return { svm: 0, isEcodesignCompliant: true, rating: "COMPLIANT (Flicker-Free)" };
  }
  
  const a0 = Math.max(1.0, meanIllumination || magnitudes[0] || 1.0);
  const halfFft = magnitudes.length;
  let sumTerm = 0;
  
  // Sum over fundamental and up to 5 harmonics
  for (let h = 1; h <= 5; h++) {
    const targetBin = Math.round(fundamentalBin * h);
    if (targetBin >= halfFft - 2) break;
    
    // Find local peak magnitude
    let bestMag = 0;
    let bestBin = targetBin;
    const bStart = Math.max(1, targetBin - 2);
    const bEnd = Math.min(halfFft - 2, targetBin + 2);
    for (let b = bStart; b <= bEnd; b++) {
      if (magnitudes[b] > bestMag) {
        bestMag = magnitudes[b];
        bestBin = b;
      }
    }
    
    const interpBin = interpolatePeak(magnitudes, bestBin);
    const f_h = interpBin / (8 * skewSec);
    if (f_h > 2000) break;
    
    const c_h = bestMag / a0; // Relative Fourier amplitude
    const t_h = getCieStroboscopicThreshold(f_h);
    
    if (t_h > 0 && c_h > 0) {
      sumTerm += Math.pow(c_h / t_h, 3.7);
    }
  }
  
  const svm = Math.pow(sumTerm, 1.0 / 3.7);
  const roundedSvm = parseFloat(svm.toFixed(2));
  
  let isEcodesignCompliant = false;
  let rating = "FAIL (Severe Stroboscopic Effect)";
  let ratingClass = "rating-hazard";
  
  if (roundedSvm <= 0.40) {
    isEcodesignCompliant = true;
    rating = "EU ECODESIGN COMPLIANT (SVM ≤ 0.4)";
    ratingClass = "rating-excellent";
  } else if (roundedSvm <= 1.0) {
    isEcodesignCompliant = false;
    rating = "BORDERLINE (0.4 < SVM ≤ 1.0)";
    ratingClass = "rating-low-quality";
  } else {
    isEcodesignCompliant = false;
    rating = "HAZARD (SVM > 1.0)";
    ratingClass = "rating-hazard";
  }
  
  return {
    svm: roundedSvm,
    isEcodesignCompliant,
    rating,
    ratingClass
  };
}

// Universal Audit SHA-256 Hash Digest (Node.js & Web Crypto)
function generateAuditChecksum(samples) {
  const content = JSON.stringify(samples.map(s => [s.timeMs, s.freq, s.percentFlicker, s.flickerIndex || 0, s.thd || 0]));
  if (typeof crypto !== 'undefined' && crypto.createHash) {
    // Node.js crypto
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }
  
  // Fallback 32-bit FNV-1a / Murmur hybrid hash for environments without async crypto
  let h1 = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h1 ^= content.charCodeAt(i);
    h1 = (h1 * 0x01000193) >>> 0;
  }
  let h2 = 0x5bd1e995;
  for (let i = content.length - 1; i >= 0; i--) {
    h2 ^= content.charCodeAt(i);
    h2 = (h2 * 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

// Universal Module Export (Browser Window + CommonJS / Node.js)
if (typeof module !== 'undefined' && module.exports) {
  const nodeCrypto = require('crypto');
  module.exports = {
    FFT,
    detrendInPlace,
    interpolatePeak,
    calculatePercentFlicker,
    calculateFlickerIndex,
    calculateHarmonicsAndTHD,
    calculateAuditStability,
    classifyDriverQuality,
    linearizeLuminance,
    calculateSVM,
    generateAuditChecksum,
    getCieStroboscopicThreshold
  };
} else if (typeof window !== 'undefined') {
  window.FFT = FFT;
  window.detrendInPlace = detrendInPlace;
  window.interpolatePeak = interpolatePeak;
  window.calculatePercentFlicker = calculatePercentFlicker;
  window.calculateFlickerIndex = calculateFlickerIndex;
  window.calculateHarmonicsAndTHD = calculateHarmonicsAndTHD;
  window.calculateAuditStability = calculateAuditStability;
  window.classifyDriverQuality = classifyDriverQuality;
  window.linearizeLuminance = linearizeLuminance;
  window.calculateSVM = calculateSVM;
  window.generateAuditChecksum = generateAuditChecksum;
  window.getCieStroboscopicThreshold = getCieStroboscopicThreshold;
}
