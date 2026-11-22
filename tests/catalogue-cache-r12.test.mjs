import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const pages=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
test('Pages stamps BOTH assets with the exact deployment SHA to avoid stale R10 JS with R11 HTML',()=>{
 assert.match(pages,/GITHUB_SHA/);
 assert.match(pages,/s\|\.\/*src\/app\.js\|/);
 assert.match(pages,/s\|\.\/*src\/styles\.css\|/);
 assert.match(pages,/grep -Fq "\.\/src\/app\.js\?build=\$\{GITHUB_SHA\}"/);
 assert.match(pages,/grep -Fq "\.\/src\/styles\.css\?build=\$\{GITHUB_SHA\}"/);
 assert.ok(html.includes('<script type="module" src="./src/app.js"></script>'),
  'R2 source must remain original: Pages stamps the deployed copy only');
});
test('catalogue has a finite 30-second multi-source deadline and a visible error when provider is unreachable',()=>{
 assert.match(app,/LIVE_MAX_SCAN_MS=30000/);
 assert.match(app,/const deadline=setTimeout/);
 assert.match(app,/liveTimedOut=true/);
 assert.match(app,/controller\.abort\(\)/);
 assert.match(app,/clearTimeout\(deadline\)/);
 assert.match(app,/Проверь интернет/);
 assert.match(app,/лимиту 30 секунд/);
 assert.match(app,/Нажми «Обновить»/);
 assert.match(app,/status\.dataset\.state=/);
});
test('refresh is clickable while checking and cancels stale in-flight requests',()=>{
 assert.match(app,/liveController\?\.abort\(\)/);
 assert.match(app,/const generation=\+\+liveGeneration/);
 assert.match(app,/if\(generation!==liveGeneration/);
 assert.ok(!app.includes('state.running || liveRefreshing ||'));
 assert.ok(!app.includes('lastManualRefresh'),'never silently ignore a rapid retry');
 assert.match(app,/refreshCoverageBtn'\)\.addEventListener\('click'/);
 assert.match(html,/id="refreshCoverageBtn"/);
});
test('Google key is user-issued; demo key cannot enable Street View and no key is embedded',()=>{
 assert.ok(html.includes('https://developers.google.com/maps/documentation/javascript/get-api-key'));
 assert.match(html,/Бесплатный Google Maps Demo Key/);
 assert.match(html,/не поддерживает Street View/);
 assert.match(html,/id="googleKey"/);
 assert.ok(!html.includes('key=AIza'));
 assert.ok(!app.includes('key=AIza'));
 assert.match(html,/Ключ не сохраняется Порталом/);
 assert.ok(!app.includes('sessionStorage.setItem'));
});
test('keep original R2 viewer, exact five imports, full screen and one search',()=>{
 const imports=[...app.matchAll(/^import .*? from '(\.\/[^']+)'/gm)].map(x=>x[1]);
 assert.deepEqual(imports,['./navigation.js','./providers.js','./storage.js','./gaze.js','./attention.js']);
 assert.ok(html.includes('id="fullscreenBtn"'));
 assert.ok(html.includes('id="originChoice"'));
 assert.ok(!html.includes('id="sourceGateway"'));
 assert.ok(!html.includes('value="random"'));
 assert.match(app,/await state\.provider\.show\(candidate, \$\('viewer'\)\)/);
});
