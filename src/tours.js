// Curated geographic starting points, NOT promises of panorama coverage.
// Always ask the selected provider for a real 360° image before recording a visit.
export const DESTINATIONS = Object.freeze([
  {id:'cairo', name:'Каир', country:'Египет', category:'ancient', emoji:'🇪🇬', lat:30.0444, lng:31.2357},
  {id:'giza', name:'Гиза', country:'Египет', category:'ancient', emoji:'🐪', lat:29.9792, lng:31.1342},
  {id:'luxor', name:'Луксор', country:'Египет', category:'ancient', emoji:'🏺', lat:25.6872, lng:32.6396},
  {id:'rome', name:'Рим', country:'Италия', category:'ancient', emoji:'🏛️', lat:41.9028, lng:12.4964},
  {id:'athens', name:'Афины', country:'Греция', category:'ancient', emoji:'🏺', lat:37.9838, lng:23.7275},
  {id:'petra', name:'Петра', country:'Иордания', category:'ancient', emoji:'🏜️', lat:30.3222, lng:35.4518},
  {id:'istanbul', name:'Стамбул', country:'Турция', category:'cities', emoji:'🕌', lat:41.0082, lng:28.9784},
  {id:'paris', name:'Париж', country:'Франция', category:'cities', emoji:'🗼', lat:48.86473, lng:2.34041},
  {id:'rennes', name:'Ренн', country:'Франция', category:'cities', emoji:'🏘️', lat:48.11617, lng:-1.68669},
  {id:'lyon', name:'Лион', country:'Франция', category:'cities', emoji:'🏙️', lat:45.76561, lng:4.84002},
  {id:'london', name:'Лондон', country:'Великобритания', category:'cities', emoji:'🇬🇧', lat:51.5074, lng:-0.1278},
  {id:'venice', name:'Венеция', country:'Италия', category:'cities', emoji:'🚤', lat:45.4408, lng:12.3155},
  {id:'barcelona', name:'Барселона', country:'Испания', category:'cities', emoji:'⛪', lat:41.3874, lng:2.1686},
  {id:'prague', name:'Прага', country:'Чехия', category:'cities', emoji:'🏰', lat:50.0755, lng:14.4378},
  {id:'amsterdam', name:'Амстердам', country:'Нидерланды', category:'cities', emoji:'🚲', lat:52.3676, lng:4.9041},
  {id:'kyiv', name:'Киев', country:'Украина', category:'cities', emoji:'🇺🇦', lat:50.4501, lng:30.5234},
  {id:'lviv', name:'Львов', country:'Украина', category:'cities', emoji:'🏘️', lat:49.8397, lng:24.0297},
  {id:'tokyo', name:'Токио', country:'Япония', category:'cities', emoji:'🗾', lat:35.6762, lng:139.6503},
  {id:'kyoto', name:'Киото', country:'Япония', category:'ancient', emoji:'⛩️', lat:35.0116, lng:135.7681},
  {id:'seoul', name:'Сеул', country:'Южная Корея', category:'cities', emoji:'🇰🇷', lat:37.5665, lng:126.9780},
  {id:'singapore', name:'Сингапур', country:'Сингапур', category:'cities', emoji:'🌇', lat:1.3521, lng:103.8198},
  {id:'newyork', name:'Нью-Йорк', country:'США', category:'cities', emoji:'🗽', lat:40.7128, lng:-74.0060},
  {id:'sanfrancisco', name:'Сан-Франциско', country:'США', category:'cities', emoji:'🌉', lat:37.7749, lng:-122.4194},
  {id:'rio', name:'Рио-де-Жанейро', country:'Бразилия', category:'cities', emoji:'🇧🇷', lat:-22.9068, lng:-43.1729},
  {id:'cusco', name:'Куско', country:'Перу', category:'ancient', emoji:'🦙', lat:-13.5319, lng:-71.9675},
  {id:'delhi', name:'Нью-Дели', country:'Индия', category:'cities', emoji:'🇮🇳', lat:28.6139, lng:77.2090},
  {id:'agra', name:'Агра', country:'Индия', category:'ancient', emoji:'🕌', lat:27.1767, lng:78.0081},
  {id:'sydney', name:'Сидней', country:'Австралия', category:'cities', emoji:'🦘', lat:-33.8688, lng:151.2093},
  {id:'cape-town', name:'Кейптаун', country:'ЮАР', category:'nature', emoji:'🏞️', lat:-33.9249, lng:18.4241},
  {id:'reykjavik', name:'Рейкьявик', country:'Исландия', category:'nature', emoji:'❄️', lat:64.1466, lng:-21.9426},
  {id:'lauterbrunnen', name:'Лаутербруннен', country:'Швейцария', category:'nature', emoji:'🏔️', lat:46.5937, lng:7.9091},
  {id:'zermatt', name:'Церматт', country:'Швейцария', category:'nature', emoji:'🏔️', lat:46.0207, lng:7.7491},
  {id:'santorini', name:'Санторини', country:'Греция', category:'nature', emoji:'🌅', lat:36.4615, lng:25.3750},
  {id:'bali', name:'Бали', country:'Индонезия', category:'nature', emoji:'🌴', lat:-8.4095, lng:115.1889},
  {id:'grandcanyon', name:'Гранд-Каньон', country:'США', category:'nature', emoji:'🏜️', lat:36.0544, lng:-112.1401},
  {id:'yellowstone', name:'Йеллоустон', country:'США', category:'nature', emoji:'♨️', lat:44.4605, lng:-110.8281},
  {id:'machupicchu', name:'Мачу-Пикчу', country:'Перу', category:'ancient', emoji:'⛰️', lat:-13.1631, lng:-72.5450}
]);

