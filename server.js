const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // 1. Method Restriction: Allow only GET and HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain', 'Allow': 'GET, HEAD' });
    res.end('405 Method Not Allowed');
    return;
  }

  // 2. Strict Check for Path Traversal Sequences (CWE-22)
  if (req.url.includes('..') || req.url.includes('%2e') || req.url.includes('%2E') || req.url.includes('\\')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Invalid path characters');
    return;
  }

  // 3. Parse URL and sanitize path
  let pathname = '/';
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    pathname = decodeURIComponent(parsedUrl.pathname);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('400 Bad Request');
    return;
  }

  if (pathname.includes('..')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Path traversal detected');
    return;
  }

  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  // 4. Block Sensitive Server Files & Hidden Dotfiles
  const basename = path.basename(pathname);
  if (
    basename.startsWith('.') ||
    basename === 'server.js' ||
    basename === 'package.json' ||
    basename === 'package-lock.json'
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Access denied');
    return;
  }

  // 5. Strict Root Directory Boundary Check
  const rootDir = path.resolve(__dirname);
  const safeRelativePath = path.posix.normalize(pathname).replace(/^\/+/, '');
  const targetPath = path.resolve(rootDir, safeRelativePath);

  // Ensure resolved path is strictly within rootDir
  if (!targetPath.startsWith(rootDir + path.sep) && targetPath !== path.join(rootDir, 'index.html')) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // 4. Check file existence
  fs.stat(targetPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // 5. Apply Comprehensive HTTP Security Headers (CWE-693)
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      // Content Security Policy: Whitelist only trusted Google Fonts and Gemini endpoints
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src https://fonts.gstatic.com; connect-src 'self' https://generativelanguage.googleapis.com; img-src 'self' data:; media-src 'self';",
      // Prevent MIME-sniffing
      'X-Content-Type-Options': 'nosniff',
      // Prevent Clickjacking / Framing
      'X-Frame-Options': 'DENY',
      // Strict Referrer Policy (hides full URL paths on external navigation)
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      // Permissions Policy: Explicitly allow microphone only for self
      'Permissions-Policy': 'microphone=(self), camera=(), geolocation=()'
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(targetPath);
    stream.on('error', () => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
    });
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n🎙️  SpeakEasy is running at http://localhost:${PORT}`);
  console.log(`👉 Open http://localhost:${PORT} in Google Chrome or Microsoft Edge for full Web Speech API support.\n`);
});
