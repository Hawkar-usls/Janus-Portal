import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {probePanoramaxCoverage} from '../src/providers.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
function feature({id,lat=34.06167,lng=-4.9771,fov=360,projection,asset=true}={}){
 return {
  id:id||'scene-'+Math.random().toString(16).slice(2),
  collection:'source-sequence',
  geometry:{type:'Point',coordinates:[lng,lat]},
  properties:{'pers:interior_orientation':{field_of_view:fov},
   ...(projection?{'pano:projection_type':projection}:{})},
  assets:asset?{sd:{href:'https://panoramax.openstreetmap.fr/sample/sd.jpg'}}:{}
 };
}
const origin={lat:34.061672694,lng:-4.977107};
function response(features){return {ok:true,status:200,json:async()=>({features})}}
async function withFetch(mock,fn){
 const original=globalThis.fetch;globalThis.fetch=mock;
 try{return await fn()}
 finally{globalThis.fetch=original}
}
test('live coverage accepts only nearby 360° image assets, not flat or far-away photographs',async()=>{
 await withFetch(async(url,options)=>{
   assert.match(String(url),/api\.panoramax\.xyz\/api\/search\?bbox=/);
   assert.equal(options.cache,'no-store');
   assert.equal(options.headers.Accept,'application/geo+json');
   return response([
     feature({id:'flat',fov:90}),
     feature({id:'without-picture',asset:false}),
     feature({id:'wrong-continent',lat:39.019,lng:125.73}),
     feature({id:'real-360',fov:360})
   ]);
 },async()=>{
   const result=await probePanoramaxCoverage(origin);
   assert.equal(result.count,1);
   assert.equal(result.candidate.id,'real-360');
   assert.equal(result.candidate.provider,'panoramax');
 });
});
test('empty and 2D-only live results produce zero available locations',async()=>{
 await withFetch(async()=>response([feature({fov:95})]),async()=>{
  assert.deepEqual(await probePanoramaxCoverage(origin),{candidate:null,count:0});
 });
});
test('live probe rejects API errors rather than marking stale cities as verified',async()=>{
 await withFetch(async()=>({ok:false,status:503}),async()=>{
  await assert.rejects(probePanoramaxCoverage(origin),/HTTP 503/);
 });
});
test('catalogue only builds from current API confirmations, with no random or stale list',()=>{
 assert.ok(html.includes('<template id="originCatalog">'));
 assert.match(html,/<select id="originChoice"[^>]*disabled>/);
 assert.ok(!html.includes('<option value="random">')&&!html.includes('<option value="random-verified">'));
 assert.ok(!app.includes("key === 'random'"));
 assert.ok(!app.includes('VERIFIED_REGION_KEYS ='));
 assert.match(app,/liveCoverage\.clear\(\)/);
 assert.match(app,/probeMerged360\(entry\.origin/);
 assert.match(app,/if\(result\.candidates\.length\)liveCoverage\.set/);
 assert.match(app,/LIVE_REFRESH_MS=5\*60\*1000/);
 assert.match(app,/document\.addEventListener\('visibilitychange'/);
 assert.match(app,/window\.addEventListener\('online',maybeRefreshCoverage\)/);
 assert.match(html,/id="refreshCoverageBtn"/);
});
test('Google remains opt-in manual to avoid billable catalogue probes',()=>{
 assert.match(app,/manual&&\$\('googleConsent'\)\.checked/);
 assert.match(app,/includeGoogle:wantsGoogle/);
 assert.match(app,/liveCoverage\.has\(key\)/);
 assert.match(html,/id="manualStartBtn"/);
 assert.match(html,/id="manualOrigin"/);
 assert.match(app,/state\.manualMode=manual/);
 assert.ok(!html.includes('id="customOrigin"'));
});
test('preserve the user-confirmed single R2 player, fullscreen and five imports',()=>{
 assert.ok(html.includes('<script type="module" src="./src/app.js"></script>'));
 const imports=[...app.matchAll(/^import .*? from '(\.\/[^']+)'/gm)].map(x=>x[1]);
 assert.deepEqual(imports,['./navigation.js','./providers.js','./storage.js','./gaze.js','./attention.js']);
 assert.match(html,/id="fullscreenBtn"/);
 assert.equal((html.match(/id="originChoice"/g)||[]).length,1);
 assert.match(app,/await state\.provider\.show\(candidate, \$\('viewer'\)\)/);
 assert.ok(!html.includes('sourceGateway'));
});
