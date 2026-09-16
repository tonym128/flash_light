# Production HTTPS Deployment Guide

Modern Android browsers (Chrome, Edge, Firefox, Brave) strictly mandate a **secure origin (HTTPS or localhost)** to access `navigator.mediaDevices.getUserMedia` and camera sensor streams. While local self-signed certificates trigger security warnings on mobile devices, deploying **FlashyLight** to a free production host yields instant, zero-configuration HTTPS with valid CA certificates.

---

## 🚀 Option 1: Cloudflare Pages (Recommended - 100% Free & Unlimited Bandwidth)

Cloudflare Pages provides global edge distribution with instant SSL and custom headers support.

### Method A: Git-Connected (Automated Deployments)
1. Push your repository to GitHub or GitLab.
2. Open the [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Select your repository: `flashy_light`.
4. Configure build settings:
   - **Framework preset**: None
   - **Build command**: *(Leave blank)*
   - **Build output directory**: `.` (root directory)
5. Click **Save and Deploy**.
6. Cloudflare automatically recognizes [`_headers`](file:///home/tonym/Projects/flashy_light/_headers) for camera `Permissions-Policy` and Service Worker cache rules.
7. Your app is immediately live at `https://<project-name>.pages.dev`.

### Method B: Cloudflare Wrangler CLI (Direct Upload)
```bash
# Install Wrangler globally or use npx
npm install -g wrangler

# Deploy current directory directly to Cloudflare Pages
wrangler pages deploy . --project-name flashy-light
```

---

## ⚡ Option 2: Vercel (1-Click Deployment)

FlashyLight includes [`vercel.json`](file:///home/tonym/Projects/flashy_light/vercel.json) with pre-configured camera headers and PWA caching rules.

### Method A: Vercel Dashboard
1. Go to [vercel.com/new](https://vercel.com/new).
2. Import your GitHub repository.
3. Keep default settings (root directory `.`, no build command).
4. Click **Deploy**.
5. Your application is live at `https://<project-name>.vercel.app`.

### Method B: Vercel CLI
```bash
# Deploy with Vercel CLI
npx vercel --prod
```

---

## 🌐 Option 3: GitHub Pages

1. In your GitHub repository, go to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
3. Select the `master` (or `main`) branch and `/ (root)` folder.
4. Click **Save**.
5. GitHub Pages will build and serve your app over HTTPS at `https://<username>.github.io/<repo-name>/`.

---

## 📱 Installing on Android

1. Open your deployed HTTPS URL in **Google Chrome for Android**.
2. Tap **Allow** when prompted for Camera permissions.
3. Tap the browser menu (`⋮`) and select **Add to Home screen** (or tap the **Install App** banner).
4. FlashyLight installs as a standalone Android application with full rolling shutter diagnostic capabilities and offline caching!
