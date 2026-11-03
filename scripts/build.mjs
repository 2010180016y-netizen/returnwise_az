import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

async function buildApp() {
  const distDir = path.resolve('dist');
  // A successful build must not ship stale files from a previous build.
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  // 1. Bundle JavaScript & CSS
  console.log('Building ReturnWise production bundle with esbuild...');
  await build({
    entryPoints: ['src/main.tsx'],
    bundle: true,
    minify: true,
    sourcemap: false,
    target: ['es2020'],
    outfile: 'dist/assets/index.js',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  // 2. Copy index.html and inject script
  let html = fs.readFileSync('index.html', 'utf-8');
  const sourceEntry = '<script type="module" src="/src/main.tsx"></script>';
  if (!html.includes(sourceEntry)) {
    throw new Error('BUILD_ENTRY_NOT_FOUND: index.html is missing the source entry script.');
  }
  html = html.replace(sourceEntry, '<script type="module" src="/assets/index.js"></script>');
  // esbuild extracts CSS imported by src/main.tsx to a sibling stylesheet.
  // Without an explicit link the production HTML renders entirely unstyled.
  const cssPath = path.join(distDir, 'assets', 'index.css');
  if (!fs.existsSync(cssPath)) {
    throw new Error('BUILD_CSS_MISSING: expected extracted production stylesheet.');
  }
  const headEnd = '</head>';
  if (!html.includes(headEnd)) throw new Error('BUILD_HEAD_NOT_FOUND');
  html = html.replace(headEnd, '    <link rel="stylesheet" href="/assets/index.css" />\n  ' + headEnd);
  fs.writeFileSync('dist/index.html', html, 'utf-8');

  // 3. Copy public files if any
  if (fs.existsSync('public')) {
    const publicFiles = fs.readdirSync('public');
    for (const file of publicFiles) {
      fs.copyFileSync(path.join('public', file), path.join(distDir, file));
    }
  }

  console.log('Production build completed successfully: dist/');
}

buildApp().catch(err => {
  console.error(err);
  process.exit(1);
});
