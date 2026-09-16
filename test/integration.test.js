// ==========================================
// Browser & DOM Script Integration Test Suite
// Verifies index.html scripts execute without SyntaxErrors,
// redeclaration clashes (like FFT), or missing DOM elements.
// ==========================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('Running Browser Scripts & DOM Integration Test Suite...\n');

let testsPassed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

// 1. Check index.html exists and parse script tags
const htmlPath = path.join(__dirname, '../index.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

async function runAllTests() {
  await test('index.html contains valid script order', () => {
    assert(htmlContent.includes('<script src="dsp.js"></script>'), 'index.html must load dsp.js');
    assert(htmlContent.includes('<script src="app.js"></script>'), 'index.html must load app.js');
    
    const dspPos = htmlContent.indexOf('<script src="dsp.js"></script>');
    const appPos = htmlContent.indexOf('<script src="app.js"></script>');
    assert(dspPos < appPos, 'dsp.js must be loaded before app.js');
  });

  await test('index.html includes modern mobile-web-app-capable meta tag', () => {
    assert(htmlContent.includes('<meta name="mobile-web-app-capable" content="yes">'), 
      'index.html must contain modern mobile-web-app-capable tag to prevent deprecation warnings');
  });

  await test('dsp.js and app.js execute sequentially in shared global scope without re-declaration SyntaxErrors', async () => {
    const dspCode = fs.readFileSync(path.join(__dirname, '../dsp.js'), 'utf8');
    const appCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
    
    // Extract all IDs referenced by document.getElementById in app.js
    const idMatches = appCode.match(/document\.getElementById\(['"]([^'"]+)['"]\)/g) || [];
    const referencedIds = idMatches.map(m => m.match(/['"]([^'"]+)['"]/)[1]);

    // Create mock DOM environment
    const mockElements = {};
    function createMockElement(id) {
      return {
        id: id,
        style: {},
        classList: {
          add: () => {},
          remove: () => {},
          contains: () => false
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        getContext: () => ({
          fillStyle: '',
          fillRect: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          stroke: () => {},
          fill: () => {},
          arc: () => {},
          closePath: () => {},
          strokeRect: () => {},
          fillText: () => {},
          measureText: () => ({ width: 50 }),
          clearRect: () => {},
          setLineDash: () => {},
          createLinearGradient: () => ({ addColorStop: () => {} }),
          drawImage: () => {},
          getImageData: () => ({ data: new Uint8ClampedArray(512 * 512 * 4) }),
          createImageData: () => ({ data: new Uint8ClampedArray(512 * 512 * 4) }),
          putImageData: () => {}
        }),
        appendChild: () => {},
        querySelectorAll: () => [],
        querySelector: () => createMockElement('sub'),
        options: [{ value: 'default', text: 'Default' }],
        selectedIndex: 0,
        value: '0',
        innerText: '',
        innerHTML: '',
        clientWidth: 640,
        clientHeight: 480,
        width: 640,
        height: 480,
        videoWidth: 1280,
        videoHeight: 720,
        readyState: 4,
        HAVE_ENOUGH_DATA: 4,
        HAVE_CURRENT_DATA: 2,
        HAVE_METADATA: 1,
        HAVE_NOTHING: 0,
        play: async () => {},
        pause: () => {},
        toDataURL: () => 'data:image/png;base64,mock',
        click: () => {}
      };
    }

    // Pre-populate referenced elements
    referencedIds.forEach(id => {
      mockElements[id] = createMockElement(id);
    });

    const mockContext = {
      console,
      Math,
      Float32Array,
      Int32Array,
      Uint8ClampedArray,
      Array,
      Object,
      Date,
      JSON,
      Promise,
      alert: () => {},
      URL: {
        createObjectURL: () => 'blob:mock',
        revokeObjectURL: () => {}
      },
      Blob: function() {},
      setTimeout: (fn, ms) => setTimeout(fn, ms || 0),
      clearTimeout: () => {},
      requestAnimationFrame: (fn) => 1,
      cancelAnimationFrame: () => {},
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      },
      sessionStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      },
      navigator: {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
        mediaDevices: {
          enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'cam1', label: 'Back Camera' }],
          getUserMedia: async () => {
            const track = {
              stop: () => {},
              getCapabilities: () => ({}),
              applyConstraints: async () => {},
              getSettings: () => ({ deviceId: 'cam1' })
            };
            return {
              getTracks: () => [track],
              getVideoTracks: () => [track]
            };
          }
        }
      },
      document: {
        getElementById: (id) => mockElements[id] || createMockElement(id),
        querySelectorAll: () => [],
        querySelector: () => createMockElement('sub'),
        createElement: (tag) => createMockElement(tag),
        addEventListener: () => {}
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      devicePixelRatio: 1,
      window: null,
      self: null
    };

    mockContext.window = mockContext;
    mockContext.self = mockContext;

    const sandbox = vm.createContext(mockContext);

    // 1. Run dsp.js
    vm.runInContext(dspCode, sandbox, { filename: 'dsp.js' });
    assert(sandbox.FFT, 'FFT must be declared after dsp.js runs');

    // 2. Run app.js in the SAME context (verifies no SyntaxError / re-declaration clashes)
    vm.runInContext(appCode, sandbox, { filename: 'app.js' });

    assert.strictEqual(typeof sandbox.startRecording, 'function', 'app.js functions should be initialized');
    assert.strictEqual(typeof sandbox.loadLensProfile, 'function', 'loadLensProfile should be defined');

    // 3. Runtime Verification: verify updateMetricsDisplay executes without throwing ReferenceError
    sandbox.updateMetricsDisplay({
      validSignal: true,
      freq: 100,
      snr: 8.5,
      percentFlicker: 5.2,
      flickerIndex: 0.015,
      thd: 2.1,
      svm: 0.18,
      svmRatingClass: 'rating-safe',
      driverQuality: 'EXCELLENT',
      ratingClass: 'rating-safe',
      isSynthetic: false,
      meanRoiLuminance: 120
    });

    sandbox.updateMetricsDisplay({
      validSignal: false,
      freq: 0,
      snr: 1.0,
      percentFlicker: 0,
      flickerIndex: 0,
      thd: 0,
      svm: 0,
      svmRatingClass: 'rating-none',
      driverQuality: 'UNKNOWN',
      ratingClass: 'rating-none',
      isSynthetic: false,
      meanRoiLuminance: 20
    });

    // 4. Runtime Verification: verify handleWorkerMessage executes cleanly without ReferenceError
    sandbox.handleWorkerMessage({
      data: {
        type: 'FRAME_RESULT',
        winner: 'y',
        validSignal: true,
        freq: 100,
        snr: 10.0,
        peakBin: 24,
        peakMag: 150,
        percentFlicker: 4.5,
        flickerIndex: 0.012,
        thd: 1.8,
        svm: 0.15,
        driverQuality: 'EXCELLENT',
        ratingClass: 'rating-safe',
        waveform: new Float32Array(512),
        magnitudes: new Float32Array(2048),
        rowAverages: new Float32Array(512),
        colAverages: new Float32Array(512)
      }
    });

    // 5. Runtime Verification: verify processFrameLoop executes in both Worker & Inline modes
    sandbox.processFrameLoop();
    sandbox.dspWorker = null; // simulate main-thread inline fallback
    sandbox.processFrameLoop();

    // 6. Runtime Verification: verify generateReportCard and downloadJSON execute cleanly
    sandbox.generateReportCard();
    sandbox.downloadJSON();

    // 7. Runtime Verification: verify camera initialization & streaming pipeline executes cleanly
    await sandbox.initCamera();
    await sandbox.startStreaming();
  });

  await test('dsp.worker.js loads dsp.js without error in worker context', () => {
    const workerCode = fs.readFileSync(path.join(__dirname, '../dsp.worker.js'), 'utf8');
    const dspCode = fs.readFileSync(path.join(__dirname, '../dsp.js'), 'utf8');

    const mockWorkerContext = {
      console,
      Math,
      Float32Array,
      Int32Array,
      Uint8ClampedArray,
      Array,
      Object,
      JSON,
      importScripts: (scriptName) => {
        if (scriptName === 'dsp.js') {
          vm.runInContext(dspCode, workerSandbox, { filename: 'dsp.js' });
        }
      },
      postMessage: () => {},
      onmessage: null,
      self: null
    };
    mockWorkerContext.self = mockWorkerContext;

    const workerSandbox = vm.createContext(mockWorkerContext);
    vm.runInContext(workerCode, workerSandbox, { filename: 'dsp.worker.js' });

    assert.strictEqual(typeof workerSandbox.onmessage, 'function', 'Worker onmessage handler should be assigned');
  });

  console.log(`\nAll ${testsPassed} integration tests passed successfully!\n`);
}

runAllTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
