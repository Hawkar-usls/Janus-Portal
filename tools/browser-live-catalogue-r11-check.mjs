// R11 acceptance on a real published/local browser.
// npm install --no-save playwright
// PORTAL_URL=http://127.0.0.1:4173/ BROWSER_PATH=... node tools/browser-live-catalogue-r11-check.mjs
import assert from 'node:assert/strict';
let chromium;
try{({chromium}=await import('playwright'))}
catch{console.error('Optional Playwright not installed');process.exit(2)}
const browser=await chromium.launch({headless:true,
 ...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const url=process.env.PORTAL_URL||'http://127.0.0.1:4173/';
const waitComplete=async page=>page.waitForFunction(
 ()=>document.querySelector('#coverageStatus')?.textContent?.includes('Проверено сейчас:'),
 null,{timeout:40000}
);
const getItems=async page=>page.locator('#originChoice option').evaluateAll(items=>items
 .filter(x=>x.value).map(x=>({id:x.value,label:x.textContent})));
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 page.on('pageerror',e=>errors.push('real: '+e.message));
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
 assert.equal(response.status(),200);
 assert.match(await page.locator('script[type=module]').getAttribute('src'),/^\.\/src\/app\.js(?:\?build=[0-9a-f]{40})?$/);
 assert.equal(await page.locator('#originChoice option[value="random"]').count(),0);
 assert.equal(await page.locator('#originChoice option[value="random-verified"]').count(),0);
 assert.equal(await page.locator('#sourceGateway').count(),0);
 assert.equal(await page.locator('#manualStartBtn').count(),1);
 await waitComplete(page);
 const items=await getItems(page);
 assert.ok(items.length>=8,'live source list too short: '+items.length);
 for(const id of ['pyongyang','cairo','giza','nairobi','lagos','windhoek','rio']){
   assert.ok(!items.some(x=>x.id===id),'unverified leaked into dropdown: '+id);
 }
 assert.ok(items.some(x=>x.id==='fes'),'tested Fes source missing');
 assert.ok(items.some(x=>x.id==='pune'),'tested Pune source missing');
 assert.ok(items.every(x=>!x.id.startsWith('random')));
 assert.equal(await page.locator('#originChoice').isEnabled(),true);
 assert.equal(await page.locator('#startBtn').isEnabled(),true);
 console.log('PASS_REAL_LIVE_CATALOGUE',JSON.stringify({
   count:items.length,items:items.map(x=>x.id),status:await page.locator('#coverageStatus').innerText()
 }));
 await page.locator('#originChoice').selectOption('fes');
 await page.locator('#startBtn').click();
 await page.waitForFunction(()=>Number(document.querySelector('#statUnique')?.textContent)>=1 &&
  (document.querySelector('#runStatus')?.textContent||'').includes('Живой взгляд'),
  null,{timeout:35000});
 assert.equal(await page.locator('pnx-photo-viewer').count(),1);
 const coord=(await page.locator('#coords').innerText()).split(',').map(Number);
 assert.ok(Math.abs(coord[0]-34.06167)<.06&&Math.abs(coord[1]-(-4.9771))<.06);
 await page.locator('#fullscreenBtn').click();
 await page.waitForFunction(()=>document.querySelector('.viewer-panel')
  .classList.contains('portal-fullscreen-active'),null,{timeout:5000});
 assert.equal(await page.locator('pnx-photo-viewer').count(),1);
 await page.locator('#fullscreenBtn').click();
 await page.waitForFunction(()=>!document.querySelector('.viewer-panel')
  .classList.contains('portal-fullscreen-active'),null,{timeout:5000});
 assert.equal(await page.locator('pnx-photo-viewer').count(),1);
 console.log('PASS_REAL_FES_PINNED_PANORAMA_AND_FULLSCREEN',coord);
 await page.close();

 // Deterministic feed checks: one city is verified now; next live fetch removes
 // that city and adds another; errors never restore stale or 2D-only options.
 const mocked=await browser.newPage({viewport:{width:1170,height:800}});
 mocked.on('pageerror',e=>errors.push('mock: '+e.message));
 let mode='fes',calls=0;
 await mocked.route(/https:\/\/api\.panoramax\.xyz\/api\/search(?:\?|$)/,route=>{
  const u=new URL(route.request().url());
  const box=(u.searchParams.get('bbox')||'').split(',').map(Number);
  const centre={lat:(box[1]+box[3])/2,lng:(box[0]+box[2])/2};
  const matches=(id)=>id==='fes'
    ?Math.abs(centre.lat-34.061672694)<.02&&Math.abs(centre.lng+4.977107)<.02
    :Math.abs(centre.lat-27.679029333)<.02&&Math.abs(centre.lng-85.316770333)<.02;
  const photo=mode==='fes'||mode==='kathmandu'&&matches('kathmandu');
  const features=mode==='error'?null:(matches(mode)&&photo?[
   {id:'mock-'+mode,collection:'real-360-fixture',type:'Feature',
    geometry:{type:'Point',coordinates:[centre.lng,centre.lat]},
    properties:{'pano:projection_type':'equirectangular'},
    assets:{sd:{href:'https://panoramax.openstreetmap.fr/fixtures/360.jpg'}}}
  ]:[]);
  calls++;
  if(mode==='error')return route.fulfill({status:503,body:'Unavailable'});
  return route.fulfill({status:200,contentType:'application/geo+json',
    body:JSON.stringify({type:'FeatureCollection',features})});
 });
 await mocked.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
 await waitComplete(mocked);
 let names=(await getItems(mocked)).map(x=>x.id);
 assert.deepEqual(names,['fes']);
 assert.ok(calls>=38);
 console.log('PASS_MOCK_ONLY_ONE_CHECKED_LOCATION',calls);
 mode='kathmandu';
 await mocked.locator('#refreshCoverageBtn').click();
 await waitComplete(mocked);
 names=(await getItems(mocked)).map(x=>x.id);
 assert.deepEqual(names,['kathmandu'],'obsolete Fes entry persisted');
 console.log('PASS_REFRESH_REMOVES_STALE_AND_ADDS_NEW_SOURCE',calls);
 mode='none';
 await mocked.locator('#refreshCoverageBtn').click();
 await waitComplete(mocked);
 names=(await getItems(mocked)).map(x=>x.id);
 assert.deepEqual(names,[]);
 assert.equal(await mocked.locator('#startBtn').isDisabled(),true);
 console.log('PASS_EMPTY_CATALOGUE_HAS_ZERO_UNVERIFIED_LOCATIONS');
 mode='error';
 await mocked.locator('#refreshCoverageBtn').click();
 await mocked.waitForFunction(
   ()=>document.querySelector('#coverageStatus')?.dataset.state==='error',
   null,{timeout:15000});
 names=(await getItems(mocked)).map(x=>x.id);
 assert.deepEqual(names,[]);
 assert.match(await mocked.locator('#coverageStatus').innerText(),/Не удалось проверить каталог/);
 console.log('PASS_API_FAILURE_NEVER_REUSES_STALE_LIST');
 await mocked.locator('#provider').selectOption('google');
 assert.equal(await mocked.locator('#originChoice').isDisabled(),true);
 assert.equal((await getItems(mocked)).length,0);
 assert.equal(await mocked.locator('#manualOrigin').evaluate(el=>el.open),true);
 assert.match(await mocked.locator('#coverageStatus').innerText(),/платную квоту/);
 console.log('PASS_GOOGLE_MANUAL_ONLY_NO_BILLABLE_AUTO_CATALOGUE');
 await mocked.close();

 const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 phone.on('pageerror',e=>errors.push('phone: '+e.message));
 await phone.route(/https:\/\/api\.panoramax\.xyz\/api\/search(?:\?|$)/,route=>
  route.fulfill({status:200,contentType:'application/geo+json',
   body:JSON.stringify({type:'FeatureCollection',features:[]})}));
 await phone.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
 await waitComplete(phone);
 assert.equal(await phone.locator('#refreshCoverageBtn').isVisible(),true);
 assert.equal(await phone.locator('#startBtn').isDisabled(),true);
 assert.deepEqual(errors,[]);
 console.log('PASS_MOBILE_NO_FAKE_PANORAMAS_AND_NO_JS_ERRORS');
 await phone.close();
}catch(error){console.error('R11_BROWSER_FAIL',error.stack||error,errors);process.exitCode=1}
finally{await browser.close()}
