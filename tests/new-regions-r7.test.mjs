import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const required={
  northKorea:['pyongyang','kaesong','wonsan'],
  egypt:['cairo','giza','saqqara','alexandria','luxor'],
  restAfrica:['nairobi','zanzibar','kampala','addis','dakar','lagos','windhoek','capetown','victoriafalls']
};
const names=Object.values(required).flat();
test('North Korea Cairo and wider Africa are searchable coordinate starts, not phantom 360 evidence',()=>{
  for(const key of names){
    assert.match(html,new RegExp('<option value="'+key+'">'));
    assert.match(app,new RegExp('^\\s{2}'+key+': \\{lat: [-\\d.]+, lng: [-\\d.]+\\}', 'm'));
  }
  assert.equal(new Set(names).size,17);
  for(const title of ['Северная Корея','Каир и Египет','Другая Африка'])
    assert.ok(html.includes(title));
  assert.ok(html.includes('не подтверждены')||html.includes('не подтверждённого'));
});
test('unverified search is bounded locally and cannot contaminate existing random pool',()=>{
  assert.match(app,/const LIMITED_COVERAGE_KEYS = new Set\(\[/);
  for(const key of names)assert.ok(app.includes("'"+key+"'"));
  assert.match(app,/const MAX_LIMITED_SEARCH_KM = 40/);
  assert.match(app,/maxRadiusKm:\s*state.limitedCoverage/);
  assert.match(app,/Object.keys\(CITY\).filter\(id => !LIMITED_COVERAGE_KEYS.has\(id\)\)/);
  assert.match(app,/state\.running = false/);
  assert.match(app,/Не подменяем их фотографиями другой страны/);
});
test('link to real source-owned 360 tours rather than displaying foreign images as local',()=>{
  for(const url of [
    'https://www.north-korea-travel.com/dprk-panorama.html',
    'https://giza.fas.harvard.edu/giza3d/',
    'https://egymonuments.gov.eg/en/media-hub/'
  ])assert.ok(html.includes('href="'+url+'"'));
  assert.match(html,/target="_blank" rel="noopener noreferrer"/);
  assert.ok(html.includes('Внешние туры не начисляют посещения JANUS'));
});
test('preserve owner-confirmed R2 entrypoint, exact five imports, old starts and radius',()=>{
  assert.ok(html.includes('<script type="module" src="./src/app.js"></script>'));
  const imports=[...app.matchAll(/^import .*? from '(\.\/[^']+)'/gm)].map(x=>x[1]);
  assert.deepEqual(imports,[
    './navigation.js','./providers.js','./storage.js','./gaze.js','./attention.js'
  ]);
  for(const key of ['paris','rennes','lyon','kyiv','tokyo','newyork','rio','pune','kathmandu','fes','merzouga'])
    assert.ok(html.includes('value="'+key+'"'),key);
  assert.match(html,/<input id="radius" type="range" min="1" max="50" step="1" value="5">/);
  assert.ok(!html.includes('/assets/'));
});
