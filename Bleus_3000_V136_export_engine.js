/* 3615 Bleus V1.3.6 — moteur d'export commun PNG/JPG
   DOM -> SVG foreignObject autonome -> canvas Retina.
   Aucun service_role, aucune requête Supabase spécifique à l'export. */
(()=>{
  'use strict';
  const assetCache=new Map();
  const cssEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const TRANSPARENT='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  const STYLE_PROPS=[
    'display','visibility','opacity','position','inset','top','right','bottom','left','zIndex','float','clear',
    'boxSizing','width','minWidth','maxWidth','height','minHeight','maxHeight','margin','marginTop','marginRight','marginBottom','marginLeft',
    'padding','paddingTop','paddingRight','paddingBottom','paddingLeft','overflow','overflowX','overflowY','overflowWrap','clipPath',
    'border','borderTop','borderRight','borderBottom','borderLeft','borderWidth','borderStyle','borderColor','borderRadius','outline','outlineOffset',
    'backgroundColor','backgroundImage','backgroundSize','backgroundPosition','backgroundRepeat','backgroundOrigin','backgroundClip',
    'boxShadow','filter','transform','transformOrigin','objectFit','objectPosition','aspectRatio',
    'color','font','fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','textAlign','textTransform','textDecoration','textOverflow','textShadow','whiteSpace','wordBreak',
    'grid','gridTemplateColumns','gridTemplateRows','gridColumn','gridRow','gridAutoFlow','gridAutoColumns','gridAutoRows','gap','rowGap','columnGap','placeItems','placeContent','justifyItems','alignItems','justifyContent','alignContent',
    'flex','flexBasis','flexGrow','flexShrink','flexDirection','flexWrap','order','alignSelf','justifySelf',
    'listStyle','tableLayout','borderCollapse','verticalAlign','cursor'
  ];
  const SVG_NS='http://www.w3.org/2000/svg';

  function safeName(value,fallback='3615_bleus'){
    const s=String(value||fallback).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'').replace(/_+/g,'_');
    return s||fallback;
  }
  function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(r.error||new Error('Lecture image impossible'));r.readAsDataURL(blob);});}
  async function assetToDataUrl(src){
    const raw=String(src||'').trim();if(!raw||/^data:/i.test(raw))return raw||TRANSPARENT;
    let url;try{url=new URL(raw,document.baseURI).href;}catch{return TRANSPARENT;}
    if(assetCache.has(url))return assetCache.get(url);
    const task=(async()=>{
      try{
        const same=new URL(url).origin===location.origin;
        const res=await fetch(url,{mode:'cors',credentials:same?'same-origin':'omit',cache:'force-cache'});
        if(!res.ok)throw new Error(`HTTP ${res.status}`);
        const type=String(res.headers.get('content-type')||'');
        if(type&&!/^image\//i.test(type)&&!/svg/i.test(type))throw new Error(`Type ${type}`);
        return await blobToDataUrl(await res.blob());
      }catch(err){console.warn('3615 export · asset non intégrable',url,err);return TRANSPARENT;}
    })();assetCache.set(url,task);return task;
  }
  async function inlineCssUrls(value){
    const raw=String(value||'');if(!/url\(/i.test(raw))return raw;
    const hits=[...raw.matchAll(/url\((['"]?)(.*?)\1\)/gi)];let out=raw;
    for(const hit of hits){const src=String(hit[2]||'').trim();if(!src||/^data:/i.test(src))continue;const data=await assetToDataUrl(src);out=out.replace(hit[0],`url("${data}")`);}
    return out;
  }
  function copyComputedStyles(source,clone){
    const a=[source,...source.querySelectorAll('*')],b=[clone,...clone.querySelectorAll('*')];
    for(let i=0;i<b.length;i++){
      const src=a[i],dst=b[i];if(!src||!dst||dst.nodeType!==1)continue;
      const cs=getComputedStyle(src);
      for(const prop of STYLE_PROPS){try{const v=cs[prop];if(v!==undefined&&v!==null&&v!=='')dst.style[prop]=v;}catch{}}
      dst.style.animation='none';dst.style.transition='none';dst.style.caretColor='transparent';dst.style.contentVisibility='visible';dst.style.contain='none';
      if(src instanceof HTMLInputElement){dst.setAttribute('value',src.value||'');if(src.checked)dst.setAttribute('checked','checked');else dst.removeAttribute('checked');}
      if(src instanceof HTMLTextAreaElement)dst.textContent=src.value||'';
      if(src instanceof HTMLSelectElement){const opts=[...dst.options];opts.forEach((o,n)=>o.selected=src.options[n]?.selected||false);}
    }
  }
  async function inlineAssets(clone){
    const imgs=[...clone.querySelectorAll('img')];
    await Promise.all(imgs.map(async img=>{
      const src=img.getAttribute('src')||img.src||'';
      img.setAttribute('src',await assetToDataUrl(src));
      img.removeAttribute('srcset');img.removeAttribute('sizes');img.removeAttribute('loading');img.removeAttribute('crossorigin');img.decoding='sync';
    }));
    const svgImages=[...clone.querySelectorAll('svg image')];
    await Promise.all(svgImages.map(async n=>{const src=n.getAttribute('href')||n.getAttribute('xlink:href')||'';if(src)n.setAttribute('href',await assetToDataUrl(src));n.removeAttribute('xlink:href');}));
    const nodes=[clone,...clone.querySelectorAll('*')];
    await Promise.all(nodes.map(async n=>{if(!n?.style)return;const bg=n.style.backgroundImage;if(/url\(/i.test(bg))n.style.backgroundImage=await inlineCssUrls(bg);}));
  }
  function materializeScorelines(clone){
    clone.querySelectorAll('.b3k-scoreline').forEach(line=>{
      const teams=[...line.querySelectorAll('.b3k-scoreline-team')],center=line.querySelector('.b3k-scoreline-center')?.textContent?.trim()||'VS';
      const side=(team,right=false)=>{const name=team?.querySelector('.b3k-scoreline-name')?.textContent?.trim()||'';const img=team?.querySelector('img')?.cloneNode(true);const flag=img?img.outerHTML:'';return `<span style="min-width:0;display:flex;align-items:center;justify-content:${right?'flex-start':'flex-end'};gap:8px;color:#17375e;font:800 13px/1.15 Poppins,Arial,sans-serif;white-space:nowrap;overflow:hidden">${right?'':flag}<span style="overflow:hidden;text-overflow:ellipsis">${cssEscape(name)}</span>${right?flag:''}</span>`;};
      const centerBg=line.classList.contains('is-win')?'linear-gradient(180deg,#238654,#17683f)':line.classList.contains('is-draw')?'linear-gradient(180deg,#f5d95d,#e5b938)':line.classList.contains('is-loss')?'linear-gradient(180deg,#df4a55,#b82d3b)':'linear-gradient(180deg,#fffef6,#ece8d8)';
      const centerColor=line.classList.contains('is-win')||line.classList.contains('is-loss')?'#fff':'#09245c';
      const simple=document.createElement('div');simple.setAttribute('data-export-scoreline','1');simple.style.cssText='display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);gap:12px;align-items:center;width:100%;box-sizing:border-box;padding:4px 10px;overflow:hidden';
      simple.innerHTML=`${side(teams[0])}<strong style="display:grid;place-items:center;min-width:64px;height:40px;padding:0 10px;border:2px solid #0c2354;border-radius:8px;background:${centerBg};color:${centerColor};font:900 15px/1 Poppins,Arial,sans-serif;white-space:nowrap;box-sizing:border-box">${cssEscape(center)}</strong>${side(teams[1],true)}`;
      line.replaceWith(simple);
    });
  }
  function colorRgb(value,fallback){
    try{const c=document.createElement('canvas').getContext('2d');c.fillStyle=fallback;c.fillStyle=String(value||fallback).trim();const v=c.fillStyle;if(/^#[0-9a-f]{6}$/i.test(v))return [parseInt(v.slice(1,3),16),parseInt(v.slice(3,5),16),parseInt(v.slice(5,7),16)];if(/^#[0-9a-f]{3}$/i.test(v))return [...v.slice(1)].map(x=>parseInt(x+x,16));const m=v.match(/rgba?\((\d+)\D+(\d+)\D+(\d+)/i);if(m)return [Number(m[1]),Number(m[2]),Number(m[3])];}catch{}return colorRgb(fallback,'#174f9e');
  }
  function mixedHex(a,b,t){const A=colorRgb(a,'#cf3046'),B=colorRgb(b,'#174f9e'),x=Math.max(0,Math.min(1,t));return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*x).toString(16).padStart(2,'0')).join('');}
  function materializeTeamType(clone){
    clone.querySelectorAll('.team-type-ring').forEach(ring=>{
      const host=ring.closest('.team-type-index'),raw=parseFloat(host?.style.getPropertyValue('--tt-progress')||getComputedStyle(host||ring).getPropertyValue('--tt-progress')||'0')||0,p=Math.min(100,Math.max(0,raw));
      const cs=getComputedStyle(host||ring),end=host?.style.getPropertyValue('--tt-end')||cs.getPropertyValue('--tt-end')||'#174f9e',start=host?.style.getPropertyValue('--tt-start')||cs.getPropertyValue('--tt-start')||'#cf3046',label=ring.querySelector('strong')?.textContent?.trim()||String(Math.round(p));
      const steps=40,step=100/steps,active=Math.ceil(p/step),arcs=[];
      for(let i=0;i<active;i++){const begin=i*step,len=Math.max(0,Math.min(step,p-begin));if(len<=0)break;const color=mixedHex(start,end,p>0?Math.min(1,(begin+len/2)/p):0);arcs.push(`<circle cx="29" cy="29" r="24" fill="none" stroke="${color}" stroke-width="7" pathLength="100" stroke-dasharray="${Math.max(.15,len-.28)} ${100-Math.max(.15,len-.28)}" stroke-dashoffset="${-begin}" transform="rotate(-90 29 29)"/>`);}
      const outer=document.createElement('span');outer.style.cssText='display:grid;place-items:center;width:52px;height:52px;position:relative;box-sizing:border-box';outer.innerHTML=`<svg xmlns="${SVG_NS}" viewBox="0 0 58 58" width="52" height="52" aria-hidden="true"><circle cx="29" cy="29" r="24" fill="#fff" stroke="#e7ecf3" stroke-width="7"/>${arcs.join('')}</svg><strong style="position:absolute;inset:0;display:grid;place-items:center;color:#102b50;font:900 19px/1 Staatliches,Poppins,Arial,sans-serif">${cssEscape(label)}</strong>`;ring.replaceWith(outer);
    });
  }
  function materializePseudoIcons(clone){
    clone.querySelectorAll('.match-event-icon-ball').forEach(n=>{const s=document.createElement('span');s.textContent='⚽';s.style.cssText='display:grid;place-items:center;width:20px;height:20px;font-size:15px;line-height:1';n.replaceWith(s);});
    clone.querySelectorAll('.match-sheet-pitch-icon').forEach(n=>{const s=document.createElement('span');s.style.cssText='display:grid;place-items:center;width:28px;height:22px;color:#174d87';s.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 24" width="28" height="22" aria-hidden="true"><rect x="1" y="1" width="30" height="22" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M16 1v22M1 7h5v10H1M31 7h-5v10h5" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="16" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';n.replaceWith(s);});
  }
  function defaultPrepare(clone){
    clone.querySelectorAll('iframe,video,source,script,noscript').forEach(n=>n.remove());
    materializeScorelines(clone);materializeTeamType(clone);materializePseudoIcons(clone);
  }
  function safeScale(width,height,requested){
    const dpr=Math.max(1,Math.min(3,Number(window.devicePixelRatio)||2)),want=Math.max(1,Number(requested)||dpr||2),maxDim=8192,maxPixels=15000000;
    return Math.max(1,Math.min(want,maxDim/Math.max(1,width),maxDim/Math.max(1,height),Math.sqrt(maxPixels/Math.max(1,width*height))));
  }
  function downloadBlob(blob,filename){
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=safeName(filename||'3615_bleus.png');a.rel='noopener';a.style.display='none';document.body.appendChild(a);a.click();
    setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},5000);
  }
  async function rasterize(element,options={}){
    if(!(element instanceof Element))throw new Error('Élément export introuvable.');
    await document.fonts?.ready?.catch?.(()=>{});
    const previousCV=element.style.contentVisibility,previousContain=element.style.contain;element.style.contentVisibility='visible';element.style.contain='none';
    try{
      const rect=element.getBoundingClientRect(),width=Math.max(280,Math.ceil(Number(options.width)||rect.width||element.scrollWidth||0));
      const clone=element.cloneNode(true);copyComputedStyles(element,clone);clone.classList.add('b3k-export-root');clone.style.width=`${width}px`;clone.style.maxWidth='none';clone.style.margin='0';clone.style.contentVisibility='visible';clone.style.contain='none';
      defaultPrepare(clone);if(typeof options.prepareClone==='function')await options.prepareClone(clone,element);
      await inlineAssets(clone);
      const pad=Math.max(0,Number(options.padding??18)),stage=document.createElement('div');stage.setAttribute('aria-hidden','true');stage.style.cssText=`position:fixed;left:-100000px;top:0;width:${width}px;padding:${pad}px;background:${options.background||'#fff'};box-sizing:content-box;z-index:-2147483647;pointer-events:none;content-visibility:visible;contain:none;`;stage.appendChild(clone);document.body.appendChild(stage);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const exportWidth=Math.ceil(width+pad*2),height=Math.max(1,Math.ceil(stage.scrollHeight));
      const serialized=new XMLSerializer().serializeToString(clone);stage.remove();
      const guard=`.b3k-export-root,.b3k-export-root *{animation:none!important;transition:none!important;caret-color:transparent!important;content-visibility:visible!important}.b3k-export-root *::before,.b3k-export-root *::after{content:none!important;display:none!important}`;
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth}" height="${height}" viewBox="0 0 ${exportWidth} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${exportWidth}px;min-height:${height}px;box-sizing:border-box;background:${options.background||'#fff'};padding:${pad}px"><style>${guard}</style>${serialized}</div></foreignObject></svg>`;
      const img=new Image(),svgUrl=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Le navigateur n’a pas pu rasteriser le rendu SVG.'));img.src=svgUrl;});
      const scale=safeScale(exportWidth,height,options.scale),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(exportWidth*scale));canvas.height=Math.max(1,Math.round(height*scale));
      const ctx=canvas.getContext('2d',{alpha:options.format!=='jpg'});ctx.setTransform(scale,0,0,scale,0,0);ctx.fillStyle=options.background||'#fff';ctx.fillRect(0,0,exportWidth,height);ctx.drawImage(img,0,0,exportWidth,height);
      try{canvas.toDataURL('image/png');}catch{throw new Error('Une image distante ne fournit pas les autorisations CORS nécessaires à l’export.');}
      const format=options.format==='jpg'?'jpg':'png',mime=format==='jpg'?'image/jpeg':'image/png',quality=format==='jpg'?Number(options.quality||.94):undefined;
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Le navigateur a généré une image vide.')),mime,quality));
      return {blob,width:exportWidth,height,scale,canvas};
    }finally{element.style.contentVisibility=previousCV;element.style.contain=previousContain;}
  }
  async function canvasToBlob(canvas,options={}){
    if(!(canvas instanceof HTMLCanvasElement))throw new Error('Canvas export introuvable.');
    const format=options.format==='jpg'?'jpg':'png',mime=format==='jpg'?'image/jpeg':'image/png',quality=format==='jpg'?Number(options.quality||.94):undefined;
    try{canvas.toDataURL('image/png');}catch{throw new Error('Une ressource externe empêche la lecture du canvas (CORS).');}
    return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Le navigateur a généré une image vide.')),mime,quality));
  }
  async function downloadCanvas(canvas,options={}){
    const format=options.format==='jpg'?'jpg':'png',filename=safeName(String(options.filename||'3615_bleus').replace(/\.(png|jpe?g)$/i,''))+`.${format==='jpg'?'jpg':'png'}`;
    const blob=await canvasToBlob(canvas,{...options,format});downloadBlob(blob,filename);return {blob,filename,width:canvas.width,height:canvas.height};
  }
  async function exportElement(element,options={}){
    const format=options.format==='jpg'?'jpg':'png',filename=safeName(String(options.filename||'3615_bleus').replace(/\.(png|jpe?g)$/i,''))+`.${format==='jpg'?'jpg':'png'}`;
    const result=await rasterize(element,{...options,format});downloadBlob(result.blob,filename);return {...result,filename};
  }
  window.BLEUS3000_EXPORT={version:'1.3.7',safeName,assetToDataUrl,rasterize,exportElement,canvasToBlob,downloadCanvas,downloadBlob,safeScale};
})();
