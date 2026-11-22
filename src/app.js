import {findNext, distanceKm, visitKey} from './navigation.js';
import {PanoramaxProvider, GoogleProvider} from './providers.js';
import {readHistory, addVisit, getStats, STORAGE_KEY} from './storage.js';

const $ = id => document.getElementById(id);
const CITY = {
  paris: {lat: 48.86473, lng: 2.34041},
  rennes: {lat: 48.11617, lng: -1.68669},
  lyon: {lat: 45.76561, lng: 4.84002},
  kyiv: {lat: 50.4501, lng: 30.5234},
  tokyo: {lat: 35.6762, lng: 139.6503},
  newyork: {lat: 40.7128, lng: -74.0060},
  rio: {lat: -22.9068, lng: -43.1729}
};
const state = {
  history: readHistory(), running: false, paused: false, busy: false,
  turbo: false, provider: null, current: null, origin: null,
  abort: null, timer: null, generation: 0, map: null, mapLayer: null
};

function setStatus(message, kind = '') {
  $('runStatus').className = 'status ' + kind;
  $('runStatus').innerHTML = '<span class="dot" aria-hidden="true"></span>';
  $('runStatus').append(document.createTextNode(message));
}
function message(text, error = false) {
  $('notice').textContent = text;
  $('notice').classList.toggle('error', error);
}
function effectiveMs() {
  return Math.round(Number($('seconds').value) * (state.turbo ? 500 : 1000));
}
function cleanTimer() {
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
}
function refreshControls() {
  $('startBtn').textContent = state.running ? '■ Остановить' : '▶ Запустить';
  $('pauseBtn').disabled = !state.running;
  $('pauseBtn').textContent = state.paused ? '▶ Продолжить' : 'Ⅱ Пауза';
  $('nextBtn').disabled = !state.running || state.busy;
  $('provider').disabled = state.running;
  $('originChoice').disabled = state.running;
  $('latlng').disabled = state.running;
  $('googleKey').disabled = state.running;
}
function updateRadius(radius, note) {
  $('activeRadius').textContent = Number(radius).toLocaleString('ru-RU') + ' км';
  if (note) $('radiusHint').textContent = note;
}
function getOrigin() {
  const key = $('originChoice').value;
  if (key === 'random') return {...CITY[Object.keys(CITY)[Math.floor(Math.random() * Object.keys(CITY).length)]]};
  if (key !== 'custom') return {...CITY[key]};
  const vals = $('latlng').value.split(/[,;\s]+/).filter(Boolean).map(Number);
  if (vals.length !== 2 || !vals.every(Number.isFinite) || vals[0] < -90 || vals[0] > 90 || vals[1] < -180 || vals[1] > 180) {
    throw new Error('Укажи корректные координаты: широта, долгота (например 48.8647, 2.3404).');
  }
  return {lat: vals[0], lng: vals[1]};
}
function chooseProvider() {
  if ($('provider').value === 'google') {
    const key = $('googleKey').value.trim();
    if (!key) throw new Error('Для Google Street View введи браузерный API-ключ с ограничением по домену.');
    return new GoogleProvider(key);
  }
  return new PanoramaxProvider();
}
function stop() {
  state.generation++;
  state.running = false;
  state.paused = false;
  cleanTimer();
  state.abort?.abort();
  state.abort = null;
  state.provider?.stopRotation();
  state.busy = false;
  setStatus('Остановлено');
  refreshControls();
}
function scheduleNext() {
  cleanTimer();
  if (state.running && !state.paused && !state.busy) {
    state.timer = setTimeout(() => travel(), effectiveMs());
  }
}
function showLocation(candidate) {
  $('coords').textContent = candidate.lat.toFixed(5) + ', ' + candidate.lng.toFixed(5);
  $('placeLabel').textContent = candidate.provider === 'google' ? 'Google Street View' : 'Panoramax 360°';
  $('mapLink').href = 'https://www.openstreetmap.org/?mlat=' + candidate.lat + '&mlon=' + candidate.lng + '#map=15/' + candidate.lat + '/' + candidate.lng;
  $('mapLink').hidden = false;
}
async function travel() {
  if (!state.running || state.paused || state.busy) return;
  cleanTimer();
  state.busy = true;
  const generation = state.generation;
  const controller = new AbortController();
  state.abort = controller;
  refreshControls();
  setStatus('Поиск новой точки…', 'warn');
  const origin = state.current || state.origin;
  updateRadius(Number($('radius').value), 'Поиск ещё не посещённых панорам');
  try {
    const visited = new Set(state.history.map(visitKey));
    const candidate = await findNext({
      origin,
      baseRadiusKm: Number($('radius').value),
      visited,
      visitedPoints: state.history,
      minSeparationKm: 0.02,
      searchAtRadius: options => state.provider.searchAtRadius(options),
      signal: controller.signal,
      onExpand: ({radiusKm}) => {
        if (generation === state.generation) {
          updateRadius(radiusKm, 'В пределах предыдущего радиуса новые точки не найдены');
          message('Новые панорамы не обнаружены. Автоматически расширяю радиус до ' +
            radiusKm.toLocaleString('ru-RU') + ' км…');
        }
      }
    });
    if (!state.running || generation !== state.generation || controller.signal.aborted) return;
    setStatus('Загрузка панорамы…', 'warn');
    await state.provider.show(candidate, $('viewer'));
    if (!state.running || generation !== state.generation || controller.signal.aborted) return;
    const previous = state.current || state.origin;
    const jumpDistance = distanceKm(previous, candidate);
    state.current = candidate;
    const saved = addVisit(state.history, candidate);
    state.history = saved.entries;
    showLocation(candidate);
    updateRadius(candidate.searchRadiusKm, candidate.expansions
      ? 'Поиск расширен ' + candidate.expansions + ' раз(а)'
      : 'Найдено в начальном радиусе');
    message('✓ Новая панорама • прыжок ' + jumpDistance.toFixed(2) + ' км' +
      (saved.added ? ' • сохранено в локальной истории' : ' • локальное сохранение недоступно или точка повторная') +
      '. JC пока не начисляются.');
    renderStats();
    if (!state.paused) {
      state.provider.startRotation(effectiveMs());
      setStatus('Исследование', 'live');
    } else setStatus('Пауза');
  } catch (error) {
    if (error?.name !== 'AbortError' && state.running && generation === state.generation) {
      const noPoints = error?.name === 'NoLocationsError';
      message(noPoints
        ? 'Поиск по доступным выборкам завершён без новых 360° панорам. Можно выбрать другой город или источник. Это не доказывает, что все места посещены.'
        : 'Ошибка: ' + (error?.message || String(error)), true);
      setStatus(noPoints ? 'Места не найдены' : 'Ошибка', 'warn');
      state.paused = true; // avoid infinite chargeable requests and tight retry loops
    }
  } finally {
    if (generation === state.generation) {
      state.busy = false;
      state.abort = null;
      refreshControls();
      if (state.running && !state.paused) scheduleNext();
    }
  }
}
function run() {
  if (state.running) {stop(); return;}
  try {
    state.origin = getOrigin();
    state.provider = chooseProvider();
  } catch (e) {
    message(e.message, true);
    return;
  }
  state.current = null;
  state.running = true;
  state.paused = false;
  state.generation++;
  refreshControls();
  message('Маршрут запущен. Начинаю с радиуса ' + $('radius').value + ' км.');
  travel();
}
function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  if (state.paused) {
    cleanTimer();
    state.provider?.stopRotation();
    setStatus('Пауза');
  } else {
    if (!state.busy) {
      state.provider?.startRotation(effectiveMs());
      scheduleNext();
      setStatus('Исследование', 'live');
    } else setStatus('Поиск…', 'warn');
  }
  refreshControls();
}
function skip() {
  if (!state.running || state.busy) return;
  state.paused = false;
  state.provider?.stopRotation();
  cleanTimer();
  refreshControls();
  travel();
}
function updateMap() {
  if (!window.L) {
    $('map').textContent = 'Карта временно недоступна (библиотека не загрузилась). История доступна ниже.';
    return;
  }
  if (!state.map) {
    state.map = L.map('map', {worldCopyJump: true}).setView([30, 12], 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);
  }
  if (state.mapLayer) state.map.removeLayer(state.mapLayer);
  state.mapLayer = L.layerGroup().addTo(state.map);
  const entries = state.history.slice(-300);
  if (!entries.length) return;
  const points = entries.map(e => [e.lat, e.lng]);
  L.polyline(points, {color: '#4cbed8', weight: 2, opacity: 0.7}).addTo(state.mapLayer);
  entries.forEach((e, i) => {
    const marker = L.circleMarker([e.lat, e.lng], {radius: i === entries.length - 1 ? 7 : 4,
      color: '#99ffea', fillColor: i === entries.length - 1 ? '#60e9bc' : '#327b9b', fillOpacity: 0.85,
      weight: 1}).addTo(state.mapLayer);
    marker.bindPopup('<strong>' + (e.provider === 'google' ? 'Google Street View' : 'Panoramax') +
      '</strong><br>№ ' + (state.history.length - entries.length + i + 1) +
      '<br>' + e.lat.toFixed(5) + ', ' + e.lng.toFixed(5));
  });
  state.map.fitBounds(L.latLngBounds(points).pad(0.35), {maxZoom: 12});
}
function renderAchievements() {
  const n = state.history.length;
  const km = getStats(state.history).km;
  const values = [
    ['🌱', 'Первый шаг', '1 место', n >= 1],
    ['🧭', 'Исследователь', '10 мест', n >= 10],
    ['🌍', 'Путешественник', '50 мест', n >= 50],
    ['🚀', 'Открытия без границ', '100 мест', n >= 100],
    ['✨', 'Дальний прыжок', '100 км пути', km >= 100],
    ['🏅', 'Марафон', '1000 км пути', km >= 1000]
  ];
  $('achievements').replaceChildren(...values.map(([emoji, name, target, unlocked]) => {
    const div = document.createElement('div');
    div.className = 'achievement ' + (unlocked ? 'unlocked' : '');
    const image = document.createElement('span'); image.className = 'emoji'; image.textContent = emoji;
    const title = document.createElement('strong'); title.textContent = name;
    const detail = document.createElement('small'); detail.textContent = (unlocked ? '✓ Открыто • ' : '🔒 ') + target;
    div.append(image, title, detail);
    return div;
  }));
}
function renderHistory() {
  const list = $('history');
  list.replaceChildren();
  if (!state.history.length) {
    const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Ещё нет открытий. Сделай первый прыжок!';
    list.append(p); return;
  }
  const entries = state.history.slice(-100).reverse();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const row = document.createElement('div'); row.className = 'history-item';
    const num = document.createElement('span'); num.className = 'number';
    num.textContent = '#' + (state.history.length - i);
    const details = document.createElement('span'); details.className = 'details';
    const title = document.createElement('strong'); title.textContent = e.provider === 'google' ? 'Google Street View' : 'Panoramax 360°';
    const sub = document.createElement('small'); sub.textContent = e.lat.toFixed(5) + ', ' + e.lng.toFixed(5) +
      ' · ' + new Date(e.visitedAt).toLocaleString('ru-RU');
    const link = document.createElement('a'); link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.href = 'https://www.openstreetmap.org/?mlat=' + e.lat + '&mlon=' + e.lng + '#map=15/' + e.lat + '/' + e.lng;
    link.textContent = 'Карта ↗';
    details.append(title, sub); row.append(num, details, link); list.append(row);
  }
}
function renderStats() {
  const {unique, jumps, km} = getStats(state.history);
  $('statUnique').textContent = unique.toLocaleString('ru-RU');
  $('statJumps').textContent = jumps.toLocaleString('ru-RU');
  $('statKm').textContent = km < 100 ? km.toFixed(1) + ' км' : Math.round(km).toLocaleString('ru-RU') + ' км';
  $('statCoins').textContent = '—';
  renderAchievements();
  renderHistory();
  updateMap();
}
function downloadHistory() {
  const payload = {schema: 'janus-portal-history-v1', exportedAt: new Date().toISOString(),
    authority: 'local-only-not-valid-for-rewards', visits: state.history};
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'janus-portal-expedition.json';
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('provider').addEventListener('change', () => $('googleKeyWrap').hidden = $('provider').value !== 'google');
$('originChoice').addEventListener('change', () => $('customOrigin').hidden = $('originChoice').value !== 'custom');
$('radius').addEventListener('input', () => {
  $('radiusVal').textContent = $('radius').value + ' км';
  if (!state.busy) updateRadius($('radius').value);
});
$('seconds').addEventListener('input', () => {
  $('secondsVal').textContent = $('seconds').value + ' сек';
  if (state.running && !state.paused && !state.busy) {
    state.provider?.startRotation(effectiveMs());
    scheduleNext();
  }
});
$('boost').addEventListener('click', () => {
  state.turbo = !state.turbo;
  $('boost').setAttribute('aria-pressed', String(state.turbo));
  $('boost').textContent = '⚡ Турбо ×2: ' + (state.turbo ? 'включено' : 'выключено');
  if (state.running && !state.paused && !state.busy) {
    state.provider?.startRotation(effectiveMs()); scheduleNext();
  }
});
$('startBtn').addEventListener('click', run);
$('pauseBtn').addEventListener('click', togglePause);
$('nextBtn').addEventListener('click', skip);
$('downloadBtn').addEventListener('click', downloadHistory);
$('resetBtn').addEventListener('click', () => {
  if (!confirm('Удалить всю историю посещений только в этом браузере? Награды на сервере это не затронет.')) return;
  stop();
  state.history = [];
  localStorage.removeItem(STORAGE_KEY);
  renderStats();
  message('Локальная история очищена. Следующая экспедиция начнётся с чистого листа.');
  $('placeLabel').textContent = 'Ждём первого прыжка';
  $('coords').textContent = '—';
  $('mapLink').hidden = true;
});
refreshControls();
renderStats();
