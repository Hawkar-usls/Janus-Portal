// Deterministic R14 Chromium integration test with mocked source metadata,
// viewer and gaze. This is NOT proof of live provider availability.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

console.log('R14 STEP 0 launching browser');
const browser=await chromium.launch({headless:true,timeout:20000,args:['--disable-dev-shm-usage']});
console.log('R14 STEP 1 browser ready');
const url=process.env.PORTAL_URL||'http://127.0.0.1:4173/';
const errors=[];
const providerMock=[
  "const places=[{key:'fes',lat:34.061672694,lng:-4.977107,provider:'panoramax',id:'test-fes'},",
  "{key:'kathmandu',lat:27.679029333,lng:85.316770333,provider:'commons',id:'test-kathmandu'}];",
  "export async function probeMerged360(origin){",
  " const candidate=places.find(p=>Math.abs(origin.lat-p.lat)<.008&&Math.abs(origin.lng-p.lng)<.008);",
  " return {candidates:candidate?[{...candidate}]:[],failed:0,checked:3};",
  "}",
  "export class Merged360Provider{",
  " async searchAtRadius(){return [];}",
  " async show(candidate,host){",
  "  const image=document.createElement('div');image.className='mock-panorama';",
  "  image.style.cssText='width:100%;height:100%;background:#24566a';",
  "  image.textContent=candidate.provider+' '+candidate.id;host.replaceChildren(image);",
  " }",
  " getPose(){return {heading:0,pitch:0,zoom:50};}",
  " getFrontHeading(){return 0;}",
  " setPose(){}",
  " stopRotation(){}",
  "}"
].join('\n');
const gazeMock=[
  "export function buildGazePlan(){return {totalMs:30,steps:[]};}",
  "export class GazeDirector{",
  " constructor(options){this.options=options;this.timer=null;}",
  " start(){this.timer=setTimeout(()=>this.options.onFinish?.(),45);}",
  " stop(){if(this.timer!==null)clearTimeout(this.timer);this.timer=null;}",
  " pause(){this.stop();}",
  " resume(){this.start();}",
  " setRate(){}",
  "}"
].join('\n');
const attentionMock="export async function analyzeInterest(){return {points:[],reason:'mock-only',detectedObjects:[]};}";

try{
  const page=await browser.newPage({viewport:{width:1280,height:850}});
  page.setDefaultTimeout(7000);
  page.on('pageerror',e=>errors.push(e.message));
  console.log('R14 STEP 2 page created');
  await page.route(/https:\/\/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.(?:js|css)/,route=>
    route.fulfill({status:200,contentType:route.request().url().endsWith('.css')?'text/css':'application/javascript',body:''}));
  await page.route(/\/src\/providers\.js(?:\?|$)/,route=>
    route.fulfill({status:200,contentType:'application/javascript',body:providerMock}));
  await page.route(/\/src\/gaze\.js(?:\?|$)/,route=>
    route.fulfill({status:200,contentType:'application/javascript',body:gazeMock}));
  await page.route(/\/src\/attention\.js(?:\?|$)/,route=>
    route.fulfill({status:200,contentType:'application/javascript',body:attentionMock}));
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});
  assert.equal(response.status(),200);
  console.log('R14 STEP 3 page and mocked modules loaded');
  await page.waitForFunction(()=>document.querySelector('#coverageStatus')?.dataset.state==='ready',null,{timeout:10000});
  const places=await page.locator('#originChoice option').evaluateAll(nodes=>
    nodes.map(x=>x.value).filter(Boolean));
  assert.deepEqual(places,['kathmandu','fes']);
  assert.equal(await page.locator('#afkBtn').isEnabled(),true);
  assert.equal(await page.locator('#passportViews').innerText(),'0');
  console.log('R14 STEP 4 verified live regions',JSON.stringify(places));
  await page.locator('#originChoice').selectOption('fes');
  await page.locator('#afkBtn').click();
  console.log('R14 STEP 5 AFK started');
  await page.waitForFunction(()=>
    document.querySelector('#passportViews')?.textContent==='2' &&
    document.querySelector('#afkBtn')?.getAttribute('aria-pressed')==='false',
    null,{timeout:12000});
  const stats={
    unique:await page.locator('#passportViews').innerText(),
    countries:await page.locator('#passportCountries').innerText(),
    xp:await page.locator('#passportXp').innerText(),
    stamps:await page.locator('#passportCountryList button').count(),
    history:await page.locator('#history .history-item').count()
  };
  assert.deepEqual(stats,{unique:'2',countries:'2',xp:'70',stamps:2,history:2});
  assert.match(await page.locator('#afkNote').innerText(),/AFK завершён/);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('janus-portal-expedition-v1')||'[]'));
  assert.deepEqual(saved.map(x=>x.provider),['panoramax','commons']);
  assert.equal(await page.locator('#statCoins').innerText(),'—');
  assert.equal(await page.locator('#sourceGateway').count(),0);
  console.log('R14 STEP 6 AFK stopped after two verified views',JSON.stringify(stats));
  await page.locator('#passportCountryList button').first().click();
  assert.deepEqual(errors,[]);
  console.log('R14 STEP 7 reload to verify passport persistence');
  await page.reload({waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(()=>document.querySelector('#passportViews')?.textContent==='2',null,{timeout:7000});
  assert.equal(await page.locator('#passportCountries').innerText(),'2');
  assert.equal(await page.locator('#passportXp').innerText(),'70');
  console.log('R14 STEP 8 persistent passport passed');
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#resetBtn').click();
  assert.equal(await page.locator('#passportViews').innerText(),'0');
  assert.equal(await page.locator('#passportXp').innerText(),'0');
  assert.equal(await page.locator('#passportCountryList button').count(),0);
  assert.deepEqual(errors,[]);
  console.log('R14_BROWSER_PASS_TWO_REGIONS_RELOAD_RESET_NO_JCOINS');
  await page.close();
}catch(error){
  console.error('R14_BROWSER_FAIL',error.stack||error,JSON.stringify(errors));
  process.exitCode=1;
}finally{
  await browser.close();
  console.log('R14 BROWSER CLOSED');
}
