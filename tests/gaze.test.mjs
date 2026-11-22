import test from 'node:test';
import assert from 'node:assert/strict';
import {
  angularDelta, wrapHeading, normalizePose, interpolatePose, buildGazePlan, GazeDirector
} from '../src/gaze.js';
import {getVisualSaliency, pixelToPose, objectDetectionsToPoints, analyzeInterest} from '../src/attention.js';
import {PanoramaxProvider, GoogleProvider} from '../src/providers.js';

test('shortest angular path crosses 360 without full unnatural spin',()=>{
 assert.equal(wrapHeading(-5),355);
 assert.equal(angularDelta(350,10),20);
 assert.equal(angularDelta(10,350),-20);
 const pose=interpolatePose({heading:350,pitch:0,zoom:0},{heading:10,pitch:20,zoom:40},.5);
 assert.ok(pose.heading<2||pose.heading>358);
 assert.equal(pose.pitch,10);
 assert.equal(pose.zoom,20);
 assert.deepEqual(normalizePose({heading:720,pitch:100,zoom:200}),{heading:0,pitch:48,zoom:75});
});

test('gaze plan has varying duration, repeated checks and focus-dependent longer stays',()=>{
 const noPoints=buildGazePlan({baseSeconds:16,random:()=>.52});
 const withPoints=buildGazePlan({baseSeconds:16,random:()=>.52,focusPoints:[
  {heading:60,pitch:5,score:.9,label:'человека',source:'mediapipe-object-detector'},
  {heading:180,pitch:3,score:.85,label:'объект',source:'mediapipe-object-detector'}
 ]});
 assert.ok(withPoints.totalMs>noPoints.totalMs);
 assert.ok(withPoints.segments.some(s=>s.kind==='squint'&&s.to.zoom>10));
 assert.ok(withPoints.segments.some(s=>s.kind==='return'));
 assert.ok(withPoints.segments.some(s=>s.kind==='hold'));
 assert.equal(withPoints.segments[0].startMs,0);
 assert.equal(withPoints.segments.at(-1).endMs,withPoints.totalMs);
 for(let i=1;i<withPoints.segments.length;i++)
  assert.equal(withPoints.segments[i].startMs,withPoints.segments[i-1].endMs);
});

test('randomized plans differ and bounded durations have no runaway waits',()=>{
 const fast=buildGazePlan({baseSeconds:5,random:()=>.01,focusPoints:[]});
 const slow=buildGazePlan({baseSeconds:5,random:()=>.89,focusPoints:[]});
 assert.notEqual(fast.totalMs,slow.totalMs);
 assert.ok(fast.totalMs>=5000&&slow.totalMs<120000);
 const reduced=buildGazePlan({baseSeconds:8,random:()=>.6,reducedMotion:true,focusPoints:[
   {heading:30,pitch:0,score:.7,label:'интерес',source:'test'}
 ]});
 assert.ok(reduced.segments.every(s=>s.kind==='hold'));
 assert.ok(reduced.segments.every(s=>s.to.zoom===0));
});

test('gaze director pauses timeline and completes only once',()=>{
 let seq=0;const frames=new Map();let poses=0,finishes=0,stages=[];
 const director=new GazeDirector({
  apply:()=>poses++,
  requestFrame:cb=>{const id=++seq;frames.set(id,cb);return id},
  cancelFrame:id=>frames.delete(id),
  onFinish:()=>finishes++,
  onStage:stage=>stages.push(stage.kind)
 });
 const plan=buildGazePlan({baseSeconds:5,random:()=>.4});
 director.start(plan);
 let now=0;
 function tick(delta){now+=delta;const old=[...frames];frames.clear();for(const [,cb] of old)cb(now);}
 tick(100);tick(200);tick(200);
 director.pause();
 const saved=poses,remaining=director.remainingMs;
 tick(2000);
 assert.equal(poses,saved);assert.equal(director.remainingMs,remaining);
 director.resume();tick(100);
 for(let i=0;i<150&&director.running;i++)tick(100);
 assert.equal(finishes,1);assert.equal(director.running,false);
 assert.ok(stages.length>1);
 assert.equal(frames.size,0);
 director.stop();
 tick(100);
 assert.equal(finishes,1);
});

test('rapid stop and new panorama cancels stale callbacks',()=>{
 const q=new Map();let id=0,done=0;
 const d=new GazeDirector({apply:()=>{},onFinish:()=>done++,
  requestFrame:cb=>{q.set(++id,cb);return id},cancelFrame:key=>q.delete(key)});
 const p=buildGazePlan({baseSeconds:12,random:()=>.4});
 d.start(p);d.stop();assert.equal(q.size,0);
 d.start(p);assert.equal(q.size,1);
 d.stop();assert.equal(done,0);
});

test('contrast saliency produces coordinate targets without claiming people',()=>{
 const width=320,height=160,rgba=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;
  const stripe=x>150&&x<190;
  const value=stripe&&Math.floor(x/3)%2===0?245:stripe?10:100;
  rgba[i]=value;rgba[i+1]=value;rgba[i+2]=value;rgba[i+3]=255;
 }
 const points=getVisualSaliency({width,height,data:rgba},45,3);
 assert.ok(points.length>=1);
 assert.ok(points.every(p=>p.source==='contrast-heuristic'&&p.label.includes('деталь')));
 assert.ok(points.every(p=>p.pitch<=40&&p.pitch>=-40));
 assert.deepEqual(pixelToPose(160,80,320,160,45),{heading:45,pitch:0});
});

test('semantic object detections recognize category only above confidence threshold',()=>{
 const people=objectDetectionsToPoints([{categories:[{categoryName:'person',score:.91}],
   boundingBox:{originX:100,originY:120,width:60,height:100}}],{
    frameIndex:2,cropCount:4,cropWidth:384,cropHeight:384,frontHeading:15
   });
 assert.equal(people.length,1);
 assert.equal(people[0].label,'человека');
 assert.equal(people[0].source,'mediapipe-object-detector');
 assert.ok(people[0].heading>=0&&people[0].heading<360);
 assert.deepEqual(objectDetectionsToPoints([{categories:[{categoryName:'person',score:.2}],
   boundingBox:{originX:100,originY:120,width:60,height:100}}],{frameIndex:1}),[]);
});

test('never analyze Google Street View image pixels',async()=>{
 const result=await analyzeInterest({
   candidate:{provider:'google',id:'test'},mode:'objects'
 });
 assert.deepEqual(result.points,[]);
 assert.equal(result.reason,'google-no-pixel-analysis');
});

test('Panoramax and Google adapters accept abstract gaze poses',()=>{
 const p=new PanoramaxProvider();
 let latest=null;
 p.photo={getXYZ:()=>({x:13,y:5,z:11}),setXYZ:(...args)=>{latest=args},
  getPictureOriginalHeading:()=>110};
 assert.deepEqual(p.getPose(),{heading:13,pitch:5,zoom:11});
 assert.equal(p.getFrontHeading(),110);
 p.setPose({heading:45,pitch:-7,zoom:24});
 assert.deepEqual(latest,[45,-7,24]);
 const g=new GoogleProvider('non-production-test-placeholder');
 let value={heading:0,pitch:0},zoom=0;
 g.view={getPov:()=>value,setPov:v=>{value=v},getZoom:()=>zoom,setZoom:v=>{zoom=v}};
 g.setPose({heading:30,pitch:4,zoom:35});
 assert.deepEqual(value,{heading:30,pitch:4});
 assert.ok(zoom>.9&&zoom<1.1);
 assert.ok(g.getPose().zoom>30);
});
