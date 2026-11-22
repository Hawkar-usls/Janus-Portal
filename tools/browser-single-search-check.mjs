// R9 single-search acceptance. Optional Playwright: npm install --no-save playwright
// PORTAL_URL=http://127.0.0.1:4173/ BROWSER_PATH=/path/to/browser node tools/browser-single-search-check.mjs
import assert from 'node:assert/strict';
let chromium;
try {({chromium}=await import('playwright'))}
catch {console.error('Install optional Playwright to run this browser test');process.exit(2)}
const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const sourceURL=process.env.PORTAL_URL||'http://127.0.0.1:4173/';
const page=await browser.newPage({viewport:{width:1366,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function assertSingleUI(p){
 assert.equal(await p.locator('script[type=module]').getAttribute('src'),'./src/app.js');
 assert.equal(await p.locator('#originChoice').count(),1);
 assert.equal(await p.locator('#startBtn').count(),1);
 assert.equal(await p.locator('#provider').count(),1);
 assert.equal(await p.locator('#sourceGateway').count(),0);
 assert.equal(await p.locator('.external-panorama-links').count(),0);
 assert.equal(await p.locator('#gatewaySources').count(),0);
 assert.equal(await p.locator('#gatewayPlace').count(),0);
 assert.equal(await p.locator('h2', {hasText:'Поиск панорам'}).count(),1);
}
try{
 const response=await page.goto(sourceURL,{waitUntil:'domcontentloaded',timeout:25000});
 assert.equal(response.status(),200);
 await assertSingleUI(page);
 console.log('PASS_SINGLE_ORIGINAL_SEARCH',sourceURL);
 // An empty Panoramax query for Cairo must never present an unrelated photo,
 // increase local visits, or leave the start button unusable.
 let calls=0;
 await page.route(/https:\/\/api\.panoramax\.xyz\/api\/search(?:\?|$)/,route=>{
   calls++;
   return route.fulfill({status:200,contentType:'application/geo+json',
     body:JSON.stringify({type:'FeatureCollection',features:[]})});
 });
 await page.locator('#originChoice').selectOption('cairo');
 await page.locator('#startBtn').click();
 await page.locator('.view-feedback').waitFor({state:'visible',timeout:4000});
 assert.match(await page.locator('.view-feedback').innerText(),/Ищу доступную 360°/);
 await page.waitForFunction(
  ()=>(document.querySelector('#runStatus')?.textContent||'').includes('360° рядом не найдены'),
  null,{timeout:15000});
 assert.equal(calls,16);
 assert.equal(await page.locator('#statUnique').innerText(),'0');
 assert.equal(await page.locator('#startBtn').innerText(),'▶ Запустить');
 assert.match(await page.locator('.view-feedback').innerText(),/нет доступной 360° панорамы/);
 assert.match(await page.locator('#notice').innerText(),/Не подменяем их фотографиями другой страны/);
 assert.doesNotMatch(await page.locator('#notice').innerText(),/внешние 360°|ссылки ниже/i);
 console.log('PASS_CAIRO_BOUNDED_ZERO_360_NO_FALSE_VISITS');
 await page.unrouteAll();
 await page.locator('#originChoice').selectOption('fes');
 await page.locator('#startBtn').click();
 await page.waitForFunction(
  ()=>Number(document.querySelector('#statUnique')?.textContent)>=1&&
      (document.querySelector('#runStatus')?.textContent||'').includes('Живой взгляд'),
  null,{timeout:35000});
 assert.equal(await page.locator('pnx-photo-viewer').count(),1);
 assert.equal(await page.locator('.view-feedback').count(),0,'no overlay over real panorama');
 const pos=(await page.locator('#coords').innerText()).split(',').map(Number);
 assert.ok(Math.abs(pos[0]-34.061672694)<.05&&Math.abs(pos[1]-(-4.977107))<.05,'wrong photo position');
 assert.deepEqual(errors,[]);
 console.log('PASS_FES_REAL_PANORAMAX_360_GAZE',{pos,errors});
 // A fresh mobile view has the same one-search layout without a gateway.
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const mobileErrors=[];
 mobile.on('pageerror',e=>mobileErrors.push(e.message));
 try{
   await mobile.goto(sourceURL,{waitUntil:'domcontentloaded',timeout:25000});
   await assertSingleUI(mobile);
   await mobile.locator('#originChoice').selectOption('pyongyang');
   assert.equal(await mobile.locator('#originChoice').inputValue(),'pyongyang');
   assert.deepEqual(mobileErrors,[]);
   console.log('PASS_MOBILE_ONE_SEARCH_R2');
 }finally{await mobile.close()}
 await page.screenshot({path:'single-search-smoke.png',fullPage:true});
}catch(e){
 console.error('FAIL_R9_SINGLE_SEARCH',e.message,'notice',
   await page.locator('#notice').innerText().catch(()=>''),errors);
 process.exitCode=1;
}finally{await browser.close()}
