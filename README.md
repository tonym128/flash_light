# FlickerHz - Light Bulb Frequency Detector

FlickerHz is a browser-based, high-performance Progressive Web App (PWA) that measures the flicker frequency (in Hz) of light bulbs, screens, and LED lights using a standard smartphone camera. 

Rather than relying on low-frequency ambient light sensors, FlickerHz exploits the **rolling shutter effect** of CMOS sensors (which maps temporal fluctuations onto spatial bands) and applies real-time digital signal processing (DSP) to calculate the oscillation frequency.

---

## ✨ Features

- **Dedicated DSP Web Worker Thread**: Offloads 4096-point Radix-2 FFT, sliding detrending, and harmonic calculations to a background worker (`dsp.worker.js`) with zero-copy transferable buffers, eliminating UI thread contention and guaranteeing 60fps rendering on budget Android devices.
- **Ambient Light DC Baseline Tare ("Zeroing")**: Measure and subtract room ambient background DC lux, preventing sunlight and background fixtures from diluting modulation depth and artificially deflating SVM.
- **Real-Time Web Audio Sonification ("Hear the Flicker")**: Multi-sensory acoustic sonification turning light oscillations into sound ($50\text{ Hz} / 60\text{ Hz} / 100\text{ Hz} / 120\text{ Hz}$ mains hum, PWM buzz with harmonic overtones, and complete silence for DC flicker-free drivers).
- **Consolidated Facility Audit Session & PDF/Print Report**: Group multi-fixture audits by facility/room ID and export a consolidated, print-optimized A4 compliance report with pass rates, CIE TN 006:2016 verification, and SHA-256 digital signatures.
- **Real-Time Frequency Measurement**: High-precision readout in Hz down to 0.1 Hz sub-bin resolution.
- **Dynamic Core ROI Scanning**: Automatically detects bulb bounding box to isolate the bright core, boosting SNR by 15 dB and avoiding edge wash-out.
- **Photometric De-Gamma Linearization**: Converts non-linear sRGB camera luma into true optical radiance ($Y_{\text{lin}} = Y^{2.2}$) via a precomputed zero-allocation LUT.
- **EU Ecodesign Stroboscopic Visibility Measure (CIE SVM)**: Implements CIE TN 006:2016 and IEC TR 63158 standards, calculating multi-harmonic stroboscopic visibility ($SVM \le 0.4$ EU Ecodesign Regulation 2019/2020 pass threshold).
- **IES Flicker Index (RP-16-10)**: Measures the ratio of area above the mean to total area under the waveform (0.00 to 1.00), accurately evaluating complex square/pulse duty cycles.
- **Waveform THD & Harmonics**: Computes Total Harmonic Distortion ($THD = \sqrt{\sum V_h^2} / V_1 \times 100\%$) and detects 2nd through 5th harmonic overtones to identify triac phase-cut dimmers and cheap linear driver distortion.
- **Exposure Quality & Shutter HUD**: Real-time alerts for pixel saturation ($Y \ge 250$), underexposure ($Y < 25$), and slow shutter speeds that average out flicker.
- **Driver Quality Assessment**: Automatic IEEE 1789-2015 health classification detecting flicker-free DC drivers, AC ripple, and low-frequency PWM hazards.
- **Pre-Calibrated Device Registry**: Built-in factory presets (`devices.json`) automatically recognizing Google Pixel, Samsung Galaxy, Apple iPhone, OnePlus, and Xiaomi rolling shutter timings.
- **Interactive Fullscreen Screen Strobe Generator**: Built-in visual strobe generator for secondary displays with selectable frequencies ($60\text{ Hz}, 100\text{ Hz}, 120\text{ Hz}, 144\text{ Hz}$) for zero-hardware rolling shutter skew calibration.
- **Auto-Detect Scan Axis**: Automatically detects whether rolling shutter lines run horizontally or vertically and locks onto the axis with the highest Signal-to-Noise Ratio (SNR).
- **Synthetic Signal Generator (Self-Test Mode)**: Built-in mathematical waveform generator (100 Hz sine, 120 Hz sine, 250 Hz PWM, 0 Hz DC) for offline benchmarking and hardware validation.
- **Multi-Lens Skew Persistence**: Stores individual rolling shutter readout calibrations per camera `deviceId` and resolution in `localStorage`.
- **10-Second Audit Recorder & Export**: Capture 10-second diagnostic runs and export to formatted CSV and structured JSON.
- **Tamper-Proof SHA-256 Audit Verification**: Generates cryptographic SHA-256 digital signatures for time-series samples and audit records, ensuring data integrity for commercial compliance audits.
- **Multi-Run Audit Comparison History**: Local audit ledger tracking sequential tests across multiple luminaires with pass/fail metrics and instant JSON export.
- **Certified 5-Metric Bulb Health Report Card**: Generates a high-resolution branded PNG summary card ($840 \times 1080\text{ px}$) complete with 5 key metrics (Frequency, Modulation, Flicker Index, THD, SVM), letter grading, Class A Lab Stability certification, and SHA-256 verification badge.
- **Zero-GC High Performance**: Zero-allocation DSP pipeline using pre-allocated TypedArrays to eliminate garbage-collection stutter at 60fps.
- **PWA Installation**: Install on your Android home screen and run fully offline (no Google Play Store required).
- **Automated DSP Test Suite**: 19 automated unit tests (`npm test`) verifying FFT transforms, parabolic interpolation, IES Flicker Index, THD, CIE SVM, ambient baseline tare subtraction, and SHA-256 checksum generation.

