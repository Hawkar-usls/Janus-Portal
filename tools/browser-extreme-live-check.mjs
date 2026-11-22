// Optional live browser test. Not part of CI because photo-provider coverage changes.
// Requires npm install --no-save playwright and a running static dev server.
// Set BROWSER_PATH=path to Edge/Chrome or install Playwright's Chromium.
// Set PORTAL_URL to choose local or the deployed public version.
import assert from 'node:assert/strict';
let chromium;
try {({chromium}=await import('playwright'))}
catch {console.error('Install Playwright before running the live browser test');process.exit(2)}
const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const page=await browser.newPage({viewport:{width:1366,height:860}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  await page.goto(process.env.PORTAL_URL||'http://127.0.0.1:4173/',
    {waitUntil:'domcontentloaded',timeout:25000});
  await page.locator('#quickStartBtn').click();
  await page.waitForFunction(
    ()=>Number(document.querySelector('#statUnique')?.textContent)>=1,
    null,{timeout:65000}
  );
  const current=await page.locator('#coords').innerText();
  const [lat,lng]=current.split(',').map(Number);
  assert.ok(lat>=67.8&&lat<=68.1 && lng>=12.8&&lng<=13.3,
    'Unexpected jump outside Reine / Lofoten: '+current);
  assert.ok(await page.locator('.native-panorama canvas, pnx-photo-viewer').count()===1);
  assert.deepEqual(errors,[]);
  const record={result:'LIVE_PANORAMAX_360_PASS',
    place:'Reine, Norway',coordinates:current,
    unique:await page.locator('#statUnique').innerText(),
    gaze:await page.locator('#gazeStage').innerText()};
  console.log(JSON.stringify(record,null,2));
  await page.screenshot({path:'janus-extreme-reine-smoke.png',fullPage:true});
}catch(e){
  console.error('LIVE_EXTREME_SMOKE_FAILED',e.message,
    await page.locator('#notice').innerText().catch(()=>''),errors);
  process.exitCode=1;
}finally{await browser.close()}
