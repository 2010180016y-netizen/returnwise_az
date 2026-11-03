import { build } from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function findTestFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findTestFiles(fullPath));
    } else if (item.endsWith('.test.ts') || item.endsWith('.spec.ts') || item.endsWith('.test.tsx') || item.endsWith('.spec.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function runTests() {
  const testFiles = findTestFiles('tests');
  if (testFiles.length === 0) {
    console.error('Quality gate failed: no test files were discovered.');
    process.exit(1);
  }

  const tmpOutDir = path.resolve('.tmp_tests');
  if (!fs.existsSync(tmpOutDir)) {
    fs.mkdirSync(tmpOutDir, { recursive: true });
  }

  const outFiles = [];

  for (const file of testFiles) {
    const outFile = path.join(tmpOutDir, file.replace(/[\/\\]/g, '_').replace(/\.tsx?$/, '.js'));
    await build({
      entryPoints: [file],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: outFile,
      banner: {
        js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
      },
    });
    outFiles.push(outFile);
  }

  const nodePath = process.execPath;
  const command = `"${nodePath}" --disable-wasm-trap-handler --test --experimental-test-coverage ${outFiles.map(f => `"${f}"`).join(' ')}`;

  try {
    execSync(command, { stdio: 'inherit' });
  } finally {
    fs.rmSync(tmpOutDir, { recursive: true, force: true });
  }
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
