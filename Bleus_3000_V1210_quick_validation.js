/* 3615 Bleus V1.2.10 — validation rapide des feuilles depuis Profil */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db=()=>window.BLEUS3000_SUPABASE;
  const role=()=>String(window.C3K_ACCOUNT_STATE?.profile?.role||window.C3K_ACCOUNT_STATE?.role||'').toLowerCase();
  const canEdit=()=>['admin','superadmin'].includes(role());
  const fmt=v=>{const d=new Date(v);return Number.isNaN(+d)?'Date ?':new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Paris'}).format(d);};
  let rows=[];

  function filter(host){
    const q=String($('#quickValidationSearch',host)?.value||'').trim().toLowerCase();let n=0;
    $$('[data-qv-row]',host).forEach(r=>{const ok=!q||String(r.dataset.search||'').includes(q);r.hidden=!ok;if(ok)n++;});
    const c=$('#quickValidationVisible',host);if(c)c.textContent=`${n} feuille${n>1?'s':''}`;
  }
  async function load(){
    const c=db();if(!c)throw new Error('Supabase indisponible.');
    const {data,error}=await c.rpc('quick_validatable_match_sheets');
    if(error){if(/quick_validatable_match_sheets|PGRST202|schema cache/i.test(String(error.message||'')))throw new Error('Migration V1.2.10 requise : exécute MIGRATION_V1.2.10_COLLECTIONS_QUICK_VALIDATION.sql.');throw error;}
    rows=(data||[]).map(x=>({...x,match_id:String(x.match_id)}));return rows;
  }
  function rowHtml(r){
    const state=String(r.sheet_validation_status||'draft')==='needs_validation'?'À revalider':'Prête à valider';
    const search=[r.chronological_number,r.opponent_name,fmt(r.match_date),state].join(' ').toLowerCase();
    return `<article class="b3k-qv-row" data-qv-row data-id="${esc(r.match_id)}" data-search="${esc(search)}"><label class="b3k-qv-check"><input type="checkbox" data-qv-check value="${esc(r.match_id)}"><span></span></label><b>#${esc(r.chronological_number||'—')}</b><div><strong>France – ${esc(r.opponent_name||'Adversaire')}</strong><small>${esc(fmt(r.match_date))}</small></div><span class="b3k-qv-state">${esc(state)}</span><button type="button" class="b3k-qv-one" data-qv-one="${esc(r.match_id)}">Valider</button></article>`;
  }
  async function validateIds(ids,host){
    const unique=[...new Set(ids.map(String).filter(Boolean))];if(!unique.length)return;
    const st=$('#quickValidationStatus',host),buttons=$$('button,input',host);buttons.forEach(x=>x.disabled=true);st.hidden=false;st.className='c3k-v8-status';
    let ok=0,failed=[];
    for(let i=0;i<unique.length;i++){
      st.textContent=`Validation ${i+1}/${unique.length}…`;
      const {error}=await db().rpc('quick_validate_existing_match_sheet',{p_match_id:unique[i]});
      if(error)failed.push({id:unique[i],message:String(error.message||error)});else ok++;
    }
    window.BLEUS3000_RELATIONAL_REFS?.invalidate?.();window.BLEUS3000_STATISTICS?.invalidate?.();
    await Promise.allSettled([window.BLEUS3000_RELATIONAL_REFS?.load?.(),window.BLEUS3000_SELECTIONS?.reload?.(),window.BLEUS3000_PLAYERS_DB?.reload?.()]);
    if(failed.length){st.className='c3k-v8-status is-error';st.textContent=`${ok} validée${ok>1?'s':''} · ${failed.length} refusée${failed.length>1?'s':''} : ${failed[0].message}`;}else{st.className='c3k-v8-status is-ok';st.textContent=`${ok} feuille${ok>1?'s':''} validée${ok>1?'s':''} ✓`;}
    await draw(host);
  }
  function bind(host,onBack){
    $('#quickValidationBack',host)?.addEventListener('click',()=>onBack?.());
    $('#quickValidationSearch',host)?.addEventListener('input',()=>filter(host));
    $('#quickValidationToggleAll',host)?.addEventListener('change',e=>{$$('[data-qv-row]',host).filter(r=>!r.hidden).forEach(r=>{const c=$('[data-qv-check]',r);if(c)c.checked=e.target.checked;});});
    $('#quickValidationSelected',host)?.addEventListener('click',()=>validateIds($$('[data-qv-check]:checked',host).map(x=>x.value),host));
    $('#quickValidationAll',host)?.addEventListener('click',()=>{const ids=$$('[data-qv-row]',host).filter(r=>!r.hidden).map(r=>r.dataset.id);if(ids.length&&confirm(`Valider rapidement ${ids.length} feuille${ids.length>1?'s':''} complète${ids.length>1?'s':''} ?`))validateIds(ids,host);});
    $$('[data-qv-one]',host).forEach(b=>b.addEventListener('click',()=>validateIds([b.dataset.qvOne],host)));
  }
  async function draw(host,onBack=host?._qvBack){
    if(!host)return;if(!canEdit()){host.innerHTML='<div class="c3k-v8-status is-error">Accès réservé aux ADMIN et SUPERADMIN.</div>';return;}
    host._qvBack=onBack;host.innerHTML='<div class="c3k-v8-muted">Recherche des feuilles déjà complètes…</div>';
    try{await load();host.innerHTML=`<section class="b3k-qv"><header><div><strong>Validation rapide</strong><span>Uniquement les feuilles déjà complètes selon les contrôles Supabase.</span></div><b>${rows.length}</b></header><div class="b3k-qv-tools"><input id="quickValidationSearch" type="search" placeholder="N° match, adversaire, date…"><span id="quickValidationVisible">${rows.length} feuille${rows.length>1?'s':''}</span></div>${rows.length?`<div class="b3k-qv-selectbar"><label><input id="quickValidationToggleAll" type="checkbox"> Tout cocher dans le filtre</label><button id="quickValidationSelected" type="button" class="secondary-btn">Valider la sélection</button><button id="quickValidationAll" type="button" class="primary-btn">Tout valider</button></div><div class="b3k-qv-list">${rows.map(rowHtml).join('')}</div>`:'<div class="b3k-qv-empty">Aucune feuille complète en attente de validation.</div>'}<div class="c3k-v8-status" id="quickValidationStatus" hidden></div><div class="c3k-v8-actions"><button class="c3k-v8-secondary" id="quickValidationBack" type="button">Retour</button></div></section>`;bind(host,onBack);}catch(err){host.innerHTML=`<div class="c3k-v8-status is-error">${esc(err?.message||err)}</div><div class="c3k-v8-actions"><button class="c3k-v8-secondary" id="quickValidationBack" type="button">Retour</button></div>`;$('#quickValidationBack',host)?.addEventListener('click',()=>onBack?.());}
  }
  window.BLEUS3000_QUICK_VALIDATION={render:draw,load};
})();
