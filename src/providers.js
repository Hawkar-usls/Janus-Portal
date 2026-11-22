import {bboxAround, distanceKm, randomProbe} from './navigation.js';

const PANORAMAX_ENDPOINT = 'https://api.panoramax.xyz/api';
const PANORAMAX_VIEWER = 'https://cdn.jsdelivr.net/npm/@panoramax/web-viewer@5.2.0/build/cjs/index_photoviewer.js';
let panoramaxLoad;
let googleLoad;

function loadScript(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => reject(new Error('Время загрузки библиотеки истекло')), timeoutMs);
    script.async = true;
    script.src = url;
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); reject(new Error('Не удалось загрузить библиотеку')); };
    document.head.appendChild(script);
  });
}

async function ensurePanoramaxViewer() {
  panoramaxLoad ||= (async () => {
    // The official v5.2.0 CommonJS browser bundle references a global
    // CommonJS 'exports' symbol during initialization. Supply it only while
    // the script loads, then restore the embedding site's previous state.
    const hadExports = Object.prototype.hasOwnProperty.call(window, 'exports');
    const previousExports = window.exports;
    window.exports = {};
    try {
      await loadScript(PANORAMAX_VIEWER);
      await customElements.whenDefined('pnx-photo-viewer');
    } finally {
      if (hadExports) window.exports = previousExports;
      else delete window.exports;
    }
  })();
  return panoramaxLoad;
}

async function ensureGoogle(key) {
  if (!key) throw new Error('Для Google Street View нужен ключ Maps JavaScript API с ограничением по домену.');
  if (!googleLoad) {
    // Google Maps JavaScript API browser keys are visible in network requests.
    // Never put a server key here; restrict this key by HTTP referrer and API in Cloud Console.
    const callback = '__janusPortalGoogleReady';
    googleLoad = new Promise((resolve, reject) => {
      let timeout;
      window[callback] = () => {
        clearTimeout(timeout);
        delete window[callback];
        resolve(window.google.maps);
      };
      timeout = setTimeout(() => reject(new Error('Google Maps не ответил')), 20000);
      const script = document.createElement('script');
      const params = new URLSearchParams({key, callback, v: 'weekly', loading: 'async', libraries: 'streetView'});
      script.src = 'https://maps.googleapis.com/maps/api/js?' + params.toString();
      script.async = true;
      script.onerror = () => { clearTimeout(timeout); reject(new Error('Ошибка загрузки Google Maps')); };
      document.head.append(script);
    });
  }
  return googleLoad;
}

function loadedWithin(promise, timeoutMs = 18000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Панорама не загрузилась вовремя')), timeoutMs))
  ]);
}

