// JANUS PORTAL — pure, provider-independent geography and adaptive exploration.
// All radii/distances use kilometres. No image or map data is stored here.
export const EARTH_RADIUS_KM = 6371.0088;
export const DEFAULT_RADIUS_KM = 5;
export const MAX_RADIUS_KM = 20000;

export function normalizeLng(lng) {
  return ((lng + 180) % 360 + 360) % 360 - 180;
}

export function distanceKm(a, b) {
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (normalizeLng(b.lng - a.lng)) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function radiusSteps(baseKm = DEFAULT_RADIUS_KM, maxKm = MAX_RADIUS_KM) {
  if (!Number.isFinite(baseKm) || baseKm <= 0 || !Number.isFinite(maxKm) || maxKm < baseKm) {
    throw new RangeError('Expected 0 < baseKm <= maxKm');
  }
  const steps = [baseKm];
  while (steps.at(-1) < maxKm) {
    steps.push(Math.min(maxKm, steps.at(-1) * 2));
  }
  return steps;
}

// Move on a sphere, rather than adding degrees of latitude/longitude.
export function destination(origin, distance, bearingRadians) {
  const theta = distance / EARTH_RADIUS_KM;
  const lat1 = origin.lat * Math.PI / 180;
  const lon1 = origin.lng * Math.PI / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(theta) +
    Math.cos(lat1) * Math.sin(theta) * Math.cos(bearingRadians));
  const lon2 = lon1 + Math.atan2(Math.sin(bearingRadians) * Math.sin(theta) * Math.cos(lat1),
    Math.cos(theta) - Math.sin(lat1) * Math.sin(lat2));
  return {lat: lat2 * 180 / Math.PI, lng: normalizeLng(lon2 * 180 / Math.PI)};
}

export function randomProbe(origin, radiusKm, random = Math.random) {
  return destination(origin, Math.sqrt(random()) * radiusKm, random() * 2 * Math.PI);
}

export function bboxAround(point, radiusKm) {
  const dLat = radiusKm / 111.2;
  const dLng = Math.min(180, radiusKm / Math.max(0.1, 111.2 * Math.cos(point.lat * Math.PI / 180)));
  // Avoid invalid wrapping boxes at the antimeridian; a probe covers one side.
  return [
    Math.max(-180, point.lng - dLng),
    Math.max(-90, point.lat - dLat),
    Math.min(180, point.lng + dLng),
    Math.min(90, point.lat + dLat)
  ];
}

export function visitKey(candidate) {
  return String(candidate.provider) + ':' + String(candidate.id);
}

export function chooseCandidate(candidates, origin, radiusKm, visited = new Set(), random = Math.random, visitedPoints = [], minSeparationKm = 0) {
  const unique = new Map();
  for (const c of candidates || []) {
    if (!c || !c.id || !c.provider || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    if (c.lat < -90 || c.lat > 90 || c.lng < -180 || c.lng > 180) continue;
    const key = visitKey(c);
    if (visited.has(key) || unique.has(key)) continue;
    if (minSeparationKm > 0 && visitedPoints.some(point => distanceKm(point, c) < minSeparationKm)) continue;
    const km = distanceKm(origin, c);
    if (km <= radiusKm + 0.005) unique.set(key, {...c, distanceKm: km});
  }
  const closest = [...unique.values()].sort((a, b) => a.distanceKm - b.distanceKm);
  if (!closest.length) return null;
  // Randomize among nearby candidates; never jump to a distant outlier when closer choices exist.
  const poolSize = Math.min(6, Math.max(1, Math.ceil(closest.length / 3)));
  return closest[Math.min(poolSize - 1, Math.floor(random() * poolSize))];
}

export async function findNext({
  origin, baseRadiusKm = DEFAULT_RADIUS_KM, maxRadiusKm = MAX_RADIUS_KM,
  visited = new Set(), visitedPoints = [], minSeparationKm = 0,
  searchAtRadius, random = Math.random, onExpand = () => {}, signal
}) {
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
    throw new TypeError('A valid origin is required');
  }
  if (typeof searchAtRadius !== 'function') throw new TypeError('searchAtRadius is required');
  const radii = radiusSteps(baseRadiusKm, maxRadiusKm);
  for (let i = 0; i < radii.length; i++) {
    if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
    const radiusKm = radii[i];
    if (i) onExpand({radiusKm, previousRadiusKm: radii[i - 1], step: i});
    const results = await searchAtRadius({origin, radiusKm, visited, random, signal});
    if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
    const next = chooseCandidate(results, origin, radiusKm, visited, random, visitedPoints, minSeparationKm);
    if (next) return {...next, searchRadiusKm: radiusKm, expansions: i};
  }
  const error = new Error('Не удалось найти новую панораму в проверенных выборках даже при расширении поиска.');
  error.name = 'NoLocationsError';
  error.checkedRadii = radii;
  throw error;
}
