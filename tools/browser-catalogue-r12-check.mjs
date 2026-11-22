// R12 browser regression: prevent endless "checking..." and stale JS/CSS on Pages.
// Optional: npm install --no-save playwright
// PORTAL_URL=http://127.0.0.1:4173/ BROWSER_PATH=... node tools/browser-catalogue-r12-check.mjs
import assert from 'node:assert/strict';
let chromium;
try{({chromium}=await import('playwright'))}
catch{console.error('Install optional Playwright first');process.exit(2)}
const browser=await chromium.launch({headless:true,
 ...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const url=process.env.PORTAL_URL||'http://127.0.0.1:4173/';
const errors=[];
const raceState=async(page,name,timeout=12000)=>{
 await page.waitForFunction(v=>document.querySelector('#coverageStatus')?.dataset.state===v,
  name,{timeout});
};
const ids=async page=>page.locator('#originChoice option').evaluateAll(nodes=>
 nodes.map(x=>x.value).filter(Boolean));
const geofeature={id:'r12-fes-verified',collection:'real-source-fixture',
 geometry:{type:'Point',coordinates:[-4.977107,34.061672694]},
 properties:{'pano:projection_type':'equirectangular'},
 assets:{sd:{href:'https://panoramax.openstreetmap.fr/fixtures/360.jpg'}}};
let result=[];
try{
 const page=await browser.newPage({viewport:{width:1320,height:850}});
 page.on('pageerror',e=>errors.push('responsive '+e.message));
 let mode='error';
 await page.route(/https:\/\/api\.panoramax\.xyz\/api\/search(?:\?|$)/,async route=>{
   if(mode==='error')return route.fulfill({status:503,body:'Unavailable'});
   const bbox=(new URL(route.request().url()).searchParams.get('bbox')||'').split(',').map(Number);
   const centre={lat:(bbox[1]+bbox[3])/2,lng:(bbox[0]+bbox[2])/2};
   const fes=Math.abs(centre.lat-34.061672694)<.015&&
    Math.abs(centre.lng+4.977107)<.015;
   return route.fulfill({status:200,contentType:'application/geo+json',
     body:JSON.stringify({type:'FeatureCollection',
      features:mode==='photo'&&fes?[geofeature]:[]})});
 });
 assert.equal((await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000})).status(),200);
 const appSrc=await page.locator('script[type=module]').getAttribute('src');
 const cssHref=await page.locator('link[href^="./src/styles.css"]').getAttribute('href');
 assert.match(appSrc,/^\.\/src\/app\.js(?:\?build=[0-9a-f]{40})?$/);
 const appRevision=appSrc.split('?build=')[1]||null;
 const cssRevision=cssHref.split('?build=')[1]||null;
 assert.equal(appRevision,cssRevision,'mixed stylesheet and script revisions');
 const style=await page.locator('#refreshCoverageBtn').evaluate(button=>
  getComputedStyle(button).backgroundColor);
 assert.equal(style,'rgb(19, 57, 71)','wrong/stale CSS refresh button style');
 await raceState(page,'error');
 assert.deepEqual(await ids(page),[]);
 assert.match(await page.locator('#coverageStatus').innerText(),/Не удалось проверить каталог/);
 assert.equal(await page.locator('#refreshCoverageBtn').isEnabled(),true);
 assert.equal(await page.locator('#startBtn').isDisabled(),true);
 result.push({case:'API outage yields error and retry',pass:true,appSrc,cssHref});
 mode='photo';
 await page.locator('#refreshCoverageBtn').click();
 await raceState(page,'ready');
 assert.deepEqual(await ids(page),['fes']);
 assert.equal(await page.locator('#startBtn').isEnabled(),true);
 result.push({case:'Manual retry recovers from source error',pass:true});
 await page.locator('#provider').selectOption('google');
 assert.equal(await page.locator('#googleKeyWrap').isVisible(),true);
 assert.equal(await page.locator('#manualOrigin').evaluate(el=>el.open),true);
 assert.equal(await page.locator('.google-key-help').getAttribute('href'),
  'https://developers.google.com/maps/documentation/javascript/get-api-key');
 assert.match(await page.locator('#googleKeyWrap').innerText(),/не предоставляет встроенный Street View/);
 result.push({case:'Google key instructions, no fake demo key',pass:true});
 await page.close();

 // Browser with a source whose metadata fetches NEVER finish. The UI must
 // remain usable during the scan, then show a finite 18-second timeout.
 const stalled=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 stalled.on('pageerror',e=>errors.push('timeout '+e.message));
 await stalled.addInitScript(()=>{
   const original=window.fetch;
   window.fetch=(input,options)=>{
     if(String(input).startsWith('https://api.panoramax.xyz/api/search?')){
       return new Promise((_,reject)=>{
         const signal=options?.signal;
         if(signal?.aborted)return reject(new DOMException('Aborted','AbortError'));
         signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')), {once:true});
       });
     }
     return original.call(window,input,options);
   };
 });
 await stalled.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
 await raceState(stalled,'checking',4000);
 assert.equal(await stalled.locator('#refreshCoverageBtn').isEnabled(),true);
 await raceState(stalled,'timeout',25000);
 assert.match(await stalled.locator('#coverageStatus').innerText(),/Достигнут предел 18 секунд/);
 assert.deepEqual(await ids(stalled),[]);
 assert.equal(await stalled.locator('#startBtn').isDisabled(),true);
 assert.equal(await stalled.locator('#refreshCoverageBtn').isEnabled(),true);
 result.push({case:'Stalled Panoramax stops at 18s and displays retry',pass:true});
 await stalled.close();
 assert.deepEqual(errors,[]);
 console.log('R12_CACHE_REFRESH_BROWSER_PASS',JSON.stringify(result,null,2));
}catch(error){console.error('R12_CACHE_REFRESH_BROWSER_FAIL',error.stack||error,result,errors);process.exitCode=1}
finally{await browser.close()}