function featureToCandidate(feature) {
  const [lng, lat] = feature?.geometry?.coordinates || [];
  const fieldOfView = Number(feature?.properties?.['pers:interior_orientation']?.field_of_view || 0);
  const equirectangular = feature?.properties?.['pano:projection_type'] === 'equirectangular';
  if (!feature?.id || !feature?.collection || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Full 360 photo only; flat photos cannot be rotated around.
  if (!equirectangular && fieldOfView < 300) return null;
  return {provider: 'panoramax', id: feature.id, collection: feature.collection, lat, lng,
    previewUrl: feature.assets?.sd?.href || feature.assets?.thumb?.href || null};
}

// R11 live catalogue: confirm usable 360° metadata on every refresh.
// One bounded, cache-bypassing public API request per known geographic anchor;
// unlike static city labels, flat photos and missing image assets never qualify.
export async function probePanoramaxCoverage(origin,{signal,timeoutMs=8000}={}) {
  const controller=new AbortController();
  const onAbort=()=>controller.abort();
  signal?.addEventListener('abort',onAbort,{once:true});
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  if(signal?.aborted)controller.abort();
  try {
    const box=bboxAround(origin,1.2);
    const url=PANORAMAX_ENDPOINT+'/search?bbox='+box.join(',')+'&limit=120';
    const response=await fetch(url,{
      headers:{Accept:'application/geo+json'},
      cache:'no-store',signal:controller.signal
    });
    if(!response.ok)throw new Error('Panoramax: HTTP '+response.status);
    const data=await response.json();
    const matching=(data.features||[]).map(featureToCandidate)
      .filter(c=>c&&(c.previewUrl)&&distanceKm(origin,c)<=5);
    matching.sort((a,b)=>distanceKm(origin,a)-distanceKm(origin,b));
    return {candidate:matching[0]||null,count:matching.length};
  } catch(error) {
    if(signal?.aborted)throw new DOMException('Catalogue refresh cancelled','AbortError');
    if(controller.signal.aborted)throw new Error('Panoramax: время ответа каталога истекло');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort',onAbort);
  }
}

export class PanoramaxProvider {
  constructor() {
    this.view = null;
    this.photo = null;
    this.rotation = null;
  }
  async searchAtRadius({origin, radiusKm, visited, visitedPoints = [], minSeparationKm = 0.02, random, signal}) {
    const found = [];
    // Seeded points offer a reliable escape from empty regions (oceans, deserts)
    // once the expanding radius can geographically reach real coverage.
    const coverage = [
      {lat: 48.86473, lng: 2.34041}, // Paris
      {lat: 48.11617, lng: -1.68669}, // Rennes
      {lat: 45.76561, lng: 4.84002}  // Lyon
    ].filter(p => distanceKm(origin, p) <= radiusKm)
      .sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b));
    const points = [origin, ...coverage.slice(0, 2)];
    while (points.length < 4) points.push(randomProbe(origin, radiusKm * 0.85, random));
    // Search small windows. Full-world bbox queries can be biased by the first
    // page of results and most images in the service are flat rather than 360.
    for (const point of points) {
      if (signal?.aborted || found.length >= 8) break;
      const box = bboxAround(point, Math.min(radiusKm / 3, 1.2));
      const url = PANORAMAX_ENDPOINT + '/search?bbox=' + box.join(',') + '&limit=80';
      const response = await fetch(url, {signal, headers: {Accept: 'application/geo+json'}});
      if (!response.ok) throw new Error('Panoramax: HTTP ' + response.status);
      const json = await response.json();
      for (const f of json.features || []) {
        const c = featureToCandidate(f);
        if (!c || visited.has(c.provider + ':' + c.id) || distanceKm(origin, c) > radiusKm + 0.005) continue;
        // Avoid filling the result budget with photos from the same few metres.
        // Otherwise a large Panoramax sequence masks all other unseen spots.
        if (visitedPoints.some(p => distanceKm(p, c) < minSeparationKm)) continue;
        if (found.some(p => distanceKm(p, c) < minSeparationKm)) continue;
        found.push(c);
        if (found.length >= 8) break;
      }
    }
    return found;
  }
  async show(candidate, container) {
    await ensurePanoramaxViewer();
    this.stopRotation();
    container.replaceChildren();
    const viewer = document.createElement('pnx-photo-viewer');
    viewer.setAttribute('endpoint', PANORAMAX_ENDPOINT);
    viewer.setAttribute('sequence', candidate.collection);
    viewer.setAttribute('picture', candidate.id);
    viewer.setAttribute('widgets', 'true'); // preserve attribution and image credits
    viewer.setAttribute('url-parameters', 'false');
    viewer.style.width = '100%';
    viewer.style.height = '100%';
    container.appendChild(viewer);
    this.view = viewer;
    await loadedWithin(viewer.onceFirstPicLoaded());
    await viewer.oncePSVReady();
    this.photo = viewer.psv || null;
    if (!this.photo?.getXYZ || !this.photo?.setXYZ)
      throw new Error('Panoramax photo viewer does not expose supported getXYZ/setXYZ methods');
    const p = this.photo.getXYZ();
    this.photo.setXYZ(p.x, p.y, 0);
  }
  getPose() {
    const p=this.photo?.getXYZ?.() || {x:0,y:0,z:0};
    return {heading:p.x, pitch:p.y, zoom:p.z};
  }
  setPose(pose) {
    this.photo?.setXYZ?.(pose.heading, pose.pitch, pose.zoom);
  }
  getFrontHeading() {
    const h=this.photo?.getPictureOriginalHeading?.();
    return Number.isFinite(h) ? h : this.getPose().heading;
  }
  // Legacy compatibility; gaze director now owns the animation clock.
  startRotation() {this.stopRotation();}
  stopRotation() {
    if (this.rotation) clearInterval(this.rotation);
    this.rotation = null;
  }
}

