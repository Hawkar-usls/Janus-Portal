// Optional end-to-end live Panoramax coverage check; intentionally outside CI.
// npm install --no-save playwright
// PORTAL_URL=http://127.0.0.1:4173/ BROWSER_PATH=/path/to/browser node tools/browser-regional-panoramas-check.mjs
// Tests original R2, no new runtime libraries. The provider may change over time.
import {distanceKm} from '../src/navigation.js';
let chromium;
try{({chromium}=await import('playwright'))}catch{console.error('Install optional Playwright');process.exit(2)}
const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const page=await browser.newPage({viewport:{width:1366,height:880}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const sources=[
 ['paris',48.86473,2.34041],
 ['pune',18.5195209,73.8412082],['kathmandu',27.679029333,85.316770333],
 ['fes',34.061672694,-4.977107],['merzouga',31.14483,-3.967989],
 ['cebu',10.3115544,123.8997359],['busay',10.368785,123.8736817],
 ['georgetown',5.41156663,100.345036046],['balikpulau',5.376598422,100.243871661],
 ['bayanlepas',5.282062689,100.242131159],
 ['cuenca',-2.893007321,-79.003228169],['sayaussi',-2.881178218,-79.061575868],
 ['ricaurte',-2.879045158,-78.981027349],['banoscuenca',-2.906943576,-79.033273236],
 ['elvalle',-2.915168508,-78.985071091]
];
const short=process.env.SHORT==='1';
const targets=short?sources.slice(0,6):sources;
const outcomes=[];
try {
  const response=await page.goto(process.env.PORTAL_URL||'http://127.0.0.1:4173/',
    {waitUntil:'domcontentloaded',timeout:25000});
  if(response.status()!==200)throw new Error('HTML HTTP '+response.status());
  const script=await page.locator('script[type="module"]').getAttribute('src');
  if(script!=='./src/app.js')throw new Error('Wrong R2 JS path: '+script);
  await page.locator('#seconds').fill('60');
  for(const [key,lat,lng] of targets) {
    const label=await page.locator('#originChoice option[value="'+key+'"]').count();
    if(label!==1)throw new Error('Missing origin '+key);
    if(await page.locator('#startBtn').innerText()!=='▶ Запустить')await page.locator('#startBtn').click();
    await page.locator('#originChoice').selectOption(key);
    await page.locator('#startBtn').click();
    try{
      await page.waitForFunction(()=>{
        const status=document.querySelector('#runStatus')?.textContent||'';
        return status.includes('Живой взгляд') || status.includes('Ошибка') || status.includes('Места не найдены');
      },null,{timeout:28000});
      const status=await page.locator('#runStatus').innerText();
      if(!status.includes('Живой взгляд'))
        throw new Error(status+' '+await page.locator('#notice').innerText());
      const loc=(await page.locator('#coords').innerText()).split(',').map(Number);
      const distance=distanceKm({lat,lng},{lat:loc[0],lng:loc[1]});
      if(!(distance<=5.02))throw new Error('Wrong location: '+loc+' dist='+distance.toFixed(2)+'km');
      const viewer=await page.locator('pnx-photo-viewer').count();
      if(viewer!==1)throw new Error('No real 360 viewer for '+key);
      outcomes.push({key,pass:true,coord:loc,distanceKm:Number(distance.toFixed(3))});
      console.log('PASS',key,loc.join(','),'anchor_km='+distance.toFixed(3));
    }catch(err){
      outcomes.push({key,pass:false,error:String(err.message).slice(0,290)});
      console.log('FAIL',key,String(err.message).slice(0,290));
    }
  }
  await page.locator('#startBtn').click().catch(()=>{});
  const passed=outcomes.filter(x=>x.pass).length;
  console.log('RESULT',passed+'/'+targets.length,'JS_ERRORS',JSON.stringify(errors));
  if(passed!==targets.length||errors.length)process.exitCode=1;
} catch(error){
  console.log('FATAL',error.message,'errors',errors);
  process.exitCode=1;
} finally {await browser.close()}
