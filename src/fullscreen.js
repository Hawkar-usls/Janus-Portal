// Fullscreen is scoped to the panorama panel, preserving credits and the exit
// button. The fallback is a reversible fixed layout for unsupported browsers.
export function installFullscreen({panel,button,documentRef=document,windowRef=window}) {
  if (!panel || !button) throw new TypeError('Fullscreen requires viewer and control');
  let fallback=false;
  const active=()=>documentRef.fullscreenElement===panel||fallback;
  const refresh=()=>{
    const on=active();
    button.textContent=on?'⤢ Свернуть':'⛶ На весь экран';
    button.setAttribute('aria-pressed',String(on));
    button.setAttribute('aria-label',on?'Свернуть панораму':'Развернуть панораму на весь экран');
    button.title=on?'Свернуть (Esc)':'Полный экран';
    panel.classList.toggle('is-immersive',fallback);
    documentRef.body?.classList.toggle('portal-immersive-fallback',fallback);
    // Allow embedded panorama renderers to resize themselves.
    windowRef.requestAnimationFrame?.(()=>windowRef.dispatchEvent(new Event('resize')));
  };
  const enterFallback=()=>{fallback=true;refresh()};
  const exit=async()=>{
    if(documentRef.fullscreenElement===panel){
      try{await documentRef.exitFullscreen?.()}catch{/* native exit may be refused */}
    }
    fallback=false;
    refresh();
  };
  const toggle=async()=>{
    if(active())return exit();
    if(typeof panel.requestFullscreen!=='function'){enterFallback();return}
    try{await panel.requestFullscreen();refresh()}
    catch {enterFallback()}
  };
  const onChange=()=>{if(!documentRef.fullscreenElement)fallback=false;refresh()};
  const onKey=event=>{
    if(event.key==='Escape'&&fallback){fallback=false;refresh()}
  };
  button.addEventListener('click',toggle);
  documentRef.addEventListener('fullscreenchange',onChange);
  documentRef.addEventListener('keydown',onKey);
  refresh();
  return {
    toggle,exit,active,
    destroy(){
      button.removeEventListener('click',toggle);
      documentRef.removeEventListener('fullscreenchange',onChange);
      documentRef.removeEventListener('keydown',onKey);
      fallback=false;refresh();
    }
  };
}
