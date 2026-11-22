// Browser smoke: one real JANUS DOM + mocked API responses and a loadable
// synthetic 2:1 sphere. This is BROWSER_MOCK, not real-provider verification.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({
  headless:true,
  args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']
});
const page=await browser.newPage({viewport:{width:1280,height:800}});
const failures=[];
page.on('pageerror',err=>failures.push(err.message));
const target={lat:34.061672694,lng:-4.977107};
const imageUrl='https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/janus-r13-fixture.svg';
let mode='sphere';
const fovSphere={
  pageid:77,title:'File:360-degree equirectangular fixture.jpg',
  coordinates:[{lat:target.lat,lon:target.lng}],
  imageinfo:[{
    width:2048,height:1024,thumburl:imageUrl,
    descriptionurl:'https://commons.wikimedia.org/wiki/File:Fixture.jpg',
    extmetadata:{
      Categories:{value:'360-degree equirectangular panoramas'},
      LicenseShortName:{value:'CC BY-SA 4.0'},
      Artist:{value:'JANUS Test Fixture'}
    }
  }]
};
const flat={
  pageid:78,title:'File:Ordinary flat photograph.jpg',
  coordinates:[{lat:target.lat,lon:target.lng}],
  imageinfo:[{
    width:2048,height:1024,thumburl:imageUrl,
    descriptionurl:'https://commons.wikimedia.org/wiki/File:Flat.jpg',
    extmetadata:{
      LicenseShortName:{value:'CC BY-SA 4.0'},
      Artist:{value:'Flat Fixture'}
    }
  }]
};
const respond=(route,obj)=>route.fulfill({status:200,
  contentType:'application/json',body:JSON.stringify(obj)});
await page.route(/https:\/\/api\.panoramax\.xyz\/api\/search/,route=>
  route.fulfill({status:200,contentType:'application\/geo+json',
    body:JSON.stringify({features:[]})}));
await page.route(/https:\/\/api\.kartaview\.org\/2\.0\/photo\//,route=>
  respond(route,{result:{data:[]}}));
await page.route(/https:\/\/commons\.wikimedia\.org\/w\/api\.php/,route=>{
  const url=new URL(route.request().url());
  const c=(url.searchParams.get('ggscoord')||'').split('|').map(Number);
  const match=Math.abs(c[0]-target.lat)<0.015&&Math.abs(c[1]-target.lng)<0.015;
  const data=match?(mode==='sphere'?fovSphere:flat):null;
  return respond(route,{query:{pages:data?{[data.pageid]:data}:{}}});
});
await page.route(/https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/a\/ab\/janus-r13-fixture\.svg/,route=>
  route.fulfill({status:200,contentType:'image/svg+xml',
    headers:{'access-control-allow-origin':'*'},
    body:'<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024"><rect width="2048" height="1024" fill="#2c6587"/><path d="M 0 512 H 2048" stroke="#f7d763" stroke-width="44"/></svg>'}));
try{
  const url=process.env.PORTAL_URL||'http://127.0.0.1:4173/';
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response.status(),200);
  assert.equal(await page.locator('#provider').isVisible(),false);
  assert.equal(await page.locator('#originChoice').count(),1);
  assert.equal(await page.locator('#viewer').count(),1);
  assert.equal(await page.locator('#mapillaryToken').count(),1);
  await page.waitForFunction(()=>document.querySelector('#coverageStatus')
    ?.textContent?.startsWith('Обновлено в'),null,{timeout:50000});
  const locations=await page.locator('#originChoice option').evaluateAll(nodes=>
    nodes.filter(n=>n.value).map(n=>n.value));
  assert.deepEqual(locations,['fes'],
    'Only the mocked confirmed 360 location must be available');
  await page.locator('#originChoice').selectOption('fes');
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>document.querySelector('#statUnique')
    ?.textContent?.trim()==='1',null,{timeout:35000});
  assert.equal(await page.locator('#viewer canvas').count(),1);
  assert.equal(await page.locator('#viewer .external-360-attribution').count(),1);
  assert.match(await page.locator('#viewer .external-360-attribution').innerText(),
    /JANUS Test Fixture.*CC BY-SA 4.0/s);
  const canvas=page.locator('#viewer canvas');
  assert.ok(await canvas.evaluate(el=>el.width>0&&el.height>0));
  await page.locator('#pauseBtn').click();
  assert.equal(await page.locator('#viewer canvas').count(),1,
    'Pause must not tear down sphere WebGL');
  await page.locator('#fullscreenBtn').click();
  await page.waitForFunction(()=>document.querySelector('.viewer-panel')
    ?.classList.contains('portal-fullscreen-active'),null,{timeout:8000});
  assert.equal(await page.locator('#viewer canvas').count(),1);
  await page.locator('#fullscreenBtn').click();
  await page.waitForFunction(()=>!document.querySelector('.viewer-panel')
    ?.classList.contains('portal-fullscreen-active'),null,{timeout:8000});
  await page.locator('#startBtn').click(); // stop expedition
  mode='flat';
  await page.locator('#refreshCoverageBtn').click();
  await page.waitForFunction(()=>document.querySelector('#coverageStatus')
    ?.textContent?.startsWith('Обновлено в') &&
    document.querySelector('#originChoice')?.disabled===true,
    null,{timeout:50000});
  const remaining=await page.locator('#originChoice option').evaluateAll(nodes=>
    nodes.filter(n=>n.value).map(n=>n.value));
  assert.deepEqual(remaining,[],'Flat photo must not become a 360 destination');
  assert.equal(await page.locator('#statUnique').innerText(),'1',
    'Refresh and failed metadata must never create visits');
  assert.deepEqual(failures,[]);
  console.log('R13_BROWSER_MOCK_PASS',{
    singleSearch:true,webglSphere:true,credit:true,pause:true,fullscreen:true,
    staleRemoved:true,flatRejected:true,javascriptErrors:0
  });
}catch(err){
  console.error('R13_BROWSER_MOCK_FAIL',err?.stack||err,failures);
  process.exitCode=1;
}finally{await browser.close();}
