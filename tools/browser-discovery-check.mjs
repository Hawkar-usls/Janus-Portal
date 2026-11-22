// Opt-in browser smoke: npm install --no-save playwright ; npx playwright install chromium
// Run a local server (npm run dev), then: node tools/browser-discovery-check.mjs
// PORTAL_URL=https://hawkar-usls.github.io/Janus-Portal/ also supported.
// Tests real UI plus MOCKED zero-coverage tour; no Google API keys or J Coins.
import assert from 'node:assert/strict';
let chromium;
try{({chromium}=await import('playwright'))}
catch{console.error('Install Playwright to run this manual browser test.');process.exit(2)}
const origin=process.env.PORTAL_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({
  headless:true,
  ...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})
});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin,{waitUntil:'domcontentloaded',timeout:25000});
  await page.locator('#tabTours').click();
  assert.equal(await page.locator('.discovery-card').count(),12);
  await page.locator('.discovery-search').fill('Каир');
  assert.equal(await page.locator('.discovery-card').count(),1);
  await page.locator('#tabDestinations').click();
  assert.equal(await page.locator('.discovery-card').count(),37);
  await page.locator('#fullscreenBtn').click();
  assert.equal(await page.locator('#fullscreenBtn').getAttribute('aria-pressed'),'true');
  await page.locator('#fullscreenBtn').click();
  assert.equal(await page.locator('#fullscreenBtn').getAttribute('aria-pressed'),'false');
  await page.close();

  const mock=await browser.newPage({viewport:{width:1280,height:900}});
  mock.on('pageerror',e=>errors.push(e.message));
  await mock.route('https://api.panoramax.xyz/api/search**',route=>route.fulfill({
    status:200,contentType:'application/geo+json',
    body:JSON.stringify({type:'FeatureCollection',features:[]})
  }));
  await mock.goto(origin,{waitUntil:'domcontentloaded'});
  await mock.locator('#tabTours').click();
  await mock.locator('.discovery-search').fill('Каир');
  await mock.locator('.discovery-card').first().click();
  await mock.waitForFunction(()=>document.querySelector('#runStatus')?.textContent.includes('Экскурсия завершена'),null,{timeout:25000});
  const progress=await mock.locator('#tourProgress').innerText();
  assert.match(progress,/пропущено 7/);
  assert.equal(await mock.locator('#statUnique').innerText(),'0');
  assert.equal(await mock.locator('#statCoins').innerText(),'—');
  await mock.close();

  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(origin,{waitUntil:'domcontentloaded'});
  await mobile.evaluate(()=>Object.defineProperty(
    document.getElementById('viewerPanel'),'requestFullscreen',{value:undefined,configurable:true}
  ));
  await mobile.locator('#fullscreenBtn').click();
  assert.equal(await mobile.locator('#viewerPanel.is-immersive').count(),1);
  await mobile.keyboard.press('Escape');
  assert.equal(await mobile.locator('#viewerPanel.is-immersive').count(),0);
  assert.equal(await mobile.locator('#fullscreenBtn').getAttribute('aria-pressed'),'false');
  await mobile.close();

  assert.deepEqual(errors,[]);
  console.log('JANUS PORTAL discovery browser smoke PASS: 12 tours / 37 places / fullscreen / Cairo zero-coverage safety / mobile ESC');
} catch(error) {
  console.error('Discovery browser smoke FAIL:',error.message);
  if(errors.length) console.error('Page errors:',errors);
  process.exitCode=1;
} finally {await browser.close()}
