# FlickerHz - Light Bulb Frequency Detector

FlickerHz is a browser-based, high-performance Progressive Web App (PWA) that measures the flicker frequency (in Hz) of light bulbs, screens, and LED lights using a standard smartphone camera. 

Rather than relying on low-frequency ambient light sensors, FlickerHz exploits the **rolling shutter effect** of CMOS sensors (which maps temporal fluctuations onto spatial bands) and applies real-time digital signal processing (DSP) to calculate the oscillation frequency.

---

## ✨ Features

- **Real-Time Frequency Measurement**: High-precision readout in Hz down to 0.1 Hz sub-bin resolution.
- **Exposure Quality HUD**: Live pixel-level saturation ($Y \ge 250$) and underexposure ($Y < 25$) indicator alerting when clipping or darkness degrades band visibility.
- **Driver Quality Assessment**: Automatic IEEE 1789-2015 health classification detecting flicker-free DC drivers, AC ripple, and low-frequency PWM hazards.
- **Auto-Detect Scan Axis**: Automatically detects whether rolling shutter lines run horizontally or vertically and locks onto the axis with the highest Signal-to-Noise Ratio (SNR).
- **Synthetic Signal Generator (Self-Test Mode)**: Built-in mathematical waveform generator (100 Hz sine, 120 Hz sine, 250 Hz PWM, 0 Hz DC) for offline benchmarking and hardware validation.
- **Multi-Lens Skew Persistence**: Stores individual rolling shutter readout calibrations per camera `deviceId` and resolution in `localStorage`.
- **10-Second Audit Recorder & Export**: Capture 10-second diagnostic runs and export to formatted CSV and structured JSON.
- **Shareable Bulb Health Report Card**: Generates a high-resolution branded PNG summary card with letter grading, modulation depth, and IEEE 1789 compliance.
- **Zero-GC High Performance**: Zero-allocation DSP pipeline using pre-allocated TypedArrays to eliminate garbage-collection stutter at 60fps.
- **PWA Installation**: Install on your Android home screen and run fully offline (no Google Play Store required).
- **Automated DSP Test Suite**: Run `npm test` to verify FFT transforms, parabolic interpolation, and IEEE 1789 classifications.

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

- **Exposure Quality HUD**: Keep an eye on the top badge. If it shows **OVEREXPOSED (SATURATED)**, move slightly further away or tilt the phone so the bulb's core does not clip ($Y \ge 250$). If it shows **UNDEREXPOSED**, move closer to increase contrast.
- **Camera Selection**: FlashyLight automatically requests manual exposure time minimization (<1ms) and continuous focus lock where supported by the Android camera HAL.
- **Multi-Camera Profiles**: Switching between wide, ultra-wide, and telephoto lenses automatically loads each lens's unique saved rolling shutter skew.
- **Generate Report Cards**: Tap **Record 10s Audit** to capture a rolling test run, then tap **Export Report Card** to download a certified PNG summary image.

---

## 🔬 How It Works (The Science)

### Rolling Shutter Scanning
Most mobile CMOS sensors scan pixels line-by-line (top to bottom). The time offset between lines translates temporal light flicker into spatial bands. 
If $T_{\text{skew}}$ is the total readout time for one frame:
$$\text{Flicker Frequency (Hz)} = \frac{\text{Number of Cycles in Frame}}{T_{\text{skew}}}$$

### DSP Pipeline (in [`dsp.js`](file:///home/tonym/Projects/flashy_light/dsp.js) & [`app.js`](file:///home/tonym/Projects/flashy_light/app.js))
1. **Luminance Extraction**: Averages columns/rows into pre-allocated `Float32Array` buffers.
2. **Detrending**: Running moving-average filter removes DC lighting gradients while preserving 50Hz/60Hz/100Hz/120Hz oscillations.
3. **Hanning Window**: Tapers edges to eliminate spectral leakage.
4. **Zero-Padding**: Extends 512-point window to 4096 points for frequency domain interpolation.
5. **Radix-2 FFT**: Executes Cooley-Tukey decimation-in-time algorithm.
6. **Parabolic Interpolation**: Quadratic vertex fit over peak bin neighbors achieves $<0.1\text{ Hz}$ accuracy.

### Driver Quality & IEEE 1789-2015 Assessment
The app computes **Percent Flicker (Modulation Depth)**:
$$\text{Percent Flicker} = \frac{\text{Detrended Peak-to-Peak Amplitude}}{2 \times \text{Raw Mean Brightness}} \times 100\%$$

Classified according to IEEE 1789-2015:
- **EXCELLENT (FLICKER-FREE)**: Percent Flicker $< 3.0\%$ or below NOEL limit. Constant-current DC driver.
- **STANDARD / HIGH QUALITY (SAFE)**: Within IEEE 1789 low-risk boundaries.
- **LOW QUALITY (AC RIPPLE)**: $100\text{ Hz}$ or $120\text{ Hz}$ with high modulation depth (insufficient capacitor filtering).
- **LOW QUALITY (LOW-FREQ PWM)**: $130\text{ Hz} - 500\text{ Hz}$ with high flicker (cheap PWM dimmers with stroboscopic hazards).

