// Manual live smoke test; intentionally not part of offline PR CI.
// Requires: npm install --no-save playwright && npx playwright install chromium
// Run npm run dev separately, then: node tools/browser-gaze-check.mjs
import {setTimeout as sleep} from 'node:timers/promises';

let chromium;
try {({chromium}=await import('playwright'));}
catch {
  console.error('Install browser tool first: npm install --no-save playwright && npx playwright install chromium');
  process.exit(2);
}
const browser=await chromium.launch({
  headless:true,
  ...(process.env.BROWSER_PATH ? {executablePath:process.env.BROWSER_PATH} : {})
});
const page=await browser.newPage({viewport:{width:1280,height:920}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
let outcomes={};
try {
  await page.goto(process.env.PORTAL_URL||'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
  await page.locator('#interestMode').selectOption('details');
  await page.locator('#seconds').fill('12');
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>Number(document.querySelector('#statUnique')?.textContent)>=1,null,{timeout:45000});
  const getPose=()=>page.evaluate(()=>document.querySelector('pnx-photo-viewer')?.psv?.getXYZ?.()||null);
  await sleep(500);
  const first=await getPose();
  await sleep(1100);
  const next=await getPose();
  outcomes.headMoved=!!first&&!!next&&Math.abs(next.x-first.x)>0.1;
  await page.locator('#pauseBtn').click();
  const paused=await getPose();
  await sleep(900);
  outcomes.paused=JSON.stringify(paused)===JSON.stringify(await getPose());
  await page.locator('#pauseBtn').click();
  let maxZoom=0;
  const start=Date.now();
  while(Date.now()-start<60000) {
    const p=await getPose(); maxZoom=Math.max(maxZoom,p?.z||0);
    if(Number(await page.locator('#statUnique').innerText())>=2)break;
    await sleep(300);
  }
  outcomes.maxZoom=maxZoom;
  outcomes.secondJump=Number(await page.locator('#statUnique').innerText())>=2;
  outcomes.noPageErrors=errors.length===0;
  console.log('JANUS HUMAN GAZE LIVE GATES',JSON.stringify(outcomes,null,2));
  await page.screenshot({path:'portal-gaze-check.png',fullPage:true});
  if(!outcomes.headMoved||!outcomes.paused||maxZoom<1||!outcomes.secondJump||!outcomes.noPageErrors)
    process.exitCode=1;
} catch(error) {
  console.error('LIVE GAZE TEST FAILED',error.message,errors);
  process.exitCode=1;
} finally {await browser.close()}
