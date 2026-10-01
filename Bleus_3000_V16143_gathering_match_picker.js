/* 3615 Bleus V1.1.67 — sélecteur de matchs robuste, passés et futurs */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const states=new WeakMap();
  let wasOpen=false,timer=0;
  const refs=()=>window.BLEUS3000_RELATIONAL_REFS;
  const gatherings=()=>window.BLEUS3000_GATHERINGS;
  const fmt=d=>{const x=new Date(d);return Number.isNaN(+x)?String(d||''):new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(x)};
  function opponent(m){return m?.opponent?.name||m?.manual_overrides?.opponent_name||'Adversaire';}
  function label(m){const opp=opponent(m);return m?.home_away==='away'?`${opp} – France`:`France – ${opp}`;}
  function searchable(m){return norm([label(m),m?.competition?.name,m?.competition?.edition,m?.sheet_competition_name,m?.match_date,new Date(m?.match_date||0).getFullYear()].filter(Boolean).join(' '));}
  function setSelected(st,id,value){if(value)st.chosen.add(String(id));else st.chosen.delete(String(id));}
  function render(st){
    const {host,input,counter,all,chosen}=st;
    const q=norm(input.value);
    const filtered=q?all.filter(m=>searchable(m).includes(q)):all;
    const selected=all.filter(m=>chosen.has(String(m.id)));
    const seen=new Set();
    const list=[...selected,...filtered].filter(m=>{const k=String(m.id);if(seen.has(k))return false;seen.add(k);return true;});
    const now=Date.now();
    host.innerHTML=list.length?list.map(m=>{
      const mid=String(m.id),checked=chosen.has(mid),past=new Date(m.match_date||0).getTime()<now;
      return `<div class="gathering-match-choice ${past?'is-past-match':''} ${checked?'is-selected-match':''}" role="checkbox" tabindex="0" aria-checked="${checked?'true':'false'}" data-gathering-match-choice="${esc(mid)}"><input type="checkbox" value="${esc(mid)}" ${checked?'checked':''} tabindex="-1" aria-hidden="true"><span><strong>${esc(label(m))}</strong><small>${esc(fmt(m.match_date))}${m?.competition?.name?` · ${esc(m.competition.name)}`:''}${past?' · Match passé':''}</small></span><i>${checked?'✓':''}</i></div>`;
    }).join(''):'<div class="gathering-empty">Aucun match correspondant.</div>';
    counter.textContent=q?`${filtered.length} résultat${filtered.length>1?'s':''} · tous sélectionnables`:`${all.length} matchs disponibles · passés et futurs sélectionnables`;
  }
  function toggleChoice(el,st){
    const id=String(el?.dataset.gatheringMatchChoice||'');if(!id)return;
    const next=!st.chosen.has(id);setSelected(st,id,next);render(st);
  }
  function enhance(){
    const modal=$('#gatheringEditorModal'),form=$('#gatheringEditorForm'),host=$('#gatheringMatchRows');
    if(!modal||modal.hidden||!form||!host)return;
    const id=String(form.elements.id?.value||'');
    let st=states.get(host);
    if(st?.callupId===id){render(st);return;}
    host.parentElement?.querySelectorAll(':scope > .gathering-match-search-wrap').forEach(x=>x.remove());
    const current=(gatherings()?.rows||[]).find(r=>String(r.id)===id);
    const chosen=new Set((current?.match_links||[]).map(x=>String(x.match_id)));
    $$('input:checked',host).forEach(x=>chosen.add(String(x.value)));
    const all=[...(refs()?.matches||[])].sort((a,b)=>new Date(b.match_date||0)-new Date(a.match_date||0));
    const wrap=document.createElement('div');
    wrap.className='gathering-match-search-wrap';
    wrap.innerHTML='<input type="search" autocomplete="off" placeholder="Rechercher n’importe quel match, année, adversaire ou compétition…"><span></span>';
    host.parentElement?.insertBefore(wrap,host);
    const input=$('input',wrap),counter=$('span',wrap);
    st={callupId:id,chosen,all,wrap,input,counter,host};states.set(host,st);
    input.addEventListener('input',()=>render(st));
    host.addEventListener('click',e=>{const el=e.target.closest('[data-gathering-match-choice]');if(!el)return;e.preventDefault();toggleChoice(el,st);});
    host.addEventListener('keydown',e=>{const el=e.target.closest('[data-gathering-match-choice]');if(!el||!['Enter',' '].includes(e.key))return;e.preventDefault();toggleChoice(el,st);});
    render(st);
    const small=host.closest('.gathering-editor-section')?.querySelector('header small');if(small)small.textContent='Tous les matchs France sont sélectionnables, y compris les matchs passés.';
  }
  function schedule(){
    const modal=$('#gatheringEditorModal'),open=Boolean(modal&&!modal.hidden);
    if(open&&!wasOpen){const host=$('#gatheringMatchRows');if(host){states.delete(host);host.parentElement?.querySelectorAll(':scope > .gathering-match-search-wrap').forEach(x=>x.remove());}}
    wasOpen=open;clearTimeout(timer);timer=setTimeout(enhance,40);
  }
  const obs=new MutationObserver(schedule);obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  window.addEventListener('bleus:gatherings-ready',()=>setTimeout(enhance,70));
  setTimeout(enhance,700);
})();
