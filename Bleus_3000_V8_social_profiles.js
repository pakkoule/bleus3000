/* 3615 Bleus V1.1.61.14 — profils sociaux sans image de profil : étiquettes + présence */
(() => {
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const memberLabels=new Map();
  const roleName=r=>({user:'USER',contributor:'CONTRIBUTOR',editor:'EDITOR',admin:'ADMIN',superadmin:'SUPERADMIN',guest:'VISITEUR'}[r]||String(r||'USER').toUpperCase());
  const presenceLabel=s=>({online:'En ligne',away:'Absent',dnd:'Ne pas déranger',offline:'Hors ligne'}[s]||'En ligne');
  function defaultMemberLabel(role){return {label_text:roleName(role),icon_text:role==='superadmin'?'★':'',appearance:'gradient',color_start:role==='superadmin'?'#E7F0FF':'#DDEAFF',color_end:role==='superadmin'?'#2563EB':'#5B8DCC',gradient_angle:135};}
  function memberLabelBadgeHtml(row){if(!row)return '';const c1=row.color_start||'#DDEAFF',c2=row.color_end||c1,ang=Number(row.gradient_angle)||135,klass=row.appearance==='solid'?'is-solid':'is-gradient';return `<span class="c3k-member-label ${klass}" style="--member-label-c1:${esc(c1)};--member-label-c2:${esc(c2)};--member-label-angle:${ang}deg"><span class="c3k-member-label-icon">${esc(row.icon_text||'')}</span><span>${esc(row.label_text||'MEMBRE')}</span></span>`;}
  function roleBadgeHtml(role,custom){return memberLabelBadgeHtml(custom||defaultMemberLabel(role));}
  function profileIdentityHtml(profile){return `<div class="c3k-profile-identity"><div class="c3k-profile-identity-copy"><strong>${esc(profile?.username||profile?.first_name||'Compte')}</strong>${roleBadgeHtml(profile?.role,profile?.member_label)}</div></div>`;}
  function enhanceProfileEditor(root,profile){
    const form=root.querySelector('#c3kV8ProfileForm');if(!form)return;
    form.insertAdjacentHTML('beforeend',`<section class="c3k-profile-social-editor"><label>Présence<select name="presence_status"><option value="online">En ligne</option><option value="away">Absent</option><option value="dnd">Ne pas déranger</option><option value="offline">Hors ligne</option></select></label><label>Statut libre<textarea name="status_text" maxlength="90" rows="2" placeholder="Ex. Mise à jour des convocations…">${esc(profile?.status_text||'')}</textarea><span class="c3k-v8-muted">90 caractères maximum. Visible dans la liste de présence.</span></label></section>`);
    const presence=form.elements.presence_status;if(presence)presence.value=profile?.presence_status||'online';
  }
  async function refreshMemberLabels(){
    const client=window.BLEUS3000_SUPABASE;if(!client)return memberLabels;
    const {data,error}=await client.from('member_role_labels').select('user_id,label_text,icon_text,appearance,color_start,color_end,gradient_angle');
    if(!error){memberLabels.clear();(data||[]).forEach(x=>memberLabels.set(String(x.user_id),x));}
    return memberLabels;
  }
  const getMemberLabel=id=>id?memberLabels.get(String(id))||null:null;
  function setMemberLabel(id,row){if(!id)return;if(row)memberLabels.set(String(id),row);else memberLabels.delete(String(id));}
  function bindPresence(){
    document.addEventListener('click',e=>{
      const el=e.target.closest('.c3k-v8-presence');if(!el)return;
      let pop=document.getElementById('c3kPresencePop');if(pop){pop.remove();return;}
      const state=window.C3K_PRESENCE_STATE||{},entries=Object.values(state).flatMap(v=>Array.isArray(v)?v:[]);
      pop=document.createElement('div');pop.id='c3kPresencePop';pop.className='c3k-presence-pop';
      pop.innerHTML=`<div class="c3k-presence-pop-head"><strong>Présence des membres</strong><span>${entries.length}</span></div><div class="c3k-presence-list">${entries.length?entries.map(u=>`<article class="c3k-presence-user"><span class="c3k-online-dot is-${esc(u.presence_status||'online')}"></span><div class="c3k-presence-user-copy"><div class="c3k-presence-user-name"><strong>${esc(u.pseudo||u.first_name||'Visiteur')}</strong>${roleBadgeHtml(u.role||'guest',getMemberLabel(u.user_id))}</div><div class="c3k-presence-state-row"><span class="c3k-presence-state-badge is-${esc(u.presence_status||'online')}">${esc(presenceLabel(u.presence_status||'online'))}</span></div>${u.status_text?`<div class="c3k-status-bubble">${esc(u.status_text)}</div>`:''}</div></article>`).join(''):'<div class="c3k-presence-empty">Aucun autre membre connecté.</div>'}</div>`;
      document.body.appendChild(pop);const r=el.getBoundingClientRect();pop.style.left=Math.max(12,Math.min(r.left,innerWidth-390))+'px';pop.style.top=Math.min(innerHeight-320,r.bottom+8)+'px';
    });
  }
  function init(){bindPresence();refreshMemberLabels();}
  window.C3K_SOCIAL_PROFILE={roleBadgeHtml,memberLabelBadgeHtml,defaultMemberLabel,profileIdentityHtml,enhanceProfileEditor,refreshMemberLabels,getMemberLabel,setMemberLabel};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
