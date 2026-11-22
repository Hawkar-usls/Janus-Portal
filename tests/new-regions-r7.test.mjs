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
  assert.ok(html.includes('id="originCatalog"'));
  assert.ok(html.includes('id="coverageStatus"'));
  assert.ok(html.includes('свежими 360°-метаданными'));
});
test('unverified search is bounded locally and cannot contaminate existing random pool',()=>{
  assert.match(app,/const LIMITED_COVERAGE_KEYS = new Set\(\[/);
  for(const key of names)assert.ok(app.includes("'"+key+"'"));
  assert.match(app,/const MAX_LIMITED_SEARCH_KM = 40/);
  assert.match(app,/maxRadiusKm:\s*state.limitedCoverage/);
  assert.ok(!app.includes("if (key === 'random')"));
  assert.ok(!app.includes('random-verified'));
  assert.ok(app.includes('liveCoverage.has'));
  assert.match(app,/state\.running = false/);
  assert.match(app,/Не подменяем их фотографиями другой страны/);
});
test('every R7 region is handled by one internal search without external links',()=>{
  assert.match(html,/<select id="originChoice"/);
  assert.match(html,/<button id="startBtn" class="primary">▶ Запустить<\/button>/);
  assert.ok(html.includes('автоматически каждые 5 минут'));
  assert.ok(!html.includes('<option value="random">'));
  assert.ok(!html.includes('<option value="random-verified">'));
  assert.equal(html.includes('external-panorama-links'),false);
  assert.equal(html.includes('sourceGateway'),false);
  assert.equal(html.includes('north-korea-travel.com'),false);
  assert.equal(html.includes('giza.fas.harvard.edu'),false);
  assert.equal(html.includes('egymonuments.gov.eg'),false);
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
