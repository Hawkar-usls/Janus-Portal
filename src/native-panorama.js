// R5: self-contained Panoramax spherical viewer, no 3rd-party JavaScript.
// Uses the legally attributed Panoramax SD photo. No Google pixel access.
const rad=x=>x*Math.PI/180,clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const wrap=x=>((x%360)+360)%360;
const safe=(input,fallback)=>{
  try {const u=new URL(input);return u.protocol==='https:'?u.href:fallback}
  catch{return fallback}
};
const el=(name,text)=>{
  const node=document.createElement(name);
  if(text!==undefined)node.textContent=text;
  return node;
};
function loadImage(src,timeoutMs=9000,signal){
  return new Promise((resolve,reject)=>{
    const im=new Image();im.crossOrigin='anonymous';im.decoding='async';
    let done=false;
    const timeout=setTimeout(()=>end(new Error('Панорама не ответила за '+Math.round(timeoutMs/1000)+' сек')),timeoutMs);
    const abort=()=>{im.src='';end(new DOMException('Загрузка отменена','AbortError'))};
    if(signal?.aborted){abort();return}
    signal?.addEventListener('abort',abort,{once:true});
    function end(error){if(done)return;done=true;clearTimeout(timeout);signal?.removeEventListener('abort',abort);im.onload=im.onerror=null;
      if(error)reject(error);else resolve(im)}
    im.onload=()=>end();im.onerror=()=>end(new Error('Изображение Panoramax недоступно'));
    im.src=src;
  });
}
function compile(gl,type,source){
  const s=gl.createShader(type);
  gl.shaderSource(s,source);gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader error');
  return s;
}
function createRenderer(canvas,img){
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,depth:false});
  if(!gl)throw new Error('WebGL unavailable');
  const v=compile(gl,gl.VERTEX_SHADER,
    'attribute vec2 pos;varying vec2 uv;void main(){uv=(pos+1.0)*0.5;gl_Position=vec4(pos,0.,1.);}');
  const f=compile(gl,gl.FRAGMENT_SHADER,
    'precision highp float;varying vec2 uv;uniform sampler2D image;uniform float yaw,pitch,fov,aspect;const float PI=3.141592653589793;'+
    'void main(){vec2 screen=uv*2.-1.;vec3 d=normalize(vec3(screen.x*aspect*fov,-screen.y*fov,1.));'+
    'float cp=cos(pitch),sp=sin(pitch);d=vec3(d.x,d.y*cp+d.z*sp,-d.y*sp+d.z*cp);'+
    'float cy=cos(yaw),sy=sin(yaw);d=vec3(d.x*cy+d.z*sy,d.y,-d.x*sy+d.z*cy);'+
    'vec2 tc=vec2(fract(atan(d.x,d.z)/(2.*PI)+.5),.5-asin(clamp(d.y,-1.,1.))/PI);'+
    'gl_FragColor=texture2D(image,tc);}');
  const prog=gl.createProgram();gl.attachShader(prog,v);gl.attachShader(prog,f);
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(prog,'pos');
  gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  for(const [param,value] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],
    [gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],
    [gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,param,value);
  const uniforms={
    yaw:gl.getUniformLocation(prog,'yaw'),pitch:gl.getUniformLocation(prog,'pitch'),
    fov:gl.getUniformLocation(prog,'fov'),aspect:gl.getUniformLocation(prog,'aspect')
  };
  return {
    render(p){
      const ratio=Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,2);
      const w=Math.max(1,Math.floor(canvas.clientWidth*ratio));
      const h=Math.max(1,Math.floor(canvas.clientHeight*ratio));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h)}
      gl.uniform1f(uniforms.yaw,rad(p.x));gl.uniform1f(uniforms.pitch,rad(p.y));
      gl.uniform1f(uniforms.fov,Math.tan(rad(clamp(96-p.z*.73,38,96)/2)));
      gl.uniform1f(uniforms.aspect,w/h);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    },
    destroy(){
      gl.deleteTexture(tex);gl.deleteBuffer(buffer);gl.deleteProgram(prog);
      gl.deleteShader(v);gl.deleteShader(f);
    }
  };
}
export class NativePanorama {
  constructor(container,image){
    this.container=container;this.image=image;
    this.pose={x:0,y:0,z:0};this.destroyed=false;this.onRemove=()=>{};
  }
  static async open(candidate,container,{signal}={}){
    const url=safe(candidate.previewUrl,null);
    if(!url)throw new Error('Panoramax: изображение отсутствует');
    const image=await loadImage(url,9000,signal);
    if(signal?.aborted)throw new DOMException('Загрузка отменена','AbortError');
    const viewer=new NativePanorama(container,image);
    viewer.mount(candidate);
    return viewer;
  }
  mount(candidate){
    this.container.replaceChildren();
    const root=el('div');
    root.__janusViewer=this; // local browser diagnostics; never contains Google imagery
    root.className='native-panorama';root.style.cssText='position:relative;width:100%;height:100%;overflow:hidden;background:#091522';
    const canvas=el('canvas');
    canvas.style.cssText='width:100%;height:100%;display:block;touch-action:none;cursor:grab';
    root.append(canvas);
    try{
      this.renderer=createRenderer(canvas,this.image);
      let last=null;
      const down=e=>{last={x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);canvas.style.cursor='grabbing'};
      const move=e=>{if(!last)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;
        last={x:e.clientX,y:e.clientY};this.setXYZ(this.pose.x-dx*.19,this.pose.y+dy*.13,this.pose.z)};
      const up=()=>{last=null;canvas.style.cursor='grab'};
      const wheel=e=>{e.preventDefault();this.setXYZ(this.pose.x,this.pose.y,this.pose.z+Math.sign(-e.deltaY)*5)};
      canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);
      canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
      canvas.addEventListener('wheel',wheel,{passive:false});
      this.resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>this.draw()):null;
      this.resize?.observe(canvas);
      this.onRemove=()=>{canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);
        canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);
        canvas.removeEventListener('wheel',wheel);this.resize?.disconnect()};
    }catch(error){
      this.renderer=null;canvas.remove();
      const preview=el('img');
      preview.className='panorama-static-preview';
      preview.alt='Предпросмотр панорамы без 3D';
      preview.src=this.image.src;
      preview.style.cssText='width:100%;height:100%;object-fit:cover';
      root.append(preview);
      const warning=el('div','3D недоступно: показываю исходное фото.');
      warning.style.cssText='position:absolute;top:8px;left:8px;padding:8px;border-radius:6px;color:white;background:#07121dd9;font:12px sans-serif;';
      root.append(warning);
    }
    const credit=el('div');
    credit.className='native-panorama-credit';
    credit.style.cssText='position:absolute;bottom:8px;left:8px;right:8px;background:#07121de8;color:#f0ffff;padding:7px;border-radius:7px;font:11px sans-serif;display:flex;gap:9px;flex-wrap:wrap';
    credit.append(el('span','Фото: '+(candidate.producer||'Panoramax')));
    const license=el('a',candidate.license||'Лицензия');
    license.href=safe(candidate.licenseUrl,'https://panoramax.xyz/');
    license.rel='noopener noreferrer';license.target='_blank';license.style.color='#8beee4';
    const source=el('a','Источник: Panoramax ↗');
    source.href=safe(candidate.sourceUrl,'https://panoramax.openstreetmap.fr/');
    source.rel='noopener noreferrer';source.target='_blank';source.style.color='#8beee4';
    credit.append(license,source);root.append(credit);
    this.container.append(root);this.draw();
  }
  getXYZ(){return {...this.pose}}
  setXYZ(x,y,z){
    if(this.destroyed)return;
    this.pose={x:wrap(Number(x)||0),y:clamp(Number(y)||0,-85,85),z:clamp(Number(z)||0,0,75)};
    this.draw();
  }
  getPictureOriginalHeading(){return 0}
  draw(){if(!this.destroyed)this.renderer?.render(this.pose)}
  destroy(){
    if(this.destroyed)return;
    this.destroyed=true;this.onRemove();this.renderer?.destroy();
    this.container.replaceChildren();
  }
}
