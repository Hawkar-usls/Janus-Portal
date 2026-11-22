import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceKm, normalizeLng, radiusSteps, destination, randomProbe, bboxAround,
  chooseCandidate, findNext, visitKey
} from '../src/navigation.js';
import {readHistory, addVisit, getStats, STORAGE_KEY} from '../src/storage.js';

const home = {lat: 48.86473, lng: 2.34041};
const near = {provider:'panoramax', id:'A',lat:48.87,lng:2.35};
const far = {provider:'panoramax', id:'B',lat:49.2,lng:2.35};
const almostSame = {provider:'google',id:'other-session-pano',lat:48.864735,lng:2.340415};

test('geodesics handle identical points, dateline and poles', () => {
  assert.equal(distanceKm(home,home),0);
  assert.ok(distanceKm({lat:0,lng:179.9},{lat:0,lng:-179.9}) < 25);
  assert.equal(normalizeLng(181),-179);
  assert.ok(distanceKm({lat:90,lng:0},{lat:90,lng:120}) < 0.0001);
});
test('adaptive radius doubles and caps at max', () => {
  assert.deepEqual(radiusSteps(5,70),[5,10,20,40,70]);
  assert.deepEqual(radiusSteps(5,5),[5]);
  assert.throws(()=>radiusSteps(0,20),RangeError);
});
test('random probes remain within their radius', () => {
  for (const fraction of [0,0.3,0.8,0.999]) {
    const p = randomProbe(home,5,()=>fraction);
    assert.ok(distanceKm(home,p) <= 5.001);
  }
  const p = destination(home,7,Math.PI/4);
  assert.ok(Math.abs(distanceKm(home,p)-7) < 0.001);
  assert.equal(bboxAround(home,1).length,4);
});
test('candidate filtering enforces radius, ID, physical location and no duplicates', () => {
  const got = chooseCandidate([far,near,near],home,5,new Set(),()=>0);
  assert.equal(got.id,'A');
  assert.equal(chooseCandidate([near],home,5,new Set([visitKey(near)])),null);
  assert.equal(chooseCandidate([far],home,5),null);
  assert.equal(chooseCandidate([almostSame],home,5,new Set(),()=>0,[home],0.02),null);
});
test('starts at 5km; expands 10 then 20 only if required', async () => {
  const tried = []; const expanded = [];
  const candidate = {...near, lat:home.lat+0.10};
  const next = await findNext({
    origin:home,baseRadiusKm:5,maxRadiusKm:40,random:()=>0,
    searchAtRadius:async ({radiusKm})=>{tried.push(radiusKm);return radiusKm >= 20 ? [candidate] : []},
    onExpand: ({radiusKm})=>expanded.push(radiusKm)
  });
  assert.deepEqual(tried,[5,10,20]);
  assert.deepEqual(expanded,[10,20]);
  assert.equal(next.searchRadiusKm,20);
  assert.equal(next.expansions,2);
});
test('does not expand if a new panorama exists within 5 km', async () => {
  let calls=0;
  const next=await findNext({origin:home,searchAtRadius:async()=>{calls++;return [near]}});
  assert.equal(calls,1);
  assert.equal(next.id,'A');
  assert.equal(next.searchRadiusKm,5);
});
test('exhaustion reports no evidence and never loops forever', async () => {
  await assert.rejects(findNext({
    origin:home,baseRadiusKm:5,maxRadiusKm:20,
    searchAtRadius:async()=>[]
  }),e=>e.name==='NoLocationsError'&&e.checkedRadii.length===3);
});
test('abort prevents further searches', async () => {
  const c=new AbortController();c.abort();
  await assert.rejects(findNext({origin:home,signal:c.signal,searchAtRadius:async()=>[]}),e=>e.name==='AbortError');
});
function memory() {
  const map=new Map();
  return {
    getItem:k=>map.get(k)??null,
    setItem:(k,v)=>map.set(k,v),
    removeItem:k=>map.delete(k)
  };
}
test('history validates stored entries and rejects ID repeats', () => {
  const m=memory();
  const row={provider:'panoramax',id:'A',lat:48.87,lng:2.35,visitedAt:'2026-11-22T08:00:00.000Z'};
  m.setItem(STORAGE_KEY,JSON.stringify([row,row,{provider:'google',id:'',lat:0,lng:0,visitedAt:'x'}]));
  assert.equal(readHistory(m).length,1);
  assert.equal(getStats(readHistory(m)).unique,1);
  assert.equal(addVisit(readHistory(m),row,m).added,false);
  assert.equal(addVisit(readHistory(m),{...row,id:'B'},m).added,true);
  assert.equal(readHistory(m).length,2);
});
test('broken storage does not crash the game', () => {
  const m={getItem:()=>'{bad json',setItem:()=>{throw new Error('quota')}};
  assert.deepEqual(readHistory(m),[]);
  const r=addVisit([],near,m);
  assert.equal(r.added,true);
  assert.equal(r.persisted,false);
  assert.equal(r.entries.length,1);
});
test('storage never invents coins from visitor history', () => {
  const stats=getStats([
    {provider:'panoramax',id:'A',lat:0,lng:0},
    {provider:'google',id:'B',lat:1,lng:1}
  ]);
  assert.equal(stats.unique,2);
  assert.ok(stats.km>150);
  assert.equal('coins' in stats,false);
});

test('Google coordinates are only in volatile session state', () => {
  const m=memory();
  const google={provider:'google',id:'g-session',lat:48.4,lng:2.1,visitedAt:'2026-11-22T09:00:00.000Z'};
  const r=addVisit([],google,m);
  assert.equal(r.added,true);
  assert.equal(r.persisted,false);
  assert.deepEqual(readHistory(m),[]);
});
