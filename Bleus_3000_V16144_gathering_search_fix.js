/* 3615 Bleus V1.1.61.44 — recherche nominative permanente dans l'éditeur de rassemblement */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const catalog=()=> (window.BLEUS3000_PLAYERS_DB?.players||window.BLEUS3000_PLAYER_REGISTRY||[])
    .map(p=>({id:String(p.id||''),name:String(p.display_name||p.name||'').trim(),position:String(p.primary_position||'')}))
    .filter(x=>x.id&&x.name).sort((a,b)=>a.name.localeCompare(b.name,'fr'));

  function upgradeSelect(select,placeholder){
    if(!select||select.dataset.v16144Search==='1')return;
    select.dataset.v16144Search='1'; select.classList.add('v16144-hidden-select'); select.setAttribute('aria-hidden','true'); select.tabIndex=-1;
    let wrap=select.previousElementSibling;
    if(!wrap?.classList?.contains('v16144-player-search')){wrap=document.createElement('div');wrap.className='v16144-player-search';wrap.innerHTML=`<input type="search" autocomplete="off" placeholder="${esc(placeholder)}"><div class="v16144-player-results" hidden></div>`;select.insertAdjacentElement('beforebegin',wrap);}
    const input=$('input',wrap),results=$('.v16144-player-results',wrap);
    const nameFor=id=>catalog().find(x=>x.id===String(id))?.name||[...select.options].find(o=>String(o.value)===String(id))?.textContent?.trim()||'';
    const sync=()=>{const name=nameFor(select.value);if(document.activeElement!==input||name)input.value=name;};sync();
    const choose=item=>{select.value=item.id;select.dispatchEvent(new Event('change',{bubbles:true}));input.value=item.name;results.hidden=true;};
    const render=()=>{const q=norm(input.value),items=catalog().filter(x=>!q||norm(`${x.name} ${x.position}`).includes(q)).slice(0,12);results.innerHTML=items.length?items.map(x=>`<button type="button" data-v16144-player="${esc(x.id)}"><strong>${esc(x.name)}</strong>${x.position?`<small>${esc(x.position)}</small>`:''}</button>`).join(''):'<span>Aucun joueur trouvé — utilise « Nouveau joueur » si nécessaire.</span>';results.hidden=false;$$('[data-v16144-player]',results).forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();const item=items.find(x=>x.id===b.dataset.v16144Player);if(item)choose(item);}));};
    input.addEventListener('input',()=>{const exact=catalog().find(x=>norm(x.name)===norm(input.value));select.value=exact?.id||'';if(exact)select.dispatchEvent(new Event('change',{bubbles:true}));render();});
    input.addEventListener('focus',render);input.addEventListener('blur',()=>setTimeout(()=>{results.hidden=true;if(select.value)sync();},140));
    select.addEventListener('change',sync);new MutationObserver(sync).observe(select,{childList:true,subtree:true,attributes:true,attributeFilter:['value']});
  }
  function apply(){const modal=$('#gatheringEditorModal');if(!modal||modal.hidden)return;$$('select[name="player_id"]',modal).forEach(s=>upgradeSelect(s,'Rechercher le joueur à ajouter…'));$$('select[name="replacement_for"]',modal).forEach(s=>upgradeSelect(s,'Rechercher le joueur remplacé…'));$$('select[name="event_player_id"]',modal).forEach(s=>upgradeSelect(s,'Rechercher le joueur concerné…'));$$('select[name="event_related_player_id"]',modal).forEach(s=>upgradeSelect(s,'Rechercher le joueur lié…'));}
  let timer=0;const obs=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(apply,25);});obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});window.addEventListener('bleus:gatherings-ready',()=>setTimeout(apply,40));setTimeout(apply,700);
})();
