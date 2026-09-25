/* 3615 Bleus V1.1.61.11 — Éphéméride du jour · fermée par défaut */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let host=null,open=false,players=[],matches=[];
  const client=()=>window.BLEUS3000_SUPABASE||null;
  const store=()=>window.BLEUS3000_RELATIONAL_REFS;
  const today=()=>new Date();
  const md=d=>{const x=new Date(d);return Number.isNaN(+x)?'':`${x.getMonth()+1}-${x.getDate()}`;};
  const year=d=>{const x=new Date(d);return Number.isNaN(+x)?null:x.getFullYear();};
  const currentMd=()=>`${today().getMonth()+1}-${today().getDate()}`;
  const ageFrom=d=>{const y=year(d);return y?today().getFullYear()-y:null;};
  const yearsSince=d=>{const y=year(d);return y?today().getFullYear()-y:null;};
  function ensure(){
    const rail=$('#c3kTopLeftRail')||$('#c3kV8AccountShell')?.parentElement;if(!rail)return null;
    if(!host){host=document.createElement('section');host.id='c3kEphemeride';host.className='c3k-ephemeride';rail.appendChild(host);}return host;
  }
  function fmtShort(iso){const d=new Date(iso);if(Number.isNaN(+d))return '';return new Intl.DateTimeFormat('fr-FR',{year:'numeric'}).format(d);}
  function matchLabel(m){
    const eff=(k)=>store()?.effective?.(m,k)??m?.[k];
    const opp=String(eff('opponent_name')||m?.opponent?.name||'Adversaire');
    const sel=String(m?.selection?.name||m?.selection_category||'France').replace(/ Masculin$/,'').replace(/ Féminine$/,' F');
    return m?.home_away==='away'?`${opp} – ${sel}`:`${sel} – ${opp}`;
  }
  function events(){
    const key=currentMd(),out=[];
    for(const p of players){if(p.birth_date&&md(`${p.birth_date}T12:00:00`)===key){const a=ageFrom(`${p.birth_date}T12:00:00`);out.push({kind:'player',id:p.id,icon:'🎂',title:p.display_name||'Joueur',meta:a?`${a} ans aujourd’hui`:'Anniversaire'});}}
    for(const m of matches){const date=store()?.effective?.(m,'match_date')??m?.match_date;if(date&&year(date)<today().getFullYear()&&md(date)===key){const n=yearsSince(date);out.push({kind:'match',id:m.id,icon:'⚽',title:matchLabel(m),meta:`${fmtShort(date)}${n?` · il y a ${n} an${n>1?'s':''}`:''}`});}}
    return out.sort((a,b)=>a.kind===b.kind?a.title.localeCompare(b.title,'fr'):a.kind==='player'?-1:1).slice(0,30);
  }
  function render(){
    ensure();if(!host)return;const rows=events();
    host.innerHTML=`<button type="button" class="c3k-ephemeride-toggle" data-ephemeride-toggle><span>📆 Éphéméride</span><span class="c3k-ephemeride-count">${rows.length}</span><span>${open?'▴':'▾'}</span></button><div class="c3k-ephemeride-panel" ${open?'':'hidden'}>${rows.length?`<div class="c3k-ephemeride-date">${new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(today())}</div><div class="c3k-ephemeride-list">${rows.map(r=>`<button type="button" class="c3k-ephemeride-item" data-ephemeride-kind="${r.kind}" data-ephemeride-id="${esc(r.id)}"><span>${r.icon}</span><span><strong>${esc(r.title)}</strong><small>${esc(r.meta)}</small></span><b>›</b></button>`).join('')}</div>`:'<div class="c3k-ephemeride-empty">Aucun anniversaire ou match historique enregistré aujourd’hui.</div>'}</div>`;
    $('[data-ephemeride-toggle]',host)?.addEventListener('click',()=>{open=!open;render();});
    host.querySelectorAll('[data-ephemeride-kind]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.ephemerideKind==='player')window.BLEUS3000_PLAYERS_DB?.openPlayer?.(b.dataset.ephemerideId);else store()?.openMatch?.(b.dataset.ephemerideId);}));
  }
  async function load(){
    ensure();const c=client();
    if(c){const {data,error}=await c.from('players').select('id,display_name,birth_date').not('birth_date','is',null);if(!error)players=data||[];}
    try{matches=await store()?.load?.()||store()?.matches||[];}catch{matches=store()?.matches||[];}
    render();
  }
  function init(){ensure();load().catch(e=>{console.warn('Éphéméride',e);render();});window.addEventListener('bleus:matches-ready',e=>{matches=e.detail?.matches||[];render();});window.addEventListener('bleus:supabase-ready',()=>load().catch(()=>{}));}
  window.BLEUS3000_EPHEMERIDE={refresh:load,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
