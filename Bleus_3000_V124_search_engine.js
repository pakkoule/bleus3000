/* Bleus 3000 V1.1.24 — moteur de recherche unifié, sans dépendance BDD */
(function(root){
  'use strict';

  const normalize = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[’'`´-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = value => normalize(value).split(' ').filter(Boolean);
  const compact = value => normalize(value).replace(/ /g, '');

  function levenshtein(a,b){
    a=normalize(a); b=normalize(b);
    if(a===b) return 0;
    if(!a) return b.length;
    if(!b) return a.length;
    let prev=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const cur=[i];
      for(let j=1;j<=b.length;j++){
        cur[j]=Math.min(
          cur[j-1]+1,
          prev[j]+1,
          prev[j-1]+(a[i-1]===b[j-1]?0:1)
        );
      }
      prev=cur;
    }
    return prev[b.length];
  }

  function typoLimit(len){
    if(len<=3) return 0;
    if(len<=5) return 1;
    if(len<=8) return 2;
    return Math.min(3,Math.floor(len*.24));
  }

  function tokenScore(queryToken,candidateToken){
    const q=normalize(queryToken), c=normalize(candidateToken);
    if(!q||!c) return Infinity;
    if(q===c) return 0;

    // Prefixes are the main behaviour for progressive typing: Kyli -> Kylian, mba -> Mbappé.
    if(q.length>=2 && c.startsWith(q)) return .025 + Math.min(.025,(c.length-q.length)*.002);

    // Internal substring only for sufficiently informative query tokens.
    if(q.length>=3 && c.includes(q)) return .075 + Math.min(.04,c.indexOf(q)*.004);

    // Do not let tiny candidate tokens ("a", "m", etc.) validate a longer query token.
    if(c.length>=4 && q.length>=4 && q.startsWith(c) && q.length-c.length<=2) return .16;

    // Controlled typo tolerance. Short queries stay strict to avoid flooding results.
    if(q.length>=4 && c.length>=3){
      const d=levenshtein(q,c);
      const limit=Math.min(typoLimit(q.length),typoLimit(c.length)+1);
      if(d<=limit) return .20 + d/Math.max(q.length,c.length)*.35;
    }
    return Infinity;
  }

  function score(query,value){
    const q=normalize(query), v=normalize(value);
    if(!q) return 0;
    if(!v) return Infinity;
    if(q===v) return 0;
    if(v.startsWith(q)) return .005;
    const phraseAt=v.indexOf(q);
    if(phraseAt>=0) return .012 + phraseAt*.001;

    const qc=compact(q), vc=compact(v);
    if(qc && vc.startsWith(qc)) return .018;
    const compactAt=qc ? vc.indexOf(qc) : -1;
    if(compactAt>=0) return .024 + compactAt*.001;

    const qTokens=tokens(q), cTokens=tokens(v);
    if(!qTokens.length||!cTokens.length) return Infinity;

    let total=0;
    for(const qt of qTokens){
      let best=Infinity;
      for(const ct of cTokens) best=Math.min(best,tokenScore(qt,ct));
      if(!Number.isFinite(best)) return Infinity;
      total+=best;
    }
    // Small penalty for token-mode matching so exact phrase/prefix results remain first.
    return .08 + total/qTokens.length;
  }

  function scoreAny(query,values){
    let best=Infinity;
    for(const value of values||[]) best=Math.min(best,score(query,value));
    return best;
  }

  function matches(query,values,threshold=.48){
    if(!normalize(query)) return true;
    return scoreAny(query,values)<=threshold;
  }

  function buildNameKeys(name){
    const clean=String(name??'').replace(/\s+/g,' ').trim();
    const parts=clean.split(/\s+/).filter(Boolean);
    const suffixes=parts.map((_,i)=>parts.slice(i).join(' '));
    const prefixes=parts.map((_,i)=>parts.slice(0,i+1).join(' '));
    return [...new Set([clean,...parts,...suffixes,...prefixes].filter(Boolean))];
  }

  const api={normalize,tokens,compact,levenshtein,score,scoreAny,matches,buildNameKeys};
  root.BLEUS3000_SEARCH=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
