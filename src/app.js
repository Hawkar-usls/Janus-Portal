import {findNext, distanceKm, visitKey} from './navigation.js';
import {Merged360Provider, probeMerged360} from './providers.js';
import {readHistory, addVisit, getStats, STORAGE_KEY} from './storage.js';
import {GazeDirector, buildGazePlan} from './gaze.js';
import {analyzeInterest} from './attention.js';

const $ = id => document.getElementById(id);
const CITY = {
  paris: {lat: 48.86473, lng: 2.34041},
  rennes: {lat: 48.11617, lng: -1.68669},
  lyon: {lat: 45.76561, lng: 4.84002},
  kyiv: {lat: 50.4501, lng: 30.5234},
  tokyo: {lat: 35.6762, lng: 139.6503},
  newyork: {lat: 40.7128, lng: -74.0060},
  rio: {lat: -22.9068, lng: -43.1729},
  sandiego: {lat: 32.913, lng: -117.17},
  // Verified live Panoramax 360° source coordinates as of 2026-11-22.
  // Only geographical start anchors: the original provider still searches
  // real photo IDs and credits the original uploader. No cloned imagery.
  pune: {lat: 18.5195209, lng: 73.8412082},
  kathmandu: {lat: 27.679029333, lng: 85.316770333},
  fes: {lat: 34.061672694, lng: -4.977107},
  merzouga: {lat: 31.14483, lng: -3.967989},
  cebu: {lat: 10.3115544, lng: 123.8997359},
  busay: {lat: 10.368785, lng: 123.8736817},
  georgetown: {lat: 5.41156663, lng: 100.345036046},
  balikpulau: {lat: 5.376598422, lng: 100.243871661},
  bayanlepas: {lat: 5.282062689, lng: 100.242131159},
  cuenca: {lat: -2.893007321, lng: -79.003228169},
  sayaussi: {lat: -2.881178218, lng: -79.061575868},
  ricaurte: {lat: -2.879045158, lng: -78.981027349},
  banoscuenca: {lat: -2.906943576, lng: -79.033273236},
  elvalle: {lat: -2.915168508, lng: -78.985071091},
  // R7 geographic search-only centres: do NOT claim verified Panoramax 360.
  // This mode is explicitly distance-bounded to prevent a Pyongyang/Cairo
  // selection from silently opening photos in another country.
  pyongyang: {lat: 39.0194, lng: 125.7381},
  kaesong: {lat: 37.9723, lng: 126.5544},
  wonsan: {lat: 39.1528, lng: 127.4436},
  cairo: {lat: 30.0444, lng: 31.2357},
  giza: {lat: 29.9792, lng: 31.1342},
  saqqara: {lat: 29.8710, lng: 31.2150},
  alexandria: {lat: 31.2001, lng: 29.9187},
  luxor: {lat: 25.6872, lng: 32.6396},
  nairobi: {lat: -1.2921, lng: 36.8219},
  zanzibar: {lat: -6.1659, lng: 39.2026},
  kampala: {lat: 0.3476, lng: 32.5825},
  addis: {lat: 9.0300, lng: 38.7400},
  dakar: {lat: 14.7167, lng: -17.4677},
  lagos: {lat: 6.5244, lng: 3.3792},
  windhoek: {lat: -22.5609, lng: 17.0658},
  capetown: {lat: -33.9249, lng: 18.4241},
  victoriafalls: {lat: -17.9243, lng: 25.8572}
};
// R11: no hard-coded or random "verified" pool. Every visible option must be
// confirmed against current provider 360° metadata in this browser session.
// These places are browseable geographic targets but have no verified Panoramax
// 360° coverage in our bounded 2026-11-22 search. Never mix them into random
// verified starts or drift to an unrelated distant location.
const LIMITED_COVERAGE_KEYS = new Set([
  'pyongyang','kaesong','wonsan',
  'cairo','giza','saqqara','alexandria','luxor',
  'nairobi','zanzibar','kampala','addis','dakar','lagos',
  'windhoek','capetown','victoriafalls'
]);
const MAX_LIMITED_SEARCH_KM = 40;
const state = {
  history: readHistory(), running: false, paused: false, busy: false,
  turbo: false, provider: null, current: null, origin: null,
  abort: null, timer: null, gaze: null, interest: null, planBaseSeconds: 16,
  generation: 0, map: null, mapLayer: null, leaflet: null, limitedCoverage: false,
  manualMode: false, startCandidate: null, selectedSourceKey: null
};

