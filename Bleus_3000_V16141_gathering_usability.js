/* 3615 Bleus V1.1.61.41 — ergonomie rassemblements + recherches nominatives */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g,' ').trim();
  const db=()=>window.BLEUS3000_SUPABASE;
  const refs=()=>window.BLEUS3000_RELATIONAL_REFS;
  const gather=()=>window.BLEUS3000_GATHERINGS;
  const canEdit=()=>['admin','superadmin'].includes(String((window.C3K_ACCOUNT_STATE?.profile?.role||window.C3K_ACCOUNT_STATE?.role||'')).toLowerCase());

  function playerCatalog(){
    return (window.BLEUS3000_PLAYERS_DB?.players||window.BLEUS3000_PLAYER_REGISTRY||[])
      .map(p=>({id:String(p.id||''),name:String(p.display_name||p.name||'').trim(),position:p.primary_position||''}))
      .filter(x=>x.id&&x.name).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
  }
  function selectCatalog(select){return [...select.options].filter(o=>o.value).map(o=>({id:o.value,name:o.textContent.trim()}));}
  function currentLabel(select){return select.value?select.options[select.selectedIndex]?.textContent?.trim()||'':'';}

  function makeSearchPicker(select,{placeholder='Rechercher un nom…',catalog=null}={}){
    if(!select||select.dataset.searchPicker==='1')return;
    select.dataset.searchPicker='1';select.classList.add('search-picker-source');select.hidden=true;
    const wrap=document.createElement('div');wrap.className='name-search-picker';
    wrap.innerHTML=`<input type="search" autocomplete="off" placeholder="${esc(placeholder)}"><div class="name-search-results" hidden></div>`;
    select.insertAdjacentElement('beforebegin',wrap);
    const input=$('input',wrap),results=$('.name-search-results',wrap);
    const getCatalog=()=>catalog?catalog():selectCatalog(select);
    const sync=()=>{input.value=currentLabel(select);};sync();
    const choose=x=>{select.value=x.id;select.dispatchEvent(new Event('change',{bubbles:true}));input.value=x.name;results.hidden=true;};
    const render=()=>{const q=norm(input.value),items=getCatalog().filter(x=>!q||norm(x.name).includes(q)).slice(0,10);results.innerHTML=items.length?items.map(x=>`<button type="button" data-pick-id="${esc(x.id)}">${esc(x.name)}</button>`).join(''):'<span>Aucun résultat</span>';results.hidden=false;$$('[data-pick-id]',results).forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();const x=items.find(z=>z.id===b.dataset.pickId);if(x)choose(x);}));};
    input.addEventListener('focus',render);input.addEventListener('input',()=>{const exact=getCatalog().find(x=>norm(x.name)===norm(input.value));select.value=exact?.id||'';if(exact)select.dispatchEvent(new Event('change',{bubbles:true}));render();});
    input.addEventListener('blur',()=>setTimeout(()=>{results.hidden=true;if(select.value)sync();},120));
    select.addEventListener('change',sync);
    new MutationObserver(sync).observe(select,{childList:true,subtree:true});
  }

  function enhanceGatheringSearches(){
    const modal=$('#gatheringEditorModal');if(!modal||modal.hidden)return;
    $$('select[name="player_id"],select[name="replacement_for"],select[name="event_player_id"],select[name="event_related_player_id"]',modal).forEach(s=>makeSearchPicker(s,{placeholder:s.name==='replacement_for'?'Rechercher le joueur forfait…':'Rechercher un joueur…',catalog:playerCatalog}));
    const coach=$('select[name="enriched_coach_id"]',modal);if(coach)makeSearchPicker(coach,{placeholder:'Rechercher le sélectionneur…'});
    enhanceNotReplacedRows();
    injectPlayerTools();
  }

  function enhanceNotReplacedRows(){
    $$('.gathering-player-editor-row').forEach(row=>{
      const status=$('[name="status"]',row),replacement=$('[name="replacement_for"]',row),replacementWrap=replacement?.previousElementSibling?.classList?.contains('name-search-picker')?replacement.previousElementSibling:null;
      if(!$('[name="not_replaced"]',row)){
        const label=document.createElement('label');label.className='gathering-not-replaced-toggle';label.innerHTML=`<input type="checkbox" name="not_replaced"> <span>Non remplacé</span>`;const cb=$('input',label);cb.checked=row.dataset.notReplaced==='1';row.insertBefore(label,row.lastElementChild);status?.addEventListener('change',()=>updatePlayerRowState(row));
      }
      updatePlayerRowState(row);
      function updatePlayerRowState(r){const st=$('[name="status"]',r)?.value||'called',toggle=$('.gathering-not-replaced-toggle',r),cb=$('[name="not_replaced"]',r);if(toggle)toggle.hidden=st!=='withdrawn';if(cb&&st!=='withdrawn'){cb.checked=false;cb.disabled=true;}else if(cb)cb.disabled=false;if(replacementWrap)replacementWrap.hidden=st!=='replacement';if(replacement)replacement.disabled=st!=='replacement';}
    });
  }

  function addExistingPlayer(playerId){
    const form=$('#gatheringEditorForm');if(!form||!playerId)return;
    if($$('.gathering-player-editor-row [name="player_id"]',form).some(s=>String(s.value)===String(playerId)))return;
    $('[data-gathering-add-player]',form)?.click();
    setTimeout(()=>{const row=$$('.gathering-player-editor-row',form).at(-1),sel=$('[name="player_id"]',row);if(!sel)return;sel.value=playerId;sel.dispatchEvent(new Event('change',{bubbles:true}));enhanceGatheringSearches();},0);
  }

  function injectPlayerTools(){
    const form=$('#gatheringEditorForm');if(!form||$('#gatheringQuickTools',form))return;
    const section=$('#gatheringPlayerRows',form)?.closest('.gathering-editor-section'),header=section?.querySelector(':scope > header');if(!header)return;
    const tools=document.createElement('div');tools.id='gatheringQuickTools';tools.className='gathering-player-quick-tools';tools.innerHTML='<button type="button" class="secondary-btn" data-previous-list>⚡ Liste précédente</button><button type="button" class="secondary-btn" data-new-player>＋ Nouveau joueur</button>';
    header.appendChild(tools);
    const panel=document.createElement('div');panel.id='gatheringPreviousPlayers';panel.className='gathering-previous-panel';panel.hidden=true;header.insertAdjacentElement('afterend',panel);
    $('[data-previous-list]',tools).addEventListener('click',()=>{panel.hidden=!panel.hidden;if(!panel.hidden)renderPreviousPlayers(panel);});
    $('[data-new-player]',tools).addEventListener('click',openNewPlayerModal);
  }

  function renderPreviousPlayers(panel){
    const current=$('#gatheringEditorForm [name="id"]')?.value||'',rows=[...(gather()?.rows||[])].filter(r=>String(r.id)!==String(current)).sort((a,b)=>String(b.announcement_date||b.start_date||'').localeCompare(String(a.announcement_date||a.start_date||''))).slice(0,3);
    panel.innerHTML=rows.length?rows.map(r=>`<section><strong>${esc(r.title)}</strong><small>${esc(r.announcement_date||r.start_date||'')}</small><div>${(r.players||[]).filter(x=>x.status!=='withdrawn').map(x=>`<button type="button" data-quick-player="${esc(x.player_id)}">＋ ${esc(playerCatalog().find(p=>p.id===String(x.player_id))?.name||'Joueur')}</button>`).join('')}</div></section>`).join(''):'<span>Aucune liste précédente disponible.</span>';
    $$('[data-quick-player]',panel).forEach(b=>b.addEventListener('click',()=>addExistingPlayer(b.dataset.quickPlayer)));
  }

  function ensureNewPlayerModal(){let m=$('#gatheringNewPlayerModal');if(m)return m;document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="gatheringNewPlayerModal" hidden><section class="modal-dialog gathering-new-player-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2>Nouveau joueur</h2><p>Création automatique de la tuile Joueur</p></div><button type="button" class="modal-close" data-new-player-close>×</button></header><div class="modal-body"><form id="gatheringNewPlayerForm" class="gathering-new-player-form"><label>Nom complet<input name="display_name" required autocomplete="off" placeholder="Ex. Jean Dupont"></label><label>Poste principal<input name="primary_position" placeholder="Ex. Avant-centre"></label><div class="gathering-editor-actions"><button type="button" class="secondary-btn" data-new-player-close>Annuler</button><button type="submit" class="primary-btn">Créer et ajouter</button></div><div class="c3k-v8-status" id="gatheringNewPlayerStatus" hidden></div></form></div></section></div>`);m=$('#gatheringNewPlayerModal');$$('[data-new-player-close]',m).forEach(b=>b.addEventListener('click',()=>m.hidden=true));$('#gatheringNewPlayerForm',m).addEventListener('submit',createNewPlayer);return m;}
  function openNewPlayerModal(){const m=ensureNewPlayerModal();$('#gatheringNewPlayerForm',m).reset();$('#gatheringNewPlayerStatus',m).hidden=true;m.hidden=false;}
  async function createNewPlayer(e){e.preventDefault();if(!canEdit())return;const c=db(),form=e.currentTarget,st=$('#gatheringNewPlayerStatus');if(!c)return;const name=String(form.elements.display_name.value||'').trim(),position=String(form.elements.primary_position.value||'').trim()||null;if(!name)return;const existing=playerCatalog().find(p=>norm(p.name)===norm(name));if(existing){st.hidden=false;st.className='c3k-v8-status is-error';st.textContent='Ce joueur existe déjà. Il a été ajouté à la liste.';addExistingPlayer(existing.id);return;}
    st.hidden=false;st.className='c3k-v8-status';st.textContent='Création…';try{const slug=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+Date.now();const {data:p,error}=await c.from('players').insert({display_name:name,last_name:name,gender:'M',primary_position:position,secondary_positions:[],france_eligibility:true,senior_a_called:true,active:true,name_normalized:name.toLocaleLowerCase('fr'),profile_slug:slug}).select('id,display_name,primary_position').single();if(error)throw error;const team=refs()?.getSelections?.().find(x=>x.code==='FRA-A-M');if(team){const {error:se}=await c.from('player_selection_stats').insert({player_id:p.id,selection_id:team.id,appearance_status:'called_only',international_number:null,selections:0,goals:0,wins:0,draws:0,losses:0,starts:0,minutes:0,data_status:'sheet_rebuild_pending'});if(se){try{await c.from('players').delete().eq('id',p.id);}catch(_){}throw se;}}try{await c.rpc('record_selection_contribution',{p_player_id:p.id,p_type:'create'});}catch(_){}await Promise.all([window.BLEUS3000_PLAYERS_DB?.reload?.(),window.BLEUS3000_SELECTIONS?.reload?.()]);st.className='c3k-v8-status is-ok';st.textContent='Joueur créé et tuile ajoutée ✓';addExistingPlayer(p.id);setTimeout(()=>{ensureNewPlayerModal().hidden=true;},450);}catch(err){st.className='c3k-v8-status is-error';st.textContent=String(err?.message||err);}}

  function enhancePlayerComparator(){
    const m=$('#playerCompareModal');if(!m||m.hidden)return;$$('select[data-compare-slot]',m).forEach(sel=>makeSearchPicker(sel,{placeholder:'Rechercher un joueur…'}));
  }

  let timer=0;const obs=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{enhanceGatheringSearches();enhancePlayerComparator();},40);});obs.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  window.addEventListener('bleus:gatherings-ready',()=>setTimeout(enhanceGatheringSearches,80));
  setTimeout(()=>{enhanceGatheringSearches();enhancePlayerComparator();},900);
})();
