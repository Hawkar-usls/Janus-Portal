import {bboxAround, distanceKm, randomProbe} from './navigation.js';

const PANORAMAX_ENDPOINT = 'https://api.panoramax.xyz/api';
const PANORAMAX_VIEWER = 'https://cdn.jsdelivr.net/npm/@panoramax/web-viewer@5.2.0/build/cjs/index.js';
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
  panoramaxLoad ||= loadScript(PANORAMAX_VIEWER).then(() => customElements.whenDefined('pnx-photo-viewer'));
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
  if (!feature?.id || !feature?.collection || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Full 360 photo only; flat photos cannot be rotated around.
  if (fieldOfView < 300) return null;
  return {provider: 'panoramax', id: feature.id, collection: feature.collection, lat, lng};
}

export class PanoramaxProvider {
  constructor() {
    this.view = null;
    this.rotation = null;
  }
  async searchAtRadius({origin, radiusKm, visited, random, signal}) {
    const found = [];
    const attempts = 4;
    // Search several small geographic windows, rather than trusting the first
    // (often flat-photo-heavy) page of a huge bounding box.
    for (let i = 0; i < attempts && found.length < 8; i++) {
      if (signal?.aborted) break;
      const point = i === 0 ? origin : randomProbe(origin, radiusKm * 0.85, random);
      const box = bboxAround(point, Math.min(radiusKm / 3, 1.2));
      const url = PANORAMAX_ENDPOINT + '/search?bbox=' + box.join(',') + '&limit=80';
      const response = await fetch(url, {signal, headers: {Accept: 'application/geo+json'}});
      if (!response.ok) throw new Error('Panoramax: HTTP ' + response.status);
      const json = await response.json();
      for (const f of json.features || []) {
        const c = featureToCandidate(f);
        if (c && !visited.has(c.provider + ':' + c.id) && distanceKm(origin, c) <= radiusKm + 0.005) {
          found.push(c);
        }
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
    viewer.setAttribute('widgets', 'false');
    viewer.setAttribute('url-parameters', 'false');
    viewer.style.width = '100%';
    viewer.style.height = '100%';
    container.appendChild(viewer);
    this.view = viewer;
    await loadedWithin(viewer.onceFirstPicLoaded());
  }
  startRotation(intervalMs) {
    this.stopRotation();
    if (!this.view) return;
    // The official viewer exposes a relative pan method; this does not
    // synthesize or download Street View image tiles.
    const stepMs = Math.max(60, Math.round(intervalMs / 90));
    this.rotation = setInterval(() => this.view?.moveRight?.(), stepMs);
  }
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
  async searchAtRadius({origin, radiusKm, visited, random, signal}) {
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
        if (!visited.has('google:' + id) && distanceKm(origin, candidate) <= radiusKm + 0.005) {
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
        } else if (status && status !== 'UNKNOWN_ERROR' && status !== 'ZERO_RESULTS' && status !== 'OK') {
          listener.remove();
          reject(new Error('Google Street View: ' + status));
        }
      };
      const listener = this.view.addListener('status_changed', check);
      setTimeout(check, 150);
    }));
  }
  startRotation(intervalMs) {
    this.stopRotation();
    if (!this.view) return;
    const start = performance.now();
    const heading = this.view.getPov().heading;
    this.rotation = setInterval(() => {
      const fraction = ((performance.now() - start) % intervalMs) / intervalMs;
      this.view?.setPov({heading: (heading + 360 * fraction) % 360, pitch: 0});
    }, 60);
  }
  stopRotation() {
    if (this.rotation) clearInterval(this.rotation);
    this.rotation = null;
  }
}
