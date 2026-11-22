import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseAfkRegion,distanceKm} from '../src/navigation.js';
import {getPassport,addVisit,readHistory,STORAGE_KEY} from '../src/storage.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const fes={lat:34.061672694,lng:-4.977107};
const kathmandu={lat:27.679029333,lng:85.316770333};
const pano=(id,origin,provider='panoramax')=>({provider,id,lat:origin.lat,lng:origin.lng});
const anchors=[{...fes,code:'MA',name:'Марокко',flag:'🇲🇦'},
  {...kathmandu,code:'NP',name:'Непал',flag:'🇳🇵'}];
const stamp='2026-11-22T13:00:00.000Z';

function memory(){
 const db=new Map();
 return {getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,v),
   removeItem:k=>db.delete(k)};
}

test('passport counts unique real opens, approximate known-country anchors, local XP only',()=>{
 const entries=[
  {...pano('one',fes),visitedAt:stamp},
  {...pano('one',fes),visitedAt:stamp},
  {...pano('two',{lat:34.062,lng:-4.978},'kartaview'),visitedAt:stamp},
  {...pano('three',kathmandu,'commons'),visitedAt:stamp},
  {...pano('distant',{lat:0,lng:0}),visitedAt:stamp}
 ];
 const p=getPassport(entries,anchors);
 assert.equal(p.unique,4);
 assert.equal(p.countryCount,2);
 assert.deepEqual(p.countries.map(c=>[c.code,c.count]),[['MA',2],['NP',1]]);
 assert.deepEqual(p.providers.map(c=>c.name).sort(),['commons','kartaview','panoramax']);
 assert.equal(p.unassigned,1);
 assert.equal(p.xp,4*10+2*25);
 assert.equal(p.level,1);
 assert.equal('coins' in p,false);
 assert.equal('jcoins' in p,false);
});

test('passport progresses deterministic level thresholds but never mints J Coins',()=>{
 const entries=Array.from({length:10},(_,i)=>({...pano('p'+i,{lat:fes.lat+i*.0003,lng:fes.lng}),visitedAt:stamp}));
 const p=getPassport(entries,anchors);
 assert.equal(p.xp,125);
 assert.equal(p.level,2);
 assert.equal(p.nextLevelXp,75);
});

test('open source 360 visits persist across reload; Google stays volatile',()=>{
 const store=memory();
 const one=addVisit([],pano('P',fes),store);
 const two=addVisit(one.entries,pano('K',{lat:fes.lat+.01,lng:fes.lng},'kartaview'),store);
 const three=addVisit(two.entries,pano('C',kathmandu,'commons'),store);
 const four=addVisit(three.entries,pano('G',fes,'google'),store);
 assert.equal(one.persisted,true);
 assert.equal(two.persisted,true);
 assert.equal(three.persisted,true);
 assert.equal(four.persisted,false);
 assert.deepEqual(readHistory(store).map(x=>x.provider),['panoramax','kartaview','commons']);
 assert.equal(JSON.parse(store.getItem(STORAGE_KEY)).some(x=>x.provider==='google'),false);
 assert.equal(getPassport(four.entries,anchors).unique,4);
});

test('AFK chooses only a fresh real 360 candidate from current provider-backed list',()=>{
 const coverage=new Map([
  ['fes',[pano('visited',fes)]],
  ['kathmandu',[pano('new',kathmandu,'commons'),pano('ignore-google',kathmandu,'google')]],
  ['ghost',[pano('fake',{lat:0,lng:0})]]
 ]);
 const options={coverage,centers:{fes,kathmandu,ghost:{"lat":42,"lng":8}},
    history:[pano('visited',fes)],exhausted:new Set(['fes']),from:fes,maxPhotoDistanceKm:5};
 const next=chooseAfkRegion(options);
 assert.equal(next.key,'kathmandu');
 assert.equal(next.photo.provider,'commons');
 assert.ok(distanceKm(fes,kathmandu)>100);
});

test('AFK stops cleanly when no verified new source, and ignores spatial duplicates',()=>{
 const coverage=new Map([
  ['fes',[pano('unique-ID-same-spot',{lat:fes.lat+.00001,lng:fes.lng})]],
  ['kathmandu',[pano('google-only',kathmandu,'google')]]
 ]);
 const next=chooseAfkRegion({coverage,centers:{fes,kathmandu},
  history:[pano('visited',fes)],exhausted:new Set(),from:fes,maxPhotoDistanceKm:5});
 assert.equal(next,null);
 assert.equal(chooseAfkRegion({coverage:new Map(),centers:{},from:fes}),null);
});

test('AFK controls and Passport/World Conquest reuse one viewer and source catalogue',()=>{
 assert.equal((html.match(/id="afkBtn"/g)||[]).length,1);
 assert.equal((html.match(/id="passportGame"/g)||[]).length,1);
 assert.match(html,/id="afkIndicator"/);
 assert.match(html,/id="passportCountryList"/);
 assert.match(html,/id="passportXp"/);
 assert.match(html,/id="passportLevel"/);
 assert.match(html,/id="passportProgress"/);
 assert.match(app,/function toggleAfk\(\)/);
 assert.match(app,/chooseAfkRegion\(/);
 assert.match(app,/if\(noPoints && state\.afk && !state\.manualMode\)/);
 assert.match(app,/state\.timer=setTimeout/);
 assert.match(app,/const profile=passport\(\)/);
 assert.match(app,/renderPassport\(\)/);
 assert.match(css,/\.country-stamp/);
 assert.match(css,/\.afk-primary/);
 assert.equal((html.match(/id="originChoice"/g)||[]).length,1);
 assert.ok(!html.includes('sourceGateway'));
 assert.ok(!html.includes('<option value="random">'));
 assert.match(html,/id="fullscreenBtn"/);
 const imports=[...app.matchAll(/^import .*? from '(\.\/[^']+)'/gm)].map(x=>x[1]);
 assert.deepEqual(imports,['./navigation.js','./providers.js','./storage.js','./gaze.js','./attention.js']);
});

test('World Conquest is clearly local-only: no monetized achievements or global rank claimed',()=>{
 assert.match(html,/XP и достижения — локальная игровая статистика, не J Coins/);
 assert.match(html,/Глобальные рейтинги и начисление JC требуют проверки аккаунта на сервере/);
 assert.match(app,/Google \(текущая сессия\)/);
 assert.match(app,/state\.history\.filter\(e => \['panoramax','kartaview','commons'\]/);
 assert.ok(!app.includes("localStorage.setItem('JCoins'"));
});
