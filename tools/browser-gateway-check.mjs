// Optional live Edge/Playwright acceptance. npm install --no-save playwright
// PORTAL_URL=http://127.0.0.1:4173/ BROWSER_PATH=... node tools/browser-gateway-check.mjs
// Real Panoramax in Fes, mock empty Pyongyang. No Google paid requests.
import assert from 'node:assert/strict';
let chromium;
try{({chromium}=await import('playwright'))}
catch{console.error('Install optional Playwright for this manual browser test');process.exit(2)}
const browser=await chromium.launch({headless:true,
 ...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const page=await browser.newPage({viewport:{width:1366,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const sourceURL=process.env.PORTAL_URL||'http://127.0.0.1:4173/';
try{
 const response=await page.goto(sourceURL,{waitUntil:'domcontentloaded',timeout:25000});
 assert.equal(response.status(),200);
 assert.equal(await page.locator('script[type=module]').getAttribute('src'),'./src/app.js');
 assert.equal(await page.locator('#sourceGateway').count(),1);
 assert.equal(await page.locator('#gatewaySources .gateway-card').count(),3);
 let sourceLinks=await page.locator('#gatewaySources a.gateway-action').all();
 assert.equal(sourceLinks.length,1);
 assert.ok((await sourceLinks[0].getAttribute('href')).includes('north-korea-travel.com'));
 assert.equal(await sourceLinks[0].getAttribute('target'),'_blank');
 console.log('PASS_GATEWAY_NORTH_KOREA_CATALOGUE');
 await page.locator('#gatewayPlace').selectOption('giza');
 assert.equal(await page.locator('#gatewaySources .gateway-card').count(),4);
 sourceLinks=await page.locator('#gatewaySources a.gateway-action').all();
 assert.equal(sourceLinks.length,2);
 for(const link of sourceLinks){
  assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
  assert.equal(await link.getAttribute('target'),'_blank');
 }
 assert.match(await page.locator('#gatewayStatus').innerText(),/не подтверждён/);
 console.log('PASS_GATEWAY_CAIRO_SOURCE_ROUTING');
 await page.locator('#gatewaySources .gateway-card').nth(1).locator('button').click();
 assert.equal(await page.locator('#provider').inputValue(),'google');
 assert.equal(await page.locator('#googleKeyWrap').isVisible(),true);
 assert.match(await page.locator('#gatewayStatus').innerText(),/нужен ограниченный браузерный ключ/);
 assert.equal(await page.locator('#statUnique').innerText(),'0');
 console.log('PASS_GOOGLE_KEY_GATE');
 await page.locator('#gatewayPlace').selectOption('fes');
 assert.match(await page.locator('#gatewayStatus').innerText(),/подтверждён/);
 await page.locator('#gatewaySources .gateway-card').first().locator('button').click();
 await page.waitForFunction(()=>Number(document.querySelector('#statUnique')?.textContent)>=1 &&
    (document.querySelector('#runStatus')?.textContent||'').includes('Живой взгляд'),
    null,{timeout:35000});
 assert.equal(await page.locator('#originChoice').inputValue(),'fes');
 assert.equal(await page.locator('#provider').inputValue(),'panoramax');
 assert.equal(await page.locator('pnx-photo-viewer').count(),1);
 console.log('PASS_REAL_FES_PANORAMAX_360',await page.locator('#coords').innerText());
 await page.locator('#startBtn').click();
 await page.route('https://api.panoramax.xyz/api/search**',route=>route.fulfill({
  status:200,contentType:'application/geo+json',
  body:JSON.stringify({type:'FeatureCollection',features:[]})
 }));
 await page.locator('#gatewayPlace').selectOption('pyongyang');
 await page.locator('#gatewaySources .gateway-card').first().locator('button').click();
 await page.waitForFunction(()=>(document.querySelector('#runStatus')?.textContent||'')
   .includes('360° рядом не найдены'),null,{timeout:16000});
 assert.equal(await page.locator('#startBtn').innerText(),'▶ Запустить');
 assert.equal(await page.locator('#statUnique').innerText(),'1');
 assert.match(await page.locator('#notice').innerText(),/Не подменяем их фотографиями другой страны/);
 assert.equal(errors.length,0,errors.join(';'));
 console.log('PASS_PYONGYANG_BOUNDED_NO_FAKE_PANORAMA',JSON.stringify({errors}));
 await page.screenshot({path:'gateway-smoke.png',fullPage:true});
 const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const phoneErrors=[];phone.on('pageerror',error=>phoneErrors.push(error.message));
 try{
   await phone.goto(sourceURL,{waitUntil:'domcontentloaded'});
   assert.equal(await phone.locator('#sourceGateway').count(),1);
   await phone.locator('#gatewayPlace').selectOption('cairo');
   assert.equal(await phone.locator('#gatewaySources .gateway-card').count(),4);
   const narrow=await phone.evaluate(()=>({
     viewport:document.documentElement.clientWidth,
     card:document.querySelector('.gateway-card')?.getBoundingClientRect().width,
     section:document.querySelector('#sourceGateway')?.getBoundingClientRect().width
   }));
   assert.ok(narrow.card>100&&narrow.card<narrow.section,narrow.card+' '+narrow.section);
   assert.equal(phoneErrors.length,0,phoneErrors.join(';'));
   console.log('PASS_MOBILE_GATEWAY',JSON.stringify(narrow));
 }finally{await phone.close()}
}catch(error){
 console.error('FAIL_GATEWAY',error.message,'notice',await page.locator('#notice').innerText().catch(()=>''),errors);
 process.exitCode=1;
}finally{await browser.close()}
