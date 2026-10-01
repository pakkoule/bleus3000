/* 3615 Bleus V1.2.10.7 — médias de match + sélection d'un ballon du référentiel */
(()=>{
  'use strict';
  const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>[...p.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const db=()=>window.BLEUS3000_SUPABASE, refs=()=>window.BLEUS3000_RELATIONAL_REFS, ballsApi=()=>window.BLEUS3000_BALLS;
  const canEdit=()=>['admin','superadmin'].includes(String(window.C3K_ACCOUNT_STATE?.profile?.role||window.C3K_ACCOUNT_STATE?.role||'').toLowerCase());
  let mediaLoaded=false,mediaLoading=null,media=[];
  const byMatch=id=>media.filter(x=>String(x.match_id)===String(id)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
  const photoUrl=x=>{if(x?.image_url)return x.image_url;if(x?.image_path&&db())try{return db().storage.from('reference-photos').getPublicUrl(x.image_path).data.publicUrl||'';}catch{}return '';};
  function youtubeId(url){const s=String(url||'').trim();const m=s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/i);return m?.[1]||'';}
  async function loadMedia(force=false){if(mediaLoaded&&!force)return media;if(mediaLoading)return mediaLoading;const c=db();if(!c)return[];mediaLoading=(async()=>{const {data,error}=await c.from('match_media_assets').select('*').order('sort_order').order('created_at');if(error&&String(error.code)!=='42P01')throw error;media=data||[];mediaLoaded=true;return media;})().finally(()=>mediaLoading=null);return mediaLoading;}
  function openPlaceSearch(q){if(!q)return;window.BLEUS3000_APP?.openReferences?.('lieux');setTimeout(()=>{const i=$('#referenceSearch');if(i){i.value=q;i.dispatchEvent(new Event('input',{bubbles:true}));i.focus();}},100);}
  function decorateCard(card){const id=card.dataset.matchId;if(!id||card.dataset.v16144Decorated==='1')return;const m=refs()?.getMatch?.(id);if(!m)return;card.dataset.v16144Decorated='1';const bottom=$('.rel-match-bottom',card);if(canEdit()&&bottom&&!$('[data-match-media-edit]',card)){$('.rel-match-actions',bottom)?.insertAdjacentHTML('beforeend',`<button type="button" class="rel-match-media-btn" data-match-media-edit="${esc(id)}">＋ Médias</button>`);}}
  async function decorateAll(){await loadMedia();$$('.rel-match-tile[data-match-id]').forEach(decorateCard);}
  async function uploadImage(matchId,file,type){if(!file)return null;if(file.size>5*1024*1024)throw new Error('L’image dépasse 5 Mo.');const ext=(String(file.name||'').split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,''),safe=['png','jpg','jpeg','webp'].includes(ext)?ext:'jpg',path=`match-media/${matchId}/${type}-${Date.now()}-${crypto.randomUUID()}.${safe}`;const {error}=await db().storage.from('reference-photos').upload(path,file,{contentType:file.type||undefined,upsert:false});if(error)throw error;return path;}
  async function removeMediaRow(row){if(!row?.id)return;const {error}=await db().from('match_media_assets').delete().eq('id',row.id);if(error)throw error;if(row.image_path)db().storage.from('reference-photos').remove([row.image_path]).catch(()=>{});}
  function ensureModal(){
    let m=$('#matchMediaEditor');if(m)return m;
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="matchMediaEditor" hidden><section class="modal-dialog match-media-dialog" role="dialog" aria-modal="true"><header class="modal-head"><div><h2>Médias du match</h2><p>Une de journal · photo d’équipe · ballon · billet</p></div><button type="button" class="modal-close" data-match-media-close>×</button></header><div class="modal-body"><div id="matchMediaExisting"></div><form id="matchMediaForm" class="match-media-form"><input type="hidden" name="match_id"><label>Type<select name="asset_type"><option value="newspaper_front">Une de journal</option><option value="team_photo">Photo d’équipe</option><option value="ball">Ballon du match</option><option value="ticket">Billet historique</option></select></label><label>Titre<input name="title" maxlength="180" placeholder="Titre / description"></label><div class="match-media-ball-picker" data-match-media-ball-picker hidden><label>Ballon enregistré<select name="ball_id"><option value="">— choisir dans la base de données —</option></select></label><div class="match-media-ball-preview" data-match-media-ball-preview><span>⚽</span><div><strong>Aucun ballon sélectionné</strong><small>Choisis un ballon déjà enregistré dans le référentiel.</small></div></div><small class="match-media-ball-help">Le ballon choisi sera relié au match via le référentiel Ballons. Les champs image ci-dessous restent disponibles uniquement pour un média personnalisé.</small></div><label>URL du média<input name="url" type="url" placeholder="https://…"></label><label>Image externe<input name="image_url" type="url" placeholder="https://…"></label><label>Ou importer l’image<input name="image_file" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="photo-copyright-toggle"><input name="copyright_enabled" type="checkbox"> Copyright</label><label class="photo-copyright-field" data-match-media-copyright hidden><span>©</span><input name="image_copyright_source" maxlength="180" placeholder="Source / photographe / agence"></label><div class="match-media-actions"><button type="button" class="secondary-btn" data-match-media-close>Fermer</button><button type="submit" class="primary-btn">Ajouter</button></div><div class="c3k-v8-status" id="matchMediaStatus" hidden></div></form></div></section></div>`);
    m=$('#matchMediaEditor');
    $$('[data-match-media-close]',m).forEach(b=>b.onclick=()=>m.hidden=true);
    const form=$('#matchMediaForm',m);
    form.addEventListener('submit',saveMedia);
    form.elements.asset_type?.addEventListener('change',()=>{syncTypeFields(form);if(form.elements.asset_type.value==='ball')populateBallPicker(m,form.elements.match_id.value).catch(err=>console.warn('Sélecteur ballon média',err));});
    form.elements.ball_id?.addEventListener('change',()=>renderBallPreview(m));
    form.elements.copyright_enabled?.addEventListener('change',e=>{const x=$('[data-match-media-copyright]',m);if(x)x.hidden=!e.target.checked;});
    return m;
  }
  function syncTypeFields(form){const box=$('[data-match-media-ball-picker]',form);if(box)box.hidden=form.elements.asset_type?.value!=='ball';}
  async function populateBallPicker(modal,matchId){
    const select=$('#matchMediaForm [name=ball_id]',modal),preview=$('[data-match-media-ball-preview]',modal);if(!select)return;
    select.disabled=true;select.innerHTML='<option value="">Chargement des ballons…</option>';
    try{
      const api=ballsApi();if(!api?.getMatchPickerData)throw new Error('Référentiel Ballons indisponible.');
      const match=refs()?.getMatch?.(matchId)||{},data=await api.getMatchPickerData(matchId,match),options=data?.options||[];
      select.innerHTML='<option value="">— choisir dans la base de données —</option>'+options.map(o=>`<option value="${esc(o.id)}" data-photo="${esc(o.photo||'')}" data-copyright="${esc(o.copyright||'')}" data-label="${esc(o.label||'Ballon')}">${esc(o.label||'Ballon')}</option>`).join('');
      select.value=String(data?.selectedId||'');select.disabled=false;renderBallPreview(modal);
    }catch(err){select.innerHTML='<option value="">Référentiel Ballons indisponible</option>';select.disabled=true;if(preview)preview.innerHTML=`<span>⚠</span><div><strong>Impossible de charger les ballons</strong><small>${esc(err?.message||err)}</small></div>`;}
  }
  function renderBallPreview(modal){
    const select=$('#matchMediaForm [name=ball_id]',modal),preview=$('[data-match-media-ball-preview]',modal);if(!select||!preview)return;const opt=select.selectedOptions?.[0],id=String(select.value||'');
    if(!id){preview.innerHTML='<span>⚽</span><div><strong>Aucun ballon sélectionné</strong><small>Choisis un ballon déjà enregistré dans le référentiel.</small></div>';return;}
    const photo=opt?.dataset.photo||'',label=opt?.dataset.label||opt?.textContent||'Ballon',copyright=opt?.dataset.copyright||'';
    preview.innerHTML=`${photo?`<img src="${esc(photo)}" alt="${esc(label)}">`:'<span>⚽</span>'}<div><strong>${esc(label)}</strong>${copyright?`<small>© ${esc(copyright)}</small>`:'<small>Ballon du référentiel</small>'}</div>`;
  }
  async function renderExisting(matchId){
    const host=$('#matchMediaExisting');if(!host)return;const rows=byMatch(matchId);let linkedBall=null;try{linkedBall=await ballsApi()?.getForMatch?.(matchId)||null;}catch{}
    const linkedHtml=linkedBall?`<div class="match-media-existing-ball"><span>⚽</span><strong>${esc(linkedBall.model_name||'Ballon du match')} <small>· référentiel Ballons</small></strong><button type="button" data-unlink-match-ball="${esc(matchId)}" title="Délier le ballon">×</button></div>`:'';
    const rowsHtml=rows.map(x=>`<div><span>${x.asset_type==='ticket'?'🎟️':x.asset_type==='ball'?'⚽':x.asset_type==='team_photo'?'👥':'🗞️'}</span><strong>${esc(x.title||({ticket:'Billet historique',ball:'Ballon du match',team_photo:'Photo d’équipe',newspaper_front:'Une de journal'}[x.asset_type]||'Média'))}${x.image_copyright_source?` <small>© ${esc(x.image_copyright_source)}</small>`:''}</strong>${x.asset_type!=='youtube'?`<button type="button" data-edit-match-media-credit="${esc(x.id)}" title="Modifier le copyright">©</button>`:''}<button type="button" data-delete-match-media="${esc(x.id)}">×</button></div>`).join('');
    host.innerHTML=(linkedHtml||rowsHtml)?`<div class="match-media-existing">${linkedHtml}${rowsHtml}</div>`:'<div class="match-media-empty">Aucun média associé.</div>';
    $$('[data-edit-match-media-credit]',host).forEach(b=>b.onclick=async()=>{const row=media.find(x=>String(x.id)===String(b.dataset.editMatchMediaCredit));if(!row)return;const next=prompt('Source du copyright photo (laisser vide pour retirer)',row.image_copyright_source||'');if(next===null)return;const {error}=await db().from('match_media_assets').update({image_copyright_source:String(next).trim()||null,updated_at:new Date().toISOString()}).eq('id',row.id);if(error)return alert(error.message);mediaLoaded=false;await loadMedia(true);await renderExisting(matchId);window.dispatchEvent(new CustomEvent('bleus:match-media-updated',{detail:{matchId}}));});
    $$('[data-delete-match-media]',host).forEach(b=>b.onclick=async()=>{if(!confirm('Supprimer ce média ?'))return;const row=media.find(x=>String(x.id)===String(b.dataset.deleteMatchMedia));try{await removeMediaRow(row);mediaLoaded=false;await loadMedia(true);await renderExisting(matchId);refreshCards();window.dispatchEvent(new CustomEvent('bleus:match-media-updated',{detail:{matchId}}));}catch(err){alert(err?.message||err);}});
    $$('[data-unlink-match-ball]',host).forEach(b=>b.onclick=async()=>{if(!confirm('Délier ce ballon du match ?'))return;try{await ballsApi()?.setMatchBall?.(matchId,null);await renderExisting(matchId);const modal=$('#matchMediaEditor');if(modal)await populateBallPicker(modal,matchId);window.dispatchEvent(new CustomEvent('bleus:match-media-updated',{detail:{matchId}}));}catch(err){alert(err?.message||err);}});
  }
  async function openMedia(matchId){await loadMedia();const m=ensureModal(),f=$('#matchMediaForm',m);f.reset();f.elements.match_id.value=matchId;const cf=$('[data-match-media-copyright]',m);if(cf)cf.hidden=true;syncTypeFields(f);$('#matchMediaStatus',m).hidden=true;await renderExisting(matchId);m.hidden=false;}
  async function saveMedia(e){
    e.preventDefault();const f=e.currentTarget,fd=new FormData(f),matchId=String(fd.get('match_id')||''),type=String(fd.get('asset_type')||''),st=$('#matchMediaStatus');if(!matchId)return;st.hidden=false;st.className='c3k-v8-status';st.textContent='Ajout…';
    try{
      const selectedBallId=type==='ball'?String(fd.get('ball_id')||'').trim():'';
      if(type==='ball'&&selectedBallId){
        const manualBalls=byMatch(matchId).filter(x=>x.asset_type==='ball');for(const row of manualBalls)await removeMediaRow(row);
        const api=ballsApi();if(!api?.setMatchBall)throw new Error('Référentiel Ballons indisponible.');await api.setMatchBall(matchId,selectedBallId);
        mediaLoaded=false;await loadMedia(true);await renderExisting(matchId);f.reset();f.elements.match_id.value=matchId;syncTypeFields(f);st.className='c3k-v8-status is-ok';st.textContent='Ballon relié au match ✓';refreshCards();window.dispatchEvent(new CustomEvent('bleus:match-media-updated',{detail:{matchId}}));return;
      }
      const file=f.elements.image_file?.files?.[0]||null,imagePath=await uploadImage(matchId,file,type),url=String(fd.get('url')||'').trim()||null,imageUrl=String(fd.get('image_url')||'').trim()||null;
      if(!imagePath&&!imageUrl)throw new Error(type==='ball'?'Choisis un ballon enregistré ou ajoute une image personnalisée.':'Ajoute une image importée ou une URL d’image.');
      if(type==='ball'&&ballsApi()?.setMatchBall)await ballsApi().setMatchBall(matchId,null);
      const payload={match_id:matchId,asset_type:type,title:String(fd.get('title')||'').trim()||null,url,image_url:imageUrl,image_path:imagePath,image_copyright_source:fd.get('copyright_enabled')==='on'?String(fd.get('image_copyright_source')||'').trim()||null:null,created_by:window.C3K_ACCOUNT_STATE?.profile?.id||null};
      const {error}=await db().from('match_media_assets').insert(payload);if(error)throw error;
      mediaLoaded=false;await loadMedia(true);await renderExisting(matchId);f.reset();f.elements.match_id.value=matchId;syncTypeFields(f);st.className='c3k-v8-status is-ok';st.textContent='Média ajouté ✓';refreshCards();window.dispatchEvent(new CustomEvent('bleus:match-media-updated',{detail:{matchId}}));
    }catch(err){st.className='c3k-v8-status is-error';st.textContent=String(err?.message||err);}
  }
  function refreshCards(){$$('.rel-match-tile[data-match-id]').forEach(c=>{c.dataset.v16144Decorated='';$('.match-place-links',c)?.remove();$('.match-media-panel',c)?.remove();$('[data-match-media-edit]',c)?.remove();decorateCard(c);});}
  window.BLEUS3000_MATCH_MEDIA={load:loadMedia,getForMatch:async id=>{await loadMedia();return byMatch(id);},photoUrl,open:openMedia,refresh:async()=>{mediaLoaded=false;await loadMedia(true);refreshCards();}};
  document.addEventListener('click',e=>{const p=e.target.closest('[data-match-place-search]');if(p){e.stopPropagation();openPlaceSearch(p.dataset.matchPlaceSearch);return;}const m=e.target.closest('[data-match-media-edit]');if(m){e.stopPropagation();openMedia(m.dataset.matchMediaEdit);}});
  let timer=0;const obs=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(decorateAll,50);});obs.observe(document.documentElement,{subtree:true,childList:true});window.addEventListener('bleus:supabase-ready',()=>{mediaLoaded=false;setTimeout(decorateAll,100)});setTimeout(decorateAll,900);
})();
