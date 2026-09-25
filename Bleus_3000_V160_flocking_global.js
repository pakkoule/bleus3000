/* 3615 Bleus V1.1.60.1 — flocages PNG réels · préférence globale */
(() => {
  'use strict';
  const STYLE_KEY='bleus3000.flockingStyle';
  const STYLES=[{"id": "france-1970", "key": "france-1970", "name": "France 1970", "label": "France 1970"}, {"id": "france-1980", "key": "france-1980", "name": "France 1980", "label": "France 1980"}, {"id": "france-2000", "key": "france-2000", "name": "France 2000", "label": "France 2000"}, {"id": "france-2002-04", "key": "france-2002-04", "name": "France 2002-04", "label": "France 2002-04"}, {"id": "france-2006", "key": "france-2006", "name": "France 2006", "label": "France 2006"}, {"id": "france-2008", "key": "france-2008", "name": "France 2008", "label": "France 2008"}, {"id": "france-2010", "key": "france-2010", "name": "France 2010", "label": "France 2010"}, {"id": "france-2011", "key": "france-2011", "name": "France 2011", "label": "France 2011"}, {"id": "france-2012", "key": "france-2012", "name": "France 2012", "label": "France 2012"}, {"id": "france-2014", "key": "france-2014", "name": "France 2014", "label": "France 2014"}, {"id": "france-2016", "key": "france-2016", "name": "France 2016", "label": "France 2016"}, {"id": "france-2018-2", "key": "france-2018-2", "name": "France 2018-2", "label": "France 2018-2"}, {"id": "france-2018", "key": "france-2018", "name": "France 2018", "label": "France 2018"}, {"id": "france-2020", "key": "france-2020", "name": "France 2020", "label": "France 2020"}, {"id": "france-2022", "key": "france-2022", "name": "France 2022", "label": "France 2022"}, {"id": "france-2024", "key": "france-2024", "name": "France 2024", "label": "France 2024"}, {"id": "france-96", "key": "france-96", "name": "France 96", "label": "France 96"}, {"id": "france-a-2026", "key": "france-a-2026", "name": "France A 2026", "label": "France A 2026"}, {"id": "france-h-2026", "key": "france-h-2026", "name": "France H 2026", "label": "France H 2026"}, {"id": "france-retro-90s", "key": "france-retro-90s", "name": "France Retro 90s", "label": "France Retro 90s"}, {"id": "olympique-2024", "key": "olympique-2024", "name": "Olympique 2024", "label": "Olympique 2024"}, {"id": "w-france-2021", "key": "w-france-2021", "name": "W France 2021", "label": "W France 2021"}, {"id": "w-france-2023", "key": "w-france-2023", "name": "W France 2023", "label": "W France 2023"}];
  const LEGACY={"retro-france-90s": "france-retro-90s", "france-1998": "france-retro-90s", "euro-2000": "france-2000", "wc-2002-euro-2004": "france-2002-04", "wc-2006": "france-2006", "euro-2008": "france-2008", "wc-2010": "france-2010", "euro-2012": "france-2012", "wc-2014": "france-2014", "euro-2016": "france-2016", "wc-2018": "france-2018", "euro-2020": "france-2020", "wc-2022": "france-2022", "wc-2023": "w-france-2023", "euro-2024": "france-2024", "euro-2025": "w-france-2023", "wc-2026-home": "france-h-2026", "wc-2026-away": "france-a-2026"};
  const styleMap=new Map(STYLES.map(s=>[s.id,s]));
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>Array.from(p.querySelectorAll(s));
  const normalizeStyle=id=>{const raw=String(id||'');if(styleMap.has(raw))return raw;const mapped=LEGACY[raw];if(mapped&&styleMap.has(mapped))return mapped;return 'france-2024';};
  let currentStyle=normalizeStyle(localStorage.getItem(STYLE_KEY)||'france-2024');

  function assetUrl(styleId,digit){return `flocages_assets/${normalizeStyle(styleId||currentStyle)}/${String(digit).replace(/[^0-9]/g,'')}.png`;}
  function digitsHtml(value,styleId=currentStyle,cls='b3k-flock-digit'){
    const digits=String(value??'').replace(/[^0-9]/g,'');
    return digits.split('').map(d=>`<img class="${cls}" src="${assetUrl(styleId,d)}" alt="" aria-hidden="true">`).join('');
  }
  function numberHtml(value,opts={}){
    const size=opts.size||'md',style=normalizeStyle(opts.styleId||currentStyle);
    return `<span class="b3k-flock-number b3k-size-${size}" data-b3k-number="${String(value)}" data-style-id="${style}">${digitsHtml(value,style)}</span>`;
  }
  function renderNumber(value,opts={}){const tmp=document.createElement('div');tmp.innerHTML=numberHtml(value,opts);return tmp.firstElementChild;}

  function refreshKnownNumberViews(root=document){
    $$('.selection-jersey-visual[data-jersey-number]',root).forEach(card=>{
      const n=card.dataset.jerseyNumber,host=$('.selection-jersey-digits',card);if(host)host.innerHTML=digitsHtml(n,currentStyle);
    });
    $$('.players-db-jersey-capsule',root).forEach(card=>{
      const m=String(card.getAttribute('aria-label')||card.getAttribute('title')||'').match(/(\d{1,3})/);const host=$('.players-db-jersey-digits',card);if(m&&host)host.innerHTML=digitsHtml(m[1],currentStyle);
    });
    $$('.team-jersey-num[data-number]',root).forEach(host=>{host.innerHTML=digitsHtml(host.dataset.number,currentStyle,'team-flock-digit');});
    document.documentElement.setAttribute('data-b3k-flocking-style',currentStyle);
  }
  function setStyle(id,opts={}){
    currentStyle=normalizeStyle(id);localStorage.setItem(STYLE_KEY,currentStyle);refreshKnownNumberViews();
    if(!opts.silent)window.dispatchEvent(new CustomEvent('bleus:flocking-style-changed',{detail:{style:currentStyle}}));
    return currentStyle;
  }
  async function syncAccountPreference(){
    try{const prefs=await window.C3K_ACCOUNT_PREFS?.get?.();if(prefs?.jersey_number_style)setStyle(prefs.jersey_number_style,{silent:true});}catch{}
  }
  function scheduleRefresh(){window.setTimeout(()=>refreshKnownNumberViews(),60);}

  window.BLEUS3000_FLOCKAGE_STYLES=STYLES;
  window.BLEUS3000_FLOCKING={styles:STYLES,getStyle:()=>currentStyle,setStyle,normalizeStyle,assetUrl,digitsHtml,numberHtml,renderNumber,refresh:refreshKnownNumberViews};

  window.addEventListener('c3k:preferences-changed',e=>{if(e.detail?.jersey_number_style)setStyle(e.detail.jersey_number_style,{silent:true});});
  ['bleus:player-registry','bleus:matches-ready','bleus:relational-registry'].forEach(ev=>window.addEventListener(ev,scheduleRefresh));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{refreshKnownNumberViews();syncAccountPreference();},{once:true});else{refreshKnownNumberViews();syncAccountPreference();}
})();
