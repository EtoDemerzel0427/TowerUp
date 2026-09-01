/* ===================== HEADLESS BALANCE RUNNER =====================
   Not loaded by the game. Inject it from the console on a running page:

       const s=document.createElement('script'); s.src='tools/fastrun.js'; document.head.appendChild(s);
       const r=await __fastRun('norm');      // 'easy' | 'norm' | 'hard'
       r.log                                 // one row per wave, plus a final {over:true,...}

   It steps sim() directly (no rendering) with a kiting bot at the controls, so a
   30-wave campaign takes a few seconds. The bot is deliberately mediocre: it kites,
   collects drops, rushes rifts when the field is quiet, builds/upgrades in a fixed
   order, picks random cards and dashes out of boss slams. Numbers it produces are
   a floor for a human, not a target. Run three times before believing a delta. */
window.__fastRun=function(diffId,opts={}){
  return new Promise(resolve=>{
    S.keys={}; if(S.P)S.P.charging=false;
    S.autoFire=true;   // a scenario test that switched it off would otherwise leave every later run blind
    pickDiff=DIFFS.find(d=>d.id===diffId)||DIFFS[1];
    startGame(); S.paused=true;   // the rAF loop stays out; we step sim by hand
    const BUILD_ORDER=['arrow','cannon','frost','flame','tesla','toxin','sniper','beacon'];
    let chargeT=0,lastWave=0,wStart=0,deaths=0,prevLives=S.playerLives,minCore=1e9,coreDmg=0,lastCore=S.core.hp;
    const log=[], errs=[]; let steps=0, t0=performance.now();
    const bot=()=>{
      if(S.cards){ takeCard(S.cards[Math.random()*S.cards.length|0]); return; }
      if(S.teleporting){
        for(const u of CORE_UP){ const lv=S.coreUp[u.id]||0;
          if(lv<u.max&&S.scrap>coreUpCost(u,lv)+250&&Math.random()<.35){ S.scrap-=coreUpCost(u,lv); S.coreUp[u.id]=lv+1; applyCoreUpgrades(true);} }
        nextStage(); return; }
      const P=S.P; if(!P.alive)return;
      if(S.playerLives<prevLives){deaths++;prevLives=S.playerLives;} if(S.playerLives>prevLives)prevLives=S.playerLives;
      if(S.core.hp<lastCore)coreDmg+=lastCore-S.core.hp; lastCore=S.core.hp; minCore=Math.min(minCore,S.core.hp);
      if(S.wave!==lastWave){
        if(lastWave)log.push({w:lastWave,st:S.stage,dur:+(S.time-wStart).toFixed(0),deaths,coreDmg:coreDmg|0,minCore:minCore|0,tw:S.towers.length,lv:S.level,scrap:S.scrap});
        lastWave=S.wave; wStart=S.time; deaths=0; coreDmg=0; minCore=S.core.hp; }
      const n=towerSlots();
      if(!slotsFull()){
        const unlocked=BUILD_ORDER.filter(towerUnlocked); const key=unlocked[S.towers.length%unlocked.length];
        if(S.scrap>=towerCost(key)){ let sp=null;
          for(let i=0;i<n*2&&!sp;i++){ const a=i/n*TAU+0.3+(i>=n?.2:0);
            for(let d=5.2;d<9.5;d+=.5){ const c=Math.floor((CX+Math.cos(a)*d*TILE)/TILE), r=Math.floor((CY+Math.sin(a)*d*TILE*.8)/TILE);
              if(canBuild(c,r)){sp=[c,r];break;} } }
          if(sp)placeTower(key,sp[0],sp[1]); }
      } else {
        const ts=S.towers.slice().sort((a,b)=>(a.lvl+(a.elite!=null?1:0))-(b.lvl+(b.elite!=null?1:0))); const t=ts[0];
        if(t){ const uc=upgradeCost(t);
          if(uc!=null&&S.scrap>uc+60)upgradeTower(t);
          else if(uc==null&&t.elite==null&&S.scrap>eliteCost(t,0)+60)eliteTower(t,0);
          else if(canOverclock(t)&&S.scrap>overclockCost(t)+400)overclockTower(t); }
        for(const t2 of S.towers) if(t2.hp<t2.maxHp*.5&&S.scrap>repairCost(t2))repairTower(t2);
      }
      if(!S.waveActive&&S.rest>5&&nothingToBuy())callEarly();
      let cx=0,cy=0,cn=0,nd=1e9;
      for(const e of S.enemies){ if(!e.alive)continue; cx+=e.x;cy+=e.y;cn++; const d=Math.hypot(e.x-P.x,e.y-P.y); if(d<nd)nd=d; }
      nd/=TILE; const c=cn?{x:cx/cn,y:cy/cn,n:cn}:null;
      let tx=CX,ty=CY+TILE*4;
      let drop=null,dd0=1e9; for(const d of S.drops){ const dd=Math.hypot(d.x-P.x,d.y-P.y); if(dd<dd0){dd0=dd;drop=d;} }
      const rift=S.rifts.find(r=>r.alive);
      const slammer=S.enemies.find(e=>e.alive&&e.slamWarn>0&&Math.hypot(e.x-P.x,e.y-P.y)<(e.def.phase2.slamR+1)*TILE);
      // champion tells: a human reads these, so the bot has to as well or the
      // numbers measure blindness, not difficulty
      const champ=S.enemies.find(e=>e.alive&&e.kit&&e.k);
      let dodge=null;
      if(champ){ const k=champ.k, d=Math.hypot(champ.x-P.x,champ.y-P.y);
        if(champ.kit==='crusher'&&(k.st==='wind'||k.st==='charge')){
          // a human sidesteps the lane, not the whole map: only move when actually in it
          const rel=Math.atan2(P.y-champ.y,P.x-champ.x)-k.a, off=Math.abs(Math.sin(rel))*d/TILE, ahead=Math.cos(rel)>0;
          if(ahead&&off<1.8){ const side=Math.sign(Math.sin(rel))||1; const a=k.a+side*Math.PI/2;
            dodge={x:P.x+Math.cos(a)*TILE*2.4,y:P.y+Math.sin(a)*TILE*2.4,dash:k.st==='charge'&&d<5*TILE}; } }
        else if(champ.kit==='magma'&&k.meteors.length){ let mx=0,my=0; for(const m of k.meteors){mx+=m.x;my+=m.y;} mx/=k.meteors.length; my/=k.meteors.length; const a=Math.atan2(P.y-my,P.x-mx); dodge={x:P.x+Math.cos(a)*TILE*5,y:P.y+Math.sin(a)*TILE*5,dash:false}; }
        else if(champ.kit==='archon'&&k.st==='well'){ const a=Math.atan2(P.y-champ.y,P.x-champ.x); dodge={x:P.x+Math.cos(a)*TILE*6,y:P.y+Math.sin(a)*TILE*6,dash:true}; }
        else if(champ.kit==='warden'&&k.st==='nova'){ const a=Math.atan2(P.y-champ.y,P.x-champ.x); dodge={x:P.x+Math.cos(a)*TILE*5,y:P.y+Math.sin(a)*TILE*5,dash:d<3*TILE}; }
        else if(champ.kit==='brood'&&k.st==='bury'&&Math.hypot(k.x1-P.x,k.y1-P.y)<3.5*TILE){ const a=Math.atan2(P.y-k.y1,P.x-k.x1); dodge={x:P.x+Math.cos(a)*TILE*4,y:P.y+Math.sin(a)*TILE*4,dash:false}; }
      }
      if(dodge){ tx=dodge.x; ty=dodge.y; if(dodge.dash&&P.dashCd<=0)S.keys.shift=true; }
      else if(slammer){ const a=Math.atan2(P.y-slammer.y,P.x-slammer.x); tx=P.x+Math.cos(a)*TILE*5; ty=P.y+Math.sin(a)*TILE*5; if(P.dashCd<=0)S.keys.shift=true; }
      else if(c&&nd<3.2){ const a=Math.atan2(P.y-c.y,P.x-c.x); tx=P.x+Math.cos(a)*TILE*4; ty=P.y+Math.sin(a)*TILE*4; }
      else if(drop&&dd0<7*TILE&&nd>2.5){ tx=drop.x; ty=drop.y; }
      else if(rift&&(!c||c.n<6)){ const a=Math.atan2(rift.y-P.y,rift.x-P.x); tx=rift.x-Math.cos(a)*TILE*7; ty=rift.y-Math.sin(a)*TILE*7; }
      else if(c){ const a=Math.atan2(c.y-CY,c.x-CX); tx=CX+Math.cos(a)*TILE*4.5; ty=CY+Math.sin(a)*TILE*4.5; }
      const dx=tx-P.x,dy=ty-P.y,K=S.keys; K.arrowup=dy<-8;K.arrowdown=dy>8;K.arrowleft=dx<-8;K.arrowright=dx>8;
      if(nd<1.6&&P.dashCd<=0)K.shift=true;
      const L=P.lock&&P.lock.k==='enemy'?P.lock.ref:null;
      if(L&&L.armor>8&&!P.charging&&chargeT<=0){ K.f=true; chargeT=1.1; }
      if(chargeT>0){ chargeT-=.1; if(chargeT<=0)K.f=false; }
      if(P.ult>=1&&c&&c.n>=4)K.q=true;
      if(c&&c.n>=8&&S.abil.strike.cd<=0)useAbility('strike');
      if(c&&c.n>=14&&S.abil.freeze.cd<=0)useAbility('freeze');
      if(c&&c.n>=10&&S.abil.over.cd<=0)useAbility('over');
    };
    const chunk=()=>{
      try{
        for(let k=0;k<900;k++){
          if(S.over||(S.victory&&!S.endless)||S.wave>(opts.maxWave||60)){
            log.push({over:true,w:S.wave,st:S.stage,lives:S.playerLives,core:S.core.hp|0,victory:!!S.victory});
            S.keys={}; return resolve({log,errs,secs:((performance.now()-t0)/1000).toFixed(0)}); }
          if(steps%6===0){ S.keys.shift=false; S.keys.q=false; bot(); }
          if(!S.cards&&!S.teleporting)sim(1/60);
          steps++;
        }
      }catch(e){ errs.push(String(e&&e.stack||e)); S.keys={}; return resolve({log,errs}); }
      setTimeout(chunk,0);
    };
    chunk();
  });
};
/* n runs, one line each */
window.__fastBatch=async function(diffId,n=3){
  const out=[];
  for(let i=0;i<n;i++){ const r=await __fastRun(diffId); const end=r.log[r.log.length-1]; const waves=r.log.filter(l=>!l.over);
    out.push({end:'W'+end.w+' st'+end.st+' lives'+end.lives+' core'+end.core+(end.victory?' WIN':''),
      deaths:waves.reduce((a,l)=>a+l.deaths,0), coreDmg:waves.reduce((a,l)=>a+l.coreDmg,0),
      byRegion:[0,1,2,3,4].map(s=>{const ws=waves.filter(l=>l.st===s); return ws.length?ws.reduce((a,l)=>a+l.coreDmg,0):'-';}),
      errs:r.errs}); }
  return out;
};
