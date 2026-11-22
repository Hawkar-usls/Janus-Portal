// Browser-only expedition history. This is never authoritative for J Coins.
import {distanceKm, visitKey} from './navigation.js';

export const STORAGE_KEY = 'janus-portal-expedition-v1';
export const MAX_VISITS = 10000;
const PERSISTABLE_OPEN_SOURCES = new Set(['panoramax','kartaview','commons']);

function valid(entry) {
  return entry && ['google', 'panoramax', 'kartaview', 'commons'].includes(entry.provider) &&
    typeof entry.id === 'string' && entry.id.length > 0 && entry.id.length < 300 &&
    Number.isFinite(entry.lat) && entry.lat >= -90 && entry.lat <= 90 &&
    Number.isFinite(entry.lng) && entry.lng >= -180 && entry.lng <= 180 &&
    typeof entry.visitedAt === 'string' && !Number.isNaN(Date.parse(entry.visitedAt));
}

export function readHistory(storage = localStorage) {
  try {
    const raw = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw.filter((entry) => {
      if (!valid(entry) || !PERSISTABLE_OPEN_SOURCES.has(entry.provider)) return false;
      const key = visitKey(entry);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(-MAX_VISITS);
  } catch {
    return [];
  }
}

export function saveHistory(entries, storage = localStorage) {
  try {
    // Google-derived coordinates remain session-only. Store source IDs,
    // coordinates and timestamps only for the three open-imagery providers.
    storage.setItem(STORAGE_KEY, JSON.stringify(entries.filter(e => PERSISTABLE_OPEN_SOURCES.has(e.provider)).slice(-MAX_VISITS)));
    return true;
  } catch {
    return false;
  }
}

export function addVisit(entries, candidate, storage = localStorage) {
  const key = visitKey(candidate);
  if (entries.some((e) => visitKey(e) === key)) return {entries, added: false};
  const entry = {
    provider: candidate.provider,
    id: String(candidate.id),
    lat: candidate.lat,
    lng: candidate.lng,
    visitedAt: new Date().toISOString()
  };
  const next = [...entries, entry].slice(-MAX_VISITS);
  const persisted = PERSISTABLE_OPEN_SOURCES.has(candidate.provider) ? saveHistory(next, storage) : false;
  return {entries: next, added: true, persisted};
}

export function getStats(entries) {
  let km = 0;
  for (let i = 1; i < entries.length; i++) km += distanceKm(entries[i - 1], entries[i]);
  return {unique: new Set(entries.map(visitKey)).size, jumps: entries.length, km};
}

// R14 PASSPORT: local-only game progress derived from actually opened views.
// Region attribution is APPROXIMATE: a source geotag near a known start anchor,
// not a national-boundary lookup or independent verification of photo location.
// No J Coins, account identity, or remote leaderboard are created here.
export function getPassport(entries, anchors = [], maxAnchorDistanceKm = 25) {
  const seen = new Set();
  const countries = new Map();
  const providers = new Map();
  let unassigned = 0;
  for (const entry of entries || []) {
    if (!entry || !entry.id || !entry.provider ||
        !Number.isFinite(entry.lat) || !Number.isFinite(entry.lng)) continue;
    const key = visitKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    providers.set(entry.provider, (providers.get(entry.provider) || 0) + 1);
    let best = null, distance = Infinity;
    for (const anchor of anchors) {
      if (!anchor || !Number.isFinite(anchor.lat) || !Number.isFinite(anchor.lng)) continue;
      const km = distanceKm(entry, anchor);
      if (km < distance && km <= maxAnchorDistanceKm) {
        best = anchor; distance = km;
      }
    }
    if (!best || !best.code || !best.name) {unassigned++;continue;}
    const value = countries.get(best.code) || {
      code: best.code, name: best.name, flag: best.flag || '🌍',
      count: 0, last: null, lat: entry.lat, lng: entry.lng
    };
    value.count++;
    if (!value.last || (entry.visitedAt || '') > value.last) {
      value.last = entry.visitedAt || null;
      value.lat = entry.lat; value.lng = entry.lng;
    }
    countries.set(best.code, value);
  }
  const places = [...countries.values()].sort((a,b) => b.count-a.count || a.name.localeCompare(b.name));
  const unique = seen.size;
  const xp = unique * 10 + countries.size * 25;
  return {unique, countries: places, countryCount:countries.size,
    providers: [...providers].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count),
    unassigned, xp, level: Math.floor(xp / 100) + 1, nextLevelXp: 100 - (xp % 100)};
}
