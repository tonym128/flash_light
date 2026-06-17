# FlickerHz - Light Bulb Frequency Detector

FlickerHz is a browser-based, high-performance Progressive Web App (PWA) that measures the flicker frequency (in Hz) of light bulbs, screens, and LED lights using a standard smartphone camera. 

Rather than relying on low-frequency ambient light sensors, FlickerHz exploits the **rolling shutter effect** of CMOS sensors (which maps temporal fluctuations onto spatial bands) and applies real-time digital signal processing (DSP) to calculate the oscillation frequency.

---

## ✨ Features

- **Real-Time Frequency Measurement**: High-precision readout in Hz.
- **Auto-Detect Scan Axis**: Automatically detects whether the rolling shutter lines run horizontally or vertically and locks onto the axis with the highest Signal-to-Noise Ratio (SNR).
- **Interactive Oscilloscope**: Real-time canvas chart displaying the detrended light waveform.
- **FFT Spectrum Analyzer**: Displays the frequency spectrum up to 500 Hz, with a peak indicator and live frequency labels.
- **Self-Guided Calibration Wizard**: Point your camera at a known 100 Hz / 120 Hz AC light source to calibrate your specific phone's rolling shutter readout skew.
- **PWA Installation**: Install on your Android home screen and run fully offline (no Google Play Store required).
- **Secure Local Dev Server**: Includes a custom HTTPS Node.js server that dynamically generates self-signed certificates so mobile devices can access camera streams (`getUserMedia`) over your local network.

---

## 🚀 How to Install and Run

### 1. Start the Local Server
FlickerHz uses a secure server to provide the secure context (HTTPS) required for mobile camera access.

```bash
# Clone or navigate to the directory
cd flashy_light

# Install dependencies (none needed - pure vanilla CSS/HTML/JS!)
# Start the server
npm run dev
```

The server will automatically generate `key.pem` and `cert.pem` and begin listening on:
- **PC Access**: `https://localhost:8443`
- **Mobile Network Access**: `https://<YOUR-PC-IP>:8443` (e.g. `https://192.168.1.146:8443`)

---

## 📱 How to Use the PWA on Android

1. **Connect to Wi-Fi**: Ensure your Android phone is connected to the same Wi-Fi network as your PC.
2. **Open URL**: Open Chrome on your phone and navigate to the mobile network address shown in your PC console (e.g. `https://192.168.1.146:8443`).
3. **Bypass Certificate Warning**:
   - Because the SSL certificate is self-signed for local development, Chrome will show a "Your connection is not private" warning.
   - Tap **Advanced** (at the bottom).
   - Tap **Proceed to <your-ip> (unsafe)**.
4. **Install App**: Tap the Chrome menu button (three vertical dots) and select **Add to Home Screen** or **Install App**.
5. **Open Standalone**: Exit Chrome and open **FlickerHz** from your app drawer. It will run in standalone fullscreen mode and works completely offline!

---

## 🎯 Tips for Best Measurements

- **Exposure Control**: To get clear bands, the camera's shutter speed must be fast (under 1ms). The easiest way to force this is to point your phone's camera **directly at the bright core of the light bulb**. This causes the auto-exposure to speed up the shutter speed, creating sharp, high-contrast bands.
- **Hold Steady**: Hand movements introduce low-frequency noise. Keep the phone still or rest it on a surface.
- **Perform Calibration**: Every phone sensor has a different line readout speed (rolling shutter skew). Open the **Auto Calibrate** menu, select your country's power grid frequency (50Hz grid = 100Hz flicker; 60Hz grid = 120Hz flicker), point at a standard AC non-dimmed bulb, and capture. This saves your sensor's exact profile to `localStorage`.

---

## 🔬 How It Works (The Science)

### Rolling Shutter Scanning
Most mobile CMOS sensors scan pixels line-by-line (top to bottom). The time offset between lines translates temporal light flicker into spatial bands. 
If $T_{\text{skew}}$ is the total readout time for one frame:
$$\text{Flicker Frequency (Hz)} = \frac{\text{Number of Cycles in Frame}}{T_{\text{skew}}}$$

### DSP Pipeline (in `app.js`)
1. **Luminance Extraction**: Averages columns/rows to form a 1D signal of length 512.
2. **Detrending**: A running average filter removes slow brightness gradients (hand shake, vignetting).
3. **Hanning Window**: Tapers the edges to eliminate spectral leakage.
4. **Zero-Padding**: Pads the 512-point signal to 4096 points to interpolate the spectrum in the frequency domain.
5. **FFT**: Runs a Cooley-Tukey Radix-2 FFT.
6. **Parabolic Interpolation**: Fits a quadratic curve to the peak bin and its neighbors:
   $$d = \frac{1}{2} \frac{\alpha - \gamma}{\alpha - 2\beta + \gamma}$$
   $$\text{Interpolated Bin} = p + d$$
   This gives a frequency resolution of $<0.1\text{ Hz}$.
