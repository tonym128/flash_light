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

// Universal Module Export (Browser Window + CommonJS / Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FFT,
    detrendInPlace,
    interpolatePeak,
    calculatePercentFlicker,
    classifyDriverQuality
  };
} else if (typeof window !== 'undefined') {
  window.FFT = FFT;
  window.detrendInPlace = detrendInPlace;
  window.interpolatePeak = interpolatePeak;
  window.calculatePercentFlicker = calculatePercentFlicker;
  window.classifyDriverQuality = classifyDriverQuality;
}
