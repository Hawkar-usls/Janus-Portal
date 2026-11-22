import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  probeMapillary360, probeKartaView360, probeCommons360, probeMerged360,
  Merged360Provider
} from '../src/providers.js';

const origin={lat:34.061672694,lng:-4.977107};
const response=data=>({ok:true,status:200,json:async()=>data});
async function withFetch(mock,run){
  const before=globalThis.fetch;
  globalThis.fetch=mock;
  try{return await run();}
  finally{globalThis.fetch=before;}
}
function route(url){
  const u=new URL(String(url));
  if(u.hostname==='api.panoramax.xyz')return response({features:[{
    id:'pano-1',collection:'collection-1',
    geometry:{coordinates:[origin.lng,origin.lat]},
    properties:{'pano:projection_type':'equirectangular'},
    assets:{thumb:{href:'https://panoramax.example.org/1.jpg'}}
  }]});
  if(u.hostname==='api.kartaview.org')return response({result:{data:[
    {id:17,lat:String(origin.lat),lng:String(origin.lng),projection:'SPHERE',
      fieldOfView:'360',imageProcUrl:'https://cdn.kartaview.org/17.jpg'},
    {id:18,lat:String(origin.lat),lng:String(origin.lng),projection:'PLANE',
      fieldOfView:'90',imageProcUrl:'https://cdn.kartaview.org/18.jpg'}
  ]}});
  if(u.hostname==='commons.wikimedia.org')return response({query:{pages:{
    '4':{pageid:4,title:'File:360-degree equirectangular panorama.jpg',
      coordinates:[{lat:origin.lat,lon:origin.lng}],
      imageinfo:[{width:4000,height:2000,
        thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a.jpg',
        descriptionurl:'https://commons.wikimedia.org/wiki/File:Example.jpg',
        extmetadata:{LicenseShortName:{value:'CC BY-SA 4.0'},Artist:{value:'Photographer'},
          Categories:{value:'360-degree equirectangular panoramas'}}}]},
    '5':{pageid:5,title:'File:Flat.jpg',
      coordinates:[{lat:origin.lat,lon:origin.lng}],
      imageinfo:[{width:4000,height:2000,
        thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/b.jpg',
        descriptionurl:'https://commons.wikimedia.org/wiki/File:Flat.jpg',
        extmetadata:{LicenseShortName:{value:'CC BY-SA 4.0'}}}]}
  }}});
  if(u.hostname==='graph.mapillary.com')return response({data:[
    {id:'mly-1',is_pano:true,geometry:{coordinates:[origin.lng,origin.lat]},compass_angle:123},
    {id:'mly-flat',is_pano:false,geometry:{coordinates:[origin.lng,origin.lat]}},
    {id:'mly-far',is_pano:true,geometry:{coordinates:[-74.006,40.713]}}
  ]});
  throw new Error('Unexpected API '+u.hostname);
}

test('Mapillary is silent without developer token; only confirmed nearby is_pano is accepted',async()=>{
  await withFetch(()=>{throw Error('no access without token')},async()=>{
    assert.deepEqual(await probeMapillary360(origin),[]);
  });
  await withFetch(async(url)=>{
    const u=new URL(String(url));
    assert.equal(u.hostname,'graph.mapillary.com');
    assert.equal(u.searchParams.get('access_token'),'fake-test-token');
    assert.match(u.searchParams.get('fields'),/is_pano/);
    return route(url);
  },async()=>{
    const found=await probeMapillary360(origin,{token:'fake-test-token'});
    assert.deepEqual(found.map(c=>c.id),['mly-1']);
    assert.equal(found[0].frontHeading,123);
  });
});

test('KartaView only accepts 360° SPHERE with source-owned HTTPS image',async()=>{
  await withFetch(async(url)=>{
    const u=new URL(String(url));
    assert.equal(u.searchParams.get('projection'),'SPHERE');
    return route(url);
  },async()=>{
    const found=await probeKartaView360(origin);
    assert.deepEqual(found.map(c=>c.id),['17']);
    assert.equal(found[0].license,'CC BY-SA 4.0');
  });
});

test('Commons requires explicit equirectangular evidence, 2:1 geometry and free licence',async()=>{
  await withFetch(async(url)=>{
    assert.match(String(url),/commons.wikimedia.org\/w\/api.php/);
    return route(url);
  },async()=>{
    const found=await probeCommons360(origin);
    assert.deepEqual(found.map(c=>c.id),['4']);
    assert.equal(found[0].attribution,'Photographer');
  });
});

test('a failing provider cannot suppress healthy verified providers',async()=>{
  await withFetch(async url=>{
    if(String(url).includes('kartaview.org'))throw new Error('KartaView offline');
    return route(url);
  },async()=>{
    const result=await probeMerged360(origin,{mapillaryToken:'fake-test-token'});
    assert.equal(result.checked,4);
    assert.equal(result.failed,1);
    assert.deepEqual(result.candidates.map(c=>c.provider).sort(),
      ['commons','mapillary','panoramax']);
  });
});

test('merged search never calls paid Google without manual consent',async()=>{
  const provider=new Merged360Provider({mapillaryToken:'fake-test-token'});
  assert.ok(!provider.providers.google);
  await withFetch(async url=>route(url),async()=>{
    provider.providers.panoramax.searchAtRadius=async()=>[];
    const items=await provider.searchAtRadius({
      origin,radiusKm:5,visited:new Set(),visitedPoints:[],minSeparationKm:0.02
    });
    assert.ok(items.some(x=>x.provider==='mapillary'));
    assert.ok(!items.some(x=>x.provider==='google'));
  });
});

test('one original search, fullscreen, no persisted tokens and unchanged R2 imports',()=>{
  const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const storage=readFileSync(new URL('../src/storage.js',import.meta.url),'utf8');
  assert.deepEqual([...app.matchAll(/^import .* from '(\.\/[^']+)'/gm)].map(x=>x[1]),
    ['./navigation.js','./providers.js','./storage.js','./gaze.js','./attention.js']);
  assert.equal((html.match(/id="originChoice"/g)||[]).length,1);
  assert.equal((html.match(/id="viewer"/g)||[]).length,1);
  assert.match(html,/id="fullscreenBtn"/);
  assert.match(html,/id="mapillaryToken"/);
  assert.match(html,/id="googleConsent"/);
  assert.match(app,/probeMerged360\(entry.origin/);
  assert.ok(!storage.includes('mapillaryToken'));
  assert.ok(!storage.includes('googleKey'));
  assert.ok(!app.includes('localStorage.setItem("mapillary'));
});
