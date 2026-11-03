import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';

async function buildApp() {
  const distDir = path.resolve('dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

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
  html = html.replace(
    '<script type="module" src="/src/main.tsx"></script>',
    '<script type="module" src="/assets/index.js"></script>'
  );
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