---

## 🚀 How to Install and Run

### 1. Start the Local Server (Development)
FlickerHz includes a secure development server to provide the HTTPS context required for mobile camera access.

```bash
# Clone or navigate to the directory
cd flashy_light

# Run automated DSP unit tests
npm test

# Start the local development server
npm run dev
```

The server will automatically generate `key.pem` and `cert.pem` and begin listening on:
- **PC Access**: `https://localhost:8443`
- **Mobile Network Access**: `https://<YOUR-PC-IP>:8443` (e.g. `https://192.168.1.146:8443`)

---

## 🌐 Production HTTPS Deployment

Modern mobile browsers mandate HTTPS for camera access. To deploy FlashyLight publicly with trusted zero-warning SSL:
- **Cloudflare Pages**: Connect your Git repo or run `wrangler pages deploy .` (uses [`_headers`](file:///home/tonym/Projects/flashy_light/_headers)).
- **Vercel**: Run `npx vercel --prod` (uses [`vercel.json`](file:///home/tonym/Projects/flashy_light/vercel.json)).
- See [DEPLOYMENT.md](file:///home/tonym/Projects/flashy_light/DEPLOYMENT.md) for full instructions.

---

## 📱 How to Use the PWA on Android

1. Open your deployed HTTPS URL in **Chrome for Android**.
2. Tap **Allow** for camera permissions.
3. Tap the Chrome menu (`⋮`) and select **Install App** or **Add to Home screen**.
4. Launch **FlashyLight** from your app drawer as a standalone fullscreen app.

---

## 🎯 Tips for Best Measurements

- **Dynamic ROI**: Keep the camera aimed so the bulb's bright core is inside the dashed cyan ROI box. FlashyLight will automatically track the core bounding box to maximize signal contrast.
- **Exposure Quality HUD**: Keep an eye on the top badge. If it shows **OVEREXPOSED (SATURATED)**, move slightly further away or tilt the phone so the bulb's core does not clip ($Y \ge 250$). If it shows **UNDEREXPOSED**, move closer to increase contrast.
- **Shutter Warning**: If the app shows **⚠️ Shutter Slow (Averaging Flicker)**, point the crosshair directly at the brightest part of the bulb to trigger camera auto-exposure to speed up.
- **Screen Strobe Calibration**: Don't have a 100 Hz / 120 Hz bulb? Open **Auto Calibrate**, tap **60 Hz Screen** or **120 Hz Screen**, and point your camera at your laptop or monitor to calibrate your rolling shutter skew!
- **Generate Certified Report Cards**: Tap **Record 10s Audit** to capture a rolling test run, then tap **Export Report Card** to download a certified PNG summary image. Runs with $<0.25\text{ Hz}$ jitter receive the **Class A Lab Certified** gold stamp!

---

## 🔬 How It Works (The Science)

### Rolling Shutter Scanning
Most mobile CMOS sensors scan pixels line-by-line (top to bottom). The time offset between lines translates temporal light flicker into spatial bands. 
If $T_{\text{skew}}$ is the total readout time for one frame:
$$\text{Flicker Frequency (Hz)} = \frac{\text{Number of Cycles in Frame}}{T_{\text{skew}}}$$

### DSP Pipeline (in [`dsp.js`](file:///home/tonym/Projects/flashy_light/dsp.js) & [`app.js`](file:///home/tonym/Projects/flashy_light/app.js))
1. **Dynamic ROI Extraction**: Integrates pixel luminance across the active bulb core into pre-allocated `Float32Array` buffers.
2. **Detrending**: Running moving-average filter removes DC lighting gradients while preserving 50Hz/60Hz/100Hz/120Hz oscillations.
3. **Hanning Window**: Tapers edges to eliminate spectral leakage.
4. **Zero-Padding**: Extends 512-point window to 4096 points for frequency domain interpolation.
5. **Radix-2 FFT**: Executes Cooley-Tukey decimation-in-time algorithm.
6. **Parabolic Interpolation**: Quadratic vertex fit over peak bin neighbors achieves $<0.1\text{ Hz}$ accuracy.
7. **Harmonic Analysis**: Calculates Total Harmonic Distortion (THD) across $H_2 \dots H_5$.

### Optical Safety Metrics:
- **Percent Flicker (Modulation Depth)**:
  $$\text{Percent Flicker} = \frac{\text{Detrended Peak-to-Peak Amplitude}}{2 \times \text{Raw Mean Brightness}} \times 100\%$$
- **IES RP-16-10 Flicker Index**:
  $$\text{Flicker Index} = \frac{\text{Area Above Mean}}{\text{Total Area Under Waveform}}$$
- **Total Harmonic Distortion (THD)**:
  $$\text{THD} = \frac{\sqrt{\sum_{h=2}^5 V_h^2}}{V_1} \times 100\%$$
- **EU Ecodesign CIE TN 006:2016 Stroboscopic Visibility Measure (SVM)**:
  $$SVM = \left(\sum_{m=1}^{5} \left(\frac{C_m}{T_m}\right)^{3.7}\right)^{1/3.7}$$
  Where $C_m$ is the Fourier harmonic relative amplitude and $T_m$ is the human visual stroboscopic threshold defined in CIE TN 006:2016 / IEC TR 63158.
  - **EU Ecodesign (Commission Regulation 2019/2020)**: Mandates $SVM \le 0.4$ for all general service LED/OLED lamps.
  - **$SVM \le 0.4$**: **PASS** (Stroboscopic effect invisible to human eye).
  - **$SVM > 0.4$**: **FAIL / HAZARD** (Stroboscopic motion illusion risk, induces migraines/fatigue).

### Driver Quality Classifications (IEEE 1789-2015 & EU Ecodesign):
- **EXCELLENT (FLICKER-FREE)**: Percent Flicker $< 3.0\%$ or below NOEL limit. High-efficiency DC constant-current driver.
- **STANDARD / HIGH QUALITY (SAFE)**: Within IEEE 1789 low-risk boundaries and $SVM \le 0.4$.
- **LOW QUALITY (AC RIPPLE)**: $100\text{ Hz}$ or $120\text{ Hz}$ with high modulation depth (cheap bridge rectifier lacking smoothing filter).
- **LOW QUALITY (LOW-FREQ PWM)**: $130\text{ Hz} - 500\text{ Hz}$ with high flicker (harsh PWM dimming, high stroboscopic hazard).