// R11: a source-backed list, never the old static/unverified selector.
// No storage of results: every session queries current Panoramax 360° data.
const LIVE_REFRESH_MS=5*60*1000;
const LIVE_CONCURRENCY=4;
// In a blocked network, 38 x 8-second queries would otherwise leave a disabled
// selector and no usable retry for more than a minute.
const LIVE_MAX_SCAN_MS=30000;
const liveCoverage=new Map();
const liveOptions=[...$('originCatalog').content.querySelectorAll('option[value]')]
  .filter(option=>Object.prototype.hasOwnProperty.call(CITY,option.value))
  .map(option=>({key:option.value,origin:CITY[option.value]}));
let liveGeneration=0;
let liveController=null;
let liveRefreshing=false;
let liveLastCheck=0;
let liveChecked=0;
let liveFailed=0;
let liveTimedOut=false;
let manualNext=false;
// R13: a live geographic list made from *all* keyless usable 360° sources.
// Each value contains the photos from different providers for that location.
const liveSourceCount=()=>3+($('mapillaryToken')?.value.trim()?1:0); // optional authenticated Mapillary
function renderLiveOptions(){
  const select=$('originChoice'),previous=select.value;
  const frag=document.createDocumentFragment();
  for(const node of $('originCatalog').content.children){
    if(node.tagName==='OPTION'){
      if(liveCoverage.has(node.value))frag.append(node.cloneNode(true));
    }else if(node.tagName==='OPTGROUP'){
      const group=node.cloneNode(false);
      for(const option of node.querySelectorAll('option[value]')){
        if(liveCoverage.has(option.value))group.append(option.cloneNode(true));
      }
      if(group.children.length)frag.append(group);
    }
  }
  if(!frag.childNodes.length){
    const placeholder=document.createElement('option');
    placeholder.value='';placeholder.disabled=true;
    placeholder.textContent=liveRefreshing?'⏳ Обновляем все 360° источники…':
      liveTimedOut||liveFailed>=liveOptions.length*liveSourceCount()
        ? 'Источники не ответили · нажми «Обновить»':
          'Подтверждённых 360° пока нет';
    frag.append(placeholder);
  }
  select.replaceChildren(frag);
  if(liveCoverage.has(previous))select.value=previous;
  else select.selectedIndex=0;
  refreshControls();
}
function updateCoverageStatus(){
  const count=liveCoverage.size;
  const status=$('coverageStatus');
  status.dataset.state=liveRefreshing?'checking':liveTimedOut?'timeout':
    liveFailed>=liveOptions.length*liveSourceCount()?'error':'ready';
  const totals={panoramax:0,kartaview:0,commons:0,mapillary:0};
  for(const values of liveCoverage.values()){
    for(const p of new Set(values.map(x=>x.provider)))totals[p]++;
  }
  const bySource='Panoramax '+totals.panoramax+' · KartaView '+totals.kartaview+
    ' · Commons '+totals.commons+' · Mapillary '+totals.mapillary;
  if(liveRefreshing){
    status.textContent='Проверяем все источники: '+liveChecked+'/'+liveOptions.length+
      ' районов · доступны '+count+' · '+bySource;
  }else if(liveLastCheck){
    const time=new Date(liveLastCheck).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
    if(liveTimedOut){
      status.textContent='Проверка завершена по лимиту 30 секунд: '+liveChecked+
        '/'+liveOptions.length+' районов · доступны '+count+' · '+bySource+
        '. Нажми «Обновить» для новой общей проверки.';
    }else if(liveFailed>=liveOptions.length*liveSourceCount()){
      status.textContent='Подключённые источники недоступны. Проверь интернет и нажми «Обновить».';
    }else{
      status.textContent='Обновлено в '+time+' · доступно '+count+' районов · '+
        bySource+(liveFailed?' · ошибок провайдеров: '+liveFailed:'')+
        '. Метки и снимки проверяются при открытии.';
    }
  }else{
    status.textContent='Проверяем Panoramax, KartaView, Commons'+($('mapillaryToken').value.trim()?', Mapillary':'')+' одновременно…';
  }
}
async function refreshLiveCoverage(){
  if(state.running)return;
  liveController?.abort();
  const controller=new AbortController();
  const generation=++liveGeneration;
  liveController=controller;
  liveCoverage.clear();
  liveChecked=0;liveFailed=0;liveTimedOut=false;liveRefreshing=true;liveLastCheck=0;
  const deadline=setTimeout(()=>{
    if(generation===liveGeneration&&!controller.signal.aborted){
      liveTimedOut=true;controller.abort();
    }
  },LIVE_MAX_SCAN_MS);
  renderLiveOptions();updateCoverageStatus();
  let index=0;
  async function worker(){
    while(index<liveOptions.length&&!controller.signal.aborted){
      const entry=liveOptions[index++];
      try{
        const result=await probeMerged360(entry.origin,{signal:controller.signal,mapillaryToken:$('mapillaryToken').value.trim()});
        if(generation!==liveGeneration||controller.signal.aborted)return;
        if(result.candidates.length)liveCoverage.set(entry.key,result.candidates);
        liveFailed+=result.failed;
      }catch{
        if(controller.signal.aborted)return;
        liveFailed+=liveSourceCount();
      }
      if(generation!==liveGeneration||controller.signal.aborted)return;
      liveChecked++;
      renderLiveOptions();updateCoverageStatus();
    }
  }
  try{await Promise.all(Array.from({length:LIVE_CONCURRENCY},()=>worker()));}
  finally{
    clearTimeout(deadline);
    if(generation===liveGeneration){
      liveRefreshing=false;liveLastCheck=Date.now();liveController=null;
      renderLiveOptions();updateCoverageStatus();
    }
  }
}
function maybeRefreshCoverage(){
  if(document.hidden||state.running||liveRefreshing)return;
  if(!liveLastCheck||Date.now()-liveLastCheck>=LIVE_REFRESH_MS)
    void refreshLiveCoverage();
}
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
function refreshControls(){
  $('startBtn').textContent=state.running?'■ Остановить':'▶ Запустить';
  $('pauseBtn').disabled=!state.running;
  $('pauseBtn').textContent=state.paused?'▶ Продолжить':'Ⅱ Пауза';
  $('nextBtn').disabled=!state.running||state.busy;
  const ready=liveCoverage.has($('originChoice').value);
  $('originChoice').disabled=state.running||liveCoverage.size===0;
  $('startBtn').disabled=!state.running&&!ready;
  $('latlng').disabled=state.running;
  $('manualStartBtn').disabled=state.running;
  $('refreshCoverageBtn').disabled=state.running;
  $('googleKey').disabled=state.running;
  $('googleConsent').disabled=state.running;
  $('mapillaryToken').disabled=state.running;
}
function updateRadius(radius, note) {
  $('activeRadius').textContent = Number(radius).toLocaleString('ru-RU') + ' км';
  if (note) $('radiusHint').textContent = note;
}
function getOrigin(manual=false) {
  if(!manual) {
    const key=$('originChoice').value;
    if(!CITY[key]||!liveCoverage.has(key))
      throw new Error('Место пока не подтверждено в текущем каталоге 360°. Обнови список.');
    return {...CITY[key]};
  }
  const vals=$('latlng').value.split(/[,;\s]+/).filter(Boolean).map(Number);
  if(vals.length!==2||!vals.every(Number.isFinite)||vals[0]<-90||vals[0]>90||vals[1]<-180||vals[1]>180)
    throw new Error('Укажи корректные координаты: широта, долгота (например, 48.8647, 2.3404).');
  return {lat:vals[0],lng:vals[1]};
}
function chooseProvider(manual=false) {
  const wantsGoogle=manual&&$('googleConsent').checked;
  const key=$('googleKey').value.trim();
  if(wantsGoogle&&!key)
    throw new Error('Для Google Street View введи свой браузерный API-ключ, либо отключи платный поиск.');
  return new Merged360Provider({googleKey:key,includeGoogle:wantsGoogle,mapillaryToken:$('mapillaryToken').value.trim()});
}
function selectMixedStart(key,entries){
  // Provider-balancing avoids always preferring the original source. No random
  // cities; user chooses the place, JANUS chooses a real photo source.
  const visits=new Map();
  for(const p of state.history){
    visits.set(p.provider,(visits.get(p.provider)||0)+1);
  }
  const valid=entries.filter(p=>!state.history.some(v=>
    v.provider===p.provider&&v.id===p.id));
  valid.sort((a,b)=>(visits.get(a.provider)||0)-(visits.get(b.provider)||0)||
    distanceKm(CITY[key],a)-distanceKm(CITY[key],b)||
    a.provider.localeCompare(b.provider));
  return valid[0]||entries[0]||null;
}
// R9: one in-window view. Search and availability feedback appear in the
// SAME #viewer that receives real Panoramax/Google photos. No second page.
function viewerFeedback(text, kind='searching') {
  const host=$('viewer');
  let overlay=host.querySelector('.view-feedback');
  if (!text) {overlay?.remove();return;}
  if (!overlay) {
    overlay=document.createElement('div');
    overlay.className='view-feedback';
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-live','polite');
    const symbol=document.createElement('span');
    symbol.className='view-feedback-icon';
    symbol.setAttribute('aria-hidden','true');
    const label=document.createElement('strong');
    label.className='view-feedback-text';
    overlay.append(symbol,label);
    host.append(overlay);
  }
  overlay.dataset.kind=kind;
  overlay.querySelector('.view-feedback-icon').textContent=kind==='missing'?'⌕':'◌';
  overlay.querySelector('.view-feedback-text').textContent=text;
}
function stop() {
  viewerFeedback(null);
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
  // A long autonomous session cannot keep an old catalogue indefinitely.
  maybeRefreshCoverage();
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
function showLocation(candidate) {
  $('coords').textContent = candidate.lat.toFixed(5) + ', ' + candidate.lng.toFixed(5);
  $('placeLabel').textContent=({
    google:'Google Street View',panoramax:'Panoramax 360°',
    kartaview:'KartaView 360°',commons:'Wikimedia Commons 360°',mapillary:'Mapillary 360°'
  })[candidate.provider]||'360°';
  $('mapLink').href = candidate.provider === 'google'
    ? 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + candidate.lat + ',' + candidate.lng
    : 'https://www.openstreetmap.org/?mlat=' + candidate.lat + '&mlon=' + candidate.lng + '#map=15/' + candidate.lat + '/' + candidate.lng;
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
  viewerFeedback('Ищу доступную 360° панораму в выбранном районе…');
  const origin = state.current || state.origin;
  updateRadius(Number($('radius').value), 'Поиск ещё не посещённых панорам');
  try {
    const visited = new Set(state.history.map(visitKey));
    const pinned=state.startCandidate;
    state.startCandidate=null;
    const pinAllowed=pinned&&['panoramax','kartaview','commons','mapillary'].includes(pinned.provider) &&
      !visited.has(visitKey(pinned)) &&
      !state.history.some(point=>distanceKm(point,pinned)<0.02) &&
      distanceKm(origin,pinned)<=Number($('radius').value)+0.005;
    let candidate=pinAllowed
      ? {...pinned,searchRadiusKm:Number($('radius').value),expansions:0}
      : await findNext({
      origin,
      baseRadiusKm: Number($('radius').value),
      // Preserve the classic 5→10→20→...→20000km explorer for working modes.
      // Only unverified selected coordinates stop locally (5→10→20→40km)
      // rather than faking Pyongyang/Cairo using distant panoramas.
      maxRadiusKm: state.limitedCoverage
        ? Math.max(MAX_LIMITED_SEARCH_KM, Number($('radius').value)) : 20000,
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
    viewerFeedback('Панорама найдена. Открываю её прямо в окне JANUS…');
    try{
      await state.provider.show(candidate, $('viewer'));
    }catch(firstError){
      const options=state.selectedSourceKey?
        (liveCoverage.get(state.selectedSourceKey)||[]):[];
      const other=options.find(x=>x.provider!==candidate.provider &&
        !visited.has(visitKey(x))&&distanceKm(origin,x)<=Number($('radius').value)+.005);
      if(!other||candidate.provider==='google')throw firstError;
      // A mismatched/broken image never counts as a visit. Try another
      // verified source for the SAME place before failing the expedition.
      liveCoverage.set(state.selectedSourceKey,options.filter(x=>
        !(x.provider===candidate.provider&&x.id===candidate.id)));
      candidate={...other,searchRadiusKm:Number($('radius').value),expansions:0};
      await state.provider.show(candidate,$('viewer'));
    }
    if (!state.running || generation !== state.generation || controller.signal.aborted) return;
    viewerFeedback(null);
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
      (candidate.provider === 'google' ? ' • Google: только статистика текущей сессии' : saved.persisted ? ' • сохранено в локальной истории' : ' • локальное сохранение недоступно') +
      '. JC пока не начисляются.');
    renderStats();
    await prepareGaze(candidate,controller,generation);
    if (state.paused) setStatus('Пауза');
  } catch (error) {
    if (error?.name !== 'AbortError' && state.running && generation === state.generation) {
      const noPoints = error?.name === 'NoLocationsError';
      if (noPoints && state.limitedCoverage) {
        message('Для выбранного региона в проверенных выборках источников не нашлось новых 360° снимков поблизости (радиус до ' +
          Math.max(MAX_LIMITED_SEARCH_KM, Number($('radius').value)) +
          ' км). Не подменяем их фотографиями другой страны. Выбери другое место в нашем поиске или официальный источник в настройках.', true);
        setStatus('360° рядом не найдены', 'warn');
        viewerFeedback('В этом районе пока нет доступной 360° панорамы. Выбери другое место и нажми «Запустить».','missing');
        // Make the next choice one click: the original engine's stopped state
        // remains unchanged for normal/verified locations.
        state.running = false;
        state.paused = false;
      } else {
        message(noPoints
          ? 'Поиск по доступным выборкам завершён без новых 360° панорам. Можно выбрать другой город или источник. Это не доказывает, что все места посещены.'
          : 'Ошибка: ' + (error?.message || String(error)), true);
        setStatus(noPoints ? 'Места не найдены' : 'Ошибка', 'warn');
        viewerFeedback(noPoints?'360° не найдены в доступных выборках. Выбери другой регион.':'Не удалось загрузить 360°. Проверь источник или выбери другое место.','missing');
        if(!noPoints && state.selectedSourceKey && !state.current &&
            state.provider instanceof Merged360Provider){
          // Metadata is provisional. A failed real photo must disappear from
          // the current live choices until a fresh source check succeeds.
          const remaining=(liveCoverage.get(state.selectedSourceKey)||[])
            .filter(c=>c.provider!==state.provider.currentProviderId);
          if(remaining.length)liveCoverage.set(state.selectedSourceKey,remaining);
          else liveCoverage.delete(state.selectedSourceKey);
          state.running=false;
          state.paused=false;
          renderLiveOptions();
          updateCoverageStatus();
        }else{
          state.paused=true; // avoid uncontrolled API retry loops
        }
      }
    }
  } finally {
    if (generation === state.generation) {
      state.busy = false;
      state.abort = null;
      refreshControls();
      // The gaze timeline (not a fixed timeout) initiates the next jump.
    }
  }
}
function run() {
  if(state.running){stop();return;}
  const manual=manualNext;
  manualNext=false;
  try{
    state.origin=getOrigin(manual);
    state.provider=chooseProvider(manual);
    state.manualMode=manual;
    state.selectedSourceKey=manual?null:$('originChoice').value;
    state.startCandidate=manual?null:selectMixedStart(state.selectedSourceKey,liveCoverage.get(state.selectedSourceKey)||[]);
    state.limitedCoverage=manual||LIMITED_COVERAGE_KEYS.has(state.selectedSourceKey);
  }catch(error){
    message(error.message,true);
    return;
  }
  // While a panorama is active, the already-checked source identity remains
  // pinned and the catalogue is not allowed to mutate the selected location.
  if(liveRefreshing){
    liveController?.abort();
    ++liveGeneration;
    liveRefreshing=false;
    liveController=null;
    renderLiveOptions();
    updateCoverageStatus();
  }
  state.current=null;
  state.running=true;
  state.paused=false;
  state.generation++;
  refreshControls();
  message('Маршрут запущен. Начинаю с радиуса '+$('radius').value+' км.');
  travel();
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
  const entries = state.history.filter(e => e.provider === 'panoramax').slice(-300);
  if (!entries.length) return;
  const points = entries.map(e => [e.lat, e.lng]);
  state.mapLayer.push(leaflet.polyline(points, {color: '#4cbed8', weight: 2, opacity: 0.7}).addTo(state.map));
  entries.forEach((e, i) => {
    const marker = leaflet.circleMarker([e.lat, e.lng], {radius: i === entries.length - 1 ? 7 : 4,
      color: '#99ffea', fillColor: i === entries.length - 1 ? '#60e9bc' : '#327b9b', fillOpacity: 0.85,
      weight: 1}).addTo(state.map);
    state.mapLayer.push(marker);
    marker.bindPopup('<strong>' + (e.provider === 'google' ? 'Google Street View' : 'Panoramax') +
      '</strong><br>№ ' + (state.history.length - entries.length + i + 1) +
      '<br>' + e.lat.toFixed(5) + ', ' + e.lng.toFixed(5));
  });
  state.map.fitBounds(leaflet.latLngBounds(points).pad(0.35), {maxZoom: 12});
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
// R10: fullscreen for the ORIGINAL panorama panel, not a second page/player.
// Browser Fullscreen API first; on iPhone/restricted embedded browsers a
// fixed-viewport CSS fallback stays inside JANUS and closes by button/Escape.
const fullscreenPanel=document.querySelector('.viewer-panel');
const fullscreenControl=$('fullscreenBtn');
function viewerIsNativeFullscreen(){
  return document.fullscreenElement===fullscreenPanel ||
    document.webkitFullscreenElement===fullscreenPanel;
}
function viewerIsFullscreen(){
  return viewerIsNativeFullscreen() ||
    fullscreenPanel.classList.contains('portal-fullscreen-fallback');
}
function syncViewerFullscreen(){
  const expanded=viewerIsFullscreen();
  fullscreenPanel.classList.toggle('portal-fullscreen-active',expanded);
  fullscreenControl.setAttribute('aria-pressed',String(expanded));
  fullscreenControl.setAttribute('aria-label',expanded?
    'Свернуть панораму':'Развернуть панораму на весь экран');
  fullscreenControl.title=expanded?'Свернуть':'На весь экран';
  fullscreenControl.querySelector('.fullscreen-label').textContent=
    expanded?'Свернуть':'На весь экран';
  // The embedded native panorama viewer may need a dimension refresh.
  window.dispatchEvent(new Event('resize'));
}
function exitViewportFullscreen(){
  fullscreenPanel.classList.remove('portal-fullscreen-fallback');
  document.body.classList.remove('portal-fullscreen-locked');
}
async function toggleViewerFullscreen(){
  if(viewerIsNativeFullscreen()){
    const exit=document.exitFullscreen||document.webkitExitFullscreen;
    if(exit){
      try{await exit.call(document);}
      catch(error){console.warn('Не удалось закрыть полный экран:',error);}
    }
  }else if(fullscreenPanel.classList.contains('portal-fullscreen-fallback')){
    exitViewportFullscreen();
  }else{
    const enter=fullscreenPanel.requestFullscreen||fullscreenPanel.webkitRequestFullscreen;
    if(enter){
      try{await enter.call(fullscreenPanel);}
      catch{
        fullscreenPanel.classList.add('portal-fullscreen-fallback');
        document.body.classList.add('portal-fullscreen-locked');
      }
    }else{
      fullscreenPanel.classList.add('portal-fullscreen-fallback');
      document.body.classList.add('portal-fullscreen-locked');
    }
  }
  syncViewerFullscreen();
}
fullscreenControl.addEventListener('click',toggleViewerFullscreen);
document.addEventListener('fullscreenchange',syncViewerFullscreen);
document.addEventListener('webkitfullscreenchange',syncViewerFullscreen);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&fullscreenPanel.classList.contains('portal-fullscreen-fallback')){
    event.preventDefault();
    exitViewportFullscreen();
    syncViewerFullscreen();
  }
});
// Source selection is automatic. Google is opt-in only through paid-key consent.
$('mapillaryToken').addEventListener('change',()=>{if(!state.running)void refreshLiveCoverage();});
$('refreshCoverageBtn').addEventListener('click',()=>{
  // Every click is a real retry: abort the previous generation immediately.
  // Ignoring rapid clicks made the button appear broken to users.
  void refreshLiveCoverage();
});
$('manualStartBtn').addEventListener('click',()=>{
  manualNext=true;
  run();
});
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)maybeRefreshCoverage();
});
window.addEventListener('online',maybeRefreshCoverage);
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
if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
  $('motionStyle').value='off';
  stageText('Автодвижение выключено по системным настройкам');
}
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
renderLiveOptions();
updateCoverageStatus();
refreshControls();
renderStats();
void refreshLiveCoverage();
setInterval(maybeRefreshCoverage,LIVE_REFRESH_MS);
