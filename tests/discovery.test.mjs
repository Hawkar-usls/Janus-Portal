import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DESTINATIONS, TOURS, TOUR_CATEGORIES, destinationById, tourById,
  hasCoordinates, getTourStop, pickRandomDestination, DESTINATION_CATEGORIES,
  extremeRegionFor, EXTREME_REGIONS
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


test('extreme tourism is a dedicated category in both excursions and destinations',()=>{
  assert.ok(TOUR_CATEGORIES.some(c=>c.id==='extreme'&&c.label.includes('Экстремаль')));
  assert.ok(DESTINATION_CATEGORIES.some(c=>c.id==='extreme'&&c.label.includes('Экстремаль')));
  const rural=DESTINATIONS.filter(d=>d.category==='extreme');
  const tours=TOURS.filter(t=>t.category==='extreme');
  assert.ok(rural.length>=30);
  assert.ok(tours.length>=7);
  const countries=new Set(rural.map(d=>d.country));
  for(const name of ['Индия','Непал','Марокко','Намибия','Танзания','Уганда','Кения','Боливия','Норвегия'])
    assert.ok(countries.has(name),'missing country: '+name);
  assert.ok(countries.size>=12);
  for(const d of rural){
    assert.ok(d.tag&&hasCoordinates(d),d.id);
    assert.ok(!/опасные люди|бедность|третий мир/i.test(d.tag));
  }
});
test('general Portal random pool includes rural, and extreme random only picks extreme',()=>{
  const all=pickRandomDestination({category:'all',random:()=>.999999});
  assert.equal(all.category,'extreme');
  const first=pickRandomDestination({category:'extreme',random:()=>0});
  const last=pickRandomDestination({category:'extreme',random:()=>.99999});
  assert.equal(first.category,'extreme');
  assert.equal(last.category,'extreme');
  assert.equal(first.id,'chitkul');
  assert.equal(last.id,'gasadalur');
  assert.throws(()=>pickRandomDestination({category:'invalid',random:()=>0}),RangeError);
  assert.ok(DESTINATIONS.some(d=>d.id==='paris'&&d.category==='cities'));
});
test('extreme trips have provider-sampled named rural stops and do not invent visits',async()=>{
  const route=TOURS.find(t=>t.id==='spiti-villages');
  assert.ok(route.stops.some(s=>/Читкул/.test(s.name)));
  const visited=[];
  const result=await findTourCandidate({
    tour:route,visited:new Set(),visitedPoints:[],
    searchAtRadius:async params=>{
      visited.push(params);
      if(params.origin.lat>32.2)return [{
        provider:'panoramax',id:'sample-real-view',
        lat:params.origin.lat+.001,lng:params.origin.lng+.001
      }];
      return [];
    }
  });
  assert.ok(result.index>0);
  assert.equal(result.skipped,result.index);
  assert.ok(result.candidate.distanceKm<=4);
  assert.ok(visited.every(x=>x.radiusKm<=4&&x.probeCount===2));
  const noCoverage=await findTourCandidate({tour:TOURS.find(t=>t.id==='east-african-roads'),
    searchAtRadius:async()=>[]});
  assert.equal(noCoverage.candidate,null);
  assert.equal(noCoverage.skipped,5);
});

test('regional filters cover India, Africa, Asia and far-flung non-poor places',()=>{
  const regions=EXTREME_REGIONS.map(x=>x.id);
  assert.deepEqual(regions,['all','india','africa','asia','world']);
  assert.equal(extremeRegionFor(destinationById('kibber')),'india');
  assert.equal(extremeRegionFor(destinationById('opuwo')),'africa');
  assert.equal(extremeRegionFor(destinationById('namche')),'asia');
  assert.equal(extremeRegionFor(destinationById('reine')),'world');
  assert.equal(extremeRegionFor(destinationById('paris')),null);
  assert.equal(extremeRegionFor(tourById('sahara-atlas')),'africa');
  for(const region of regions.filter(x=>x!=='all')){
    assert.ok(TOURS.some(t=>t.category==='extreme'&&extremeRegionFor(t)===region),region);
    assert.ok(DESTINATIONS.some(d=>d.category==='extreme'&&extremeRegionFor(d)===region),region);
    const picked=pickRandomDestination({category:'extreme',region,random:()=>.33});
    assert.equal(extremeRegionFor(picked),region);
  }
  assert.throws(()=>pickRandomDestination({category:'cities',region:'africa'}),RangeError);
});
