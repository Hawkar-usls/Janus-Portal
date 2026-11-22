import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DESTINATIONS, TOURS, TOUR_CATEGORIES, destinationById, tourById,
  hasCoordinates, getTourStop
} from '../src/tours.js';
import {findTourCandidate} from '../src/tour-runner.js';
import {distanceKm} from '../src/navigation.js';
import {installFullscreen} from '../src/fullscreen.js';

test('catalogue has Cairo/Giza, wide world coverage and valid grounded search centres',()=>{
 assert.ok(DESTINATIONS.length>=30);
 assert.ok(TOURS.length>=10);
 assert.equal(new Set(DESTINATIONS.map(x=>x.id)).size,DESTINATIONS.length);
 assert.equal(new Set(TOURS.map(x=>x.id)).size,TOURS.length);
 assert.ok(destinationById('cairo'));
 assert.ok(destinationById('giza'));
 assert.ok(tourById('egypt').stops.some(s=>/Сфинкс/.test(s.name)));
 assert.ok(TOUR_CATEGORIES.some(c=>c.id==='wonders'));
 for (const d of DESTINATIONS) {
  assert.ok(d.name&&d.country&&d.category);
  assert.ok(hasCoordinates(d), d.id);
 }
 for (const t of TOURS){
  assert.ok(t.stops.length>=3);
  for (const stop of t.stops) assert.ok(hasCoordinates(stop),t.id+':'+stop.name);
  assert.equal(getTourStop(t,0),t.stops[0]);
  assert.equal(getTourStop(t,99),null);
 }
});

const cityTour={id:'test',stops:[
  {name:'Not covered',lat:29.9792,lng:31.1342},
  {name:'Found nearby',lat:48.86473,lng:2.34041},
  {name:'Later',lat:45.76561,lng:4.84002}
]};

test('guided discovery skips inaccessible landmarks and accepts only nearby provider imagery',async()=>{
 const requested=[],skipped=[],touched=[];
 const result=await findTourCandidate({
  tour:cityTour,startIndex:0,visited:new Set(),visitedPoints:[],
  onStop:({index})=>touched.push(index),
  onSkip:x=>skipped.push(x.index),
  searchAtRadius:async opts=>{
   requested.push(opts);
   assert.equal(opts.probeCount,2);
   return opts.origin.lat>40 ? [{id:'real360',provider:'panoramax',
    lat:opts.origin.lat+.004,lng:opts.origin.lng+.004}] : [];
  }
 });
 assert.equal(result.index,1);
 assert.equal(result.stop.name,'Found nearby');
 assert.equal(result.skipped,1);
 assert.deepEqual(touched,[0,1]);
 assert.deepEqual(skipped,[0]);
 assert.ok(result.candidate.distanceKm<4);
 assert.ok(requested.every(x=>x.radiusKm<=4));
 assert.ok(requested.length<=4);
});
test('guided discovery never substitutes distant image or rewards an absent stop',async()=>{
 const attempted=[];
 const result=await findTourCandidate({tour:cityTour,
  searchAtRadius:async ({origin,radiusKm})=>{
   attempted.push({origin,radiusKm});
   return [{id:'far',provider:'panoramax',lat:0,lng:0}];
  }
 });
 assert.equal(result.candidate,null);
 assert.equal(result.skipped,3);
 assert.equal(attempted.length,6);
 assert.ok(distanceKm(cityTour.stops[0],{lat:0,lng:0})>100);
});
test('tour scans remain cancellable',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(findTourCandidate({tour:cityTour,signal:controller.signal,
  searchAtRadius:async()=>[]}),e=>e.name==='AbortError');
});
function classList(){
 const values=new Set();return{
  toggle:(name,on)=>{if(on)values.add(name);else values.delete(name)},
  contains:name=>values.has(name)
 }
}
test('fullscreen fallback toggles and ESC restores the original page',async()=>{
 const doc=new EventTarget();doc.body={classList:classList()};doc.fullscreenElement=null;
 const panel={classList:classList()};
 const button=new EventTarget();button.setAttribute=(k,v)=>{button[k]=v};
 let resize=0;
 const win={requestAnimationFrame:fn=>fn(),dispatchEvent:()=>resize++};
 const api=installFullscreen({panel,button,documentRef:doc,windowRef:win});
 button.dispatchEvent(new Event('click'));
 assert.equal(api.active(),true);
 assert.equal(panel.classList.contains('is-immersive'),true);
 assert.equal(button['aria-pressed'],'true');
 const esc=new Event('keydown');esc.key='Escape';doc.dispatchEvent(esc);
 assert.equal(api.active(),false);
 assert.equal(doc.body.classList.contains('portal-immersive-fallback'),false);
 assert.ok(resize>=2);
 api.destroy();
});
test('native fullscreen can enter/exit without leaving fallback styles',async()=>{
 const doc=new EventTarget();doc.body={classList:classList()};doc.fullscreenElement=null;
 const panel={classList:classList()};
 panel.requestFullscreen=async()=>{doc.fullscreenElement=panel;doc.dispatchEvent(new Event('fullscreenchange'))};
 doc.exitFullscreen=async()=>{doc.fullscreenElement=null;doc.dispatchEvent(new Event('fullscreenchange'))};
 const button=new EventTarget();button.setAttribute=(k,v)=>{button[k]=v};
 const api=installFullscreen({panel,button,documentRef:doc,windowRef:{
  requestAnimationFrame:fn=>fn(),dispatchEvent:()=>{}
 }});
 await api.toggle();
 assert.equal(api.active(),true);
 assert.equal(panel.classList.contains('is-immersive'),false);
 await api.exit();
 assert.equal(api.active(),false);
 api.destroy();
});
