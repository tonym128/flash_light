const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PORT = 8443;
const HTTP_PORT = 8080;

// Ensure SSL certs exist
const keyPath = path.join(__dirname, 'key.pem');
const certPath = path.join(__dirname, 'cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    console.log('Generating self-signed SSL certificates...');
    try {
        execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -sha256 -days 365 -nodes -subj "/CN=localhost"`, { stdio: 'inherit' });
        console.log('SSL certificates generated successfully.');
    } catch (err) {
        console.error('Failed to generate SSL certificates:', err.message);
        process.exit(1);
    }
}

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function serveFile(req, res) {
    let filePath = '.' + req.url;
    if (filePath === './' || filePath === './?') {
        filePath = './index.html';
    }
    
    // Remove query strings
    filePath = filePath.split('?')[0];

    const extname = path.extname(filePath);
    let contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 File Not Found', 'utf-8');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Error: ' + error.code, 'utf-8');
            }
        } else {
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(content, 'utf-8');
        }
    });
}

// Start HTTPS Server
try {
    const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };
    https.createServer(options, serveFile).listen(PORT, '0.0.0.0', () => {
        console.log(`\n==================================================`);
        console.log(`💡 Light Flicker Detector Server Running Securely!`);
        console.log(`==================================================`);
        console.log(`💻 Local access: https://localhost:${PORT}`);
        
        // Output IP addresses for mobile devices
        const nets = os.networkInterfaces();
        console.log(`📱 Mobile/Local network access:`);
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                if (net.family === 'IPv4' && !net.internal) {
                    console.log(`   👉 https://${net.address}:${PORT}`);
                }
            }
        }
        console.log(`==================================================`);
        console.log(`⚠️  Note: Since the certificate is self-signed,`);
        console.log(`    your browser will show a warning. Just tap`);
        console.log(`    "Advanced" -> "Proceed anyway" to open the app.`);
        console.log(`==================================================\n`);
    });
} catch (err) {
    console.error('Failed to start HTTPS server:', err.message);
}

// Redirect HTTP to HTTPS
const httpServer = http.createServer((req, res) => {
    // Safely parse host header
    const hostHeader = req.headers['host'] || '';
    const host = hostHeader.split(':')[0] || 'localhost';
    res.writeHead(301, { "Location": "https://" + host + ":" + PORT + req.url });
    res.end();
});

httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`⚠️  Warning: Port ${HTTP_PORT} is already in use. HTTP redirect is disabled.`);
        console.log(`   Please connect to HTTPS directly: https://localhost:${PORT}`);
    } else {
        console.error('HTTP redirect server error:', err.message);
    }
});

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`HTTP redirect server running on port ${HTTP_PORT}`);
});