export class GoogleProvider {
  constructor(key) {
    this.key = key;
    this.service = null;
    this.view = null;
    this.rotation = null;
    this.container = null;
  }
  async ready() {
    const maps = await ensureGoogle(this.key);
    await maps.importLibrary('streetView');
    this.service ||= new maps.StreetViewService();
    return maps;
  }
  async searchAtRadius({origin, radiusKm, visited, visitedPoints = [], minSeparationKm = 0.02, random = Math.random, signal}) {
    await this.ready();
    const found = [];
    // Bound paid service lookups; the engine handles expanding to wider radii.
    for (let i = 0; i < 4; i++) {
      if (signal?.aborted) break;
      const target = i === 0 ? origin : randomProbe(origin, radiusKm * 0.9, random);
      try {
        const result = await this.service.getPanorama({
          location: target,
          radius: 350,
          preference: 'nearest',
          sources: ['outdoor']
        });
        const data = result.data;
        const coords = data?.location?.latLng;
        const id = data?.location?.pano;
        if (!coords || !id) continue;
        const candidate = {provider: 'google', id, lat: coords.lat(), lng: coords.lng()};
        if (!visited.has('google:' + id) && distanceKm(origin, candidate) <= radiusKm + 0.005 &&
            !visitedPoints.some(p => distanceKm(p, candidate) < minSeparationKm)) {
          found.push(candidate);
        }
      } catch (error) {
        if (String(error?.message || error).includes('ZERO_RESULTS')) continue;
        throw error;
      }
    }
    return found;
  }
  async show(candidate, container) {
    const maps = await this.ready();
    this.stopRotation();
    if (!this.view || this.container !== container) {
      container.replaceChildren();
      this.view = new maps.StreetViewPanorama(container, {
        disableDefaultUI: false,
        addressControl: false,
        showRoadLabels: false,
        motionTracking: false,
        motionTrackingControl: false,
        pov: {heading: 0, pitch: 0},
        zoom: 0,
        visible: true
      });
      this.container = container;
    }
    this.view.setPano(candidate.id);
    this.view.setVisible(true);
    // A successful metadata lookup does not always imply successful tile display.
    await loadedWithin(new Promise((resolve, reject) => {
      const check = () => {
        const status = this.view.getStatus();
        if (status === 'OK') {
          listener.remove();
          resolve();
        } else if (status && status !== 'OK') {
          listener.remove();
          reject(new Error('Google Street View: ' + status));
        }
      };
      const listener = this.view.addListener('status_changed', check);
      setTimeout(check, 150);
    }));
  }
  getPose() {
    const p=this.view?.getPov?.() || {heading:0,pitch:0};
    return {heading:p.heading, pitch:p.pitch, zoom:(this.view?.getZoom?.() || 0) * 35};
  }
  setPose(pose) {
    if (!this.view) return;
    this.view.setPov({heading:pose.heading, pitch:pose.pitch});
    const current=this.view.getZoom?.() || 0;
    const target=Math.max(0,Math.min(2.2,pose.zoom/35));
    // Avoid expensive tiny zoom updates on every animation frame.
    if (Math.abs(current-target) >= .09) this.view.setZoom(target);
  }
  getFrontHeading() {return this.getPose().heading;}
  startRotation() {this.stopRotation();}
  stopRotation() {
    if (this.rotation) clearInterval(this.rotation);
    this.rotation = null;
  }
}


