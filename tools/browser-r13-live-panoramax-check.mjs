// R13 optional LIVE regression: genuine Panoramax API + viewer on Fes.
// KartaView/Commons are deliberately mocked empty to isolate the existing
// user-confirmed provider. This is NOT evidence of those new providers.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,
  args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route(/https:\/\/api\.kartaview\.org\/2\.0\/photo\//,route=>
  route.fulfill({status:200,contentType:'application/json',
    body:'{"result":{"data":[]}}'}));
await page.route(/https:\/\/commons\.wikimedia\.org\/w\/api\.php/,route=>
  route.fulfill({status:200,contentType:'application/json',
    body:'{"query":{"pages":{}}}'}));
try{
  await page.goto(process.env.PORTAL_URL||'http://127.0.0.1:4173/',{
    waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#coverageStatus')
    ?.textContent?.startsWith('Обновлено в')||
    document.querySelector('#coverageStatus')?.dataset.state==='timeout',
    null,{timeout:42000});
  const status=await page.locator('#coverageStatus').innerText();
  const candidates=await page.locator('#originChoice option').evaluateAll(nodes=>
    nodes.filter(n=>n.value).map(n=>n.value));
  assert.ok(candidates.includes('fes'),
    'Real Panoramax Fes 360 candidate missing; API outage or incompatible source: '+status);
  await page.locator('#originChoice').selectOption('fes');
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>Number(document.querySelector('#statUnique')?.textContent)>=1
    && document.querySelector('pnx-photo-viewer'),null,{timeout:45000});
  const coords=(await page.locator('#coords').innerText()).split(',').map(Number);
  assert.ok(Math.abs(coords[0]-34.06167)<.06&&Math.abs(coords[1]+4.9771)<.06,
    'Panoramax live image must belong to sampled Fes coordinates');
  assert.equal(await page.locator('pnx-photo-viewer').count(),1);
  await page.locator('#fullscreenBtn').click();
  await page.waitForFunction(()=>document.querySelector('.viewer-panel')
    ?.classList.contains('portal-fullscreen-active'),null,{timeout:8000});
  assert.equal(await page.locator('pnx-photo-viewer').count(),1);
  await page.locator('#fullscreenBtn').click();
  await page.waitForFunction(()=>!document.querySelector('.viewer-panel')
    ?.classList.contains('portal-fullscreen-active'),null,{timeout:8000});
  assert.deepEqual(errors,[]);
  console.log('R13_LIVE_PANORAMAX_PASS',JSON.stringify({
    candidateCount:candidates.length,coordinates:coords,
    realImage:true,fullscreen:true,jsErrors:errors.length
  }));
}catch(e){
  console.error('R13_LIVE_PANORAMAX_FAIL',e?.stack||e,errors);
  process.exitCode=1;
}finally{await browser.close();}
