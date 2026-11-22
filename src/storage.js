// Browser-only expedition history. This is never authoritative for J Coins.
import {distanceKm, visitKey} from './navigation.js';

export const STORAGE_KEY = 'janus-portal-expedition-v1';
export const MAX_VISITS = 10000;

function valid(entry) {
  return entry && ['google', 'panoramax'].includes(entry.provider) &&
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
      if (!valid(entry)) return false;
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
    storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_VISITS)));
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
  return {entries: next, added: saveHistory(next, storage)};
}

export function getStats(entries) {
  let km = 0;
  for (let i = 1; i < entries.length; i++) km += distanceKm(entries[i - 1], entries[i]);
  return {unique: new Set(entries.map(visitKey)).size, jumps: entries.length, km};
}
