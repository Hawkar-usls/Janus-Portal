// R10 real browser acceptance for native fullscreen and CSS fallback.
// npm install --no-save playwright
// PORTAL_URL=http://127.0.0.1:4173/ BROWSER_PATH=... node tools/browser-fullscreen-r10-check.mjs
import assert from 'node:assert/strict';
let chromium;
try{({chromium}=await import('playwright'))}
catch{console.error('Install optional Playwright before running R10 browser smoke');process.exit(2)}
const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const url=process.env.PORTAL_URL||'http://127.0.0.1:4173/';
const errors=[];
const stage=async(page)=>page.evaluate(()=>{
 const panel=document.querySelector('.viewer-panel');
 const view=document.querySelector('#viewer');
 const button=document.querySelector('#fullscreenBtn');
 const box=panel.getBoundingClientRect(),photo=view.getBoundingClientRect();
 return {native:document.fullscreenElement===panel,
   fallback:panel.classList.contains('portal-fullscreen-fallback'),
   active:panel.classList.contains('portal-fullscreen-active'),
   bodyLocked:document.body.classList.contains('portal-fullscreen-locked'),
   text:button.textContent.trim(),pressed:button.getAttribute('aria-pressed'),
   panelHeight:Math.round(box.height),viewHeight:Math.round(photo.height),
   viewport:window.innerHeight};
});
const results=[];
try{
 const desktop=await browser.newPage({viewport:{width:1366,height:840}});
 desktop.on('pageerror',err=>errors.push('desktop: '+err.message));
 assert.equal((await desktop.goto(url,{waitUntil:'domcontentloaded',timeout:25000})).status(),200);
 assert.equal(await desktop.locator('script[type=module]').getAttribute('src'),'./src/app.js');
 assert.equal(await desktop.locator('#sourceGateway').count(),0);
 assert.equal(await desktop.locator('#fullscreenBtn').count(),1);
 await desktop.locator('#originChoice').selectOption('fes');
 await desktop.locator('#startBtn').click();
 await desktop.waitForFunction(()=>Number(document.querySelector('#statUnique')?.textContent)>=1 &&
   (document.querySelector('#runStatus')?.textContent||'').includes('Живой взгляд'),
  null,{timeout:42000});
 assert.equal(await desktop.locator('pnx-photo-viewer').count(),1);
 const before=await desktop.locator('#coords').innerText();
 await desktop.locator('#fullscreenBtn').click();
 await desktop.waitForFunction(()=>document.querySelector('.viewer-panel')
   .classList.contains('portal-fullscreen-active'),null,{timeout:6000});
 const expanded=await stage(desktop);
 assert.ok(expanded.native||expanded.fallback,'fullscreen did not enter');
 assert.ok(expanded.viewHeight>expanded.viewport*.5,'360° image does not fill viewport');
 assert.equal(expanded.pressed,'true');
 assert.match(expanded.text,/Свернуть/);
 assert.equal(await desktop.locator('pnx-photo-viewer').count(),1);
 assert.equal(await desktop.locator('#coords').innerText(),before);
 await desktop.locator('#fullscreenBtn').click();
 await desktop.waitForFunction(()=>!document.querySelector('.viewer-panel')
   .classList.contains('portal-fullscreen-active'),null,{timeout:6000});
 const exited=await stage(desktop);
 assert.ok(!exited.native&&!exited.fallback);
 assert.equal(exited.pressed,'false');
 assert.equal(await desktop.locator('pnx-photo-viewer').count(),1);
 results.push({case:'desktop native or fallback with real Fes panorama',expanded,exited});
 await desktop.close();

 // Force an environment like iOS Safari, which rejects generic Fullscreen API:
 // still provide a readable 100dvh in-page viewport without navigation.
 const fallback=await browser.newPage({viewport:{width:1050,height:760}});
 fallback.on('pageerror',err=>errors.push('fallback: '+err.message));
 await fallback.addInitScript(()=>{
   Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:undefined});
   Object.defineProperty(Element.prototype,'webkitRequestFullscreen',{configurable:true,value:undefined});
 });
 await fallback.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
 await fallback.locator('#fullscreenBtn').click();
 let f=await stage(fallback);
 assert.equal(f.fallback,true);
 assert.equal(f.native,false);
 assert.equal(f.bodyLocked,true);
 assert.ok(Math.abs(f.panelHeight-f.viewport)<4);
 await fallback.keyboard.press('Escape');
 await fallback.waitForFunction(()=>!document.querySelector('.viewer-panel')
   .classList.contains('portal-fullscreen-fallback'),null,{timeout:3000});
 f=await stage(fallback);
 assert.equal(f.bodyLocked,false);
 await fallback.locator('#fullscreenBtn').click();
 assert.equal((await stage(fallback)).fallback,true);
 await fallback.locator('#fullscreenBtn').click();
 assert.equal((await stage(fallback)).fallback,false);
 results.push({case:'fallback CSS enter, Escape exit and toggle exit',result:'PASS'});
 await fallback.close();

 // Mobile layout when fullscreen is unavailable must keep a 360°-sized
 // browsing panel and the exit control within the viewport.
 const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 phone.on('pageerror',err=>errors.push('phone: '+err.message));
 await phone.addInitScript(()=>{
   Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:undefined});
   Object.defineProperty(Element.prototype,'webkitRequestFullscreen',{configurable:true,value:undefined});
 });
 await phone.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
 await phone.locator('#fullscreenBtn').click();
 const m=await stage(phone);
 assert.equal(m.fallback,true);
 assert.ok(Math.abs(m.panelHeight-m.viewport)<5,'mobile fullscreen height mismatch');
 assert.ok(m.viewHeight>m.viewport*.4,'mobile photo not visible');
 assert.equal(await phone.locator('#fullscreenBtn').isVisible(),true);
 await phone.locator('#fullscreenBtn').click();
 assert.equal((await stage(phone)).fallback,false);
 results.push({case:'mobile 390x844 fallback viewport',expanded:m});
 await phone.close();
 assert.deepEqual(errors,[]);
 console.log('R10_FULLSCREEN_BROWSER_PASS',JSON.stringify(results,null,2));
}catch(error){
 console.error('R10_FULLSCREEN_BROWSER_FAIL',error.message,JSON.stringify(results),errors);
 process.exitCode=1;
}finally{await browser.close()}
