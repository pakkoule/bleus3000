/* 3615 Bleus V1.2.2 — Éphéméride · anniversaires, décès, matchs */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let host=null,open=false,players=[],staff=[],matches=[];
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
    if(!host){host=document.createElement('section');host.id='c3kEphemeride';host.className='c3k-ephemeride';rail.appendChild(host);}
    window.BLEUS3000_NAVIGATION?.mount?.(host);
    return host;
  }
  function fmtShort(iso){const d=new Date(iso);if(Number.isNaN(+d))return '';return new Intl.DateTimeFormat('fr-FR',{year:'numeric'}).format(d);}
  function matchLabel(m){
    const eff=(k)=>store()?.effective?.(m,k)??m?.[k];
    const opp=String(eff('opponent_name')||m?.opponent?.name||'Adversaire');
    const sel='France A';
    return m?.home_away==='away'?`${opp} – ${sel}`:`${sel} – ${opp}`;
  }
  function events(){
    const key=currentMd(),out=[];
    for(const p of players){
      if(p.birth_date&&md(`${p.birth_date}T12:00:00`)===key){const a=ageFrom(`${p.birth_date}T12:00:00`);out.push({kind:'player',priority:1,id:p.id,icon:'🎂',title:p.display_name||'Joueur',meta:a?`${a} ans aujourd’hui`:'Anniversaire'});}
      if(p.death_date&&md(`${p.death_date}T12:00:00`)===key){const n=yearsSince(`${p.death_date}T12:00:00`);out.push({kind:'player-death',priority:0,id:p.id,icon:'🕯️',title:p.display_name||'Joueur',meta:`Décès · ${fmtShort(`${p.death_date}T12:00:00`)}${n?` · il y a ${n} an${n>1?'s':''}`:''}`});}
    }
    for(const p of staff){if(p.death_date&&md(`${p.death_date}T12:00:00`)===key){const n=yearsSince(`${p.death_date}T12:00:00`);out.push({kind:'staff-death',priority:0,id:p.id,icon:'🕯️',title:p.display_name||'Staff',meta:`Staff · décès · ${fmtShort(`${p.death_date}T12:00:00`)}${n?` · il y a ${n} an${n>1?'s':''}`:''}`});}}
    for(const m of matches){const date=store()?.effective?.(m,'match_date')??m?.match_date;if(date&&year(date)<today().getFullYear()&&md(date)===key){const n=yearsSince(date);out.push({kind:'match',priority:2,id:m.id,icon:'⚽',title:matchLabel(m),meta:`${fmtShort(date)}${n?` · il y a ${n} an${n>1?'s':''}`:''}`});}}
    return out.sort((a,b)=>(a.priority??9)-(b.priority??9)||a.title.localeCompare(b.title,'fr')).slice(0,30);
  }
  function render(){
    ensure();if(!host)return;const rows=events();
    host.innerHTML=`<button type="button" class="c3k-ephemeride-toggle" data-ephemeride-toggle><span>📆 Éphéméride</span><span class="c3k-ephemeride-count">${rows.length}</span><span>${open?'▴':'▾'}</span></button><div class="c3k-ephemeride-panel" ${open?'':'hidden'}>${rows.length?`<div class="c3k-ephemeride-date">${new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(today())}</div><div class="c3k-ephemeride-list">${rows.map(r=>`<button type="button" class="c3k-ephemeride-item" data-ephemeride-kind="${r.kind}" data-ephemeride-id="${esc(r.id)}"><span>${r.icon}</span><span><strong>${esc(r.title)}</strong><small>${esc(r.meta)}</small></span><b>›</b></button>`).join('')}</div>`:'<div class="c3k-ephemeride-empty">Aucun anniversaire, hommage ou match historique enregistré aujourd’hui.</div>'}</div>`;
    $('[data-ephemeride-toggle]',host)?.addEventListener('click',()=>{open=!open;render();});
    host.querySelectorAll('[data-ephemeride-kind]').forEach(b=>b.addEventListener('click',()=>{const kind=b.dataset.ephemerideKind,id=b.dataset.ephemerideId;if(kind==='player'||kind==='player-death'){window.BLEUS3000_PLAYERS_DB?.openPlayer?.(id);return;}if(kind==='staff-death'){const p=staff.find(x=>String(x.id)===String(id));window.BLEUS3000_APP?.openReferences?.('staff');setTimeout(()=>{const input=$('#referenceSearch');if(input){input.value=p?.display_name||'';input.dispatchEvent(new Event('input',{bubbles:true}));}},100);return;}store()?.openMatch?.(id);}));
  }
  async function load(){
    ensure();const c=client();
    if(c){const [{data:pd,error:pe},{data:sd,error:se}]=await Promise.all([c.from('players').select('id,display_name,birth_date,death_date').limit(5000),c.from('personnel').select('id,display_name,birth_date,death_date,person_type').eq('person_type','selectionneur').limit(5000)]);if(!pe)players=(pd||[]).filter(x=>x.birth_date||x.death_date);if(!se)staff=(sd||[]).filter(x=>x.death_date);}
    try{matches=await store()?.load?.()||store()?.matches||[];}catch{matches=store()?.matches||[];}
    render();
  }
  function init(){ensure();load().catch(e=>{console.warn('Éphéméride',e);render();});window.addEventListener('bleus:matches-ready',e=>{matches=e.detail?.matches||[];render();});window.addEventListener('bleus:supabase-ready',()=>load().catch(()=>{}));}
  window.BLEUS3000_EPHEMERIDE={refresh:load,render};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
