// Real browser regression for R13 all-source automatic 360 mixing.
// Optional Playwright: npm install --no-save playwright
// PORTAL_URL=http://127.0.0.1:4173 BROWSER_PATH=... node tools/browser-merged-r13-check.mjs
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{
 executablePath:process.env.BROWSER_PATH}:{})});
const base=process.env.PORTAL_URL||'http://127.0.0.1:4173/';
const errors=[];
let evidence=[];
try{
 const page=await browser.newPage({viewport:{width:1366,height:850}});
 page.on('pageerror',e=>errors.push(e.message));
 assert.equal((await page.goto(base,{waitUntil:'domcontentloaded',timeout:25000})).status(),200);
 assert.equal(await page.locator('#provider').isVisible(),false);
 assert.equal(await page.locator('#originChoice').count(),1);
 assert.equal(await page.locator('#sourceGateway').count(),0);
 assert.equal(await page.locator('#googleAuth').count(),1);
 await page.waitForFunction(()=>{
   const state=document.querySelector('#coverageStatus')?.dataset.state;
   return state==='ready'||state==='timeout'||state==='error';
 },null,{timeout:38000});
 const message=await page.locator('#coverageStatus').innerText();
 const names=await page.locator('#originChoice option').evaluateAll(items=>items.filter(x=>x.value).map(x=>x.value));
 assert.ok(names.includes('fes'),'Fes missing from combined source results');
 assert.match(message,/Panoramax|KartaView/);
 evidence.push({case:'one combined live catalogue',count:names.length,sourceStatus:message});
 // Direct official KartaView 360 (Fes) inside our WebGL window.
 const karta=await page.evaluate(async()=>{
  const mod=await import('./src/providers.js');
  const photos=await mod.probeKartaView360({lat:34.061672694,lng:-4.977107});
  if(!photos.length)return {error:'No real KartaView 360 source'};
  const player=new mod.Merged360Provider();
  await player.show(photos[0],document.querySelector('#viewer'));
  const canvas=document.querySelector('#viewer canvas');
  const pixels=canvas?.getContext('webgl')?.readPixels;
  player.setPose({heading:46,pitch:13,zoom:26});
  return {id:photos[0].id,provider:photos[0].provider,
   canvas:!!canvas,width:canvas?.width,height:canvas?.height,
   heading:player.getPose().heading,
   attribution:document.querySelector('#viewer .external-360-attribution')?.textContent,
   webgl:!!pixels};
 });
 assert.ok(!karta.error,karta.error||'');
 assert.equal(karta.provider,'kartaview');
 assert.ok(karta.canvas&&karta.webgl&&karta.width>200);
 assert.equal(karta.heading,46);
 assert.match(karta.attribution,/KartaView/);
 evidence.push({case:'real spherical KartaView photo in JANUS',...karta});
 // Commons geotagged 360 photo on Wikimedia Wikimedia's own origin.
 const commons=await page.evaluate(async()=>{
  const mod=await import('./src/providers.js');
  const candidate={
   provider:'commons',id:'source-audit-commons-360',lat:32.913,lng:-117.17,
   imageUrl:'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/San_Diego_Panorama_DSC_1927-DSC_1931.jpg/3840px-San_Diego_Panorama_DSC_1927-DSC_1931.jpg',
   sourceName:'Wikimedia Commons',sourceUrl:'https://commons.wikimedia.org/wiki/File:San_Diego_Panorama_DSC_1927-DSC_1931.jpg',
   attribution:'Wikimedia Commons · Sankeytm',license:'CC BY-SA 4.0'
  };
  const player=new mod.Merged360Provider();
  await player.show(candidate,document.querySelector('#viewer'));
  player.setPose({heading:110,pitch:-20,zoom:42});
  const canvas=document.querySelector('#viewer canvas');
  return {canvas:!!canvas,heading:player.getPose().heading,
   attribution:document.querySelector('#viewer .external-360-attribution')?.textContent};
 });
 assert.ok(commons.canvas&&commons.heading===110);
 assert.match(commons.attribution,/Wikimedia Commons/);
 evidence.push({case:'actual Commons equirectangular JPEG in JANUS',...commons});
 // Restore real app usage by choosing city from its source-confirmed list.
 await page.locator('#originChoice').selectOption('fes');
 await page.locator('#startBtn').click();
 await page.waitForFunction(()=>Number(document.querySelector('#statUnique')?.textContent)>=1 &&
  (document.querySelector('#runStatus')?.textContent||'').includes('Живой взгляд'),
  null,{timeout:45000});
 assert.equal(await page.locator('#statUnique').innerText(),'1');
 const location=await page.locator('#placeLabel').innerText();
 assert.match(location,/Panoramax|KartaView|Commons/);
 await page.locator('#fullscreenBtn').click();
 await page.waitForFunction(()=>document.querySelector('.viewer-panel')
  .classList.contains('portal-fullscreen-active'),null,{timeout:5000});
 await page.locator('#fullscreenBtn').click();
 await page.waitForFunction(()=>!document.querySelector('.viewer-panel')
  .classList.contains('portal-fullscreen-active'),null,{timeout:5000});
 evidence.push({case:'original Start and fullscreen with mixed source',location});
 const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 phone.on('pageerror',e=>errors.push('phone '+e.message));
 await phone.goto(base,{waitUntil:'domcontentloaded',timeout:25000});
 assert.equal(await phone.locator('#provider').isVisible(),false);
 assert.equal(await phone.locator('#refreshCoverageBtn').isVisible(),true);
 await phone.close();
 assert.deepEqual(errors,[]);
 console.log('R13_EDGE_MERGED_PASS',JSON.stringify(evidence,null,2));
}catch(e){console.error('R13_EDGE_MERGED_FAIL',e.stack||e,JSON.stringify(evidence),errors);process.exitCode=1}
finally{await browser.close()}
