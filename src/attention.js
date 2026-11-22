// JANUS PORTAL R2 — client-side visual attention for Panoramax only.
// No user photo uploads and no pixel access to Google Street View.
// This can identify contrast-rich regions; it DOES NOT identify a person.
// Optional MediaPipe recognition can report tentative object categories.
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const wrap = v => ((v % 360) + 360) % 360;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
const PACKAGE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22';
let detectorPromise;

const labels = new Map([
  ['person', 'человека'], ['dog', 'собаку'], ['cat', 'кошку'],
  ['bird', 'птицу'], ['bicycle', 'велосипед'], ['car', 'автомобиль'],
  ['motorcycle', 'мотоцикл'], ['bus', 'автобус'], ['truck', 'грузовик'],
  ['boat', 'лодку'], ['bench', 'скамейку'], ['traffic light', 'светофор'],
  ['horse', 'лошадь'], ['train', 'поезд']
]);

export function pixelToPose(x, y, width, height, frontHeading = 0) {
  return {
    heading: wrap(frontHeading + (x / width - 0.5) * 360),
    pitch: clamp(90 - y / height * 180, -40, 40)
  };
}

export function getVisualSaliency(imageData, frontHeading = 0, maxResults = 3) {
  const {width, height, data} = imageData || {};
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 32 || height < 16 ||
      !data || data.length < width * height * 4) return [];
  const bands = [];
  // Sample broad cells along horizon; contrast, edges and colour variation
  // are hints of "interesting" detail, NOT semantic object recognition.
  const tileW = Math.max(8, Math.floor(width / 20));
  const tileH = Math.max(8, Math.floor(height / 8));
  const brightness = (x,y) => {
    const offset = ((y * width) + x) * 4;
    return (data[offset]*.2126 + data[offset+1]*.7152 + data[offset+2]*.0722);
  };
  const sat = (x,y) => {
    const offset = ((y * width) + x) * 4;
    return Math.max(data[offset],data[offset+1],data[offset+2]) -
      Math.min(data[offset],data[offset+1],data[offset+2]);
  };
  for (let y = Math.floor(height*.26); y < Math.floor(height*.77); y += tileH) {
    for (let x = 0; x + tileW < width; x += tileW) {
      let contrast=0, colour=0, count=0;
      for (let j=y+2; j<Math.min(y+tileH,height-3); j+=4) {
        for (let i=x+2; i<Math.min(x+tileW,width-3); i+=4) {
          contrast+=Math.abs(brightness(i+2,j)-brightness(i-2,j))+
            Math.abs(brightness(i,j+2)-brightness(i,j-2));
          colour+=sat(i,j);
          count++;
        }
      }
      if (!count) continue;
      bands.push({x:x+tileW/2,y:y+tileH/2,
        energy:contrast / count * .78 + colour / count * .22});
    }
  }
  const max = Math.max(1,...bands.map(c=>c.energy));
  const sorted = bands.sort((a,b)=>b.energy-a.energy);
  const selected = [];
  for (const c of sorted) {
    if (selected.length>=maxResults) break;
    if (c.energy < max*.28 || c.energy < 8) continue;
    const pose=pixelToPose(c.x,c.y,width,height,frontHeading);
    if (selected.some(p => Math.abs(((pose.heading-p.heading+540)%360)-180)<27)) continue;
    selected.push({...pose, score:clamp(c.energy/max*.68,.35,.78),
      label:'визуальную деталь', source:'contrast-heuristic'});
  }
  return selected;
}

export function objectDetectionsToPoints(detections, {
  frameIndex, cropCount = 4, cropWidth = 384, cropHeight = 384, frontHeading = 0
} = {}) {
  if (!Array.isArray(detections)) return [];
  return detections.flatMap(d => {
    const category=d.categories?.[0];
    if (!category || !labels.has(category.categoryName) || category.score < .48) return [];
    const box=d.boundingBox;
    if (!box || !Number.isFinite(box.originX) || !Number.isFinite(box.originY)) return [];
    const dx=(box.originX+box.width/2)/cropWidth;
    const dy=(box.originY+box.height/2)/cropHeight;
    if (dx < 0 || dx > 1 || dy < 0 || dy > 1) return [];
    // Four overlapping 90° windows centred on the equator; this is approximate,
    // not a promise of exact compass registration for all source image metadata.
    const heading=wrap(frontHeading+(frameIndex+dx)/cropCount*360-180);
    const pitch=clamp((.75-dy)*90,-35,35);
    return [{heading,pitch,score:clamp(category.score, .48,1),
      label:labels.get(category.categoryName), source:'mediapipe-object-detector',
      category:category.categoryName}];
  });
}

