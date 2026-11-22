import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');

// Keep the first end-user-confirmed working R2 launch path and import graph intact.
const keys=[
  'pune','kathmandu','fes','merzouga','cebu','busay',
  'georgetown','balikpulau','bayanlepas',
  'cuenca','sayaussi','ricaurte','banoscuenca','elvalle'
];
const origins=new Map([...app.matchAll(/^\s+([a-z]+): \{lat: ([-\d.]+), lng: ([-\d.]+)\}/gm)]
  .map(([,key,lat,lng])=>[key,{lat:Number(lat),lng:Number(lng)}]));
test('all 14 verified Panoramax geographic search centres appear as R2 select options',()=>{
  for(const key of keys){
    assert.ok(origins.has(key),'CITY missing '+key);
    const {lat,lng}=origins.get(key);
    assert.ok(Number.isFinite(lat)&&Math.abs(lat)<=90&&Number.isFinite(lng)&&Math.abs(lng)<=180,key);
    assert.ok(html.includes('<option value="'+key+'">'),'select missing '+key);
  }
  assert.equal(new Set(keys).size,keys.length);
  assert.ok(html.includes('<template id="originCatalog">'));
  assert.ok(!html.includes('<option value="random">'));
  assert.ok(!html.includes('<option value="random-verified">'));
  assert.ok(app.includes('probeMerged360'));
  assert.ok(app.includes('liveCoverage.has'));
});
test('new user-selectable places span multiple countries and three world regions',()=>{
  for(const name of ['Индия','Непал','Марокко','Филиппины','Малайзия','Эквадор']){
    assert.ok(html.includes(name),'country missing: '+name);
  }
  assert.ok(html.includes('Южная Азия') && html.includes('Северная Африка') &&
    html.includes('Юго-Восточная Азия') && html.includes('Южная Америка'));
});
test('preserve working R2 script entrypoint, controls and no extra client import dependencies',()=>{
  assert.ok(html.includes('<script type="module" src="./src/app.js"></script>'));
  assert.ok(html.includes('<button id="startBtn" class="primary">▶ Запустить</button>'));
  assert.equal((html.match(/type="module"/g)||[]).length,1);
  const imports=[...app.matchAll(/^import .*? from '(\.\/[^']+)'/gm)].map(x=>x[1]);
  assert.deepEqual(imports,[
    './navigation.js','./providers.js','./storage.js','./gaze.js','./attention.js'
  ]);
  assert.ok(!html.includes('/assets/')&&!app.includes("import {installDiscovery}"));
});