// R13 source mixer. Every candidate below must be a genuine 360° image with a
// source-owned URL, coordinates, license/attribution and a working in-window
// renderer. No scraped Google tiles, no Mapillary token borrowed from demos.
const KARTAVIEW_PHOTOS='https://api.kartaview.org/2.0/photo/';
const COMMONS_API='https://commons.wikimedia.org/w/api.php';
const sourceTimeout=async (url,{signal,timeoutMs=7000}={})=>{
  const ctrl=new AbortController();
  const onAbort=()=>ctrl.abort();
  signal?.addEventListener('abort',onAbort,{once:true});
  const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
  if(signal?.aborted)ctrl.abort();
  try {
    const res=await fetch(url,{signal:ctrl.signal,cache:'no-store',
      headers:{Accept:'application/json'}});
    if(!res.ok)throw new Error('Источник HTTP '+res.status);
    const data=await res.json();
    if(data.error||data.status?.httpCode>=400)
      throw new Error(String(data.error?.info||data.status?.apiMessage||'Ошибка каталога'));
    return data;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort);}
};
const isHttpsHost=(value,hosts)=>{
  try{const url=new URL(value);return url.protocol==='https:'&&hosts.some(h=>url.hostname===h||url.hostname.endsWith('.'+h))}
  catch{return false}
};
const kvImageHost=['cdn.kartaview.org'];
const commonsImageHost=['upload.wikimedia.org','thumb.wikimedia.org'];
const safeExternalLink=(url,host)=>isHttpsHost(url,[host])?url:null;
export async function probeKartaView360(origin,{signal,timeoutMs=7000}={}){
  const p=new URLSearchParams({lat:String(origin.lat),lng:String(origin.lng),
    radius:'500',itemsPerPage:'60',projection:'SPHERE'});
  const data=await sourceTimeout(KARTAVIEW_PHOTOS+'?'+p,{signal,timeoutMs});
  const photos=data.result?.data||[];
  const out=[];
  for(const row of photos){
    const lat=Number(row.lat),lng=Number(row.lng);
    const image=row.imageProcUrl;
    if(!row.id||row.projection!=='SPHERE'||Number(row.fieldOfView)<300||
      !Number.isFinite(lat)||!Number.isFinite(lng)||
      !isHttpsHost(image,kvImageHost)||distanceKm(origin,{lat,lng})>5)
      continue;
    const sequenceId=String(row.sequenceId||'');
    out.push({provider:'kartaview',id:String(row.id),lat,lng,
      previewUrl:image,imageUrl:image,sourceName:'KartaView',
      sourceUrl:/^\d+$/.test(sequenceId)?
        'https://kartaview.org/details/'+encodeURIComponent(sequenceId)+'/'+encodeURIComponent(row.id):
        'https://kartaview.org/',license:'CC BY-SA 4.0',attribution:'KartaView contributors'});
  }
  return out.slice(0,5);
}
export async function probeCommons360(origin,{signal,timeoutMs=7000}={}){
  const query=new URLSearchParams({
    origin:'*',action:'query',format:'json',generator:'geosearch',
    ggsnamespace:'6',ggsprimary:'all',
    ggscoord:String(origin.lat)+'|'+String(origin.lng),ggsradius:'5000',ggslimit:'50',
    prop:'coordinates|imageinfo',iiprop:'url|size|extmetadata',iiurlwidth:'3072'
  });
  const data=await sourceTimeout(COMMONS_API+'?'+query,{signal,timeoutMs});
  const out=[];
  for(const page of Object.values(data.query?.pages||{})){
    const info=page.imageinfo?.[0];
    const ext=info?.extmetadata||{};
    const categories=String(ext.Categories?.value||'');
    const description=String(ext.ImageDescription?.value||'').replace(/<[^>]*>/g,' ');
    const declared360=/360.? panoramas with equirectangular projection|360.?degree equirectangular|photosphere|photosphere panorama|equirectangular projection/i
      .test(categories+' '+description+' '+page.title);
    const width=Number(info?.width),height=Number(info?.height);
    const ratio=width/height;
    const gps=page.coordinates?.[0]||{};
    const lat=Number(gps.lat??ext.GPSLatitude?.value);
    const lng=Number(gps.lon??ext.GPSLongitude?.value);
    const license=String(ext.LicenseShortName?.value||'');
    const image=info?.thumburl||info?.url;
    const sourceUrl=info?.descriptionurl;
    if(!page.pageid||!declared360||!Number.isFinite(ratio)||
      Math.abs(ratio-2)>.12||width<1800||height<850||
      !Number.isFinite(lat)||!Number.isFinite(lng)||
      !/^CC(?: BY(?:-SA)?|0)|^Public domain|^PD-/i.test(license)||
      distanceKm(origin,{lat,lng})>5||
      !isHttpsHost(image,commonsImageHost)||
      !safeExternalLink(sourceUrl,'commons.wikimedia.org'))continue;
    const author=String(ext.Artist?.value||'Wikimedia Commons contributors')
      .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,140);
    out.push({provider:'commons',id:String(page.pageid),lat,lng,
      previewUrl:image,imageUrl:image,sourceUrl,
      sourceName:'Wikimedia Commons',license,attribution:author||'Wikimedia Commons contributors'});
  }
  return out.slice(0,5);
}

