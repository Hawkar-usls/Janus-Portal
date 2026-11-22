// GitHub Pages has a short shared cache; previous revisions reused /src/app.js.
// A cached HTML shell could combine with newer/older modules and appear broken.
// Publish every revision's ES module graph inside a commit-specific directory.
import {mkdir, readFile, readdir, copyFile, rm, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'dist');
const raw=process.env.GITHUB_SHA||process.env.PORTAL_BUILD_SHA||'local-build';
const build=raw.slice(0,12).replace(/[^a-zA-Z0-9_-]/g,'');
if(!build)throw new Error('Invalid build revision');
await rm(output,{recursive:true,force:true});
const assetDir=join(output,'assets',build);
await mkdir(assetDir,{recursive:true});
const names=(await readdir(join(root,'src'))).filter(x=>/\.(?:js|css)$/.test(x));
for(const name of names)await copyFile(join(root,'src',name),join(assetDir,name));
let html=await readFile(join(root,'index.html'),'utf8');
const beforeCss='./src/styles.css',beforeJs='./src/app.js';
if(!html.includes(beforeCss)||!html.includes(beforeJs))throw new Error('Expected versionable entrypoints missing');
html=html.replace(beforeCss,'./assets/'+build+'/styles.css')
  .replace(beforeJs,'./assets/'+build+'/app.js')
  .replace('<title>','<meta name="janus-build" content="'+build+'">\n  <title>');
const footer='<span class="build-revision">Сборка '+build+'</span>';
html=html.replace('</footer>',footer+'</footer>');
await writeFile(join(output,'index.html'),html);
await copyFile(join(root,'favicon.svg'),join(output,'favicon.svg'));
await writeFile(join(output,'.nojekyll'),'');
if(!names.includes('tours.js')||!names.includes('app.js')||!names.includes('gaze.js'))
  throw new Error('Required modules absent');
console.log('Built GitHub Pages assets /assets/'+build+'/ ('+names.length+' files)');
