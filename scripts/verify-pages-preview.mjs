/**
 * ReturnWise S6-02: Isolated Cloudflare Pages Preview Verification Script
 * Validates local dist build with real HTTP request/response loop, headers enforcement,
 * 404 noindex handling, 301 redirects, and zero outbound network connections.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');

function parseHeadersFile(headersPath) {
  if (!fs.existsSync(headersPath)) return {};
  const content = fs.readFileSync(headersPath, 'utf8');
  const sections = {};
  let currentPath = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      currentPath = trimmed;
      sections[currentPath] = {};
    } else if (currentPath && trimmed.includes(':')) {
      const idx = trimmed.indexOf(':');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      sections[currentPath][key.toLowerCase()] = val;
    }
  }
  return sections;
}

function parseRedirectsFile(redirectsPath) {
  if (!fs.existsSync(redirectsPath)) return [];
  const content = fs.readFileSync(redirectsPath, 'utf8');
  const rules = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      rules.push({ from: parts[0], to: parts[1], status: parseInt(parts[2] || '301', 10) });
    }
  }
  return rules;
}

export async function runPreviewVerification(port = 4173) {
  const headersConfig = parseHeadersFile(path.join(distDir, '_headers'));
  const redirectRules = parseRedirectsFile(path.join(distDir, '_redirects'));

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const pathname = url.pathname;

    // Check redirects first
    const redirect = redirectRules.find(r => r.from === pathname);
    if (redirect) {
      res.writeHead(redirect.status, { Location: redirect.to });
      res.end();
      return;
    }

    // Determine target file
    let filePath = path.join(distDir, pathname === '/' ? 'index.html' : pathname.slice(1));
    let statusCode = 200;

    if (!fs.existsSync(filePath)) {
      filePath = path.join(distDir, '404.html');
      statusCode = 404;
    }

    // Apply Cloudflare _headers
    const headers = {
      ...(headersConfig['/*'] || {}),
    };

    if (pathname.startsWith('/assets/')) {
      Object.assign(headers, headersConfig['/assets/*'] || {});
    } else if (pathname === '/' || pathname === '/index.html') {
      Object.assign(headers, headersConfig['/index.html'] || {});
    }

    if (statusCode === 404) {
      Object.assign(headers, headersConfig['/404.html'] || {});
    }

    // Set MIME type
    if (filePath.endsWith('.html')) headers['content-type'] = 'text/html; charset=utf-8';
    else if (filePath.endsWith('.js')) headers['content-type'] = 'application/javascript; charset=utf-8';
    else if (filePath.endsWith('.css')) headers['content-type'] = 'text/css; charset=utf-8';
    else if (filePath.endsWith('.svg')) headers['content-type'] = 'image/svg+xml';
    else if (filePath.endsWith('.xml')) headers['content-type'] = 'application/xml';
    else if (filePath.endsWith('.txt')) headers['content-type'] = 'text/plain';

    res.writeHead(statusCode, headers);
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise(resolve => server.listen(port, resolve));

  const results = [];

  async function testRoute(routePath, expectedStatus, checks) {
    const res = await fetch(`http://127.0.0.1:${port}${routePath}`, { redirect: 'manual' });
    const text = await res.text();
    const headers = Object.fromEntries(res.headers.entries());

    const result = {
      path: routePath,
      status: res.status,
      expectedStatus,
      statusMatch: res.status === expectedStatus,
      checksPassed: true,
      log: [],
    };

    for (const [checkName, fn] of Object.entries(checks)) {
      const pass = fn(res.status, headers, text);
      result.log.push({ check: checkName, pass });
      if (!pass) result.checksPassed = false;
    }
    results.push(result);
  }

  try {
    // 1. Root /
    await testRoute('/', 200, {
      'CSP connect-src none': (s, h) => h['content-security-policy']?.includes("connect-src 'none'"),
      'X-Content-Type-Options nosniff': (s, h) => h['x-content-type-options'] === 'nosniff',
      'HTML contains App root': (s, h, b) => b.includes('id="root"'),
      'Cache-Control revalidate': (s, h) => h['cache-control']?.includes('must-revalidate'),
    });

    // 2. Production JS Bundle
    await testRoute('/assets/index.js', 200, {
      'JS MIME type': (s, h) => h['content-type']?.includes('javascript'),
      'Cache-Control revalidate': (s, h) => h['cache-control']?.includes('must-revalidate'),
      'No immutable flag': (s, h) => !h['cache-control']?.includes('immutable'),
    });

    // 3. Production CSS Bundle
    await testRoute('/assets/index.css', 200, {
      'CSS MIME type': (s, h) => h['content-type']?.includes('text/css'),
      'Cache-Control revalidate': (s, h) => h['cache-control']?.includes('must-revalidate'),
    });

    // 4. Redirect /calculator -> /
    await testRoute('/calculator', 301, {
      'Location header to /': (s, h) => h['location'] === '/',
    });

    // 5. 404 Route
    await testRoute('/nonexistent-route-for-testing', 404, {
      'X-Robots-Tag noindex': (s, h) => h['x-robots-tag']?.includes('noindex'),
      '404 HTML body content': (s, h, b) => b.includes('404'),
    });

    return results;
  } finally {
    server.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-pages-preview.mjs')) {
  runPreviewVerification(4173)
    .then(results => {
      console.log(JSON.stringify({ ok: results.every(r => r.statusMatch && r.checksPassed), results }, null, 2));
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
