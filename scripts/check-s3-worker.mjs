/** Static Worker bundle check (no deploy, no D1 mutation, no network). */
import { build } from 'esbuild';

const result=await build({
  entryPoints:['server/worker/index.ts'],
  bundle:true,
  platform:'browser',
  target:'es2022',
  format:'esm',
  write:false,
  external:['node:crypto'],
  logLevel:'warning',
});
if(!result.outputFiles?.length || result.outputFiles[0].text.length===0) {
  throw new Error('S3_WORKER_BUNDLE_EMPTY');
}
console.log('S3 Cloudflare Worker ESM bundle check PASS (no deployment).');
