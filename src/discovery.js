import {TOURS,DESTINATIONS,TOUR_CATEGORIES,DESTINATION_CATEGORIES} from './tours.js';

// Original JANUS discovery interface inspired by guided sightseeing modes.
// These cards represent search locations, not confirmed camera panoramas.
export function installDiscovery({
  onFree = () => {}, onTour = () => {}, onDestination = () => {}
} = {}) {
  const navs = {
    explore:document.getElementById('tabExplore'),
    tours:document.getElementById('tabTours'),
    destinations:document.getElementById('tabDestinations')
  };
  const panel=document.getElementById('discoveryContent');
  let active='explore',filter='all',query='';
  const make=(tag,cls,text)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=text;
    return node;
  };
  const render=()=>{
    for(const [id,button] of Object.entries(navs)){
      const selected=active===id;
      button.classList.toggle('selected',selected);
      button.setAttribute('aria-selected',String(selected));
      button.tabIndex=selected?0:-1;
    }
    panel.replaceChildren();
    if(active==='explore'){panel.hidden=true;return}
    panel.hidden=false;
    const isTours=active==='tours';
    const heading=make('div','discovery-heading');
    const copy=make('div');
    copy.append(make('h2','',isTours?'🧭 Экскурсионные маршруты':'🗺️ Каталог направлений'));
    copy.append(make('p','',isTours
      ? 'Как в режиме обзорных полётов: маршрут из знаменитых мест, автоматический осмотр и прыжки между найденными панорамами.'
      : 'Выбери город или регион для свободного исследования. Наличие 360° панорам проверяется при запуске.'));
    heading.append(copy,make('span','mini',isTours?TOURS.length+' тематических экскурсий':DESTINATIONS.length+' направлений'));
    const filters=make('div','discovery-filters');
    const cats=isTours?TOUR_CATEGORIES:DESTINATION_CATEGORIES;
    for(const cat of cats){
      const button=make('button','discovery-filter'+(filter===cat.id?' active':''),cat.label);
      button.type='button';button.dataset.category=cat.id;
      button.setAttribute('aria-pressed',String(filter===cat.id));
      button.addEventListener('click',()=>{filter=cat.id;render()});
      filters.append(button);
    }
    const input=make('input','discovery-search');input.type='search';
    input.placeholder=isTours?'Найти экскурсию…':'Город или страна…';
    input.setAttribute('aria-label','Поиск в каталоге');
    input.value=query;
    // Only the grid updates while typing: don't destroy the focused input.
    input.addEventListener('input',()=>{
      query=input.value;
      drawGrid();
    });
    filters.append(input);
    const grid=make('div','discovery-grid');
    const drawGrid=()=>{
      grid.replaceChildren();
      const source=isTours?TOURS:DESTINATIONS;
      const values=source.filter(item=>(filter==='all'||item.category===filter) &&
        [item.title,item.subtitle,item.name,item.country,...(item.stops||[]).map(s=>s.name)]
          .filter(Boolean).join(' ').toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
      for(const item of values){
        const card=make('button','discovery-card');
        card.type='button';
        card.dataset[isTours?'tourId':'destinationId']=item.id;
        card.append(make('span','card-emoji',item.icon||item.emoji));
        card.append(make('strong','',isTours?item.title:item.name));
        card.append(make('span','card-meta',isTours
          ?item.subtitle+' · '+item.stops.length+' остановок'
          :item.country));
        if(isTours)card.append(make('span','card-route',
          item.stops.slice(0,3).map(s=>s.name).join(' · ')+(item.stops.length>3?' · …':'')));
        card.append(make('span','card-action',isTours?'▶ Начать экскурсию':'↪ Исследовать'));
        card.addEventListener('click',()=>isTours?onTour(item):onDestination(item));
        grid.append(card);
      }
      if(!values.length)grid.append(make('p','discovery-empty','По этому запросу пока нет маршрутов.'));
    };
    drawGrid();
    const note=make('small','discovery-note','Экскурсия показывает только реально найденные 360° панорамы рядом с каждой достопримечательностью. Если данных нет, остановка пропускается. Panoramax и Google имеют разное покрытие.');
    panel.append(heading,filters,grid,note);
  };
  const selectTab=(id)=>{
    if(!(id in navs))return;
    active=id;filter='all';query='';
    render();
    if(id==='explore')onFree();
  };
  for(const [id,tab] of Object.entries(navs)){
    tab.addEventListener('click',()=>selectTab(id));
    tab.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const keys=Object.keys(navs);
      const i=event.key==='Home'?0:event.key==='End'?keys.length-1:
        (keys.indexOf(id)+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length;
      navs[keys[i]].focus();selectTab(keys[i]);
    });
  }
  render();
  return {selectTab, get activeTab(){return active}};
}
