import test from 'node:test';
import assert from 'node:assert/strict';
import {PanoramaxProvider,GoogleProvider} from '../src/providers.js';
import {QUICK_START_PANORAMA} from '../src/quick-start.js';

const origin={lat:48.86473,lng:2.34041};
function feature(id,lat,lng,fieldOfView=360){
  return {id,collection:'test-collection',geometry:{type:'Point',coordinates:[lng,lat]},
    properties:{'pers:interior_orientation':{field_of_view:fieldOfView}}};
}

test('Panoramax search does not exhaust candidate budget on 360 photos within the same 20m', async()=>{
  const oldFetch=globalThis.fetch;
  const rows=[];
  for(let i=0;i<30;i++) rows.push(feature('duplicate-location-'+i,origin.lat+i*0.000001,origin.lng));
  rows.push(feature('far-enough',origin.lat+0.002,origin.lng));
  rows.push(feature('flat-photo',origin.lat+0.004,origin.lng,70));
  let calls=0;
  globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({features:rows})}};
  try{
    const provider=new PanoramaxProvider();
    const results=await provider.searchAtRadius({
      origin,radiusKm:5,visited:new Set(),visitedPoints:[origin],minSeparationKm:0.02,random:()=>0.5
    });
    assert.deepEqual(results.map(v=>v.id),['far-enough']);
    assert.ok(calls>=1 && calls<=4);
  }finally{globalThis.fetch=oldFetch;}
});

test('rejects flat panoramax photos and previously visited IDs',async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,json:async()=>({features:[
   feature('one',origin.lat+0.004,origin.lng,70),
   feature('two',origin.lat+0.005,origin.lng,360)
 ]})});
 try{
   const results=await new PanoramaxProvider().searchAtRadius({
     origin,radiusKm:5,visited:new Set(['panoramax:two']),visitedPoints:[],minSeparationKm:0.02,random:()=>0.3
   });
   assert.equal(results.length,0);
 }finally{globalThis.fetch=oldFetch;}
});

test('Google source search uses provided probe budget and visited positions',async()=>{
  const provider=new GoogleProvider('test-key-not-loaded');
  provider.ready=async()=>({});
  let calls=0;
  provider.service={getPanorama:async()=>{
    calls++;
    return {data:{location:{pano:'google-public-pano-fixture',latLng:{
      lat:()=>origin.lat+.001,lng:()=>origin.lng+.001
    }}}};
  }};
  const samples=await provider.searchAtRadius({
    origin,radiusKm:5,visited:new Set(),visitedPoints:[],probeCount:1,
    minSeparationKm:.02,random:()=>.4
  });
  assert.equal(samples.length,1);
  assert.equal(samples[0].provider,'google');
  assert.equal(calls,1);
  const repeats=await provider.searchAtRadius({
    origin,radiusKm:5,visited:new Set(['google:google-public-pano-fixture']),
    visitedPoints:[],probeCount:1,random:()=>.4
  });
  assert.deepEqual(repeats,[]);
  const nearby=await provider.searchAtRadius({
    origin,radiusKm:5,visited:new Set(),
    visitedPoints:[{lat:origin.lat+.001,lng:origin.lng+.001}],
    minSeparationKm:.1,probeCount:1,random:()=>.4
  });
  assert.deepEqual(nearby,[]);
});
test('quick start uses a real, attributed equirectangular source without API lookup',()=>{
  assert.equal(QUICK_START_PANORAMA.provider,'panoramax');
  assert.ok(QUICK_START_PANORAMA.id.length>15);
  assert.ok(QUICK_START_PANORAMA.previewUrl.startsWith('https://panoramax.openstreetmap.fr/'));
  assert.equal(QUICK_START_PANORAMA.license,'CC-BY-SA-4.0');
  assert.ok(QUICK_START_PANORAMA.producer);
  assert.ok(QUICK_START_PANORAMA.lat>60&&QUICK_START_PANORAMA.lat<70);
});
