/* 3615 Bleus V1.3.13 — scoreline simple : drapeau + pays, sans surlignage */
(()=>{
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const countryName=v=>window.BLEUS3000_FLAGS?.countryName?.(v)||String(v||'');
  function flag(team){return window.BLEUS3000_FLAGS?.img?.(team,'b3k-scoreline-flag-img')||'<span class="b3k-scoreline-flag-img is-missing">◌</span>';}
  function team(teamName,side){const name=countryName(teamName).toLocaleUpperCase('fr-FR');return `<span class="b3k-scoreline-team is-${side}">${side==='left'?`<span class="b3k-scoreline-flag">${flag(teamName)}</span>`:''}<span class="b3k-scoreline-name">${esc(name)}</span>${side==='right'?`<span class="b3k-scoreline-flag">${flag(teamName)}</span>`:''}</span>`;}
  function render(left,right,center,opts={}){const label=String(center??'VS').trim()||'VS',compact=Boolean(opts.compact),outcome=String(opts.outcome||''),matchId=String(opts.matchId||''),classes=['b3k-scoreline',compact?'is-compact':'',/^VS$/i.test(label)?'is-vs':'',outcome?`is-${outcome}`:''].filter(Boolean).join(' ');return `<div class="${classes}"${matchId?` data-match-id="${esc(matchId)}"`:''} aria-label="${esc(countryName(left))} ${esc(label)} ${esc(countryName(right))}">${team(left,'left')}<span class="b3k-scoreline-center">${esc(label)}</span>${team(right,'right')}</div>`;}
  window.BLEUS3000_SCORELINE={render};
})();
