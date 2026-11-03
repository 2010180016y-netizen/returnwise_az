/**
 * ReturnWise S6 OFFLINE release-evidence auditor.
 *
 * Default preflight validates that the manifest is internally consistent and
 * built static artifacts do not contain known release regressions. It is safe
 * in CI even when launches are blocked.
 *
 * --require-ready=FREE|PRO is a separate, deliberately failing launch gate
 * until each scope-specific human/external requirement has independent evidence.
 * This tool NEVER deploys, grants entitlement, charges, or signs on behalf of
 * a product owner. Green CI != a production authorization.
 */
import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve('docs/release/S6_GATE_MANIFEST.json');
const dist = path.resolve('dist');
const REQUIRED_FREE = Array.from({length:9},(_,i)=>'F'+String(i+1).padStart(2,'0'));
const REQUIRED_PRO = Array.from({length:8},(_,i)=>'P'+String(i+1).padStart(2,'0'));
const validStatus = new Set(['PASS','PENDING','BLOCKED','FAIL']);
function check(cond,message) {if(!cond)throw new Error('S6_PREFLIGHT_FAILED: '+message);}
function read(file) {check(fs.existsSync(file),'missing '+file);return fs.readFileSync(file,'utf8');}

export function validateManifest(m) {
  check(m?.schema==='returnwise.s6.release-gates.v1','unexpected schema version');
  check(/^\d{4}-\d{2}-\d{2}$/.test(m.asOf),'asOf must be an exact date');
  check(Array.isArray(m.gates),'gates must be an array');
  const byId=new Map();
  for (const gate of m.gates) {
    check(gate&&typeof gate.id==='string'&&!byId.has(gate.id),
      'duplicate or missing gate id: '+String(gate?.id));
    check(validStatus.has(gate.status),'invalid status '+gate.id);
    check(Array.isArray(gate.evidence),'missing evidence array '+gate.id);
    check(typeof gate.owner==='string'&&gate.owner.length>2,'missing owner '+gate.id);
    check(Array.isArray(gate.scope)&&gate.scope.length>0,'missing scope '+gate.id);
    check(gate.scope.every(s=>s==='FREE'||s==='PRO'),'invalid scope '+gate.id);
    if(gate.status==='PASS') {
      check(gate.evidence.length>0,'PASS has no supporting evidence '+gate.id);
      check(gate.evidence.every(e=>typeof e==='string'&&e.trim().length>8),
        'invalid proof reference '+gate.id);
    }
    byId.set(gate.id,gate);
  }
  for(const id of [...REQUIRED_FREE,...REQUIRED_PRO]) {
    check(byId.has(id),'required release gate missing '+id);
  }
  for(const id of REQUIRED_FREE) check(byId.get(id).scope.includes('FREE'),'FREE scope missing '+id);
  for(const id of REQUIRED_PRO) check(byId.get(id).scope.includes('PRO'),'PRO scope missing '+id);
  return m;
}

export function validateBuild(outputDir=dist) {
  const html=read(path.join(outputDir,'index.html'));
  const headers=read(path.join(outputDir,'_headers'));
  const js=path.join(outputDir,'assets/index.js');
  const css=path.join(outputDir,'assets/index.css');

  check(fs.statSync(js).size>100,'production JS absent/empty');
  check(fs.statSync(css).size>100,'production CSS absent/empty');
  check(html.includes('src="/assets/index.js"'),'script missing from production HTML');
  check(html.includes('href="/assets/index.css"'),'stylesheet missing from production HTML');
  check(!html.includes('src="/src/main.tsx"'),'source TSX leaked into production HTML');
  check(!html.includes('og-image.png'),'nonexistent social preview image still advertised');
  check(!/2026 전자상거래법 준수/.test(html),'unsupported complete legal compliance claim');
  check(headers.includes("connect-src 'none'"),'static page CSP permits outbound connections');
  check(/\/assets\/\*[\s\S]*?max-age=0, must-revalidate/.test(headers),
    'fixed filenames require browser revalidation, not immutable caching');
  const assetBlock=headers.split('/assets/*')[1]?.split('\n\n')[0]??'';
  check(!/immutable/i.test(assetBlock),'unhashed asset has immutable cache policy');

  // Parse local assets from SEO tags without making remote network requests.
  for(const match of html.matchAll(/<(?:meta|link)[^>]*(?:href|content)="(\/[^"]+)"[^>]*>/g)) {
    const localPath=match[1].split(/[?#]/)[0];
    if(localPath==='/'||localPath.startsWith('//'))continue;
    check(fs.existsSync(path.join(outputDir,localPath.slice(1))),
      'metadata references a missing local asset '+localPath);
  }
  return {html:true,css:true,js:true,cache:true,csp:true,missingOgClaimRemoved:true};
}

function main() {
  const manifest=validateManifest(JSON.parse(read(manifestPath)));
  const distStatus=validateBuild();
  const requested=process.argv.find(arg=>arg.startsWith('--require-ready='));
  const scope=requested?.split('=')[1];
  if(scope!==undefined)check(scope==='FREE'||scope==='PRO','scope must be FREE or PRO');
  const gateList=manifest.gates.filter(g=>!scope||g.scope.includes(scope));
  const blockers=gateList.filter(g=>g.status!=='PASS');
  const summary={
    checkedAt:new Date().toISOString(),
    scope:scope??'ALL',
    status:blockers.length===0?'READY_FOR_HUMAN_REVIEW':'BLOCKED',
    gateCount:gateList.length,
    openGates:blockers.map(g=>({id:g.id,status:g.status,owner:g.owner})),
    staticArtifactPreflight:distStatus,
    note:'Automated gate evidence is not legal review or human launch authorization.',
  };
  console.log(JSON.stringify(summary,null,2));
  if(scope && blockers.length>0) {
    process.exitCode=2;
  }
}
if(process.argv[1] && path.resolve(process.argv[1])===new URL(import.meta.url).pathname) {
  try {main();}catch(e){console.error(String(e));process.exitCode=1;}
}
