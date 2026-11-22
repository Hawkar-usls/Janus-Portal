import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {probeKartaView360,probeCommons360,probeMerged360,Merged360Provider} from '../src/providers.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const origin={lat:34.061672694,lng:-4.977107};
const resp=data=>({ok:true,status:200,json:async()=>data});
const sphere={id:'123',projection:'SPHERE',fieldOfView:'360',lat:'34.061673',lng:'-4.977107',
 imageProcUrl:'https://cdn.kartaview.org/pr:sharp/sample',sequenceId:'777'};
async function mocked(fetcher,callback){
 const prev=globalThis.fetch;globalThis.fetch=fetcher;
 try{return await callback()}finally{globalThis.fetch=prev}
}
test('KartaView API accepts only nearby spherical 360 with CDN CORS URL',async()=>{
 await mocked(async url=>{
  assert.match(String(url),/^https:\/\/api\.kartaview\.org\/2\.0\/photo\/\?/);
  assert.match(String(url),/radius=500/);
  assert.match(String(url),/projection=SPHERE/);
  return resp({status:{httpCode:200},result:{data:[
   {...sphere,id:'flat',projection:'PLANE'},
   {...sphere,id:'narrow',fieldOfView:'95'},
   {...sphere,id:'external',imageProcUrl:'https://untrusted.example.com/photo'},
   {...sphere,id:'far',lat:'39.0194',lng:'125.7381'},
   sphere
  ]}});
 },async()=>{
  const items=await probeKartaView360(origin);
  assert.equal(items.length,1);
  assert.equal(items[0].id,'123');
  assert.equal(items[0].provider,'kartaview');
  assert.match(items[0].sourceUrl,/kartaview\.org\/details\/777\/123/);
 });
});
test('Wikimedia Commons accepts geotagged licensed full 2:1 sphere only',async()=>{
 const photo={
  pageid:42,title:'File:360 panorama in Fes.jpg',
  imageinfo:[{width:6000,height:3000,
   thumburl:'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a0/360.jpg',
   descriptionurl:'https://commons.wikimedia.org/wiki/File:360_panorama_in_Fes.jpg',
   extmetadata:{
    Categories:{value:'360° panoramas with equirectangular projection'},
    LicenseShortName:{value:'CC BY-SA 4.0'},
    GPSLatitude:{value:'34.061672694'},
    GPSLongitude:{value:'-4.977107'},
    Artist:{value:'<a href="https://commons.wikimedia.org">Author</a>'}
   }}]
 };
 await mocked(async url=>{
  assert.match(String(url),/^https:\/\/commons\.wikimedia\.org\/w\/api\.php\?/);
  assert.match(String(url),/origin=(?:%2A|\*)/);
  return resp({query:{pages:{
   42:photo,
   43:{...photo,pageid:43,imageinfo:[{...photo.imageinfo[0],width:3000,height:3000}]},
   44:{...photo,pageid:44,imageinfo:[{...photo.imageinfo[0],extmetadata:{
    ...photo.imageinfo[0].extmetadata,LicenseShortName:{value:'All rights reserved'}}}]},
   45:{...photo,pageid:45,imageinfo:[{...photo.imageinfo[0],extmetadata:{
    ...photo.imageinfo[0].extmetadata,GPSLatitude:{value:'39'},GPSLongitude:{value:'125'}}}]}
  }}});
 },async()=>{
  const items=await probeCommons360(origin);
  assert.equal(items.length,1);
  assert.equal(items[0].provider,'commons');
  assert.equal(items[0].attribution,'Author');
  assert.match(items[0].sourceUrl,/commons\.wikimedia\.org/);
 });
});
test('A failed open-source API cannot hide valid panoramas from another source',async()=>{
 await mocked(async url=>{
  const u=String(url);
  if(u.includes('panoramax.xyz'))return resp({features:[{
   id:'pano-1',collection:'seq',geometry:{coordinates:[origin.lng,origin.lat]},
   properties:{'pano:projection_type':'equirectangular'},
   assets:{sd:{href:'https://api.panoramax.xyz/photo.jpg'}}
  }]});
  if(u.includes('kartaview.org'))throw Error('server unavailable');
  return resp({query:{pages:{}}});
 },async()=>{
  const result=await probeMerged360(origin);
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].provider,'panoramax');
  assert.equal(result.failed,1);
  assert.equal(result.checked,3);
 });
});
test('One automatic geographical catalogue, no visible provider selector, no random options',()=>{
 assert.match(html,/<select id="provider" hidden/);
 assert.match(html,/id="originChoice"/);
 assert.match(html,/id="googleConsent"/);
 assert.ok(!html.includes('<label for="provider">'));
 assert.ok(!html.includes('sourceGateway'));
 assert.ok(!html.includes('<option value="random">'));
 assert.ok(!html.includes('<option value="random-verified">'));
 assert.match(app,/probeMerged360\(entry\.origin/);
 assert.match(app,/liveCoverage\.set\(entry\.key,result\.candidates\)/);
 assert.match(app,/selectMixedStart\(state\.selectedSourceKey/);
 assert.match(app,/LIVE_SOURCE_COUNT=3/);
 assert.match(app,/LIVE_REFRESH_MS=5\*60\*1000/);
 assert.match(css,/\.source-360-frame/);
 assert.match(css,/\.external-360-attribution/);
});
test('Mixed viewer dispatches to original Panoramax and native WebGL sphere without extra runtime imports',()=>{
 const provider=new Merged360Provider();
 assert.ok(provider.providers.panoramax);
 assert.ok(provider.providers.kartaview);
 assert.ok(provider.providers.commons);
 assert.equal(provider.providers.google,undefined);
 assert.match(app,/await state\.provider\.show\(candidate, \$\('viewer'\)\)/);
 assert.ok(html.includes('<script type="module" src="./src/app.js"></script>'));
 const imports=[...app.matchAll(/^import .*? from '(\.\/[^']+)'/gm)].map(x=>x[1]);
 assert.deepEqual(imports,['./navigation.js','./providers.js','./storage.js','./gaze.js','./attention.js']);
 assert.match(html,/id="fullscreenBtn"/);
 assert.match(app,/manual&&\$\('googleConsent'\)\.checked/);
});