// Stops are **search centres**, never hardcoded photo IDs or "guaranteed views".
// Every tour is a succession of availability checks within a small distance
// of a real landmark; no silent jump to a different continent.
const STOP = (name, lat, lng, note = '') => ({name, lat, lng, note});
export const TOURS = Object.freeze([
  {id:'egypt', icon:'🐪', category:'ancient', title:'Тайны Древнего Египта', subtitle:'Каир, Гиза и Луксор', stops:[
    STOP('Великие пирамиды Гизы',29.9792,31.1342,'Главная панорама у пирамид'),
    STOP('Большой Сфинкс',29.9753,31.1376,'Сфинкс и плато Гиза'),
    STOP('Египетский музей',30.0478,31.2336,'История Каира'),
    STOP('Цитадель Каира',30.0287,31.2599,'Виды на старый город'),
    STOP('Хан эль-Халили',30.0477,31.2621,'Улицы исторического рынка'),
    STOP('Карнакский храм',25.7188,32.6573,'Луксор, монументальные колоннады'),
    STOP('Долина царей',25.7402,32.6014,'Западный берег Нила')
  ]},
  {id:'paris-icons', icon:'🗼', category:'cities', title:'Открытки из Парижа', subtitle:'Самые узнаваемые места города', stops:[
    STOP('Эйфелева башня',48.8584,2.2945),
    STOP('Триумфальная арка',48.8738,2.2950),
    STOP('Лувр',48.8606,2.3376),
    STOP('Нотр-Дам',48.8530,2.3499),
    STOP('Монмартр',48.8867,2.3431)
  ]},
  {id:'rome-antiquity', icon:'🏛️', category:'ancient', title:'Древний Рим', subtitle:'Античность и итальянские площади', stops:[
    STOP('Колизей',41.8902,12.4922),
    STOP('Римский форум',41.8925,12.4853),
    STOP('Пантеон',41.8986,12.4769),
    STOP('Фонтан Треви',41.9009,12.4833),
    STOP('Собор Святого Петра',41.9022,12.4539)
  ]},
  {id:'london', icon:'🇬🇧', category:'cities', title:'Королевский Лондон', subtitle:'От Темзы до старого города', stops:[
    STOP('Биг-Бен',51.5007,-0.1246),
    STOP('Лондонский глаз',51.5033,-0.1195),
    STOP('Тауэрский мост',51.5055,-0.0754),
    STOP('Букингемский дворец',51.5014,-0.1419),
    STOP('Трафальгарская площадь',51.5080,-0.1281)
  ]},
  {id:'tokyo', icon:'🗾', category:'cities', title:'Огни Токио', subtitle:'Контрасты мегаполиса', stops:[
    STOP('Перекрёсток Сибуя',35.6595,139.7005),
    STOP('Храм Сэнсо-дзи',35.7148,139.7967),
    STOP('Синдзюку',35.6938,139.7034),
    STOP('Токийская башня',35.6586,139.7454),
    STOP('Императорский дворец',35.6852,139.7528)
  ]},
  {id:'nyc', icon:'🗽', category:'cities', title:'Нью-Йорк с открытки', subtitle:'Высотки, площади и парки', stops:[
    STOP('Таймс-сквер',40.7580,-73.9855),
    STOP('Центральный парк',40.7759,-73.9702),
    STOP('Бруклинский мост',40.7061,-73.9969),
    STOP('Статуя Свободы',40.6892,-74.0445),
    STOP('Рокфеллер-центр',40.7587,-73.9787)
  ]},
  {id:'istanbul', icon:'🕌', category:'ancient', title:'Сокровища Стамбула', subtitle:'На стыке двух континентов', stops:[
    STOP('Айя-София',41.0086,28.9802),
    STOP('Голубая мечеть',41.0054,28.9768),
    STOP('Дворец Топкапы',41.0115,28.9834),
    STOP('Галатская башня',41.0256,28.9744),
    STOP('Гранд-базар',41.0107,28.9674)
  ]},
  {id:'kyiv', icon:'🇺🇦', category:'cities', title:'Исторический Киев', subtitle:'Площади, храмы и Днепр', stops:[
    STOP('Майдан Незалежности',50.4501,30.5234),
    STOP('Софийский собор',50.4529,30.5144),
    STOP('Андреевский спуск',50.4587,30.5173),
    STOP('Киево-Печерская лавра',50.4347,30.5570),
    STOP('Владимирская горка',50.4557,30.5312)
  ]},
  {id:'wonder-world', icon:'🌎', category:'wonders', title:'Чудеса света', subtitle:'Экспедиция по нескольким странам', stops:[
    STOP('Пирамиды Гизы',29.9792,31.1342),
    STOP('Колизей',41.8902,12.4922),
    STOP('Петра',30.3222,35.4518),
    STOP('Тадж-Махал',27.1751,78.0421),
    STOP('Великая Китайская стена (Мутяньюй)',40.4374,116.5618),
    STOP('Мачу-Пикчу',-13.1631,-72.5450),
    STOP('Чичен-Ица',20.6843,-88.5678),
    STOP('Христос-Искупитель',-22.9519,-43.2105)
  ]},
  {id:'nature', icon:'🏞️', category:'nature', title:'Природные чудеса', subtitle:'Горы, вулканы, ущелья', stops:[
    STOP('Гранд-Каньон',36.0544,-112.1401),
    STOP('Олд-Фейтфул, Йеллоустон',44.4605,-110.8281),
    STOP('Лаутербруннен',46.5937,7.9091),
    STOP('Маттерхорн, Церматт',46.0207,7.7491),
    STOP('Гюдльфосс, Исландия',64.3274,-20.1218),
    STOP('Утёсы Санторини',36.4615,25.3750)
  ]},
  {id:'renaissance', icon:'🎭', category:'cities', title:'Итальянская мечта', subtitle:'Рим, Венеция и Флоренция', stops:[
    STOP('Колизей, Рим',41.8902,12.4922),
    STOP('Площадь Сан-Марко, Венеция',45.4342,12.3388),
    STOP('Мост Риальто, Венеция',45.4380,12.3359),
    STOP('Санта-Мария-дель-Фьоре, Флоренция',43.7731,11.2560),
    STOP('Понте-Веккьо, Флоренция',43.7680,11.2531)
  ]},
  {id:'east-asia', icon:'🌸', category:'cities', title:'Азия: храм и мегаполис', subtitle:'Япония, Корея и Сингапур', stops:[
    STOP('Перекрёсток Сибуя, Токио',35.6595,139.7005),
    STOP('Фусими Инари, Киото',34.9671,135.7727),
    STOP('Дворец Кёнбоккун, Сеул',37.5796,126.9770),
    STOP('Марина-Бэй, Сингапур',1.2834,103.8607)
  ]}
]);
export const TOUR_CATEGORIES = Object.freeze([
  {id:'all',label:'Все экскурсии'},
  {id:'ancient',label:'🏛️ История'},
  {id:'cities',label:'🏙️ Города'},
  {id:'nature',label:'🏔️ Природа'},
  {id:'wonders',label:'🌟 Чудеса света'}
]);
export const DESTINATION_CATEGORIES = Object.freeze([
  {id:'all',label:'Все направления'},
  {id:'cities',label:'Города'},
  {id:'ancient',label:'История'},
  {id:'nature',label:'Природа'}
]);
export const destinationById = id => DESTINATIONS.find(d=>d.id===id) || null;
export const tourById = id => TOURS.find(t=>t.id===id) || null;
export const hasCoordinates = x => x && Number.isFinite(x.lat) &&
  Number.isFinite(x.lng) && x.lat >= -90 && x.lat <=90 && x.lng >=-180 && x.lng<=180;
export function getTourStop(tour, index) {
  if (!tour || !Number.isInteger(index) || index < 0) return null;
  const p=tour.stops[index];
  return hasCoordinates(p) ? p : null;
}
export const tourSummary = tour => ({id:tour.id, stops:tour.stops.length,
  countries: new Set(tour.stops.map(s=>s.country).filter(Boolean)).size});
