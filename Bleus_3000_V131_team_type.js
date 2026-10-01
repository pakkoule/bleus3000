/* 3615 Bleus V1.3.1 — Indice propriétaire « Équipe type » (lecture cache-first, aucune requête au clic) */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(v,a=0,b=100)=>Math.min(b,Math.max(a,Number(v)||0));
  const finite=v=>Number.isFinite(Number(v));
  let matches=new Map(),popover=null,currentButton=null;

  function mix(a,b,t){return a.map((x,i)=>Math.round(x+(b[i]-x)*t));}
  function color(score){
    const s=clamp(score)/100,red=[207,48,70],violet=[120,63,166],blue=[23,79,158],rgb=s<=.5?mix(red,violet,s*2):mix(violet,blue,(s-.5)*2);
    return `rgb(${rgb.join(',')})`;
  }
  function quality(score){const s=Number(score);if(s>=88)return'équipe très proche du noyau habituel';if(s>=76)return'XI très représentatif';if(s>=63)return'XI plutôt représentatif';if(s>=48)return'XI mixte / hiérarchie partielle';if(s>=32)return'XI assez remanié';return'XI très expérimental ou peu établi';}
  function confLabel(v){const n=Number(v);if(n>=85)return'élevée';if(n>=65)return'bonne';if(n>=45)return'modérée';return'faible';}
  const labels={core:'Noyau du sélectionneur',big_match:'Matchs importants',continuity:'Continuité récente',experience:'Expérience',competition_context:'Contexte compétition',captaincy:'Capitanat / hiérarchie',manager_phase:'Phase du mandat'};

  function ringHtml(m){
    if(!finite(m?.team_type_score_raw))return'';
    const raw=clamp(m.team_type_score_raw),display=Math.round(raw),conf=finite(m.team_type_confidence)?clamp(m.team_type_confidence):0,partial=conf<60;
    return `<div class="team-type-index" data-team-type-index="${esc(m.id)}" style="--tt-progress:${raw.toFixed(4)}%;--tt-end:${color(raw)}"><button type="button" class="team-type-index-btn" data-team-type-open="${esc(m.id)}" aria-label="Indice Équipe type : ${display} sur 100. Afficher l’explication." aria-haspopup="dialog"><span class="team-type-ring"><strong>${display}</strong></span><span class="team-type-label">Équipe type</span>${partial?'<span class="team-type-partial">Données partielles</span>':''}</button></div>`;
  }
  function decorate(card){
    const id=String(card?.dataset?.matchId||'');if(!id||card.querySelector('[data-team-type-index]'))return;
    const m=matches.get(id)||window.BLEUS3000_RELATIONAL_REFS?.getMatch?.(id);if(!m)return;
    const html=ringHtml(m);if(!html)return;
    // V1.3.1 placement fix: l'indice vit dans la ligne de synthèse du XI
    // (Âge moyen + Sélections moyennes), jamais dans l'en-tête de la tuile Match.
    const stats=$('.match-sheet-lineup-stats',card);if(!stats)return;
    stats.classList.add('has-team-type-index');
    stats.insertAdjacentHTML('beforeend',html);
  }
  function decorateAll(root=document){$$('.rel-match-tile[data-match-id]',root).forEach(decorate);}

  function ensurePopover(){
    if(popover)return popover;popover=document.createElement('section');popover.className='team-type-popover';popover.hidden=true;popover.setAttribute('role','dialog');popover.setAttribute('aria-modal','false');popover.setAttribute('aria-label','Détail de l’indice Équipe type');document.body.appendChild(popover);return popover;
  }
  function detailRows(details){const subs=details?.subscores||{};return Object.keys(labels).filter(k=>finite(subs[k])).map(k=>{const v=clamp(subs[k]);return `<div class="team-type-detail-row"><span>${esc(labels[k])}</span><b>${Math.round(v)}</b><div class="team-type-detail-bar"><i style="width:${v.toFixed(2)}%"></i></div></div>`;}).join('');}
  function position(btn,pop){
    if(matchMedia('(max-width:720px)').matches){pop.style.left='';pop.style.top='';return;}
    const r=btn.getBoundingClientRect(),w=Math.min(380,innerWidth-24),left=Math.max(12,Math.min(innerWidth-w-12,r.right-w)),top=Math.min(innerHeight-12,r.bottom+8);
    pop.style.left=`${left}px`;pop.style.top=`${Math.max(12,top)}px`;requestAnimationFrame(()=>{const pr=pop.getBoundingClientRect();if(pr.bottom>innerHeight-12)pop.style.top=`${Math.max(12,r.top-pr.height-8)}px`;});
  }
  function close(){const p=ensurePopover();p.hidden=true;if(currentButton){currentButton.setAttribute('aria-expanded','false');currentButton=null;}}
  function open(btn,id){
    const m=matches.get(String(id))||window.BLEUS3000_RELATIONAL_REFS?.getMatch?.(id);if(!m||!finite(m.team_type_score_raw))return;
    const p=ensurePopover(),raw=clamp(m.team_type_score_raw),display=Math.round(raw),conf=finite(m.team_type_confidence)?clamp(m.team_type_confidence):0,d=m.team_type_details||{},warnings=Array.isArray(d.warnings)?d.warnings:[],partial=conf<60;
    if(currentButton===btn&&!p.hidden){close();return;}
    if(currentButton)currentButton.setAttribute('aria-expanded','false');currentButton=btn;btn.setAttribute('aria-expanded','true');
    p.innerHTML=`<div class="team-type-popover-head"><div class="team-type-popover-title"><strong>Équipe type</strong><b>${display}</b>${partial?'<span class="team-type-data-partial">Données partielles</span>':''}</div><button type="button" class="team-type-close" data-team-type-close aria-label="Fermer">×</button></div><p class="team-type-intro">Mesure à quel point ce onze correspond à l’équipe privilégiée par le sélectionneur au moment de ce match.</p><p class="team-type-intro"><b>${raw.toFixed(4)} / 100</b> — ${esc(quality(raw))}</p><div class="team-type-confidence"><span>Confiance du calcul</span><b>${Math.round(conf)} · ${esc(confLabel(conf))}</b></div>${partial?'<div class="team-type-warning">Certaines informations nécessaires au calcul ne sont pas disponibles pour cette période. L’indice est calculé à partir des données actuellement renseignées.</div>':''}<div class="team-type-warning">Cet indice mesure la représentativité du XI, pas sa force ni sa probabilité de victoire.</div><button type="button" class="team-type-detail-toggle" data-team-type-detail-toggle aria-expanded="false">Voir le détail du calcul</button><div class="team-type-details" data-team-type-details hidden>${detailRows(d)}</div>${warnings.filter(Boolean).map(w=>`<div class="team-type-method">${esc(w)}</div>`).join('')}<div class="team-type-method">Calcul temporel : seules les informations disponibles jusqu’à la date du match servent à reconstruire la hiérarchie. Le résultat du match n’entre pas dans la note.</div>`;
    p.hidden=false;position(btn,p);$('[data-team-type-close]',p)?.addEventListener('click',e=>{e.stopPropagation();close();});$('[data-team-type-detail-toggle]',p)?.addEventListener('click',e=>{e.stopPropagation();const b=e.currentTarget,dv=$('[data-team-type-details]',p),will=dv.hidden;dv.hidden=!will;b.setAttribute('aria-expanded',String(will));b.textContent=will?'Masquer le détail du calcul':'Voir le détail du calcul';position(btn,p);});
  }

  document.addEventListener('click',e=>{const btn=e.target.closest?.('[data-team-type-open]');if(btn){e.preventDefault();e.stopPropagation();open(btn,btn.dataset.teamTypeOpen);return;}if(popover&&!popover.hidden&&!popover.contains(e.target))close();},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&popover&&!popover.hidden){e.preventDefault();close();currentButton?.focus?.();}});
  window.addEventListener('resize',()=>{if(currentButton&&popover&&!popover.hidden)position(currentButton,popover);},{passive:true});
  window.addEventListener('bleus:matches-ready',e=>{matches=new Map((e.detail?.matches||[]).map(m=>[String(m.id),m]));decorateAll();});
  window.addEventListener('bleus:match-sheet-synced',()=>setTimeout(()=>{const list=window.BLEUS3000_RELATIONAL_REFS?.matches||[];matches=new Map(list.map(m=>[String(m.id),m]));decorateAll();},80));
  function decorateFromNode(n){
    if(!n||n.nodeType!==1)return;
    const cards=[];
    if(n.matches?.('.rel-match-tile[data-match-id]'))cards.push(n);
    if(n.matches?.('.match-sheet-lineup-stats')){const card=n.closest?.('.rel-match-tile[data-match-id]');if(card)cards.push(card);}
    $$('.match-sheet-lineup-stats',n).forEach(stats=>{const card=stats.closest?.('.rel-match-tile[data-match-id]');if(card)cards.push(card);});
    $$('.rel-match-tile[data-match-id]',n).forEach(card=>cards.push(card));
    [...new Set(cards)].forEach(decorate);
  }
  new MutationObserver(muts=>{for(const m of muts)for(const n of m.addedNodes)decorateFromNode(n);}).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('bleus:match-sheet-updated',()=>setTimeout(()=>decorateAll(),0));
  setTimeout(()=>{const list=window.BLEUS3000_RELATIONAL_REFS?.matches||[];if(list.length)matches=new Map(list.map(m=>[String(m.id),m]));decorateAll();},0);
  window.BLEUS3000_TEAM_TYPE={decorateAll,close};
})();
