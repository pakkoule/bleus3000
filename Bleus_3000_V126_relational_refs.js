/* Bleus 3000 V1.1.26 — Référentiels relationnels Espoirs : Matchs + Personnel/Officiels */
(() => {
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const S=window.BLEUS3000_SEARCH;
  const norm=v=>S?.normalize?S.normalize(v):String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const matchQuery=(q,vals)=>!String(q||'').trim()||(S?.matches?S.matches(q,vals,.5):vals.some(v=>norm(v).includes(norm(q))));
  let client=null,loaded=false,loading=null,selection=null,espoirsTag=null,matches=[],people=[],searchRegistry=[];

  async function waitClient(){for(let i=0;i<50;i++){client=window.BLEUS3000_SUPABASE||null;if(client)return client;await new Promise(r=>setTimeout(r,100));}return null;}
  const fmtDate=v=>{if(!v)return '—';const d=new Date(v+'T00:00:00');return Number.isNaN(+d)?v:d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});};
  function chip(t){if(!t)return '<span class="rel-tag-fallback">ESPOIRS</span>';if(window.BLEUS3000_TAGS?.chipHtml)return window.BLEUS3000_TAGS.chipHtml(t,'relational-espoirs-chip');const bg=t.appearance==='solid'?(t.color_start||'#2563eb'):`linear-gradient(${Number(t.gradient_angle||135)}deg,${t.color_start||'#123B8F'},${t.color_end||'#4dc6ff'})`;return `<span class="rel-tag-fallback" style="background:${bg};color:${esc(t.text_color||'#fff')};border-color:${esc(t.border_color||'#123B8F')}">${esc(t.icon_text||'🇫🇷')} ${esc(t.label_text||'ESPOIRS')}</span>`;}
  function resultLetter(m){const a=Number(m.france_score),b=Number(m.opponent_score);if(!Number.isFinite(a)||!Number.isFinite(b))return '—';return a>b?'V':a<b?'D':'N';}
  function scoreClass(m){const r=resultLetter(m);return r==='V'?'is-win':r==='D'?'is-loss':r==='N'?'is-draw':'';}
  async function load(){
    if(loaded)return;if(loading)return loading;loading=(async()=>{
      if(!await waitClient())throw new Error('Supabase indisponible');
      const [{data:teams,error:te},{data:tagRows,error:tge}]=await Promise.all([
        client.from('selection_teams').select('id,code,name,team_tag_id').eq('code','FRA-ESP-M').limit(1),
        client.from('tags').select('*').eq('slug','espoirs').limit(1)
      ]);if(te)throw te;if(tge)throw tge;selection=teams?.[0]||null;espoirsTag=tagRows?.[0]||null;if(!selection)throw new Error('Sélection Espoirs introuvable');
      const [{data:mm,error:me},{data:pp,error:pe}]=await Promise.all([
        client.from('matches').select('id,match_date,home_away,france_score,opponent_score,status,notes_short,phase,spectators,lineup_status,source_calendar_url,source_detail_url,opponent_id,competition_id,place_id,coach_id,external_ids').eq('selection_team_id',selection.id).order('match_date',{ascending:false}).limit(1000),
        client.from('espoirs_personnel_stats').select('*').order('display_name').limit(1000)
      ]);if(me)throw me;if(pe)throw pe;
      const oppIds=[...new Set((mm||[]).map(x=>x.opponent_id).filter(Boolean))],compIds=[...new Set((mm||[]).map(x=>x.competition_id).filter(Boolean))],placeIds=[...new Set((mm||[]).map(x=>x.place_id).filter(Boolean))],coachIds=[...new Set((mm||[]).map(x=>x.coach_id).filter(Boolean))];
      const [oo,cc,ll,hh]=await Promise.all([
        oppIds.length?client.from('opponents').select('id,name').in('id',oppIds):Promise.resolve({data:[]}),
        compIds.length?client.from('competitions').select('id,name').in('id',compIds):Promise.resolve({data:[]}),
        placeIds.length?client.from('places').select('id,name,city').in('id',placeIds):Promise.resolve({data:[]}),
        coachIds.length?client.from('personnel').select('id,display_name').in('id',coachIds):Promise.resolve({data:[]})
      ]);
      const om=new Map((oo.data||[]).map(x=>[x.id,x])),cm=new Map((cc.data||[]).map(x=>[x.id,x])),lm=new Map((ll.data||[]).map(x=>[x.id,x])),hm=new Map((hh.data||[]).map(x=>[x.id,x]));
      matches=(mm||[]).map(x=>({...x,opponent:om.get(x.opponent_id)||null,competition:cm.get(x.competition_id)||null,place:lm.get(x.place_id)||null,coach:hm.get(x.coach_id)||null}));people=pp||[];
      const d=window.BLEUS3000_DATA;if(d?.references){const mr=d.references.find(x=>x.key==='matchs'),pr=d.references.find(x=>x.key==='personnel');if(mr)mr.count=String(matches.length);if(pr)pr.count=String(people.length);}
      searchRegistry=[...matches.map(m=>({kind:'matchs',title:`France - ${m.opponent?.name||'Adversaire'}`,meta:`${fmtDate(m.match_date)} · ${m.competition?.name||'France Espoirs'}`,values:[m.opponent?.name,m.competition?.name,m.phase,m.place?.name,m.place?.city,m.coach?.display_name,fmtDate(m.match_date)]})),...people.map(p=>({kind:'personnel',title:p.display_name,meta:p.coached_matches>0?'Sélectionneur France Espoirs':((p.official_roles||[]).join(' · ')||'Officiel'),values:[p.display_name,p.person_type,p.nationality,...(p.official_roles||[]),'Espoirs']}))];
      loaded=true;window.dispatchEvent(new CustomEvent('bleus:relational-registry',{detail:{count:searchRegistry.length}}));
    })().finally(()=>loading=null);return loading;
  }
  function resetForeignUi(){const cat=$('#selectionCategoryTabs');if(cat)cat.hidden=true;const sf=$('#selectionFilterBar');if(sf)sf.hidden=true;}
  function renderMatchCard(m){const opp=m.opponent?.name||'Adversaire';const home=m.home_away==='home';const left=home?'France':opp,right=home?opp:'France';const score=Number.isFinite(Number(m.france_score))&&Number.isFinite(Number(m.opponent_score))?(home?`${m.france_score} – ${m.opponent_score}`:`${m.opponent_score} – ${m.france_score}`):'—';const place=[m.place?.name,m.place?.city].filter(Boolean).join(' · ');return `<article class="selection-player-tile rel-ref-tile rel-match-tile"><div class="rel-ref-head"><div><small>${fmtDate(m.match_date)}</small><h3>${esc(left)} <span class="rel-score ${scoreClass(m)}">${esc(score)}</span> ${esc(right)}</h3><div class="subtitle">${esc(m.competition?.name||'France Espoirs')}${m.phase?` · ${esc(m.phase)}`:''}</div></div><span class="rel-result ${scoreClass(m)}">${resultLetter(m)}</span></div><div class="rel-facts">${place?`<span>🏟 ${esc(place)}</span>`:''}${m.coach?.display_name?`<span>👔 ${esc(m.coach.display_name)}</span>`:''}${m.spectators?`<span>👥 ${Number(m.spectators).toLocaleString('fr-FR')}</span>`:''}<span>${esc(m.lineup_status||m.notes_short||'Match Espoirs')}</span></div><div class="rel-tags">${chip(espoirsTag)}</div></article>`;}
  function renderPersonCard(p){const coach=Number(p.coached_matches||0)>0;const roles=(p.official_roles||[]).filter(Boolean);return `<article class="selection-player-tile rel-ref-tile rel-person-tile"><div class="rel-person-avatar">${esc((p.display_name||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase())}</div><div class="rel-ref-head"><div><h3>${esc(p.display_name)}</h3><div class="subtitle">${coach?'Sélectionneur France Espoirs':esc(roles.join(' · ')||p.person_type||'Officiel')}</div></div></div>${coach?`<div class="rel-stat-grid"><span><small>Matchs</small><strong>${Number(p.coached_matches||0)}</strong></span><span><small>V</small><strong>${Number(p.coached_wins||0)}</strong></span><span><small>N</small><strong>${Number(p.coached_draws||0)}</strong></span><span><small>D</small><strong>${Number(p.coached_losses||0)}</strong></span></div>`:`<div class="rel-stat-grid one"><span><small>Matchs documentés</small><strong>${Number(p.official_matches||0)}</strong></span></div>`}<div class="rel-tags">${chip(espoirsTag)}</div></article>`;}
  async function render(kind,q=''){
    resetForeignUi();const host=$('#referenceEntries'),title=$('#referenceModalTitle'),sub=$('#referenceModalSub'),count=$('#referenceCount');if(!host)return;host.innerHTML='<div class="selection-loading">Chargement du référentiel relationnel…</div>';
    try{await load();if(kind==='matchs'){const list=matches.filter(m=>matchQuery(q,[m.opponent?.name,m.competition?.name,m.phase,m.place?.name,m.place?.city,m.coach?.display_name,fmtDate(m.match_date),m.external_ids?.home,m.external_ids?.away]));if(title)title.textContent='Matchs';if(sub)sub.textContent='France Espoirs · 2004–2026 · matchs reliés aux joueurs, sélectionneurs, officiels, compétitions et lieux';if(count)count.textContent=`${list.length} match${list.length>1?'s':''}`;host.innerHTML=list.length?`<div class="rel-ref-grid">${list.map(renderMatchCard).join('')}</div>`:'<div class="universal-search-empty">Aucun match ne correspond à la recherche.</div>';}
      else{const list=people.filter(p=>matchQuery(q,[p.display_name,p.person_type,p.nationality,...(p.official_roles||[]),'sélectionneur','arbitre','officiel','espoirs']));if(title)title.textContent='Personnel & Officiels';if(sub)sub.textContent='France Espoirs · sélectionneurs, arbitres et officiels reliés aux matchs';if(count)count.textContent=`${list.length} personne${list.length>1?'s':''}`;host.innerHTML=list.length?`<div class="rel-ref-grid">${list.map(renderPersonCard).join('')}</div>`:'<div class="universal-search-empty">Aucune personne ne correspond à la recherche.</div>';}
    }catch(e){console.error('Référentiels relationnels',e);host.innerHTML=`<div class="selection-empty"><strong>Chargement impossible.</strong><span>${esc(e?.message||e)}</span></div>`;}
  }
  function search(q){if(!loaded||!String(q||'').trim())return [];return searchRegistry.filter(x=>matchQuery(q,[x.title,x.meta,...x.values])).slice(0,15).map(x=>({type:x.kind==='matchs'?'Matchs':'Personnel & Officiels',icon:x.kind==='matchs'?'⚽':'👔',title:x.title,meta:x.meta,score:0.18,action:()=>{window.BLEUS3000_APP?.openReferences?.(x.kind);setTimeout(()=>{const i=$('#referenceSearch');if(i){i.value=x.title;i.dispatchEvent(new Event('input',{bubbles:true}));}},80);}}));}
  window.BLEUS3000_RELATIONAL_REFS={render,load,search,get matches(){return matches;},get people(){return people;}};
  load().catch(()=>{});
})();
