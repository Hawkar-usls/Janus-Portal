// Acceptance test for R5 first-click reliability. Requires optional Playwright.
// PORTAL_URL=... BROWSER_PATH=... node tools/browser-start-check.mjs
import assert from 'node:assert/strict';
let chromium;
try{({chromium}=await import('playwright'))}
catch{console.error('Please install Playwright separately for live smoke test');process.exit(2)}
const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const page=await browser.newPage({viewport:{width:1280,height:850}});
const jsErrors=[];
page.on('pageerror',e=>jsErrors.push(e.message));
const blocked=[];
await page.route(/(?:cdn\.jsdelivr\.net|unpkg\.com|api\.panoramax\.xyz)/,route=>{
  blocked.push(route.request().url());
  return route.abort();
});
try{
  const url=process.env.PORTAL_URL||'http://127.0.0.1:4173/';
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
  assert.equal(response.status(),200);
  assert.equal(await page.evaluate(()=>window.__JANUS_PORTAL_READY__),true);
  await page.locator('#quickStartBtn').click();
  await page.waitForFunction(()=>document.querySelector('#runStatus')?.textContent.includes('Живой взгляд'),null,{timeout:25000});
  assert.equal(await page.locator('.native-panorama canvas').count(),1);
  assert.match(await page.locator('.native-panorama-credit').innerText(),/Luc Girod/);
  assert.equal(await page.locator('#statUnique').innerText(),'1');
  const first=await page.evaluate(()=>document.querySelector('.native-panorama').__janusViewer.getXYZ());
  await page.waitForTimeout(1200);
  const later=await page.evaluate(()=>document.querySelector('.native-panorama').__janusViewer.getXYZ());
  assert.ok(Math.abs(first.x-later.x)>.1 || Math.abs(first.y-later.y)>.1,'gaze did not move');
  assert.deepEqual(jsErrors,[]);
  console.log('PASS first-click 360 / natural camera / without CDN JS or metadata API',
    JSON.stringify({first,later,blocked,visibleState:await page.locator('#runStatus').innerText()}));
}catch(error){
  console.error('FAIL R5 first-start',error.message,'UI',await page.locator('#notice').innerText().catch(()=>''),jsErrors);
  process.exitCode=1;
}finally{await browser.close()}