// Minimum-dependency spherical photo renderer for licensed 2:1 JPEG/PNG.
// WebGL is used only after the original search picks a verified KartaView or
// Commons photo. Panoramax and Google retain their own official viewers.
class SphericalImageProvider {
  constructor(){this.camera={heading:0,pitch:0,zoom:0};this.drawPending=0;this.cleanup=null;}
  async show(candidate,container){
    this.stopRotation();
    if(!candidate?.imageUrl||!isHttpsHost(candidate.imageUrl,
      candidate.provider==='commons'?commonsImageHost:kvImageHost))
      throw new Error('Источник не предоставил разрешённый URL панорамы');
    const img=new Image();img.crossOrigin='anonymous';
    await new Promise((resolve,reject)=>{
      let settled=false;const finish=err=>{
        if(settled)return;settled=true;clearTimeout(timeout);
        img.onload=null;img.onerror=null;err?reject(err):resolve();
      };
      const timeout=setTimeout(()=>finish(new Error('Тайм-аут загрузки 360° изображения')),18000);
      img.onload=()=>finish();
      img.onerror=()=>finish(new Error('Изображение 360° недоступно или запрещено CORS'));
      img.src=candidate.imageUrl;
    });
    if(!img.naturalWidth||!img.naturalHeight||
      Math.abs(img.naturalWidth/img.naturalHeight-2)>.18)
      throw new Error('Изображение не является полной сферической панорамой 2:1');
    const canvas=document.createElement('canvas');canvas.style.cssText=
      'display:block;width:100%;height:100%;touch-action:none;cursor:grab;';
    const gl=canvas.getContext('webgl',{antialias:false,alpha:false,preserveDrawingBuffer:false});
    if(!gl)throw new Error('Для этого источника нужен браузер с WebGL');
    const shader=(type,code)=>{
      const obj=gl.createShader(type);gl.shaderSource(obj,code);gl.compileShader(obj);
      if(!gl.getShaderParameter(obj,gl.COMPILE_STATUS))
        throw new Error('WebGL shader: '+gl.getShaderInfoLog(obj));
      return obj;
    };
    const vert=shader(gl.VERTEX_SHADER,
      'attribute vec2 pos;varying vec2 uv;void main(){uv=pos;gl_Position=vec4(pos,0.0,1.0);}');
    const frag=shader(gl.FRAGMENT_SHADER,[
      'precision highp float;varying vec2 uv;uniform sampler2D photo;',
      'uniform float yaw;uniform float pitch;uniform float fov;uniform float aspect;',
      'void main(){',
      'float t=tan(radians(fov)*0.5);',
      'vec3 d=normalize(vec3(uv.x*aspect*t,uv.y*t,1.0));',
      'float p=radians(pitch);',
      'vec3 v=vec3(d.x,d.y*cos(p)+d.z*sin(p),d.z*cos(p)-d.y*sin(p));',
      'float lon=atan(v.x,v.z)+radians(yaw);',
      'vec2 st=vec2(fract(0.5+lon/6.2831853),clamp(0.5-asin(clamp(v.y,-1.0,1.0))/3.14159265,0.0,1.0));',
      'gl_FragColor=texture2D(photo,st);',
      '}'
    ].join('\n'));
    const program=gl.createProgram();
    gl.attachShader(program,vert);gl.attachShader(program,frag);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
      throw new Error('WebGL программа не загрузилась');
    gl.useProgram(program);
    const buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'pos');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    const texture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,texture);
    const max=Math.min(4096,gl.getParameter(gl.MAX_TEXTURE_SIZE));
    let source=img;
    if(img.naturalWidth>max||img.naturalHeight>max){
      const down=document.createElement('canvas');
      down.width=Math.min(max,img.naturalWidth);
      down.height=Math.round(down.width*img.naturalHeight/img.naturalWidth);
      down.getContext('2d').drawImage(img,0,0,down.width,down.height);
      source=down;
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    this.camera={heading:0,pitch:0,zoom:0};
    const uni=k=>gl.getUniformLocation(program,k);
    const uYaw=uni('yaw'),uPitch=uni('pitch'),uFov=uni('fov'),uAspect=uni('aspect');
    const render=()=>{
      this.drawPending=0;
      const dpr=Math.min(2,window.devicePixelRatio||1);
      const w=Math.max(1,Math.round(container.clientWidth*dpr));
      const h=Math.max(1,Math.round(container.clientHeight*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);
      gl.uniform1f(uYaw,this.camera.heading);
      gl.uniform1f(uPitch,this.camera.pitch);
      gl.uniform1f(uFov,Math.max(34,83-this.camera.zoom*.45));
      gl.uniform1f(uAspect,w/h);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    };
    this.render=()=>{if(!this.drawPending)this.drawPending=requestAnimationFrame(render);};
    let last=null;
    const down=e=>{last={x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);canvas.style.cursor='grabbing';};
    const move=e=>{
      if(!last)return;
      this.camera.heading+=(last.x-e.clientX)*.14;
      this.camera.pitch=Math.max(-85,Math.min(85,this.camera.pitch+(e.clientY-last.y)*.11));
      last={x:e.clientX,y:e.clientY};this.render();
    };
    const up=()=>{last=null;canvas.style.cursor='grab';};
    const wheel=e=>{e.preventDefault();this.camera.zoom=Math.max(0,Math.min(100,this.camera.zoom+e.deltaY*-0.06));this.render();};
    canvas.addEventListener('pointerdown',down);
    canvas.addEventListener('pointermove',move);
    canvas.addEventListener('pointerup',up);
    canvas.addEventListener('pointercancel',up);
    canvas.addEventListener('wheel',wheel,{passive:false});
    const credit=document.createElement('div');credit.className='external-360-attribution';
    const text=document.createElement('span');text.textContent=
      (candidate.sourceName||'360°')+' · '+(candidate.attribution||'автор источника')+
      ' · '+(candidate.license||'см. источник');
    const link=document.createElement('a');
    link.href=candidate.sourceUrl||'https://commons.wikimedia.org/';
    link.target='_blank';link.rel='noopener noreferrer';link.textContent='Источник ↗';
    credit.append(text,link);
    const frame=document.createElement('div');
    frame.className='source-360-frame';
    frame.append(canvas,credit);
    container.replaceChildren(frame);
    const observer=new ResizeObserver(()=>this.render());observer.observe(container);
    this.cleanup=()=>{observer.disconnect();canvas.removeEventListener('pointerdown',down);
      canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);
      canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);
      if(this.drawPending)cancelAnimationFrame(this.drawPending);
      this.drawPending=0;gl.deleteTexture(texture);gl.deleteProgram(program);
      gl.deleteBuffer(buffer);gl.deleteShader(vert);gl.deleteShader(frag);};
    this.render();
  }
  getPose(){return {...this.camera};}
  setPose(p){this.camera={heading:p.heading,pitch:p.pitch,zoom:p.zoom};this.render?.();}
  getFrontHeading(){return this.camera.heading;}
  stopRotation(){if(this.cleanup){this.cleanup();this.cleanup=null;}if(this.drawPending)cancelAnimationFrame(this.drawPending);this.drawPending=0;}
}
export async function probeMerged360(origin,{signal,includeCommons=true,includeKartaView=true}={}){
  const queries=[
    probePanoramaxCoverage(origin,{signal}).then(x=>x.candidate?[x.candidate]:[])
  ];
  if(includeKartaView)queries.push(probeKartaView360(origin,{signal}));
  if(includeCommons)queries.push(probeCommons360(origin,{signal}));
  const result=await Promise.allSettled(queries);
  const errors=result.filter(x=>x.status==='rejected');
  const photos=result.flatMap(x=>x.status==='fulfilled'?x.value:[]);
  const distinct=[];
  for(const candidate of photos){
    if(!distinct.some(x=>x.provider===candidate.provider&&x.id===candidate.id))
      distinct.push(candidate);
  }
  return {candidates:distinct,failed:errors.length,checked:queries.length};
}
export class Merged360Provider {
  constructor({googleKey='',includeGoogle=false}={}){
    this.providers={panoramax:new PanoramaxProvider(),
      kartaview:new SphericalImageProvider(),commons:new SphericalImageProvider(),
      ...(includeGoogle&&googleKey?{google:new GoogleProvider(googleKey)}:{})};
    this.current=null;
  }
  async searchAtRadius(opts){
    const searches=[this.providers.panoramax.searchAtRadius(opts),
      probeKartaView360(opts.origin,{signal:opts.signal}),
      probeCommons360(opts.origin,{signal:opts.signal})];
    // A paid Google search is never initiated by a passive catalogue refresh.
    // It is only allowed after an explicitly entered key and manual journey.
    if(this.providers.google)searches.push(this.providers.google.searchAtRadius(opts));
    const all=await Promise.allSettled(searches);
    const photos=all.flatMap(x=>x.status==='fulfilled'?x.value:[]);
    const result=[];
    for(const c of photos){
      if(opts.visited?.has(c.provider+':'+c.id) ||
         opts.visitedPoints?.some(x=>distanceKm(x,c)<(opts.minSeparationKm??.02)) ||
         distanceKm(opts.origin,c)>opts.radiusKm+.005)continue;
      if(!result.some(p=>p.provider===c.provider&&p.id===c.id))
        result.push(c);
    }
    return result;
  }
  async show(candidate,container){
    const adapter=this.providers[candidate.provider];
    if(!adapter)throw new Error('Неизвестный провайдер панорамы '+candidate.provider);
    this.current?.stopRotation();
    this.current=adapter;
    this.currentProviderId=candidate.provider;
    await adapter.show(candidate,container);
  }
  getPose(){return this.current?.getPose()||{heading:0,pitch:0,zoom:0};}
  setPose(p){this.current?.setPose(p);}
  getFrontHeading(){return this.current?.getFrontHeading()||0;}
  stopRotation(){this.current?.stopRotation();}
}
