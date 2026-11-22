// Public HTTPS browser smoke: REAL API coverage, REAL panorama, local Passport.
// Requires Playwright Chromium. This is not a payment/account validation.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url=process.env.PORTAL_URL||'https://hawkar-usls.github.io/Janus-Portal/';
const expectedSha=process.env.DEPLOY_SHA||null;
const browser=await chromium.launch({headless:true,timeout:20000,
  args:['--disable-dev-shm-usage','--enable-webgl','--use-gl=swiftshader']});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1366,height:850}});
  page.on('pageerror',e=>errors.push(e.message));
  const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
  assert.equal(r.status(),200);
  console.log('R14 LIVE STEP1 HTTPS 200');
  const js=await page.locator('script[type=module]').getAttribute('src');
  const css=await page.locator('link[href^="./src/styles.css"]').getAttribute('href');
  const appSha=js?.split('?build=')[1]||null;
  const styleSha=css?.split('?build=')[1]||null;
  assert.ok(appSha&&appSha===styleSha,'Mixed Pages asset revisions');
  if(expectedSha)assert.equal(appSha,expectedSha,'Published site has an older revision');
  assert.equal(await page.locator('#afkBtn').count(),1);
  assert.equal(await page.locator('#passportGame').count(),1);
  assert.equal(await page.locator('#sourceGateway').count(),0);
  assert.equal(await page.locator('#originChoice').count(),1);
  await page.waitForFunction(()=>{
    const s=document.querySelector('#coverageStatus')?.dataset.state;
    return s==='ready'||s==='timeout'||s==='error';
  },null,{timeout:42000});
  const status=await page.locator('#coverageStatus').innerText();
  const values=await page.locator('#originChoice option').evaluateAll(opts=>
    opts.map(x=>x.value).filter(Boolean));
  console.log('R14 LIVE STEP2 CATALOGUE',JSON.stringify({count:values.length,status}));
  assert.ok(values.includes('fes'),'No currently verified 360 in Fes');
  await page.locator('#originChoice').selectOption('fes');
  assert.equal(await page.locator('#afkBtn').isEnabled(),true);
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>
    Number(document.querySelector('#passportViews')?.textContent)>=1 &&
    (document.querySelector('#runStatus')?.textContent||'').includes('Живой взгляд'),
    null,{timeout:45000});
  const place=await page.locator('#placeLabel').innerText();
  const stats={views:await page.locator('#passportViews').innerText(),
    countries:await page.locator('#passportCountries').innerText(),
    xp:await page.locator('#passportXp').innerText()};
  assert.ok(Number(stats.views)>=1);
  assert.ok(Number(stats.countries)>=1);
  assert.ok(Number(stats.xp)>=35);
  assert.ok(await page.locator('pnx-photo-viewer,#viewer canvas').count()>=1);
  console.log('R14 LIVE STEP3 REAL PHOTO AND PASSPORT',JSON.stringify({place,stats}));
  await page.locator('#fullscreenBtn').click();
  await page.waitForFunction(()=>
    document.querySelector('.viewer-panel')?.classList.contains('portal-fullscreen-active'),
    null,{timeout:5000});
  assert.equal(await page.locator('#fullscreenBtn').getAttribute('aria-pressed'),'true');
  await page.locator('#fullscreenBtn').click();
  await page.waitForFunction(()=>
    !document.querySelector('.viewer-panel')?.classList.contains('portal-fullscreen-active'),
    null,{timeout:5000});
  assert.deepEqual(errors,[]);
  console.log('R14_LIVE_HTTPS_PASS',JSON.stringify({place,stats,errors}));
  await page.close();
}catch(error){
  console.error('R14_LIVE_HTTPS_FAIL',error.stack||error,JSON.stringify(errors));
  process.exitCode=1;
}finally{await browser.close()}
