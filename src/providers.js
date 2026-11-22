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
