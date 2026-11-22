// Optional real browser smoke: Node/Playwright (not required by offline CI).
// PORTAL_URL=http://127.0.0.1:4173/ BROWSER_PATH=... node tools/browser-r7-cautious-coverage-check.mjs
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url=process.env.PORTAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const page=await browser.newPage({viewport:{width:1340,height:860}});
const errors=[];let calls=0;let mock=true;
page.on('pageerror',e=>errors.push(e.message));
await page.route(/https:\/\/api\.panoramax\.xyz\/api\/search(?:\?|$)/,route=>{
  if(!mock)return route.continue();
  calls++;
  return route.fulfill({status:200,contentType:'application/geo+json',
    body:JSON.stringify({type:'FeatureCollection',features:[]})});
});
async function searchEmpty(key){
  await page.locator('#originChoice').selectOption(key);
  const before=calls;
  await page.locator('#startBtn').click();
  await page.waitForFunction(
    ()=>document.querySelector('#runStatus')?.textContent?.includes('360° рядом не найдены'),
    null,{timeout:16000});
  const probes=calls-before;
  assert.equal(probes,16,key+' should search only 5/10/20/40km with four probes each');
  assert.equal(await page.locator('#startBtn').innerText(),'▶ Запустить');
  assert.equal(await page.locator('#statUnique').innerText(),'0');
  assert.match(await page.locator('#notice').innerText(),/Не подменяем их фотографиями другой страны/);
  console.log('PASS BOUNDED_NO_COVERAGE',key,'metadata_probes',probes);
}
try{
  const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
  assert.equal(r.status(),200);
  assert.equal(await page.locator('script[type=module]').getAttribute('src'),'./src/app.js');
  assert.equal(await page.locator('#originChoice option[value="pyongyang"]').count(),1);
  assert.equal(await page.locator('#originChoice option[value="cairo"]').count(),1);
  assert.equal(await page.locator('#originChoice option[value="nairobi"]').count(),1);
  for(const needle of ['north-korea-travel.com/dprk-panorama.html','giza.fas.harvard.edu/giza3d/','egymonuments.gov.eg/en/media-hub/'])
    assert.ok((await page.locator('.external-panorama-links').innerHTML()).includes(needle));
  await searchEmpty('pyongyang');
  await searchEmpty('cairo');
  mock=false;
  await page.locator('#originChoice').selectOption('fes');
  await page.locator('#startBtn').click();
  await page.waitForFunction(
    ()=>Number(document.querySelector('#statUnique')?.textContent)>=1 &&
      (document.querySelector('#runStatus')?.textContent||'').includes('Живой взгляд'),
    null,{timeout:35000});
  assert.equal(await page.locator('pnx-photo-viewer').count(),1);
  assert.match(await page.locator('#runStatus').innerText(),/Живой взгляд/);
  assert.equal(errors.length,0,errors.join(';'));
  console.log('PASS EXISTING_R2_MOROCCO_REAL_360',
    await page.locator('#coords').innerText(),'pageerrors',errors.length);
}catch(e){
  console.error('FAIL R7 BROWSER',e.message,
    'notice',await page.locator('#notice').innerText().catch(()=>''),errors);
  process.exitCode=1;
}finally{await browser.close()}
