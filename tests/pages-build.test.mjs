import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,stat,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=join(root,'dist');
test('Pages build uses commit-specific JS/CSS paths and includes transitive import graph',async()=>{
  const sha='aabbccddee11223344556677889900aabbccddee';
  try{
    const result=spawnSync(process.execPath,['tools/build-pages.mjs'],{
      cwd:root,env:{...process.env,PORTAL_BUILD_SHA:sha,GITHUB_SHA:''},encoding:'utf8'
    });
    assert.equal(result.status,0,result.stderr||result.stdout);
    const html=await readFile(join(out,'index.html'),'utf8');
    assert.match(html,/assets\/aabbccddee11\/app\.js/);
    assert.match(html,/assets\/aabbccddee11\/styles\.css/);
    assert.match(html,/name="janus-build" content="aabbccddee11"/);
    assert.doesNotMatch(html,/(?:src|href)="\.\/src\/(?:app\.js|styles\.css)"/);
    const file=join(out,'assets','aabbccddee11');
    for(const name of ['app.js','providers.js','navigation.js','tours.js','discovery.js','gaze.js','attention.js','native-panorama.js','quick-start.js','styles.css']){
      assert.ok((await stat(join(file,name))).size>0,name);
    }
    const js=await readFile(join(file,'app.js'),'utf8');
    assert.ok(js.includes("from './tours.js'"));
  }finally{await rm(out,{force:true,recursive:true});}
});
