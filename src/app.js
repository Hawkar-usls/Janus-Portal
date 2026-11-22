import {findNext, distanceKm, visitKey} from './navigation.js';
import {PanoramaxProvider, GoogleProvider} from './providers.js';
import {readHistory, addVisit, getStats, STORAGE_KEY} from './storage.js';
import {GazeDirector, buildGazePlan} from './gaze.js';
import {analyzeInterest} from './attention.js';
import {DESTINATIONS,destinationById,pickRandomDestination} from './tours.js';
import {findTourCandidate} from './tour-runner.js';
import {installDiscovery} from './discovery.js';
import {installFullscreen} from './fullscreen.js';
import {QUICK_START_PANORAMA} from './quick-start.js';

const $ = id => document.getElementById(id);
const state = {
  history: readHistory(), running: false, paused: false, busy: false,
  turbo: false, provider: null, current: null, origin: null,
  abort: null, timer: null, gaze: null, interest: null, planBaseSeconds: 16,
  generation: 0, map: null, mapLayer: null, leaflet: null,
  tour: null, tourIndex: 0, tourViewed: 0, tourSkipped: 0, lastTourStop: null
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
function gazeRate() {
  return (state.turbo ? 2 : 1) * (state.planBaseSeconds / Number($('seconds').value));
}
function cleanTimer() {
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
}
function refreshControls() {
  $('startBtn').textContent = state.running ? '■ Остановить' : state.tour ? '▶ Экскурсия' : '▶ Запустить';
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
  const key=$('originChoice').value;
  const randomModes={
    'random':{category:'all'},
    'random-extreme':{category:'extreme'},
    'random-india':{category:'extreme',region:'india'},
    'random-africa':{category:'extreme',region:'africa'}
  };
  if(randomModes[key]){
    const choice=pickRandomDestination(randomModes[key]);
    return {lat:choice.lat,lng:choice.lng};
  }
  if(key==='custom'){
    const vals=$('latlng').value.split(/[,;\s]+/).filter(Boolean).map(Number);
    if(vals.length!==2||!vals.every(Number.isFinite)||vals[0]<-90||vals[0]>90||vals[1]<-180||vals[1]>180)
      throw new Error('Укажи координаты широта, долгота (например 48.8647, 2.3404).');
    return {lat:vals[0],lng:vals[1]};
  }
  const place=destinationById(key);
  if(!place)throw new Error('Неизвестная стартовая точка');
  return {lat:place.lat,lng:place.lng};
}
function updateTourStatus(detail='') {
  const element=$('tourProgress');
  if(!state.tour){element.hidden=true;element.textContent='';return}
  element.hidden=false;
  const total=state.tour.stops.length;
  element.textContent='🧭 '+state.tour.title+
    ' · осмотрено '+state.tourViewed+' / '+total+
    ' · пропущено '+state.tourSkipped+
    (detail?' · '+detail:'');
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
  state.gaze?.stop();
  state.gaze = null;
  state.interest = null;
  $('gazeStage').textContent = 'Взгляд остановлен';
  state.busy = false;
  setStatus('Остановлено');
  refreshControls();
}
function stageText(text) {
  $('gazeStage').textContent = text;
}
function startGaze(candidate, interests = []) {
  state.gaze?.stop();
  const generation=state.generation;
  state.planBaseSeconds=Number($('seconds').value);
  const style=$('motionStyle').value;
  const plan=buildGazePlan({
    start:state.provider.getPose(),
    baseSeconds:state.planBaseSeconds,
    focusPoints:interests,
    gentle:style==='gentle',
    reducedMotion:style==='off'
  });
  const total=plan.totalMs / 1000 / (state.turbo ? 2 : 1);
  $('gazeTime').textContent='Осмотр ~' + total.toFixed(1) + ' сек';
  state.gaze=new GazeDirector({
    apply:pose=>{if(state.running&&state.generation===generation)state.provider.setPose(pose);},
    onStage:({label})=>{if(state.generation===generation)stageText(label);},
    onFinish:()=>{
      if(!state.running||state.generation!==generation)return;
      stageText('Следующий прыжок…');
      state.gaze=null;
      if(!state.paused)travel();
    }
  });
  state.gaze.start(plan,gazeRate());
  if(state.paused)state.gaze.pause();
  else setStatus('Живой взгляд','live');
}
async function prepareGaze(candidate,controller,generation) {
  const mode=$('interestMode').value;
  stageText('Оценивает панораму…');
  $('gazeTime').textContent='Составляет сценарий';
  const analysis=await analyzeInterest({
    candidate,
    frontHeading:state.provider.getFrontHeading(),
    mode,
    signal:controller.signal,
    onInfo:stageText
  });
  if(!state.running||controller.signal.aborted||generation!==state.generation)return;
  state.interest=analysis;
  const n=analysis.points.length;
  const modeLabel=analysis.reason==='detected-objects'?'Возможные объекты (локальная ML)':
    analysis.reason==='contrast-heuristic'||analysis.reason==='contrast-fallback' ||
    analysis.reason==='model-unavailable-contrast-fallback'?'Визуальные детали (контраст)':
    analysis.reason==='google-no-pixel-analysis'?'Без анализа изображений Google':
    'Исследовательские движения';
  const noun = n%10===1 && n%100!==11 ? 'точка' : [2,3,4].includes(n%10) && !(n%100>=12 && n%100<=14) ? 'точки' : 'точек';
  const people = analysis.detectedObjects?.filter(x=>x.category==='person').length || 0;
  const peopleNote = people ? ' · возможно, людей: ' + people : '';
  $('attentionStatus').textContent=modeLabel + ' · ' + n + ' ' + noun + peopleNote;
  startGaze(candidate,analysis.points);
}
function showLocation(candidate,tourStop=null) {
  $('coords').textContent = candidate.lat.toFixed(5) + ', ' + candidate.lng.toFixed(5);
  $('placeLabel').textContent = tourStop
    ? 'Экскурсия: '+tourStop.name+' · рядом ('+distanceKm(tourStop,candidate).toFixed(1)+' км)'
    : candidate.provider === 'google' ? 'Google Street View' : 'Panoramax 360°';
  $('mapLink').href = candidate.provider === 'google'
    ? 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + candidate.lat + ',' + candidate.lng
    : 'https://www.openstreetmap.org/?mlat=' + candidate.lat + '&mlon=' + candidate.lng + '#map=15/' + candidate.lat + '/' + candidate.lng;
  $('mapLink').hidden = false;
}
async function travel(firstCandidate=null) {
  if (!state.running || state.paused || state.busy) return;
  cleanTimer();
  state.busy = true;
  const generation = state.generation;
  const controller = new AbortController();
  state.abort = controller;
  // Preserve the default 5km adaptive explorer, but never leave the visitor
  // waiting indefinitely on a blocked remote network or unpopulated region.
  let searchExpired=false;
  const searchBudget=firstCandidate?null:setTimeout(()=>{
    searchExpired=true;
    controller.abort();
  },18000);
  refreshControls();
  setStatus(firstCandidate?'Открываю проверенную панораму…':'Поиск новой точки…', 'warn');
  const origin = state.current || state.origin;
  updateRadius(Number($('radius').value), 'Поиск ещё не посещённых панорам');
  try {
    const visited = new Set(state.history.map(visitKey));
    let candidate=firstCandidate, tourResult=null;
    if(firstCandidate){
      updateRadius(0,'Прямое открытие проверенной панорамы без поиска API');
    } else if(state.tour){
      const result=await findTourCandidate({
        tour:state.tour,startIndex:state.tourIndex,visited,
        visitedPoints:state.history,
        searchAtRadius:options=>state.provider.searchAtRadius(options),
        signal:controller.signal,
        onStop:({index,stop,total})=>{
          if(generation!==state.generation)return;
          updateTourStatus('остановка '+(index+1)+'/'+total+': '+stop.name);
          message('Ищу доступную 360° панораму рядом с «'+stop.name+'»…');
        },
        onSkip:({stop})=>{
          if(generation===state.generation)
            message('Не удалось найти новую панораму рядом с «'+(stop?.name||'точкой')+'». Продолжаю экскурсию.');
        }
      });
      if(!state.running || generation!==state.generation || controller.signal.aborted)return;
      state.tourSkipped+=result.skipped;
      if(!result.candidate){
        const tourName=state.tour.title,seen=state.tourViewed,skipped=state.tourSkipped;
        stop();
        setStatus('Экскурсия завершена');
        updateTourStatus('маршрут завершён');
        message('Экскурсия «'+tourName+'» завершена. Открыто панорам: '+seen+
          ', пропущено остановок: '+skipped+'. Недоступность в выборке не означает отсутствия панорам.');
        return;
      }
      tourResult=result;
      candidate=result.candidate;
      updateRadius(candidate.searchRadiusKm,
        'Реально найденная панорама неподалёку от '+result.stop.name);
    } else {
      candidate = await findNext({
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
    }
    if(searchBudget!==null)clearTimeout(searchBudget);
    if (!state.running || generation !== state.generation || controller.signal.aborted) return;
    setStatus('Загрузка панорамы…', 'warn');
    await state.provider.show(candidate, $('viewer'));
    if (!state.running || generation !== state.generation || controller.signal.aborted) return;
    const previous = state.current || state.origin;
    const jumpDistance = distanceKm(previous, candidate);
    state.current = candidate;
    if(tourResult){
      state.tourIndex=tourResult.index+1;
      state.tourViewed++;
      state.lastTourStop=tourResult.stop;
    }
    const saved = addVisit(state.history, candidate);
    state.history = saved.entries;
    showLocation(candidate,tourResult?.stop);
    updateTourStatus();
    if(!tourResult)updateRadius(candidate.searchRadiusKm, candidate.expansions
      ? 'Поиск расширен ' + candidate.expansions + ' раз(а)'
      : 'Найдено в начальном радиусе');
    message((saved.added?'✓ Новая панорама':'✓ Повторное открытие (без нового посещения)') + ' • прыжок ' + jumpDistance.toFixed(2) + ' км' +
      (candidate.provider === 'google' ? ' • Google: только статистика текущей сессии' : saved.persisted ? ' • сохранено в локальной истории' : ' • локальное сохранение недоступно') +
      '. JC пока не начисляются.');
    renderStats();
    await prepareGaze(candidate,controller,generation);
    if (state.paused) setStatus('Пауза');
  } catch (error) {
    if(state.running && generation===state.generation &&
       (searchExpired||error?.name!=='AbortError')){
      const noPoints=error?.name==='NoLocationsError';
      const failedMessage=searchExpired
        ? 'Поиск занял больше 18 секунд и остановлен. Источник панорам может быть недоступен или выбранный район пока не покрыт. Нажми «Начать путешествие сейчас» для проверенного примера.'
        : noPoints
          ? 'В проверенных выборках новых 360° панорам не нашлось. Попробуй другую локацию или кнопку быстрого старта.'
          : 'Не удалось открыть панораму: '+(error?.message||String(error))+
            '. Можно попробовать быстрый старт или другой источник.';
      message(failedMessage,true);
      setStatus(searchExpired?'Нет ответа':noPoints?'Нет панорам':'Ошибка загрузки','warn');
      // On a failed first start, reset the button to "Start" instead of
      // requiring a confusing extra click on "Stop" before retry.
      state.running=false;
      state.paused=false;
      state.gaze?.stop();
    }
  } finally {
    if(searchBudget!==null)clearTimeout(searchBudget);
    if (generation === state.generation) {
      state.busy = false;
      state.abort = null;
      refreshControls();
      // The gaze timeline (not a fixed timeout) initiates the next jump.
    }
  }
}
function run(firstCandidate=null) {
  if(state.running){stop();if(!firstCandidate)return}
  try {
    state.origin = firstCandidate
      ? {lat:firstCandidate.lat,lng:firstCandidate.lng}
      : state.tour?{lat:state.tour.stops[0].lat,lng:state.tour.stops[0].lng}:getOrigin();
    state.provider = firstCandidate?new PanoramaxProvider():chooseProvider();
  } catch (e) {
    message(e.message, true);
    return;
  }
  state.current = null;
  if(state.tour){state.tourIndex=0;state.tourViewed=0;state.tourSkipped=0;state.lastTourStop=null;updateTourStatus('начинаем');}
  else updateTourStatus();
  state.running = true;
  state.paused = false;
  state.generation++;
  refreshControls();
  message(state.tour ? 'Экскурсия «'+state.tour.title+'» запущена. Покажу доступные 360° панорамы рядом с остановками маршрута.' :
    'Маршрут запущен. Начинаю с радиуса ' + $('radius').value + ' км.');
  travel(firstCandidate);
}
function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  if (state.paused) {
    cleanTimer();
    state.gaze?.pause();
    state.provider?.stopRotation();
    setStatus('Пауза');
  } else {
    if (!state.busy) {
      state.gaze?.resume();
      setStatus('Живой взгляд', 'live');
    } else setStatus('Поиск…', 'warn');
  }
  refreshControls();
}
function skip() {
  if (!state.running || state.busy) return;
  state.paused = false;
  state.gaze?.stop();
  state.gaze = null;
  state.provider?.stopRotation();
  cleanTimer();
  refreshControls();
  travel();
}
function replanGaze() {
  if (!state.running || state.busy || !state.current) return;
  startGaze(state.current,state.interest?.points||[]);
}
function updateMap() {
  const leaflet = state.leaflet || window.L;
  if (!leaflet?.map || !leaflet?.polyline) {
    $('map').textContent = 'Карта временно недоступна (библиотека не загрузилась). История доступна ниже.';
    return;
  }
  state.leaflet = leaflet; // capture before another viewer changes a global symbol
  if (!state.map) {
    state.map = leaflet.map('map', {worldCopyJump: true}).setView([30, 12], 2);
    leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);
  }
  if (state.mapLayer) for (const layer of state.mapLayer) state.map.removeLayer(layer);
  state.mapLayer = [];
  const planned = state.tour?.stops.map(s=>[s.lat,s.lng]) || [];
  if(planned.length){
    state.mapLayer.push(leaflet.polyline(planned,{color:'#e6c580',weight:2,dashArray:'6 7',opacity:.75}).addTo(state.map));
    state.tour.stops.forEach((stop,i)=>{
      const marker=leaflet.circleMarker([stop.lat,stop.lng],{
        radius:i===state.tourIndex?7:5,color:'#f0d69b',fillColor:i<state.tourIndex?'#57e0bf':'#6a4d24',
        fillOpacity:.9,weight:2
      }).addTo(state.map);
      const popup=document.createElement('span');
      popup.textContent=(i+1)+'. '+stop.name+' · плановая точка экскурсии';
      marker.bindPopup(popup);
      state.mapLayer.push(marker);
    });
  }
  const entries = state.history.filter(e => e.provider === 'panoramax').slice(-300);
  if(!entries.length&&!planned.length)return;
  const points = entries.map(e => [e.lat, e.lng]);
  if(points.length>1)state.mapLayer.push(leaflet.polyline(points, {color: '#4cbed8', weight: 2, opacity: 0.7}).addTo(state.map));
  entries.forEach((e, i) => {
    const marker = leaflet.circleMarker([e.lat, e.lng], {radius: i === entries.length - 1 ? 7 : 4,
      color: '#99ffea', fillColor: i === entries.length - 1 ? '#60e9bc' : '#327b9b', fillOpacity: 0.85,
      weight: 1}).addTo(state.map);
    state.mapLayer.push(marker);
    marker.bindPopup('<strong>' + (e.provider === 'google' ? 'Google Street View' : 'Panoramax') +
      '</strong><br>№ ' + (state.history.length - entries.length + i + 1) +
      '<br>' + e.lat.toFixed(5) + ', ' + e.lng.toFixed(5));
  });
  const bounds=planned.length?planned:points;
  if(bounds.length)state.map.fitBounds(leaflet.latLngBounds(bounds).pad(0.35),{maxZoom:12});
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
    link.href = e.provider === 'google'
      ? 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + e.lat + ',' + e.lng
      : 'https://www.openstreetmap.org/?mlat=' + e.lat + '&mlon=' + e.lng + '#map=15/' + e.lat + '/' + e.lng;
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
  try {updateMap();} catch (err) {console.error('Local map unavailable:', err);}
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
  state.gaze?.setRate(gazeRate());
});
$('boost').addEventListener('click', () => {
  state.turbo = !state.turbo;
  $('boost').setAttribute('aria-pressed', String(state.turbo));
  $('boost').textContent = '⚡ Турбо ×2: ' + (state.turbo ? 'включено' : 'выключено');
  state.gaze?.setRate(gazeRate());
});
$('motionStyle').addEventListener('change',replanGaze);
$('interestMode').addEventListener('change', () => {
  if (state.running && state.current && !state.busy) {
    // An explicit user change can re-run the same photo's optional analysis.
    state.gaze?.stop();
    state.gaze=null;
    const controller=new AbortController();
    state.abort?.abort();
    state.abort=controller;
    state.busy=true;
    refreshControls();
    prepareGaze(state.current,controller,state.generation).catch(error=>{
      if(error?.name!=='AbortError')message('Анализ недоступен: '+error.message,true);
    }).finally(()=>{state.busy=false;refreshControls();});
  }
});
const select=$('originChoice');
select.replaceChildren();
for(const place of DESTINATIONS){
  const option=document.createElement('option');
  option.value=place.id;option.textContent=place.emoji+' '+place.name+', '+place.country;
  select.append(option);
}
for(const [id,label] of [['random','🎲 Случайное место (весь мир)'],['random-extreme','🏕️ Случайный экстрим (весь мир)'],['random-india','🇮🇳 Случайная Индия: сёла и горы'],['random-africa','🌍 Случайная Африка: удалённые места'],['custom','📍 Свои координаты']]){
  const option=document.createElement('option');option.value=id;option.textContent=label;select.append(option);
}
select.value='paris';
let discovery;
discovery=installDiscovery({
  onFree(){
    if(state.tour){if(state.running)stop();state.tour=null;updateTourStatus();refreshControls();updateMap();}
  },
  onTour(tour){
    if(state.running)stop();
    state.tour=tour;state.tourIndex=0;state.tourViewed=0;state.tourSkipped=0;state.lastTourStop=null;
    updateTourStatus('маршрут выбран');
    updateMap();
    refreshControls();
    run();
  },
  onDestination(place){
    if(state.running)stop();
    state.tour=null;updateTourStatus();
    updateMap();
    discovery.selectTab('explore');
    select.value=place.id;
    run();
  }
});
installFullscreen({panel:$('viewerPanel'),button:$('fullscreenBtn')});
if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
  $('motionStyle').value='off';
  stageText('Автодвижение выключено по системным настройкам');
}
$('startBtn').addEventListener('click',()=>run());
$('quickStartBtn').addEventListener('click',()=>{
  if(state.running)stop();
  state.tour=null;updateTourStatus();
  $('provider').value='panoramax';
  $('googleKeyWrap').hidden=true;
  select.value='reine';
  run(QUICK_START_PANORAMA);
  $('viewerPanel').scrollIntoView?.({behavior:'smooth',block:'start'});
});
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
window.__JANUS_PORTAL_READY__=true;
