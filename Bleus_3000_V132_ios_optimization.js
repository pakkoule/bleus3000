/* 3615 Bleus V1.3.2 — optimisation iPhone / Safari iOS */
(()=>{
  'use strict';
  const root=document.documentElement,body=document.body;
  const coarse=()=>window.matchMedia?.('(pointer:coarse)')?.matches||false;
  const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Mac/.test(navigator.platform||'')&&navigator.maxTouchPoints>1);
  root.classList.toggle('b3k-ios',isIOS);
  root.classList.toggle('b3k-touch',coarse());

  let viewportFrame=0;
  function updateViewportNow(){
    viewportFrame=0;
    const vv=window.visualViewport;
    const h=Math.max(240,Math.round(vv?.height||window.innerHeight||0));
    const w=Math.max(280,Math.round(vv?.width||window.innerWidth||0));
    const top=Math.max(0,Math.round(vv?.offsetTop||0));
    const left=Math.max(0,Math.round(vv?.offsetLeft||0));
    const gap=Math.max(0,Math.round((window.innerHeight||h)-h));
    root.style.setProperty('--b3k-vvh',`${h}px`);
    root.style.setProperty('--b3k-vvw',`${w}px`);
    root.style.setProperty('--b3k-vv-top',`${top}px`);
    root.style.setProperty('--b3k-vv-left',`${left}px`);
    root.style.setProperty('--b3k-keyboard-gap',`${gap}px`);
    root.classList.toggle('b3k-keyboard-open',gap>140);
  }
  function updateViewport(){if(viewportFrame)return;viewportFrame=requestAnimationFrame(updateViewportNow);}
  updateViewportNow();
  window.addEventListener('resize',updateViewport,{passive:true});
  window.addEventListener('orientationchange',updateViewport,{passive:true});
  window.visualViewport?.addEventListener('resize',updateViewport,{passive:true});
  window.visualViewport?.addEventListener('scroll',updateViewport,{passive:true});

  /* Images : ne pas décoder/télécharger agressivement des visuels hors écran. */
  function optimizeImage(img){
    if(!(img instanceof HTMLImageElement)||img.dataset.b3kImageOptimized==='1')return;
    img.dataset.b3kImageOptimized='1';
    img.decoding='async';
    const eager=img.classList.contains('bleus-header-logo')||img.closest('.home-search-3615,.calendar-home-title,.top-header');
    if(eager){img.loading='eager';try{img.fetchPriority='high';}catch{}}
    else{
      if(!img.hasAttribute('loading'))img.loading='lazy';
      try{if(!img.fetchPriority)img.fetchPriority='low';}catch{}
    }
  }
  function scanImages(scope=document){
    if(scope instanceof HTMLImageElement)optimizeImage(scope);
    scope.querySelectorAll?.('img').forEach(optimizeImage);
  }
  scanImages();

  /* Restauration du scroll des référentiels (même onglet/session). */
  const referenceScroll=new Map();
  const refModal=document.getElementById('referenceModal');
  const refBody=refModal?.querySelector('.modal-body');
  let scrollFrame=0,lastKind='';
  function refKind(){return String(refModal?.dataset.referenceKind||'').trim();}
  function rememberReferenceScroll(){
    scrollFrame=0;const kind=refKind();if(!kind||!refBody)return;
    referenceScroll.set(kind,refBody.scrollTop||0);
    try{sessionStorage.setItem(`bleus3000.scroll.reference.${kind}`,String(refBody.scrollTop||0));}catch{}
  }
  function restoreReferenceScroll(){
    if(!refBody||!refModal||refModal.hidden)return;
    const kind=refKind();if(!kind)return;
    let value=referenceScroll.get(kind);
    if(value==null){try{value=Number(sessionStorage.getItem(`bleus3000.scroll.reference.${kind}`)||0);}catch{value=0;}}
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(refKind()===kind&&Number.isFinite(value))refBody.scrollTop=Math.max(0,value); }));
  }
  refBody?.addEventListener('scroll',()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(rememberReferenceScroll);},{passive:true});

  /* Scroll-lock iOS : évite les sauts de page et le double scroll derrière les modales. */
  let lockActive=false,lockY=0;
  const visibleModal=()=>!!document.querySelector('.modal-backdrop:not([hidden]),.c3k-v8-panel-backdrop:not([hidden])');
  function syncScrollLock(){
    if(!isIOS)return;
    const active=visibleModal();
    if(active&&!lockActive){
      lockY=Math.max(0,window.scrollY||window.pageYOffset||0);
      body.style.setProperty('--b3k-lock-top',`${-lockY}px`);
      body.classList.add('b3k-ios-scroll-lock');lockActive=true;
    }else if(!active&&lockActive){
      body.classList.remove('b3k-ios-scroll-lock');body.style.removeProperty('--b3k-lock-top');lockActive=false;
      requestAnimationFrame(()=>window.scrollTo(0,lockY));
    }
  }

  /* Clavier virtuel : recentre seulement si le champ passe réellement sous le viewport visuel. */
  document.addEventListener('focusin',e=>{
    if(!coarse())return;
    const el=e.target;if(!el?.matches?.('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),textarea,select'))return;
    window.setTimeout(()=>{
      const vv=window.visualViewport;if(!vv)return;
      const r=el.getBoundingClientRect(),top=vv.offsetTop+8,bottom=vv.offsetTop+vv.height-16;
      if(r.bottom>bottom||r.top<top)el.scrollIntoView({block:'center',inline:'nearest',behavior:'auto'});
    },90);
  },{passive:true});

  let mutationFrame=0,pendingImageRoots=[];
  const observer=new MutationObserver(mutations=>{
    let needsModalSync=false,needsRestore=false;
    for(const m of mutations){
      if(m.type==='childList'){
        m.addedNodes.forEach(n=>{if(n?.nodeType===1)pendingImageRoots.push(n);});
        needsModalSync=true;
      }else if(m.type==='attributes'){
        if(m.attributeName==='hidden')needsModalSync=true;
        if(m.target===refModal&&(m.attributeName==='data-reference-kind'||m.attributeName==='hidden'))needsRestore=true;
      }
    }
    if(mutationFrame)return;
    mutationFrame=requestAnimationFrame(()=>{
      mutationFrame=0;
      const roots=pendingImageRoots.splice(0,pendingImageRoots.length);
      const run=()=>roots.forEach(scanImages);
      if(roots.length){if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:180});else setTimeout(run,0);}
      if(needsModalSync)syncScrollLock();
      const kind=refKind();
      if(needsRestore||kind!==lastKind){lastKind=kind;restoreReferenceScroll();}
    });
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','data-reference-kind']});
  syncScrollLock();

  /* pagehide/pageshow : Safari remet parfois une page en cache bfcache. */
  window.addEventListener('pagehide',()=>{rememberReferenceScroll();},{passive:true});
  window.addEventListener('pageshow',e=>{updateViewport();if(e.persisted){scanImages();restoreReferenceScroll();syncScrollLock();}},{passive:true});

  window.BLEUS3000_IOS_OPTIMIZATION={version:'1.3.2',updateViewport,restoreReferenceScroll,optimizeImages:scanImages};
})();
