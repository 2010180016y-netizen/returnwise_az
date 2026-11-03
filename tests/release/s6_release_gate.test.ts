import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const manifestPath='docs/release/S6_GATE_MANIFEST.json';
const read=(path:string)=>fs.readFileSync(path,'utf8');
const manifest=JSON.parse(read(manifestPath));

describe('S6 | truthful release readiness contract', () => {
  it('separates FREE and PRO launch requirements with explicit incomplete state', () => {
    assert.equal(manifest.schema,'returnwise.s6.release-gates.v1');
    assert.equal(manifest.gates.length,17);
    assert.ok(manifest.gates.some((g:{id:string,status:string})=>g.id==='F07'&&g.status==='BLOCKED'));
    assert.ok(manifest.gates.some((g:{id:string,status:string})=>g.id==='P02'&&g.status==='BLOCKED'));
    assert.ok(manifest.gates.every((g:{status:string,evidence:string[]})=>
      g.status!=='PASS'||g.evidence.length>0));
  });

  it('the offline evidence preflight passes without pretending to approve release', () => {
    const run=spawnSync(process.execPath,['scripts/s6_release_preflight.mjs'],
      {encoding:'utf8'});
    assert.equal(run.status,0,run.stderr||run.stdout);
    const output=JSON.parse(run.stdout);
    assert.equal(output.status,'BLOCKED');
    assert.equal(output.staticArtifactPreflight.css,true);
    assert.equal(output.staticArtifactPreflight.cache,true);
    assert.ok(output.openGates.length>=1);
  });

  it('FREE public authorization fails closed while owner/legal/staging evidence is absent', () => {
    const run=spawnSync(process.execPath,
      ['scripts/s6_release_preflight.mjs','--require-ready=FREE'],{encoding:'utf8'});
    assert.equal(run.status,2,run.stderr||run.stdout);
    assert.equal(JSON.parse(run.stdout).status,'BLOCKED');
  });

  it('PRO billing authorization remains blocked despite green security tests', () => {
    const run=spawnSync(process.execPath,
      ['scripts/s6_release_preflight.mjs','--require-ready=PRO'],{encoding:'utf8'});
    assert.equal(run.status,2,run.stderr||run.stdout);
    assert.equal(JSON.parse(run.stdout).status,'BLOCKED');
  });

  it('non-hashed assets are revalidated instead of cached as immutable for one year', () => {
    const h=read('public/_headers');
    const asset=h.split('/assets/*')[1]?.split('\n\n')[0]??'';
    assert.match(asset,/max-age=0, must-revalidate/);
    assert.doesNotMatch(asset,/immutable/i);
  });

  it('does not advertise nonexistent social preview image or guaranteed legal compliance', () => {
    const html=read('index.html');
    assert.doesNotMatch(html,/og-image\.png|twitter:image|property="og:image"/);
    assert.doesNotMatch(html,/2026 전자상거래법 준수/);
    assert.match(html,/2026 전자상거래법/);
    assert.match(html,/CSV 원본에는 개인정보/);
  });

  it('official 2026 statute number is correct and account staging remains unverified', () => {
    const law=read('docs/LEGAL_POLICY_REGISTER.md');
    assert.match(law,/법률 제21312호/);
    assert.doesNotMatch(law,/법률 제20480호/);
    assert.equal(manifest.observations.cloudflarePagesProjectsFound,0);
    assert.equal(manifest.observations.cloudflareD1DatabasesFound,0);
  });

  it('prevents fake deliverable contact information or auto human approval',()=>{
    const copy=read('src/content/disclosures.ts');
    assert.doesNotMatch(copy,/contact-review@returnwise\.local/);
    assert.match(copy,/실제 문의처 등록 필요/);
    assert.ok(manifest.gates.some((g:{id:string,status:string})=>
      g.id==='F09' && g.status!=='PASS'));
  });
});
