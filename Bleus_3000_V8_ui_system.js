/* Bleus 3000 V1.1.1 — système UI léger */
(() => {
  'use strict';
  const ICONS={
    user:'<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"/>',
    bell:'<path d="M6.5 9.8a5.5 5.5 0 0 1 11 0v3.7l1.5 2.3H5l1.5-2.3z"/><path d="M10 19h4"/>',
    flag:'<path d="M5 21V4"/><path d="M5 5h10l-1.4 3L15 11H5"/>',
    star:'<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    book:'<path d="M4 5.5c2.8-.8 5.4-.2 8 1.5v12c-2.6-1.7-5.2-2.3-8-1.5z"/><path d="M20 5.5c-2.8-.8-5.4-.2-8 1.5v12c2.6-1.7 5.2-2.3 8-1.5z"/><path d="M12 7v12"/>',
    grid:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'
  };
  function svg(name){return `<svg class="c3k-ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]||ICONS.grid}</svg>`;}
  function hydrate(root=document){root.querySelectorAll?.('[data-c3k-icon]').forEach(n=>{const name=n.dataset.c3kIcon||'grid';if(n.dataset.c3kIconHydrated===name)return;n.innerHTML=svg(name);n.dataset.c3kIconHydrated=name;});}
  function init(){hydrate();new MutationObserver(()=>hydrate()).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-c3k-icon']});}
  window.C3K_UI={icons:ICONS,svg,hydrate,updateSpace:()=>{}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