async function getDetector() {
  detectorPromise ||= (async()=>{
    const {FilesetResolver, ObjectDetector} =
      await import(PACKAGE + '/vision_bundle.mjs');
    const fileset=await FilesetResolver.forVisionTasks(PACKAGE + '/wasm');
    return ObjectDetector.createFromOptions(fileset,{
      baseOptions:{modelAssetPath:MODEL,delegate:'CPU'},
      runningMode:'IMAGE', scoreThreshold:.48, maxResults:12
    });
  })();
  try {return await detectorPromise;} catch (e) {detectorPromise=null;throw e;}
}

function loadSourceImage(url,signal,timeoutMs=4500) {
  return new Promise((resolve,reject)=>{
    if (signal?.aborted) {reject(new DOMException('Cancelled','AbortError'));return;}
    const img=new Image(); img.crossOrigin='anonymous'; img.decoding='async';
    let finished=false;
    const settle=(error)=>{if(finished)return;finished=true;clearTimeout(timeout);
      signal?.removeEventListener('abort',cancel);
      if(error)reject(error);else resolve(img);
    };
    const cancel=()=>{img.src='';settle(new DOMException('Cancelled','AbortError'))};
    const timeout=setTimeout(()=>settle(new Error('Photo analysis timed out')),timeoutMs);
    signal?.addEventListener('abort',cancel,{once:true});
    img.onload=()=>settle(); img.onerror=()=>settle(new Error('Photo unavailable or CORS blocked'));
    img.src=url;
  });
}
function attentionCanvas(img) {
  const canvas=document.createElement('canvas');
  canvas.width=640;canvas.height=320;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return {canvas,ctx};
}

export async function analyzeInterest({
  candidate, frontHeading=0, mode='details', signal, onInfo=()=>{}
}={}) {
  if (!candidate || candidate.provider!=='panoramax' || mode==='off' || !candidate.previewUrl)
    return {points:[],reason:candidate?.provider==='google'?'google-no-pixel-analysis':'disabled-or-unavailable'};
  try {
    const img=await loadSourceImage(candidate.previewUrl,signal);
    if(signal?.aborted) throw new DOMException('Cancelled','AbortError');
    const {canvas,ctx}=attentionCanvas(img);
    const points=getVisualSaliency(ctx.getImageData(0,0,640,320),frontHeading,3);
    if (mode!=='objects') return {points,reason:'contrast-heuristic'};
    onInfo('Локально ищу людей и объекты…');
    // The model runs locally in the browser. No panorama is sent to the model
    // server; only model code/weights are downloaded from a CDN.
    let detector;
    try {detector=await Promise.race([
      getDetector(),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('Model timeout')),8000))
    ]);} catch {return {points,reason:'model-unavailable-contrast-fallback'};}
    if(signal?.aborted) throw new DOMException('Cancelled','AbortError');
    const crop=document.createElement('canvas');crop.width=384;crop.height=384;
    const cctx=crop.getContext('2d');
    if (!cctx) return {points,reason:'canvas-unavailable'};
    const semantic=[];
    for (let i=0;i<4;i++) {
      if(signal?.aborted) throw new DOMException('Cancelled','AbortError');
      // The 360x180 source is horizontally subdivided into four wide views.
      cctx.drawImage(canvas, i*160,24,160,272,0,0,384,384);
      const result=detector.detect(crop);
      semantic.push(...objectDetectionsToPoints(result.detections,{
        frameIndex:i,cropCount:4,cropWidth:384,cropHeight:384,frontHeading
      }));
    }
    const first=[...semantic.sort((a,b)=>b.score-a.score)];
    for (const p of points) if (!first.some(o =>
      Math.abs(((p.heading-o.heading+540)%360)-180)<25)) first.push(p);
    return {points:first.slice(0,4),reason:semantic.length?'detected-objects':'contrast-fallback',
      detectedObjects:semantic.map(s=>({category:s.category,score:s.score}))};
  } catch(e) {
    if (e?.name==='AbortError') throw e;
    return {points:[],reason:'image-unavailable'};
  }
}
