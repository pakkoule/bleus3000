/* Bleus 3000 V1.1.1 — raccourcis favoris du profil */
(() => {
  'use strict';
  const options=[
    {key:'selections',label:'Sélections',icon:'👤',selector:'[data-reference-open="selections"]'},
    {key:'convocations',label:'Convocations',icon:'📋',selector:'[data-reference-open="convocations"]'},
    {key:'matchs',label:'Matchs',icon:'⚽',selector:'[data-reference-open="matchs"]'},
    {key:'competitions',label:'Compétitions',icon:'🏆',selector:'[data-reference-open="competitions"]'},
    {key:'adversaires',label:'Adversaires',icon:'🌍',selector:'[data-reference-open="adversaires"]'},
    {key:'personnel',label:'Personnel & Officiels',icon:'👥',selector:'[data-reference-open="personnel"]'},
    {key:'equipements',label:'Équipements',icon:'👕',selector:'[data-reference-open="equipements"]'},
    {key:'statistiques',label:'Statistiques',icon:'📊',selector:'[data-reference-open="statistiques"]'},
    {key:'lieux',label:'Lieux',icon:'📍',selector:'[data-reference-open="lieux"]'},
    {key:'bibliographie',label:'Bibliographie & Médias',icon:'📚',selector:'[data-reference-open="bibliographie"]'},
    {key:'xi',label:'Créer un Onze',icon:'⚽',selector:'[data-tool-open="xi"]'},
    {key:'five',label:'Créer un Five',icon:'⑤',selector:'[data-tool-open="five"]'},
    {key:'liste',label:'Créer une Liste',icon:'📋',selector:'[data-tool-open="list"]'}
  ];
  const prefKey='bleus3000.preferences.local.v1';
  const cleanValues=v=>Array.isArray(v)?[...new Set(v.filter(x=>options.some(o=>o.key===x)))].slice(0,3):[];
  function localPrefs(){try{return JSON.parse(localStorage.getItem(prefKey)||'{}');}catch{return {};}}
  function selected(){return cleanValues(localPrefs().profile_shortcuts||[]);}
  function ensureHost(){let h=document.getElementById('c3kProfileShortcuts');const rail=document.getElementById('compactToolbar')||document.getElementById('c3kTopLeftRail');if(!rail)return null;if(!h){h=document.createElement('section');h.id='c3kProfileShortcuts';h.className='c3k-profile-shortcuts';rail.appendChild(h);}else if(h.parentElement!==rail){rail.appendChild(h);}return h;}
  function render(){const h=ensureHost();if(!h)return;const state=window.C3K_ACCOUNT_STATE||{},vals=selected();if(!state.profile||!vals.length){h.hidden=true;h.innerHTML='';return;}h.hidden=false;h.innerHTML=`<div class="c3k-profile-shortcuts-title">★ Mes raccourcis</div><div class="c3k-profile-shortcuts-grid">${vals.map(k=>{const o=options.find(x=>x.key===k);return `<button type="button" class="c3k-profile-shortcut" data-shortcut="${o.key}"><span class="c3k-profile-shortcut-icon">${o.icon}</span><span>${o.label}</span></button>`;}).join('')}</div>`;h.querySelectorAll('[data-shortcut]').forEach(b=>b.addEventListener('click',()=>{const o=options.find(x=>x.key===b.dataset.shortcut),t=o&&document.querySelector(o.selector);t?.click();}));}
  function setCache(values){const p=localPrefs();p.profile_shortcuts=cleanValues(values);localStorage.setItem(prefKey,JSON.stringify(p));render();}
  function init(){render();window.addEventListener('c3k:account-state',render);window.addEventListener('c3k:profile-shortcuts-changed',e=>{setCache(e.detail?.values||[]);});}
  window.C3K_PROFILE_SHORTCUTS={options,cleanValues,getSelected:selected,setCache};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
