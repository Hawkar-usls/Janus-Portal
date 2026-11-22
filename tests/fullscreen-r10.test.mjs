import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
test('one existing R2 panorama has a real fullscreen button',()=>{
  assert.equal((html.match(/id="fullscreenBtn"/g)||[]).length,1);
  assert.ok(html.includes('aria-label="Развернуть панораму на весь экран"'));
  assert.ok(html.includes('aria-pressed="false"'));
  assert.match(html,/<div class="view" id="viewer">/);
  assert.match(html,/<button id="startBtn" class="primary">▶ Запустить<\/button>/);
  assert.equal((html.match(/id="originChoice"/g)||[]).length,1);
  assert.equal((html.match(/id="sourceGateway"/g)||[]).length,0);
  assert.equal((html.match(/class="external-panorama-links"/g)||[]).length,0);
});
test('native Fullscreen API with viewport fallback and Escape exit is wired',()=>{
  assert.ok(app.includes("document.querySelector('.viewer-panel')"));
  assert.match(app,/document\.fullscreenElement===fullscreenPanel/);
  assert.match(app,/fullscreenPanel\.requestFullscreen\|\|fullscreenPanel\.webkitRequestFullscreen/);
  assert.match(app,/document\.exitFullscreen\|\|document\.webkitExitFullscreen/);
  assert.match(app,/portal-fullscreen-fallback/);
  assert.match(app,/event\.key==='Escape'/);
  assert.match(app,/fullscreenControl\.addEventListener\('click',toggleViewerFullscreen\)/);
  assert.match(app,/document\.addEventListener\('fullscreenchange',syncViewerFullscreen\)/);
  assert.match(app,/aria-pressed/);
});
test('fullscreen targets current viewer only, without a new viewer or runtime module',()=>{
  assert.ok(css.includes('.viewer-panel.portal-fullscreen-active .view'));
  assert.ok(css.includes('flex:1 1 auto'));
  assert.ok(css.includes('.viewer-panel.portal-fullscreen-fallback'));
  assert.ok(css.includes('100dvh'));
  assert.ok(css.includes('.viewer-fullscreen-btn'));
  assert.ok(html.includes('<script type="module" src="./src/app.js"></script>'));
  const imports=[...app.matchAll(/^import .*? from '(\.\/[^']+)'/gm)].map(x=>x[1]);
  assert.deepEqual(imports,['./navigation.js','./providers.js','./storage.js','./gaze.js','./attention.js']);
  assert.match(app,/await state\.provider\.show\(candidate, \$\('viewer'\)\)/);
});
