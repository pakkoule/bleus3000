/* 3615 Bleus V1.1.89 — surlignages pays multi-couleurs */
(()=>{
  'use strict';
  const STORAGE='bleus3000.country-colors.v1';
  const cache=new Map();
  let loaded=false,loading=null;
  const normCode=v=>String(v||'').trim().toLowerCase();
  const flags=()=>window.BLEUS3000_FLAGS;
  const db=()=>window.BLEUS3000_SUPABASE||null;
  function readLocal(){try{return JSON.parse(localStorage.getItem(STORAGE)||'{}')||{};}catch{return {};}}
  function writeLocal(){const obj={};for(const [k,v] of cache)obj[k]=v;try{localStorage.setItem(STORAGE,JSON.stringify(obj));}catch{}}
  function normalize(row){if(!row)return null;const code=normCode(row.country_code||row.code);if(!code)return null;const mode=String(row.display_mode||'gradient')==='solid'?'solid':'gradient',angle=Math.max(0,Math.min(360,Number(row.gradient_angle??90)||90)),type=String(row.highlight_gradient_type||'linear')==='radial'?'radial':'linear',opacity=Math.max(.05,Math.min(.95,Number(row.highlight_opacity??.28)||.28)),height=Math.max(35,Math.min(120,Number(row.highlight_height??82)||82));let colors=Array.isArray(row.highlight_colors)?row.highlight_colors.filter(Boolean).slice(0,5):[];if(!colors.length)colors=[row.primary_color||'#315f9a',row.secondary_color||row.primary_color||'#315f9a'];while(colors.length<2)colors.push(colors[0]||'#315f9a');return {country_code:code,country_name:String(row.country_name||row.name||code),primary_color:String(colors[0]||'#315f9a'),secondary_color:String(colors[1]||colors[0]||'#315f9a'),text_color:row.text_color?String(row.text_color):null,display_mode:mode,gradient_angle:angle,highlight_colors:colors,highlight_gradient_type:type,highlight_opacity:opacity,highlight_height:height,updated_at:row.updated_at||null};}
  // Hydrate immédiatement les halos depuis localStorage, avant toute requête réseau.
  Object.values(readLocal()).map(normalize).filter(Boolean).forEach(x=>cache.set(x.country_code,x));
  async function load(force=false){if(loaded&&!force)return cache;if(loading&&!force)return loading;loading=(async()=>{if(!cache.size)Object.values(readLocal()).map(normalize).filter(Boolean).forEach(x=>cache.set(x.country_code,x));const client=db();if(client){try{const {data,error}=await client.from('country_display_colors').select('*').order('country_name');if(error)throw error;(data||[]).map(normalize).filter(Boolean).forEach(x=>cache.set(x.country_code,x));}catch(err){console.warn('3615 Bleus · couleurs pays',err);}}loaded=true;writeLocal();window.dispatchEvent(new CustomEvent('bleus:country-colors-ready',{detail:{count:cache.size}}));return cache;})();try{return await loading;}finally{loading=null;}}
  function codeFor(nameOrCode){const raw=normCode(nameOrCode);if(cache.has(raw))return raw;return normCode(flags()?.codeFor?.(nameOrCode));}
  function get(nameOrCode){const code=codeFor(nameOrCode);return code?cache.get(code)||null:null;}
  async function save(row){const item=normalize(row);if(!item)throw new Error('Pays invalide.');const client=db();if(!client)throw new Error('Supabase indisponible.');const payload={country_code:item.country_code,country_name:item.country_name,primary_color:item.primary_color,secondary_color:item.secondary_color||null,text_color:item.text_color||null,display_mode:item.display_mode||'gradient',gradient_angle:Number(item.gradient_angle??90),highlight_colors:item.highlight_colors||[item.primary_color,item.secondary_color].filter(Boolean),highlight_gradient_type:item.highlight_gradient_type||'linear',highlight_opacity:Number(item.highlight_opacity??.28),highlight_height:Number(item.highlight_height??82),updated_by:window.C3K_ACCOUNT_STATE?.profile?.id||null,updated_at:new Date().toISOString()};const {data,error}=await client.from('country_display_colors').upsert(payload,{onConflict:'country_code'}).select('*').single();if(error)throw error;const saved=normalize(data||payload);cache.set(saved.country_code,saved);loaded=true;writeLocal();window.dispatchEvent(new CustomEvent('bleus:country-colors-changed',{detail:{code:saved.country_code,row:saved}}));return saved;}
  async function remove(nameOrCode){const code=codeFor(nameOrCode)||normCode(nameOrCode);if(!code)return;const client=db();if(!client)throw new Error('Supabase indisponible.');const {error}=await client.from('country_display_colors').delete().eq('country_code',code);if(error)throw error;cache.delete(code);writeLocal();window.dispatchEvent(new CustomEvent('bleus:country-colors-changed',{detail:{code,row:null}}));}
  function entries(){return [...cache.values()].sort((a,b)=>a.country_name.localeCompare(b.country_name,'fr',{sensitivity:'base'}));}
  window.BLEUS3000_COUNTRY_COLORS={load,get,save,remove,entries,codeFor};
  window.addEventListener('bleus:supabase-ready',()=>load(true).catch(()=>{}));
  load().catch(()=>{});
})();
