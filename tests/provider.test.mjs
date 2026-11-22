import test from 'node:test';
import assert from 'node:assert/strict';
import {PanoramaxProvider} from '../src/providers.js';

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
