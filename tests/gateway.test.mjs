import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const places=['paris','pune','kathmandu','fes','merzouga','cebu','georgetown','cuenca',
  'pyongyang','kaesong','wonsan','cairo','giza','saqqara','alexandria','luxor',
  'nairobi','zanzibar','kampala','addis','dakar','lagos','windhoek','capetown','victoriafalls'];
test('only one original search controls the world places and starts the panorama',()=>{
  assert.match(html,/<h2>Поиск панорам<\/h2>/);
  assert.equal((html.match(/id="originChoice"/g)||[]).length,1);
  assert.equal((html.match(/id="provider"/g)||[]).length,1);
  assert.equal((html.match(/id="startBtn"/g)||[]).length,1);
  for(const place of places)assert.ok(html.includes('value="'+place+'"'),place);
  assert.match(html,/<button id="startBtn" class="primary">▶ Запустить<\/button>/);
});
test('duplicate gateway and external tours are removed, not merely hidden',()=>{
  for(const text of ['sourceGateway','gatewayPlace','gatewaySources','external-panorama-links',
    'Альтернативные 360° туры','Один Портал — разные миры',
    'north-korea-travel.com','giza.fas.harvard.edu','egymonuments.gov.eg']){
    assert.equal(html.includes(text),false,'Unexpected duplicate UI: '+text);
  }
  for(const token of ['function renderGateway','gatewayStart(','gatewaySourceCard(',
    'GATEWAY_EXTERNAL_TOURS','gatewayPlace']){
    assert.equal(app.includes(token),false,'Unexpected legacy gateway JS: '+token);
  }
  assert.equal(css.includes('.gateway-card'),false);
  assert.equal(css.includes('.external-panorama-links'),false);
});
test('original user-confirmed R2 startup graph is preserved exactly',()=>{
  assert.ok(html.includes('<script type="module" src="./src/app.js"></script>'));
  const imports=[...app.matchAll(/^import .*? from '(\.\/[^']+)'/gm)].map(x=>x[1]);
  assert.deepEqual(imports,['./navigation.js','./providers.js','./storage.js','./gaze.js','./attention.js']);
  assert.ok(!html.includes('/assets/'));
  assert.match(app,/\$\('startBtn'\)\.addEventListener\('click', run\)/);
  assert.match(html,/<input id="radius" type="range" min="1" max="50" step="1" value="5">/);
});
test('missing source cannot masquerade as a local Korea or Cairo 360 photo',()=>{
  assert.match(app,/const LIMITED_COVERAGE_KEYS = new Set/);
  assert.match(app,/maxRadiusKm:\s*state\.limitedCoverage/);
  assert.match(app,/Не подменяем их фотографиями другой страны/);
  assert.match(app,/state\.running = false/);
  assert.equal(app.includes('ссылки на внешние 360°'),false);
  assert.ok(html.includes('JANUS объединяет Panoramax, KartaView и Wikimedia Commons'));
  assert.ok(html.includes('id="originCatalog"'));
  assert.ok(!html.includes('<option value="random">'));
  assert.ok(!html.includes('<option value="random-verified">'));
  assert.ok(html.includes('JANUS объединяет Panoramax, KartaView и Wikimedia Commons'));
  assert.ok(html.includes('Фото откроется здесь же после проверки загрузки'));
});
