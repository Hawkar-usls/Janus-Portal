import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const places=[
 'pyongyang','kaesong','wonsan',
 'cairo','giza','saqqara','alexandria','luxor',
 'fes','merzouga','nairobi','zanzibar','capetown',
 'pune','kathmandu','cebu','georgetown','cuenca','paris'
];
test('gateway offers the requested places and preserves the owner-confirmed R2 module graph',()=>{
 assert.match(html,/<section id="sourceGateway"/);
 assert.match(html,/<select id="gatewayPlace"/);
 assert.match(html,/<div class="gateway-sources" id="gatewaySources"/);
 for(const p of places)assert.match(html,new RegExp('<option value="'+p+'">'));
 assert.ok(html.includes('<script type="module" src="./src/app.js"></script>'));
 const imports=[...script.matchAll(/^import .*? from '(\.\/[^']+)'/gm)].map(x=>x[1]);
 assert.deepEqual(imports,['./navigation.js','./providers.js','./storage.js','./gaze.js','./attention.js']);
 assert.ok(!html.includes('/assets/'));
 assert.equal((html.match(/type="module"/g)||[]).length,1);
 assert.match(html,/<button id="startBtn" class="primary">▶ Запустить<\/button>/);
});
test('source registry does not claim North Korea/Cairo panoramas as verified',()=>{
 assert.match(script,/const GATEWAY_PANORAMAX_VERIFIED = new Set\(\[/);
 const start=script.indexOf('const GATEWAY_PANORAMAX_VERIFIED');
 const end=script.indexOf('const GATEWAY_EXTERNAL_TOURS');
 const verified=script.slice(start,end);
 for(const p of ['pyongyang','kaesong','wonsan','cairo','giza','nairobi','zanzibar'])
   assert.ok(!verified.includes("'"+p+"'"),'incorrectly verified '+p);
 for(const p of ['fes','merzouga','pune','kathmandu','cebu','georgetown','cuenca'])
   assert.ok(verified.includes("'"+p+"'"),'missing verified '+p);
 assert.match(script,/ПОКРЫТИЕ НЕ ПОДТВЕРЖДЕНО/);
 assert.match(script,/state\.limitedCoverage/);
});
test('cross-provider source routing is opt-in, never a background Google query',()=>{
 assert.match(script,/function gatewayStart\(origin,provider\)/);
 assert.match(script,/if\(provider==='google'&&!.*googleKey.*value\.trim\(\)\)/);
 assert.match(script,/gatewayStart\(origin,'panoramax'\)/);
 assert.match(script,/gatewayStart\(origin,'google'\)/);
 assert.match(script,/if\(state\.running\)stop\(\)/);
 assert.match(script,/run\(\)/);
 assert.match(script,/function renderGateway\(\)/);
});
test('external tours remain source-owned, with no iframe/mirroring or invented JC rewards',()=>{
 const urls=[
  'https://www.north-korea-travel.com/dprk-panorama.html',
  'https://giza.fas.harvard.edu/giza3d/',
  'https://egymonuments.gov.eg/en/media-hub/'
 ];
 for(const u of urls)assert.ok(script.includes("'"+u+"'"));
 assert.match(script,/a\.target='_blank';a\.rel='noopener noreferrer'/);
 assert.ok(!script.includes("createElement('iframe')"));
 assert.ok(html.includes('Внешние туры открываются на своих сайтах'));
 assert.ok(html.includes('не записываются'));
});
