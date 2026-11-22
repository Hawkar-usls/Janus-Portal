import test from 'node:test';
import assert from 'node:assert/strict';
import {GoogleProvider} from '../src/providers.js';
const center={lat:30.0444,lng:31.2357};
function fixture(){
 const provider=new GoogleProvider('unit-test-key-only');
 provider.ready=async()=>({});
 let count=0;
 provider.service={getPanorama:async()=>{
  count++;
  return {data:{location:{
   pano:'mocked-google-panorama',
   latLng:{lat:()=>center.lat+.001,lng:()=>center.lng+.001}
  }}};
 }};
 return {provider,calls:()=>count};
}
test('existing Google adapter no longer crashes on visitedPoints / minSeparationKm',async()=>{
 const x=fixture();
 const photos=await x.provider.searchAtRadius({
  origin:center,radiusKm:5,visited:new Set(),visitedPoints:[],
  minSeparationKm:.02,random:()=>.3
 });
 assert.ok(x.calls()>0);
 assert.ok(photos.length>0);
 assert.equal(photos[0].provider,'google');
 assert.equal(photos[0].id,'mocked-google-panorama');
});
test('existing Google adapter respects visited ID and spatial exclusion without API keys',async()=>{
 const a=fixture();
 const byId=await a.provider.searchAtRadius({
  origin:center,radiusKm:5,visited:new Set(['google:mocked-google-panorama']),
  visitedPoints:[],minSeparationKm:.02,random:()=>.3
 });
 assert.deepEqual(byId,[]);
 const b=fixture();
 const byLocation=await b.provider.searchAtRadius({
  origin:center,radiusKm:5,visited:new Set(),
  visitedPoints:[{lat:center.lat+.001,lng:center.lng+.001}],
  minSeparationKm:.1,random:()=>.3
 });
 assert.deepEqual(byLocation,[]);
});
