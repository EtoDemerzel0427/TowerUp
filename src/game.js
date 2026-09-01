/* ===================== GAME LOGIC ===================== */
const MULT_KEYS=['dmg','rate','range','splash','slow','shred','buffDmg','buffRate'];
const REST=13, VICTORY_WAVE=30;

/* ---------- player stats (mutated by level-up cards) ---------- */
/* control layout: 'right' = arrows move + WASD aims (default), 'left' = the mirror */
function KEYMAP(){
  const K=S.keys, R=S.layout==='right';
  const mv=R?['arrowup','arrowdown','arrowleft','arrowright']:['w','s','a','d'];
  const am=R?['w','s','a','d']:['arrowup','arrowdown','arrowleft','arrowright'];
  return {
    up:!!K[mv[0]], down:!!K[mv[1]], left:!!K[mv[2]], right:!!K[mv[3]],
    turnL:!!K[am[2]], turnR:!!K[am[3]],
    charge:!!K[am[0]],          // aim-cluster up  = wind up the heavy shot
    fine:!!K[am[1]],            // aim-cluster down = precision aim (slow turn)
    fire:!!K[' '],              // space = trigger
    dash:!!K['shift'],
  };
}
function layoutHint(){
  return S.layout==='right'
    ? {move:'↑ ↓ ← →', turn:'A / D', fire:'空格', charge:'W', fine:'S'}
    : {move:'W A S D', turn:'← / →', fire:'空格', charge:'↑', fine:'↓'};
}
function freshStats(){
  return {dmg:PLAYER.dmg,rate:PLAYER.rate,range:PLAYER.range,pierce:0,multi:1,explo:0,crit:0,
    speed:PLAYER.speed,dashCd:PLAYER.dashCd,dashDist:PLAYER.dashDist,shock:0,
    heatMax:PLAYER.heatMax,heatCool:PLAYER.heatCool,heatPerShot:PLAYER.heatPerShot,
    maxHp:PLAYER.hp,regen:0,leech:0,thorn:0,dr:1,drones:0,pickup:PLAYER.pickup,
    coreRegen:0,twrDmg:0,twrRate:0,cost:1,scrapGain:0};
}
function newPlayer(){
  return {x:CX,y:CY+TILE*3,vx:0,vy:0,face:-Math.PI/2,aim:-Math.PI/2,
    hp:PLAYER.hp,alive:true,deadT:0,dashT:0,dashCd:0,dashDx:0,dashDy:0,
    iframe:1.5,moving:false,cool:0,droneAng:0,r:PLAYER.r,
    heat:0,overheat:0,charge:0,charging:false,chgCd:0,flashT:0,kick:0,turnHold:0,aiming:false,
    onIce:false,hazT:0,fine:false,dashLatch:false,coolT:0,rageT:0,shield:0,
    ult:0,ultT:0,ultLatch:false,magnetT:0,
    lock:null,lockLatch:false,cycleLatch:0};
}

/* ---------- spatial hash so 250 enemies stay cheap ---------- */
const CELL=TILE*2.2; let GRID=new Map();
function gkey(cx,cy){return cx*4096+cy;}
function rebuildGrid(){
  GRID.clear();
  for(const e of S.enemies){
    if(!e.alive)continue;
    const k=gkey(Math.floor(e.x/CELL),Math.floor(e.y/CELL));
    let a=GRID.get(k); if(!a){a=[];GRID.set(k,a);} a.push(e);
  }
}
function nearEnemies(x,y,rad,fn){
  const c0=Math.floor((x-rad)/CELL),c1=Math.floor((x+rad)/CELL);
  const r0=Math.floor((y-rad)/CELL),r1=Math.floor((y+rad)/CELL);
  for(let c=c0;c<=c1;c++)for(let r=r0;r<=r1;r++){
    const a=GRID.get(gkey(c,r)); if(!a)continue;
    for(const e of a) fn(e);
  }
}

/* ---------- turret stats ---------- */
function tstat(t,noBuff){
  const d=t.def,L=t.lvl-1,o={
    dmg:d.dmg?d.dmg[L]:0, rate:d.rate?d.rate[L]:0, range:d.range[L],
    splash:d.splash?d.splash[L]:0, slow:d.slow?d.slow[L]:0, chain:d.chain?d.chain[L]:0,
    burn:d.burn?d.burn[L]:0, poison:d.poison?d.poison[L]:0, shred:d.shred?d.shred[L]:0,
    buffDmg:d.buffDmg?d.buffDmg[L]:0, buffRate:d.buffRate?d.buffRate[L]:0,
    falloff:.7, pierce:0, cluster:0, stun:0, freeze:0, crit:0, vuln:0, scrap:0, buffRange:0,
    magma:0, ring:0, rail:0, mark:0, plague:0, aura:0, shredHit:0, pen:0,
  };
  if(t.elite!=null&&d.elites[t.elite]){
    const e=d.elites[t.elite];
    for(const k in e){ if(k==='n'||k==='c'||k==='d')continue;
      if(MULT_KEYS.includes(k))o[k]*=e[k]; else o[k]=e[k]; }
  }
  if(!noBuff){
    o.dmg*=1+(t.bDmg||0)+S.st.twrDmg; o.rate*=1+(t.bRate||0)+S.st.twrRate; o.range*=1+(t.bRange||0);
    if(S.overT>0)o.rate*=2.5;
  }
  return o;
}
function recalcBuffs(){
  for(const t of S.towers){t.bDmg=0;t.bRate=0;t.bRange=0;t.scrapB=0;t.links=[];}
  // resonance: turrets placed close together wire themselves together
  const R=LINK_R*TILE;
  for(let i=0;i<S.towers.length;i++)for(let j=i+1;j<S.towers.length;j++){
    const a=S.towers[i],b=S.towers[j];
    if(dist2(a.x,a.y,b.x,b.y)<=R*R){ a.links.push(b); b.links.push(a); }
  }
  // connected-component size drives a grid-wide bonus
  const seen=new Set();
  for(const t of S.towers){
    if(seen.has(t))continue;
    const comp=[],stack=[t]; seen.add(t);
    while(stack.length){ const x=stack.pop(); comp.push(x);
      for(const n of x.links) if(!seen.has(n)){seen.add(n);stack.push(n);} }
    const gridBonus=comp.length>=4?.15:0;
    for(const x of comp){ x.compSize=comp.length; x.gridBonus=gridBonus; }
  }
  for(const t of S.towers){
    const n=Math.min(3,t.links.length);
    t.bDmg+=n*.09+(t.gridBonus||0); t.bRate+=n*.09+(t.gridBonus||0);
  }
  for(const b of S.towers){
    if(!b.def.support)continue;
    const s=tstat(b,true), R2=s.range*TILE;
    for(const t of S.towers){
      if(t===b||t.def.support)continue;
      if(dist2(t.x,t.y,b.x,b.y)<=R2*R2){
        t.bDmg+=s.buffDmg; t.bRate+=s.buffRate; t.bRange+=s.buffRange; t.scrapB+=s.scrap;
      }
    }
  }
  World.updateLinks();
}
/* No hard cap: the Nth turret simply costs more than the first.
   Spamming is possible, it is just a bad deal. */
function buildScale(){
  const relief=Math.pow(.75,S.coreUp.logi||0);
  return 1+BUILD_STEP*relief*S.towers.length;
}
const towerCost=key=>Math.round(TOWERS[key].cost*S.st.cost*buildScale());
function towerPower(t){ return (t.def.power||1)+(t.lvl>=4?1:0); }
function recalcPower(){ /* legacy hook: build pressure is a price now, not a cap */ }
const upgradeCost=t=>t.lvl<4?Math.round(t.def.up[t.lvl-1]*S.st.cost):null;
const eliteCost=(t,i)=>Math.round(t.def.elites[i].c*S.st.cost);
const sellValue=t=>Math.floor(t.spent*.7);

/* ---------- build / upgrade / sell ---------- */
const towerUnlocked=key=>S.stage>=(TOWERS[key].unlock||0);
function unlockText(key){ return '第 '+((TOWERS[key].unlock||0)+1)+' 区解锁'; }
function placeTower(key,c,r){
  if(!towerUnlocked(key)){ sfx('err'); toast(TOWERS[key].name+' 尚未解锁 · '+unlockText(key),'#8d96bd'); return false; }
  const cost=towerCost(key);
  if(S.scrap<cost){sfx('err');toast('碎片不足 · 还差 '+(cost-S.scrap),'#ff4d5e');return false;}
  if(!canBuild(c,r)){sfx('err');toast(buildBlockReason(c,r),'#ff4d5e');return false;}
  const d=TOWERS[key];
  const t={key,def:d,col:c,row:r,x:(c+.5)*TILE,y:(r+.5)*TILE,lvl:1,elite:null,
    cool:0,target:null,mode:key==='sniper'?'strong':'core',spent:cost,kills:0,dealt:0,
    recoil:0,riseT:0,bDmg:0,bRate:0,bRange:0,scrapB:0,flameT:0,
    hp:TOWER_HP[0],maxHp:TOWER_HP[0],flash:0};
  S.scrap-=cost; S.towers.push(t); World.addTower(t); recalcBuffs(); recalcPower();
  sfx('place'); shock(t.x,t.y,.3,1.4,d.c,.5); t.riseT=.45;
  toast(d.name+' 已部署 · 下一座 '+towerCost(key),d.c);
  for(let i=0;i<14;i++)part(t.x,t.y,.4,d.c,{sp:rnd(4,1.5)});
  UI.sync(); return true;
}
function upgradeTower(t){
  const c=upgradeCost(t); if(c==null)return;
  if(S.scrap<c){sfx('err');toast('碎片不足 · 升级需要 '+c,'#ff4d5e');return;}
  S.scrap-=c; t.spent+=c; t.lvl++;
  const ratio=t.hp/t.maxHp;
  t.maxHp=TOWER_HP[t.lvl-1]; t.hp=t.maxHp*Math.max(ratio,.6);
  World.refreshTower(t); recalcBuffs(); recalcPower(); sfx('up');
  shock(t.x,t.y,.35,1.6,t.def.c,.55);
  for(let i=0;i<22;i++)part(t.x,t.y,.5,t.def.c,{sp:rnd(6,2)});
  text(t.x,t.y,1.3,'LV '+t.lvl,t.def.c,15); UI.sync();
}
function eliteTower(t,idx){
  const c=eliteCost(t,idx);
  if(S.scrap<c){sfx('err');toast('碎片不足 · 精英强化需要 '+c,'#ff4d5e');return;}
  S.scrap-=c; t.spent+=c; t.elite=idx;
  t.maxHp+=TOWER_HP_ELITE; t.hp+=TOWER_HP_ELITE;
  World.refreshTower(t); recalcBuffs(); recalcPower(); sfx('up'); sfx('ability',.5);
  shock(t.x,t.y,.35,2.2,'#ffc247',.7);
  for(let i=0;i<34;i++)part(t.x,t.y,.5,'#ffc247',{sp:rnd(8,2)});
  text(t.x,t.y,1.4,t.def.elites[idx].n,'#ffc247',15); UI.sync();
}
function sellTower(t){
  const v=sellValue(t); S.scrap+=v;
  for(let i=0;i<16;i++)part(t.x,t.y,.4,'#ffc247',{sp:rnd(5,1)});
  text(t.x,t.y,1.1,'+'+v,'#ffc247',14);
  World.removeTower(t); S.towers.splice(S.towers.indexOf(t),1);
  if(S.sel===t)selectTower(null);
  recalcBuffs(); recalcPower(); sfx('sell'); UI.sync();
}
function playerTile(){ return {c:Math.floor(S.P.x/TILE), r:Math.floor(S.P.y/TILE)}; }
/* E: plant the selected turret at your feet, or inspect what is already there */
function buildBlockReason(c,r){
  if(c<1||r<1||c>=COLS-1||r>=ROWS-1)return '太靠近战场边缘';
  if(towerAt(c,r))return '此处已有炮塔';
  if(dist2((c+.5)*TILE,(r+.5)*TILE,CX,CY)<((CORE.r+1.15)*TILE)**2)return '核心平台上不能建造';
  for(const o of S.obstacles) if(dist2((c+.5)*TILE,(r+.5)*TILE,o.x,o.y)<((o.r+.55)*TILE)**2)
    return '被'+((PROPS[o.kind]||{}).n||'掩体')+'挡住 · 可先打掉它';
  for(const h of S.hazards) if(dist2((c+.5)*TILE,(r+.5)*TILE,h.x,h.y)<((h.r+.4)*TILE)**2)
    return '地形危害区内不能建造';
  return '此处不可建造';
}
function buildHere(){
  const {c,r}=playerTile();
  const existing=towerAt(c,r);
  if(S.build){
    if(existing){ selectTower(existing); return; }
    if(placeTower(S.build,c,r)){
      // nudge the player clear, then keep the new turret selected so R/T act on it
      const a=S.P.aim+Math.PI;
      S.P.x+=Math.cos(a)*TILE*.55; S.P.y+=Math.sin(a)*TILE*.55;
      selectTower(towerAt(c,r));
    }
    return;
  }
  const near=nearestTower(1.4);
  if(near){ selectTower(near===S.sel?null:near); return; }
  sfx('err'); toast('先按 1–8 选择炮塔','#9fd8ff');
}
function nearestTower(maxTiles){
  let best=null,bv=(maxTiles*TILE)**2;
  for(const t of S.towers){ const d=dist2(t.x,t.y,S.P.x,S.P.y); if(d<bv){bv=d;best=t;} }
  return best;
}
function upgradeHere(){
  const t=nearestTower(1.4)||S.sel;
  if(!t){sfx('err');flashMsg('站到炮塔旁再按 R');return;}
  if(t.hp<t.maxHp*.999){ repairTower(t); return; }
  if(upgradeCost(t)!=null)upgradeTower(t);
  else if(t.elite==null){ selectTower(t); flashMsg('已满级 · 在右侧面板选择精英强化'); }
  else {sfx('err');}
}
function sellHere(){
  const t=nearestTower(1.4)||S.sel;
  if(!t){sfx('err');flashMsg('站到炮塔旁再按 T');return;}
  sellTower(t);
}
function selectTower(t){ S.sel=t; World.setSel(t);
  if(t){const s=tstat(t);World.setRange(t.x,t.y,s.range,t.def.c);}else if(!S.build)World.setRange(null);
  UI.sync(); }

/* ---------- targeting ---------- */
function findTarget(t,s){
  const R=s.range*TILE, R2=R*R; let best=null,bv=-Infinity;
  nearEnemies(t.x,t.y,R,e=>{
    if(!e.alive)return;
    if(e.fly&&!t.def.air)return;
    const dd=dist2(t.x,t.y,e.x,e.y); if(dd>R2)return;
    let v;
    switch(t.mode){
      case 'close': v=-dd; break;
      case 'strong': v=e.hp+e.shield; break;
      case 'weak': v=-(e.hp+e.shield); break;
      default: v=-dist2(e.x,e.y,CX,CY);       // whatever is closest to the Core
    }
    if(v>bv){bv=v;best=e;}
  });
  return best;
}
const inRange=(t,e,R)=>!(e.fly&&!t.def.air)&&dist2(t.x,t.y,e.x,e.y)<=R*R;
function predict(fx,fy,e,speed){
  let tx=e.x,ty=e.y;
  for(let i=0;i<3;i++){
    const d=Math.hypot(tx-fx,ty-fy), tt=d/speed;
    tx=e.x+(e.vx||0)*tt; ty=e.y+(e.vy||0)*tt;
  }
  return {x:tx,y:ty};
}

/* ---------- turret firing ---------- */
function towerFire(t,s){
  const mz=t.obj?t.obj.userData.muzzle:{x:.4,y:.6};
  const ang=Math.atan2(t.target.y-t.y,t.target.x-t.x);
  const ox=t.x+Math.cos(ang)*mz.x*TILE, oy=t.y+Math.sin(ang)*mz.x*TILE, oz=.36+mz.y;
  t.recoil=1;
  switch(t.key){
    case 'arrow':{
      if(s.pierce){
        S.shots.push({kind:'pierce',x:ox,y:oy,z:oz,dx:Math.cos(ang),dy:Math.sin(ang),sp:34*TILE,
          maxD:s.range*TILE*1.15,d:0,dmg:s.dmg,left:s.pierce,hit:new Set(),src:t,color:t.def.c,r:.1});
      }else{
        const p=predict(ox,oy,t.target,30*TILE);
        S.shots.push({kind:'bolt',x:ox,y:oy,z:oz,tgt:t.target,tx:p.x,ty:p.y,sp:30*TILE,
          dmg:s.dmg,shred:s.shredHit,pen:s.pen,src:t,color:t.def.c,r:.09});
      }
      sfx('arrow',.7,rnd(1.15,.85)); muzzle(ox,oy,oz,t.def.c,4,ang); break;
    }
    case 'cannon':{
      const n=s.cluster||1;
      for(let i=0;i<n;i++){
        const p=predict(ox,oy,t.target,14*TILE), sp=n>1?TILE*.9:0;
        S.shots.push({kind:'shell',x:ox,y:oy,z:oz,sx:ox,sy:oy,sz:oz,
          tx:p.x+rnd(sp,-sp),ty:p.y+rnd(sp,-sp),t:0,
          dur:Math.max(.28,Math.hypot(p.x-ox,p.y-oy)/(14*TILE)),
          dmg:s.dmg,splash:s.splash,stun:s.stun,src:t,color:t.def.c,r:.13});
      }
      sfx('cannon',.8); muzzle(ox,oy,oz,'#ffb45a',12,ang); shake(.04); break;
    }
    case 'frost':{
      const p=predict(ox,oy,t.target,16*TILE);
      S.shots.push({kind:'orb',x:ox,y:oy,z:oz,tgt:t.target,tx:p.x,ty:p.y,sp:16*TILE,
        dmg:s.dmg,splash:s.splash,slow:s.slow,freeze:s.freeze,src:t,color:t.def.c,r:.12});
      sfx('frost',.7,rnd(1.1,.9)); break;
    }
    case 'toxin':{
      // not a bullet — a cloud that drifts off and hunts on its own
      if(S.clouds.length<10){
        const a=Math.atan2(t.target.y-oy,t.target.x-ox);
        S.clouds.push({x:ox,y:oy,vx:Math.cos(a)*TILE*1.6,vy:Math.sin(a)*TILE*1.6,
          r:s.splash*1.5,t:0,life:9,dps:s.poison,shred:s.shred,vuln:s.vuln,
          plague:s.plague,slow:.35,src:t,seed:rnd(99),color:t.def.c});
        World.addCloud(S.clouds[S.clouds.length-1]);
      }
      sfx('toxin',.6,rnd(1.15,.85));
      for(let i=0;i<5;i++)part(ox,oy,oz,'#a6e22e',{sp:rnd(2,.4),el:.6,life:.5,r:.14,g:-1});
      break;
    }
    case 'tesla':{
      let cur=t.target,dmg=s.dmg,from={x:ox,y:oy,z:oz};const hit=new Set();
      for(let i=0;i<=s.chain;i++){
        if(!cur)break;
        hit.add(cur);
        beam(from,{x:cur.x,y:cur.y,z:.45},'#c9b6ff',2,.13,.16);
        hurt(cur,dmg,{src:t});
        if(s.stun)applyStun(cur,s.stun);
        burstFx(cur.x,cur.y,.5,'#b39dff',4,4,.09);
        from={x:cur.x,y:cur.y,z:.45}; dmg*=s.falloff;
        let nx=null,nv=1e9;
        nearEnemies(cur.x,cur.y,3.2*TILE,e=>{ if(!e.alive||hit.has(e))return;
          if(e.fly&&!t.def.air)return;
          const dd=dist2(cur.x,cur.y,e.x,e.y); if(dd<(3.2*TILE)**2&&dd<nv){nv=dd;nx=e;} });
        cur=nx;
      }
      sfx('zap',.8); break;
    }
    case 'sniper':{
      const e=t.target;
      if(s.rail){
        const L=s.range*TILE*1.3, ex=t.x+Math.cos(ang)*L, ey=t.y+Math.sin(ang)*L;
        beam({x:ox,y:oy,z:oz},{x:ex,y:ey,z:oz},'#fff2b0',3,.22);
        beam({x:ox,y:oy,z:oz},{x:ex,y:ey,z:oz},t.def.c,6,.3);
        for(const en of S.enemies){ if(!en.alive)continue;
          if(en.fly&&!t.def.air)continue;
          if(ptSegDist(en.x,en.y,t.x,t.y,ex,ey)<TILE*.5){
            hurt(en,s.dmg,{src:t,pierceArmor:true}); burstFx(en.x,en.y,.5,'#fff2b0',6,5,.1); } }
      }else{
        const crit=s.crit&&Math.random()<s.crit;
        beam({x:ox,y:oy,z:oz},{x:e.x,y:e.y,z:.5},crit?'#fff':'#ffe89a',2,.18);
        hurt(e,s.dmg,{src:t,pierceArmor:true,crit});
        if(s.mark)e.markT=4;
        burstFx(e.x,e.y,.5,'#ffe89a',crit?14:7,6,.11);
      }
      sfx('snipe',.8); shake(.04); muzzle(ox,oy,oz,'#ffe89a',8,ang); break;
    }
  }
}
function muzzle(x,y,z,c,n,ang){
  for(let i=0;i<n;i++)part(x,y,z,c,{sp:rnd(7,2.5),ang:ang+rnd(.7,-.7),el:rnd(.3,-.15),life:rnd(.28,.12),r:.1});
  shock(x,y,z,.5,c,.16,.2);
}
function ptSegDist(px,py,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
  let t=l2?((px-ax)*dx+(py-ay)*dy)/l2:0; t=clamp(t,0,1);
  return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
}
function flameTick(t,s,dt){
  const R=s.range*TILE; t.flameT-=dt;
  const ang=t.target?Math.atan2(t.target.y-t.y,t.target.x-t.x):0;
  const list=[];
  nearEnemies(t.x,t.y,R,e=>{
    if(!e.alive||e.fly)return;
    if(dist2(t.x,t.y,e.x,e.y)>R*R)return;
    if(!s.ring&&Math.abs(norm(Math.atan2(e.y-t.y,e.x-t.x)-ang))>.55)return;
    list.push(e);
  });
  if(!list.length)return;
  for(const e of list){
    hurt(e,s.dmg*dt,{src:t,noNum:true,pierceArmor:true});
    if(s.burn>=e.burnDps){e.burnDps=s.burn;e.burnSrc=t;} e.burnT=2.2;
  }
  if(t.flameT<=0){ t.flameT=.055;
    if(s.ring){ for(let i=0;i<4;i++){const a=rnd(TAU);
      part(t.x+Math.cos(a)*R*.4,t.y+Math.sin(a)*R*.4,.5,'#ff9a3d',{sp:rnd(3,1),el:.4,life:.32,r:.15}); } }
    else { for(let i=0;i<3;i++){const a=ang+rnd(.42,-.42),d=rnd(R,TILE*.4);
      part(t.x+Math.cos(a)*d,t.y+Math.sin(a)*d,.5+rnd(.3),'#ff8a2d',{sp:rnd(2.5,.6),el:.5,life:.3,r:.17}); } }
    if(s.magma&&Math.random()<.75&&S.magma.length<22&&t.target)
      S.magma.push({x:t.target.x,y:t.target.y,r:.9,t:0,life:4.5,dps:s.burn*2.2,src:t});
    sfx('flame',.45);
  }
}
function frostAura(t,s,dt){
  const R=s.range*TILE;
  nearEnemies(t.x,t.y,R,e=>{
    if(!e.alive||dist2(t.x,t.y,e.x,e.y)>R*R)return;
    applySlow(e,s.slow,.35);
    hurt(e,s.dmg*.6*dt,{src:t,noNum:true,pierceArmor:true});
  });
  if(Math.random()<dt*14){const a=rnd(TAU),d=rnd(R,0);
    part(t.x+Math.cos(a)*d,t.y+Math.sin(a)*d,.3,'#9fe8ff',{sp:rnd(1,.2),el:.9,life:.7,r:.1,g:-1});}
}

/* ---------- drifting toxin clouds ---------- */
function updateClouds(dt){
  for(let i=S.clouds.length-1;i>=0;i--){
    const c=S.clouds[i];
    c.t+=dt;
    if(c.t>=c.life){ World.removeCloud(c); S.clouds.splice(i,1); continue; }
    // wander, but lean toward whatever crowd is nearby
    let bx=0,by=0,n=0;
    nearEnemies(c.x,c.y,7*TILE,e=>{ if(!e.alive||e.fly)return; bx+=e.x; by+=e.y; n++; });
    if(n){ const a=Math.atan2(by/n-c.y,bx/n-c.x);
      c.vx+=Math.cos(a)*TILE*1.5*dt; c.vy+=Math.sin(a)*TILE*1.5*dt; }
    c.vx+=Math.cos(c.t*1.7+c.seed)*TILE*1.1*dt;
    c.vy+=Math.sin(c.t*1.3+c.seed*1.7)*TILE*1.1*dt;
    const sp=Math.hypot(c.vx,c.vy), lim=TILE*2.4;
    if(sp>lim){ c.vx=c.vx/sp*lim; c.vy=c.vy/sp*lim; }
    c.x=clamp(c.x+c.vx*dt,TILE,W-TILE); c.y=clamp(c.y+c.vy*dt,TILE,H-TILE);
    const R=c.r*TILE;
    nearEnemies(c.x,c.y,R,e=>{
      if(!e.alive||e.fly)return;
      if(dist2(e.x,e.y,c.x,c.y)>R*R)return;
      hurt(e,c.dps*.55*dt,{src:c.src,noNum:true,pierceArmor:true});
      if(c.dps>=e.poisonDps){e.poisonDps=c.dps;e.poisonSrc=c.src;} e.poisonT=2.2;
      if(c.plague)e.poisonPlague=true;
      if(c.shred)e.shred=Math.min(e.armor*.9,(e.shred||0)+c.shred*dt*1.6);
      if(c.vuln){e.vuln=c.vuln;e.vulnT=2;}
      applySlow(e,c.slow,.5);
    });
    if(Math.random()<dt*22){const a=rnd(TAU),d=rnd(R);
      part(c.x+Math.cos(a)*d,c.y+Math.sin(a)*d,.25+rnd(.5),'#a6e22e',
        {sp:rnd(.7,.1),el:.9,life:.9,r:.14,g:-.6});}
  }
}
function clearClouds(){ for(const c of S.clouds)World.removeCloud(c); S.clouds.length=0; }

/* ---------- status ---------- */
function applySlow(e,f,dur){
  f*=1-(e.def.slowRes||0);
  if(f>=e.slowF||e.slowT<=0)e.slowF=f;
  e.slowT=Math.max(e.slowT,dur);
}
function applyStun(e,d){ if(e.def.noStun){applySlow(e,.5,d*1.6);return;} e.stun=Math.max(e.stun,d); }

/* ---------- damage ---------- */
function hurt(e,amount,o={}){
  if(!e.alive)return 0;
  if(e.dodge&&Math.random()<e.dodge){          // phase affix
    text(e.x,e.y,1+e.r/TILE,'闪避','#bfe4ff',12);
    burstFx(e.x,e.y,.5,'#5fd0ff',5,4,.09); return 0; }
  let dmg=amount;
  if(!o.pierceArmor){ const ar=Math.max(0,e.armor-(e.shred||0)-(o.pen||0)); dmg=Math.max(amount*.15,amount-ar); }
  if(e.vulnT>0)dmg*=1+e.vuln;
  if(e.markT>0)dmg*=1.3;
  if(e.auraT>0)dmg*=.82;
  if(o.crit)dmg*=o.critMul||3;
  if(e.shield>0){ const a=Math.min(e.shield,dmg); e.shield-=a; dmg-=a; e.shieldT=3.2;
    if(e.shield<=0){shock(e.x,e.y,.5,1.1,'#4ad2c4',.4);burstFx(e.x,e.y,.5,'#8ef0e4',12,6,.11);sfx('hit',.5);} }
  if(dmg<=0){e.flash=.1;return 0;}
  e.hp-=dmg; e.flash=.12;
  if(o.src&&o.src.dealt!==undefined)o.src.dealt+=dmg;
  // Poise is the PLAYER's lever. Letting turret fire fill it stun-locked
  // everything in range and stopped units ever reaching what they were attacking.
  if(o.fromPlayer){
    // poise is about impact, not penetration: armour must not make anything un-staggerable
    e.poise+=amount*(o.poiseMul||1);
    e.poiseHitT=1.2;
    // keep hitting it and it keeps caring about you
    if(e.aggroT>0)e.aggroT=Math.min((e.def.breakAggro||10)*1.5,e.aggroT+.6);
    e.grudge=(e.grudge||0)+1;
    if(e.grudge>=3&&!e.def.boss)e.aggroT=Math.max(e.aggroT,e.def.breakAggro||10);
    const poise=e.def.poise||1;
    // light units also flinch between breaks
    const kb=clamp(dmg/e.maxHp,0,.35)*TILE*7/poise;
    if(kb>.4&&o.ang!==undefined){ e.kbx+=Math.cos(o.ang)*kb; e.kby+=Math.sin(o.ang)*kb; }
    if(dmg>e.maxHp*.05/poise){ e.stagger=Math.max(e.stagger,.16/poise); e.atkCd=Math.max(e.atkCd,.22/poise); }
    if(e.poise>=e.poiseMax) poiseBreak(e,o.ang);
  }
  if(o.fromPlayer&&S.st.leech&&S.P.alive) healPlayer(dmg*S.st.leech);
  if(o.fromPlayer&&S.P.alive&&S.P.ultT<=0)ultCharge(amount);
  e.numAcc+=dmg;
  if(o.crit)text(e.x,e.y,1.2,'暴击 '+Math.round(dmg),'#fff2b0',16);
  if(e.hp<=0)kill(e,o.src,o.fromPlayer);
  return dmg;
}
/* poise break: the moment your damage actually interrupts something */
function ultCharge(v){
  const P=S.P; if(!P||!P.alive||P.ultT>0)return;
  const need=PLAYER.ultNeed*(1+S.wave*.04);
  const before=P.ult;
  P.ult=Math.min(1,P.ult+v/need);
  if(before<1&&P.ult>=1){ toast('歼灭光束就绪 · 按 Q 释放','#ffe89a'); sfx('level'); }
}
function poiseBreak(e,ang,byTurret){
  e.poise=0; e.poiseBreaks++;
  // each break costs a little more than the last, so nothing can be perma-locked
  e.poiseMax=e.def.hp*Math.pow(e.hpMul,.35)*(e.def.poiseFrac||.6)*Math.min(2.2,1+e.poiseBreaks*.18);
  const stunT=e.def.breakStun||.8;
  e.stagger=Math.max(e.stagger,byTurret?stunT*.5:stunT);
  e.atkCd=Math.max(e.atkCd,(byTurret?stunT*.5:stunT)+.15);
  // only YOUR hits pull its attention; turret fire just staggers it in place
  if(!byTurret)e.aggroT=Math.max(e.aggroT,e.def.breakAggro||5);
  e.breakFlash=.5;
  const a=ang!==undefined?ang:rnd(TAU);
  const push=TILE*(e.boss?3:e.def.poise>2?5:9)*(byTurret?.3:1);
  e.kbx+=Math.cos(a)*push; e.kby+=Math.sin(a)*push;
  text(e.x,e.y,1.2+e.r/TILE,'架势崩溃!','#ffe89a',15);
  hitStop(e.boss?.13:e.def.poise>2?.09:.045);
  shock(e.x,e.y,.4,1.6+e.r/26,'#ffffff',.42);
  shock(e.x,e.y,.4,2.4+e.r/22,'#ffc247',.6);
  burstFx(e.x,e.y,.5,'#fff2b0',18,7,.14);
  shake(e.boss?.35:.16);
  sfx('snipe',.55,1.5);
}
function kill(e,src,byPlayer){
  if(!e.alive)return;
  e.alive=false;
  S.kills++; S.combo++; S.comboT=2.6;
  if(byPlayer!==false)ultCharge(e.maxHp*.10);
  const mul=(1+(src&&src.scrapB?src.scrapB:0)+S.st.scrapGain)*S.diff.rw;
  const bonus=e.mini?6:e.affix?2.6:1;
  const sc=e.mini?e.mini.scrap:e.def.scrap*bonus;
  const xp=e.mini?e.mini.xp:e.def.xp*bonus;
  dropLoot(e.x,e.y,Math.max(1,Math.round(sc*mul)),Math.max(1,Math.round(xp*(1+S.st.scrapGain*.5))),e.boss);
  if(e.deathFx==='blast'){
    shock(e.x,e.y,.4,3.4,'#ffc247',.7);
    burstFx(e.x,e.y,.5,'#ffc247',34,9,.2); shake(.35); sfx('boom',.9);
    nearEnemies(e.x,e.y,3.2*TILE,o=>{ if(o.alive&&o!==e&&dist2(o.x,o.y,e.x,e.y)<(3.2*TILE)**2)
      hurt(o,e.maxHp*.16,{pierceArmor:true}); });
    const P=S.P;
    if(P.alive&&dist2(P.x,P.y,e.x,e.y)<(3.2*TILE)**2)hurtPlayer(28*(1+S.wave*.05),null);
  }
  if(e.mini){ log('★ 击杀 '+e.mini.n);
    spawnPickup(null,e.x,e.y); spawnPickup(null,e.x+TILE*1.2,e.y);
    toast(e.mini.n+' 被击杀 · 掉落补给','#ffc247'); }
  else if(e.boss){ for(let i=0;i<3;i++)spawnPickup(null,e.x+rnd(TILE*2,-TILE*2),e.y+rnd(TILE*2,-TILE*2)); }
  else if(e.affix&&Math.random()<.55)spawnPickup(null,e.x,e.y);
  else if(Math.random()<.012)spawnPickup(null,e.x,e.y);
  // a long kill streak also shakes something loose
  if(S.combo>0&&S.combo%25===0){ spawnPickup(null,S.P.x+rnd(TILE*2,-TILE*2),S.P.y+rnd(TILE*2,-TILE*2));
    toast('连杀 ×'+S.combo+' · 补给掉落','#ffc247'); }
  if(src&&src.kills!==undefined)src.kills++;
  const n=e.boss?70:e.def.hp>200?26:14;
  burstFx(e.x,e.y,.45,e.def.c,n,e.boss?11:6,e.boss?.28:.15);
  shock(e.x,e.y,.3,e.boss?4.5:1+e.r/22,e.def.c,e.boss?.9:.42);
  if(e.boss){shake(.9);hitStop(.22);sfx('boom',1);log('★ 击杀 '+e.def.name);}
  else sfx('hit',.6);
  if(e.def.split) for(const s of e.def.split)
    spawnEnemyAt(s,e.x+rnd(TILE*.7,-TILE*.7),e.y+rnd(TILE*.7,-TILE*.7),e.hpMul*.55);
  if(e.poisonPlague&&e.poisonT>0){
    nearEnemies(e.x,e.y,2.6*TILE,o=>{ if(!o.alive||o===e)return;
      if(dist2(o.x,o.y,e.x,e.y)<(2.6*TILE)**2){
        o.poisonDps=Math.max(o.poisonDps,e.poisonDps*.8); o.poisonT=3.4; o.poisonPlague=true;
        beam({x:e.x,y:e.y,z:.5},{x:o.x,y:o.y,z:.5},'#a6e22e',2,.35); } });
  }
  World.removeEnemy(e,true);
}
function dropLoot(x,y,scrap,xp,boss){
  const n=boss?14:1+(scrap>8?2:0);
  for(let i=0;i<n;i++)
    S.drops.push({kind:'scrap',x:x+rnd(18,-18),y:y+rnd(18,-18),v:Math.ceil(scrap/n),t:0});
  const nx=boss?10:1+(xp>10?1:0);
  for(let i=0;i<nx;i++)
    S.drops.push({kind:'xp',x:x+rnd(18,-18),y:y+rnd(18,-18),v:Math.ceil(xp/nx),t:0});
  if(S.drops.length>260)S.drops.splice(0,S.drops.length-260);
}

/* ---------- enemies ---------- */
function rimSpawnPoint(){
  const side=(Math.random()*4)|0, m=TILE*1.1;
  if(side===0)return{x:rnd(W-m,m),y:m};
  if(side===1)return{x:rnd(W-m,m),y:H-m};
  if(side===2)return{x:m,y:rnd(H-m,m)};
  return{x:W-m,y:rnd(H-m,m)};
}
const ELITE_POOL=['grunt','runner','brute','flyer','shooter','shield','splitter'];
/* the wave table can ask for "an elite" or "the region's champion";
   resolve those into a real unit here, wherever it is being spawned from */
function spawnUnit(type,x,y){
  if(type==='__elite'){
    const base=pick(ELITE_POOL.filter(k=>k!=='shooter'||S.wave>=6));
    return spawnEnemyAt(base,x,y,null,{affix:pick(AFFIX_KEYS)});
  }
  if(type==='__miniboss'){
    const mb=MINIBOSS[S.map.id]||MINIBOSS.ring;
    return spawnEnemyAt(mb.base,x,y,null,{affix:mb.affix,mini:mb});
  }
  return spawnEnemyAt(type,x,y);
}
function spawnEnemy(type){ const p=rimSpawnPoint(); return spawnUnit(type,p.x,p.y); }
function spawnEnemyAt(type,x,y,hpMulOverride,opt){
  if(type&&type[0]==='_')return spawnUnit(type,x,y);
  const def=ENEMIES[type];
  const A=opt&&opt.affix?AFFIX[opt.affix]:null;
  const MB=opt&&opt.mini?opt.mini:null;
  let hpMul=hpMulOverride!=null?hpMulOverride:hpScale(S.wave)*S.diff.hp;
  if(A)hpMul*=A.hp;
  if(MB)hpMul*=MB.hp;
  const e={
    type,def,x,y,vx:0,vy:0,face:0,
    hp:def.hp*hpMul,maxHp:def.hp*hpMul,hpMul,
    shield:(def.shield||0)*hpMul,maxShield:(def.shield||0)*hpMul,shieldT:0,
    armor:def.armor*(1+S.wave*.016)*(A&&A.armor?A.armor:1),
    sp:def.sp*spScale(S.wave)*(A&&A.sp?A.sp:1),curSp:def.sp,
    r:def.r*(MB?1.25:A?1.12:1),fly:!!def.fly,boss:!!def.boss||!!MB,
    scale:(def.scale||1)*(MB?MB.scale:A?1.18:1),
    affix:opt&&opt.affix||null, affixDef:A, mini:MB, ai:(A&&A.ai)||null,
    lungeCd:rnd(2), blinkCd:rnd(3),
    name:MB?MB.n:(A?A.n+'·'+def.name:def.name),
    atkMul:(A&&A.atk?A.atk:1), regenPct:(A&&A.regen?A.regen:0),
    dodge:(A&&A.dodge?A.dodge:0), deathFx:(A&&A.death)||null,
    auraR:(A&&A.aura?A.aura:0),
    alive:true,flash:0,slowF:0,slowT:0,stun:0,burnDps:0,burnT:0,poisonDps:0,poisonT:0,
    poisonPlague:false,shred:0,vuln:0,vulnT:0,markT:0,auraT:0,numAcc:0,numT:0,
    atkCd:rnd(.6),seed:rnd(99),corruptT:0,icy:0,recoilT:0,blockedBy:null,touchT:0,touching:null,
    aggroT:0,stagger:0,kbx:0,kby:0,
    sapper:!!def.siege&&Math.random()<(def.sap!=null?def.sap:1), sapT:null,
    poise:0, poiseMax:def.hp*Math.pow(hpMul,.35)*(def.poiseFrac||.6), poiseBreaks:0, breakFlash:0, poiseHitT:0,
  };
  S.enemies.push(e); World.addEnemy(e);
  if(MB){ sfx('boss'); shake(.55); banner('精英首领 · '+MB.n); log('⚑ '+MB.n+' 出现'); }
  else if(def.boss){ sfx('boss'); shake(.7); banner('BOSS · '+def.name); }
  else if(A){ shock(x,y,.4,1.6,A.c,.6); sfx('hit',.7,.7); }
  return e;
}
function enemyTarget(e){
  const P=S.P;
  const core={x:CX,y:CY,isCore:true,r:CORE.r*TILE};
  if(P&&P.alive&&e.aggroT>0)return P;
  // stand in its face and it will deal with you first
  if(P&&P.alive&&dist2(e.x,e.y,P.x,P.y)<(2.6*TILE)**2){
    if(e.proxT===undefined)e.proxT=0;
    return P;
  }
  // --- elite personalities ---
  if(e.ai==='hunter'&&P&&P.alive)return P;                    // berserk: comes for you
  if(e.ai==='bomber'){                                        // volatile: whichever is nearer
    if(P&&P.alive&&dist2(e.x,e.y,P.x,P.y)<dist2(e.x,e.y,CX,CY))return P;
    return core;
  }
  if(e.ai==='blink'&&P&&P.alive)return P;                     // phase: teleports onto you
  if(e.ai==='breaker'){                                       // bulwark: dismantles your defences
    let best=null,bv=(9*TILE)**2;
    for(const t of S.towers){ const dd=dist2(e.x,e.y,t.x,t.y); if(dd<bv){bv=dd;best=t;} }
    if(best)return {x:best.x,y:best.y,isTower:true,tower:best,r:TILE*.42};
  }
  if(e.ai==='coward'&&e.hp<e.maxHp*.75){                      // revenant: retreats to heal
    const ax=e.x-CX, ay=e.y-CY, l=Math.hypot(ax,ay)||1;
    return {x:CX+ax/l*17*TILE, y:CY+ay/l*17*TILE, isFlee:true, r:0};
  }
  if(e.ai==='commander'){                                     // warden: hides behind the pack
    let sx=0,sy=0,n=0;
    nearEnemies(e.x,e.y,8*TILE,o=>{ if(o!==e&&o.alive&&!o.ai){ sx+=o.x; sy+=o.y; n++; } });
    if(n>=2){
      const mx2=sx/n, my2=sy/n;
      const ax=mx2-CX, ay=my2-CY, l=Math.hypot(ax,ay)||1;
      return {x:mx2+ax/l*3.2*TILE, y:my2+ay/l*3.2*TILE, isFollow:true, r:0};
    }
  }
  // sappers -- a rolled fraction of the pack -- stop to wreck a turret they walk past.
  // Only sappers divert, and once one commits it stays on that turret, so the threat
  // reads as "those three are on my guns" instead of the whole wave nibbling everything.
  if(e.sapper){
    if(e.sapT&&!e.sapT.dead&&e.sapT.hp>0&&
       dist2(e.x,e.y,e.sapT.x,e.sapT.y)<(e.def.siege*TILE*1.9)**2)
      return {x:e.sapT.x,y:e.sapT.y,isTower:true,tower:e.sapT,r:TILE*.42};
    e.sapT=null;
    const R=e.def.siege*TILE; let best=null,bv=R*R;
    for(const t of S.towers){ const dd=dist2(e.x,e.y,t.x,t.y); if(dd<bv){bv=dd;best=t;} }
    if(best){ e.sapT=best;
      return {x:best.x,y:best.y,isTower:true,tower:best,r:TILE*.42}; }
  }
  if(!P||!P.alive)return core;                       // you shot it; it wants you now
  if(e.def.aim==='player')return P;
  if(e.def.aim==='both'){
    const dp=dist2(e.x,e.y,P.x,P.y), dc=dist2(e.x,e.y,CX,CY);
    return dp<dc*.75?P:core;
  }
  if(dist2(e.x,e.y,P.x,P.y)<(TILE*1.6)**2)return P;
  return core;
}
function updateEnemy(e,dt){
  const P=S.P;
  if(e.flash>0)e.flash-=dt;
  if(e.markT>0)e.markT-=dt;
  if(e.vulnT>0)e.vulnT-=dt;
  if(e.auraT>0)e.auraT-=dt;
  if(e.slowT>0){e.slowT-=dt; if(e.slowT<=0)e.slowF=0;}
  if(e.stun>0)e.stun-=dt;
  if(e.burnT>0){ e.burnT-=dt; hurt(e,e.burnDps*dt,{noNum:true,pierceArmor:true,src:e.burnSrc});
    if(Math.random()<dt*9)part(e.x,e.y,.4,'#ff8a2d',{sp:rnd(1.4,.3),el:1,life:.42,r:.1,g:-2});
    if(e.burnT<=0)e.burnDps=0; }
  if(e.poisonT>0){ e.poisonT-=dt; hurt(e,e.poisonDps*dt,{noNum:true,pierceArmor:true,src:e.poisonSrc});
    if(Math.random()<dt*7)part(e.x,e.y,.4,'#a6e22e',{sp:rnd(1,.2),el:1,life:.5,r:.09,g:-2});
    if(e.poisonT<=0){e.poisonDps=0;e.poisonPlague=false;} }
  if(!e.alive)return;
  if(e.shieldT>0)e.shieldT-=dt;
  else if(e.shield<e.maxShield&&e.maxShield>0)e.shield=Math.min(e.maxShield,e.shield+e.maxShield*.11*dt);
  if(e.numT>0)e.numT-=dt;
  else if(e.numAcc>=1){ text(e.x,e.y,.7+e.r/TILE,Math.round(e.numAcc),'#ffd7e2',13); e.numAcc=0; e.numT=.28; }

  // terrain hazards: ground units only
  if(!e.fly){
    const hz=hazardAt(e.x,e.y);
    if(hz){
      const H=HAZARD[hz.kind];
      if(H.dps&&hz.kind!=='corrupt'){
        hurt(e,H.dps*dt,{noNum:true,pierceArmor:true});
        if(Math.random()<dt*5)part(e.x,e.y,.3,H.c,{sp:rnd(1.4,.3),el:1,life:.4,r:.08,g:-2});
      }
      if(hz.kind==='corrupt'){ e.corruptT=.2; }
      if(hz.kind==='ice'){ e.icy=.2; }
    }
  }
  if(e.corruptT>0)e.corruptT-=dt;
  if(e.icy>0)e.icy-=dt;
  for(const m of S.magma) if(!e.fly&&dist2(e.x,e.y,m.x,m.y)<(m.r*TILE)**2){
    hurt(e,m.dps*dt,{noNum:true,pierceArmor:true,src:m.src});
    if(m.dps*.5>=e.burnDps){e.burnDps=m.dps*.5;e.burnSrc=m.src;} e.burnT=Math.max(e.burnT,1); }

  if(e.def.heal){
    e.healT=(e.healT||0)-dt;
    if(e.healT<=0){ e.healT=.5;
      nearEnemies(e.x,e.y,e.def.healR*TILE,o=>{ if(!o.alive||o===e)return;
        if(dist2(o.x,o.y,e.x,e.y)<(e.def.healR*TILE)**2&&o.hp<o.maxHp){
          o.hp=Math.min(o.maxHp,o.hp+e.def.heal*e.hpMul*.25);
          beam({x:e.x,y:e.y,z:.6},{x:o.x,y:o.y,z:.5},'#7ef0a8',2,.3); } }); }
  }
  if(e.def.aura) nearEnemies(e.x,e.y,e.def.auraR*TILE,o=>{
    if(o!==e&&o.alive&&dist2(o.x,o.y,e.x,e.y)<(e.def.auraR*TILE)**2)o.auraT=.2; });
  // warden affix projects the same buff
  if(e.auraR) nearEnemies(e.x,e.y,e.auraR*TILE,o=>{
    if(o!==e&&o.alive&&dist2(o.x,o.y,e.x,e.y)<(e.auraR*TILE)**2)o.auraT=.2; });
  if(e.regenPct&&e.hp<e.maxHp)e.hp=Math.min(e.maxHp,e.hp+e.maxHp*e.regenPct*dt);

  if(e.breakFlash>0)e.breakFlash-=dt;
  if(e.poiseHitT>0)e.poiseHitT-=dt;
  else if(e.poise>0&&e.stagger<=0)e.poise=Math.max(0,e.poise-e.poiseMax*.22*dt);
  // lingering irritation after you have been in its face
  if(P&&P.alive&&dist2(e.x,e.y,P.x,P.y)<(2.6*TILE)**2&&!e.def.boss)
    e.aggroT=Math.max(e.aggroT,2.2);
  if(e.aggroT>0){
    e.aggroT-=dt;
    if(Math.random()<dt*3)part(e.x,e.y,.9+e.r/TILE,'#ff4d5e',{sp:rnd(.9,.2),el:1,life:.5,r:.07,g:-1});
  }
  if(e.stagger>0)e.stagger-=dt;
  if(e.recoilT>0)e.recoilT-=dt;
  if(e.lungeCd>0)e.lungeCd-=dt;
  if(e.blinkCd>0)e.blinkCd-=dt;
  // knockback carries over a few frames so hits read as impacts
  if(e.kbx||e.kby){
    e.x+=e.kbx*dt; e.y+=e.kby*dt;
    const damp=Math.min(1,dt*9); e.kbx-=e.kbx*damp; e.kby-=e.kby*damp;
    if(Math.abs(e.kbx)<1&&Math.abs(e.kby)<1)e.kbx=e.kby=0;
    if(!e.fly){ resolveObstacles(e,e.r/TILE); resolveTowers(e,e.r/TILE); }
  }
  if(e.stun>0){ e.curSp=0;
    if(Math.random()<dt*6)part(e.x,e.y,.5,'#9fe8ff',{sp:rnd(1,.2),el:1,life:.4,r:.08,g:-1});
    return; }
  if(e.stagger>0){ e.curSp=0; return; }         // interrupted: it cannot advance or swing

  // --- steering ---
  const tgt=enemyTarget(e);
  const tr=tgt.isCore?tgt.r:(tgt.r||PLAYER.r)*TILE;
  let dx=tgt.x-e.x, dy=tgt.y-e.y;
  const d=Math.hypot(dx,dy)||1;
  const reach=tr+e.r+ (e.def.atkR||.6)*TILE*0;
  const wantD=e.def.keepAway?e.def.keepAway*TILE:tr+e.r*.8;
  let ax,ay;
  if(e.recoilT>0){ ax=-dx/d; ay=-dy/d; }                        // just swung: peel off
  else if(e.def.keepAway&&d<wantD*.85){ ax=-dx/d; ay=-dy/d; }   // ranged units back off
  else if(d>wantD){ ax=dx/d; ay=dy/d; }
  else { ax=0; ay=0; }

  // separation from neighbours so the swarm spreads instead of stacking
  let sx=0,sy=0;
  const sep=(e.r+14);
  nearEnemies(e.x,e.y,sep*2.2,o=>{
    if(o===e||!o.alive)return;
    const ox=e.x-o.x, oy=e.y-o.y, dd=ox*ox+oy*oy, rr=(e.r+o.r)*1.25;
    if(dd<rr*rr&&dd>1e-4){ const dl=Math.sqrt(dd); sx+=ox/dl*(1-dl/rr); sy+=oy/dl*(1-dl/rr); }
  });
  ax+=sx*(e.blockedBy?.5:1.35); ay+=sy*(e.blockedBy?.5:1.35);
  const al=Math.hypot(ax,ay);
  let sp=e.sp*(1-e.slowF);
  if(e.auraT>0&&!e.def.aura)sp*=1.22;
  // berserk lunges: a short, telegraphed burst of speed
  if(e.ai==='hunter'){
    if(e.lungeT>0){ e.lungeT-=dt; sp*=2.6; 
      if(Math.random()<dt*24)part(e.x,e.y,.4,'#ff5a3d',{sp:rnd(1.4,.3),life:.3,r:.1,g:0}); }
    else if(e.lungeCd<=0&&P&&P.alive&&dist2(e.x,e.y,P.x,P.y)<(6*TILE)**2){
      e.lungeT=.55; e.lungeCd=rnd(4.5,2.8);
      shock(e.x,e.y,.4,1.2,'#ff5a3d',.35); }
  }
  // bomber accelerates as it closes
  if(e.ai==='bomber'&&d<5*TILE)sp*=1.5;
  // coward sprints when running away
  if(e.ai==='coward'&&tgt.isFlee)sp*=1.5;
  if(e.corruptT>0)sp*=1.3;          // corruption drives them into a frenzy
  if(e.icy>0)sp*=1.22;              // and ice makes them skid
  e.curSp=sp;
  let wx=0,wy=0;
  if(al>1e-4){
    wx=ax/al; wy=ay/al;
    e.vx=wx*sp*TILE; e.vy=wy*sp*TILE;
    e.x+=e.vx*dt; e.y+=e.vy*dt;
    e.face=Math.atan2(e.vy,e.vx);
  } else { e.vx=e.vy=0; e.face=Math.atan2(dy,dx); }
  const px0=e.x-e.vx*dt, py0=e.y-e.vy*dt;
  if(!e.fly){
    resolveObstacles(e,e.r/TILE);
    const touch=resolveTowers(e,e.r/TILE);        // flying units ignore walls entirely
    // sustained contact means the turret is in the way; a graze never adds up
    if(touch){ e.touchT=(e.touchT||0)+dt; e.touching=touch; }
    else { e.touchT=Math.max(0,(e.touchT||0)-dt*3); e.touching=null; }
    e.blockedBy=(e.touching&&e.touchT>.2)?e.touching:null;
  } else { e.blockedBy=null; e.stuckT=0; e.x=clamp(e.x,TILE*.5,W-TILE*.5); e.y=clamp(e.y,TILE*.5,H-TILE*.5); }
  // soft body collision with the player: they crowd around you, never inside you
  if(P&&P.alive){
    const R=e.r+PLAYER.r*TILE*.95, ddx=e.x-P.x, ddy=e.y-P.y, dd=ddx*ddx+ddy*ddy;
    if(dd<R*R&&dd>1e-6){ const dl=Math.sqrt(dd), k=(R-dl)/dl; e.x+=ddx*k; e.y+=ddy*k; }
  }

  // phase elites blink to your flank
  if(e.ai==='blink'&&e.blinkCd<=0&&P&&P.alive){
    const dd=Math.hypot(P.x-e.x,P.y-e.y);
    if(dd>3.5*TILE&&dd<16*TILE){
      e.blinkCd=rnd(5,3.2);
      burstFx(e.x,e.y,.5,'#5fd0ff',16,6,.13); shock(e.x,e.y,.3,1.4,'#5fd0ff',.4);
      const a=rnd(TAU);
      e.x=clamp(P.x+Math.cos(a)*TILE*2.2,TILE,W-TILE);
      e.y=clamp(P.y+Math.sin(a)*TILE*2.2,TILE,H-TILE);
      if(!e.fly)resolveObstacles(e,e.r/TILE);
      burstFx(e.x,e.y,.5,'#bfe4ff',16,6,.13); sfx('dash',.6,1.4);
    }
  }
  // volatile elites do not wait to be killed — they detonate on contact
  if(e.ai==='bomber'){
    const P2=S.P;
    const nearCore=dist2(e.x,e.y,CX,CY)<((CORE.r+e.r/TILE+.4)*TILE)**2;
    const nearYou=P2.alive&&dist2(e.x,e.y,P2.x,P2.y)<((PLAYER.r+e.r/TILE+.3)*TILE)**2;
    if(nearCore||nearYou){
      if(nearCore)damageCore(e.def.atk*(1+S.wave*.05)*2.2,e);
      text(e.x,e.y,1.6,'引爆!','#ffc247',16);
      hurt(e,e.hp+1,{pierceArmor:true});      // triggers the volatile death blast
      return;
    }
  }

  // --- ranged attack: many units shoot while closing, not just the dedicated shooter ---
  if(e.def.shot&&!e.stagger&&e.stun<=0){
    const S0=e.def.shot;
    e.shotCd=(e.shotCd===undefined?rnd(S0.rate):e.shotCd)-dt;
    const P2=S.P;
    let tx2,ty2,toCore=false;
    // if you are inside its firing envelope it shoots YOU, full stop
    const inRangeOfPlayer=P2.alive&&dist2(e.x,e.y,P2.x,P2.y)<(S0.range*TILE)**2;
    if(inRangeOfPlayer){ tx2=P2.x; ty2=P2.y; }
    else { tx2=CX; ty2=CY; toCore=true; }
    const dd=Math.hypot(tx2-e.x,ty2-e.y);
    if(e.shotCd<=0&&dd<S0.range*TILE&&dd>TILE*1.7){
      e.shotCd=S0.rate*rnd(1.15,.85);
      const base=Math.atan2(ty2-e.y,tx2-e.x);
      const n=S0.n||1;
      for(let i=0;i<n;i++){
        const a=base+(n>1?(i-(n-1)/2)*.16:0)+rnd(.05,-.05);
        const b={x:e.x+Math.cos(a)*e.r,y:e.y+Math.sin(a)*e.r,z:.55,
          dx:Math.cos(a),dy:Math.sin(a),sp:S0.sp*TILE,
          dmg:S0.dmg*(1+S.wave*.05)*(e.atkMul||1),d:0,maxD:S0.range*TILE*1.25,
          color:e.affixDef?e.affixDef.c:e.def.c,r:S0.style==='siege'?.22:S0.style==='mortar'?.17:.13,
          style:S0.style,toCore};
        S.ebullets.push(b); World.addShot(b);
      }
      muzzle(e.x+Math.cos(base)*e.r,e.y+Math.sin(base)*e.r,.55,e.def.c,4,base);
      sfx(S0.style==='siege'?'cannon':'toxin',.5,S0.style==='siege'?.8:1.2);
    }
  }

  // --- attack ---
  e.atkCd-=dt;
  // something solid is in the way: break it down before moving on
  if(e.blockedBy&&e.atkCd<=0&&!e.def.ranged){
    e.atkCd=e.def.atkRate;
    damageTower(e.blockedBy,e.def.atk*(1+S.wave*.05)*(e.atkMul||1)*.55,e);
    burstFx(e.blockedBy.x,e.blockedBy.y,.6,'#ff8a8a',6,4,.11);
    return;                                   // keep hammering; no bounce-off on structures
  }
  const atkReach=e.def.ranged?e.def.atkR*TILE:tr+e.r+e.def.atkR*TILE;
  if(d<=atkReach&&e.atkCd<=0){
    e.atkCd=e.def.atkRate;
    const dmg=e.def.atk*(1+S.wave*.05)*(e.atkMul||1);
    if(e.def.ranged){
      const a=Math.atan2(dy,dx);
      S.ebullets.push({x:e.x+Math.cos(a)*e.r,y:e.y+Math.sin(a)*e.r,z:.5,
        dx:Math.cos(a),dy:Math.sin(a),sp:13*TILE,dmg,d:0,maxD:atkReach*1.2,
        color:e.def.c,r:.13,toCore:!!tgt.isCore});
      World.addShot(S.ebullets[S.ebullets.length-1]);
      sfx('toxin',.4,1.4);
    } else if(tgt.isFlee||tgt.isFollow){ /* repositioning, not attacking */ }
    else if(tgt.isTower){
      damageTower(tgt.tower,dmg*.5,e);
      burstFx(tgt.x,tgt.y,.6,'#ff8a8a',6,4,.11);
      e.recoilT=(e.def.recoil||0)*.4;
    }
    else if(tgt.isCore){ damageCore(dmg,e); e.recoilT=(e.def.recoil||0)*.5; }
    else { hurtPlayer(dmg,e); e.recoilT=e.def.recoil||0; }
  }
}

/* ---------- destructible scenery ---------- */
function damageProp(o,dmg,ang){
  if(o.hp<=0)return;
  o.hp-=dmg; o.flash=.14;
  burstFx(o.x,o.y,.6,'#cfd8f0',4,4,.09);
  if(o.hp<=0)destroyProp(o,ang);
}
function destroyProp(o,ang){
  const P0=PROPS[o.kind]||{scrap:10,fx:'none',n:'掩体'};
  const R=(o.r+1.6)*TILE;
  const scrap=Math.round(P0.scrap*(1+S.wave*.08)*S.diff.rw*(1+S.st.scrapGain));
  dropLoot(o.x,o.y,scrap,Math.round(6+S.wave*.6),false);
  burstFx(o.x,o.y,.6,'#9fb0dc',26,7,.18);
  shock(o.x,o.y,.3,o.r*1.8,'#cfd8f0',.5);
  shake(.12); sfx('boom',.55);
  const hitAll=(fn)=>nearEnemies(o.x,o.y,R,e=>{ if(!e.alive)return;
    if(dist2(e.x,e.y,o.x,o.y)>R*R)return; fn(e); });
  switch(P0.fx){
    case 'blast':{
      const BR=(o.r+3.4)*TILE;                      // much wider than a normal prop effect
      shock(o.x,o.y,.3,o.r*5.5,'#ffb45a',.9,.3);
      shock(o.x,o.y,.3,o.r*3.2,'#fff2b0',.6);
      shock(o.x,o.y,.3,o.r*7.5,'#ff6b3d',1.3,.18);
      for(let i=0;i<80;i++)part(o.x,o.y,.5,pick(['#ffb45a','#ff6b3d','#fff2b0','#ffffff']),
        {sp:rnd(17,3),r:rnd(.3,.09)});
      let hits=0;
      nearEnemies(o.x,o.y,BR,e=>{ if(!e.alive)return;
        const dd=Math.sqrt(dist2(e.x,e.y,o.x,o.y)); if(dd>BR)return;
        hits++;
        hurt(e,240*(1+S.wave*.14)*clamp(1-dd/BR*.5,.5,1),
          {pierceArmor:true,fromPlayer:true,ang:Math.atan2(e.y-o.y,e.x-o.x),poiseMul:2.4});
        const a=Math.atan2(e.y-o.y,e.x-o.x), kb=TILE*11/Math.max(1,(e.def.poise||1)*.6);
        e.kbx+=Math.cos(a)*kb; e.kby+=Math.sin(a)*kb; });
      const P3=S.P;
      if(P3.alive&&dist2(P3.x,P3.y,o.x,o.y)<BR*BR)hurtPlayer(34*(1+S.wave*.05),null);
      if(hits)toast('弹药箱殉爆 · 波及 '+hits+' 个敌人','#ffb45a');
      shake(.75); hitStop(.09); S.flash=Math.max(S.flash,.22); sfx('boom',1.3); break; }
    case 'steam':
      hitAll(e=>{ hurt(e,60*(1+S.wave*.1),{pierceArmor:true,fromPlayer:true,poiseMul:1.4});
        applySlow(e,.5,3.5); });
      for(let i=0;i<30;i++)part(o.x,o.y,.4,'#e8f4ff',{sp:rnd(6,1),el:1.3,life:.9,r:.16,g:-2}); break;
    case 'emp':
      hitAll(e=>{ applyStun(e,1.8); burstFx(e.x,e.y,.5,'#9fe8ff',6,5,.1); });
      shock(o.x,o.y,.3,o.r*3.4,'#9fe8ff',.8); sfx('zap',1); break;
    case 'rubble':
      S.hazards.push({kind:'ice',x:o.x,y:o.y,r:o.r*1.5,seed:o.seed,t:0,phase:'idle',obj:null,temp:14});
      World.addHazardLate(S.hazards[S.hazards.length-1]); break;
    case 'frost':
      hitAll(e=>{ hurt(e,45*(1+S.wave*.1),{pierceArmor:true,fromPlayer:true});
        applyStun(e,1.1); applySlow(e,.6,4); });
      shock(o.x,o.y,.3,o.r*3,'#9fe8ff',.7); sfx('frost',1); break;
    case 'lava':
      S.magma.push({x:o.x,y:o.y,r:o.r*1.3,t:0,life:14,dps:34*(1+S.wave*.08),src:null});
      hitAll(e=>hurt(e,40,{pierceArmor:true,fromPlayer:true})); break;
    case 'fire':
      hitAll(e=>{ hurt(e,55*(1+S.wave*.1),{pierceArmor:true,fromPlayer:true});
        e.burnDps=Math.max(e.burnDps,26*(1+S.wave*.08)); e.burnT=4.5; });
      for(let i=0;i<34;i++)part(o.x,o.y,.5,pick(['#ff8a2d','#ffb45a']),{sp:rnd(9,2),el:.9,life:.7,r:.16}); break;
    case 'void':
      hitAll(e=>{ hurt(e,70*(1+S.wave*.1),{pierceArmor:true,fromPlayer:true,poiseMul:1.6}); });
      S.overT=Math.max(S.overT,4);
      shock(o.x,o.y,.3,o.r*3.6,'#b06cff',.9);
      text(o.x,o.y,2,'虚空脉冲 · 火力过载','#d0a0ff',15); sfx('ability',.8); break;
    case 'crush':
      hitAll(e=>{ hurt(e,150*(1+S.wave*.12),{pierceArmor:true,fromPlayer:true,poiseMul:2}); });
      shake(.45); shock(o.x,o.y,.3,o.r*2.6,'#8a6ad0',.7); break;
  }
  log('摧毁 '+P0.n+' · +'+scrap+' 碎片');
  World.removeProp(o);
  const i=S.obstacles.indexOf(o); if(i>=0)S.obstacles.splice(i,1);
}
function damageTower(t,dmg,src){
  t.hp-=dmg; t.flash=.14; t.hitT=1.4;
  S.towerAlarm=Math.max(S.towerAlarm||0,1.4);
  if(t.hp<t.maxHp*.35&&!t.criedFor){ t.criedFor=1;
    toast(t.def.name+' 结构告急 · 走过去按 R 维修','#ff8a8a');
    sfx('err',.6); }
  if(t.hp<=0)destroyTower(t);
}
function destroyTower(t){
  t.dead=true;
  burstFx(t.x,t.y,.5,t.def.c,30,8,.18);
  shock(t.x,t.y,.3,2.2,t.def.c,.6); shake(.3); sfx('boom',.8);
  text(t.x,t.y,1.4,'炮塔被摧毁','#ff4d5e',15);
  log('✖ '+t.def.name+' 被摧毁');
  World.removeTower(t);
  const i=S.towers.indexOf(t); if(i>=0)S.towers.splice(i,1);
  if(S.sel===t)selectTower(null);
  recalcBuffs(); recalcPower(); UI.sync();
}
function repairCost(t){ return Math.ceil((t.maxHp-t.hp)/6); }
function repairTower(t){
  if(t.hp>=t.maxHp){toast('结构完好，无需维修','#9fd8ff');return true;}
  const c=repairCost(t);
  if(S.scrap<c){sfx('err');toast('碎片不足 · 维修需要 '+c,'#ff4d5e');return true;}
  S.scrap-=c; t.hp=t.maxHp; sfx('up');
  shock(t.x,t.y,.35,1.3,'#6ee7a8',.5);
  for(let i=0;i<16;i++)part(t.x,t.y,.5,'#6ee7a8',{sp:rnd(5,1)});
  text(t.x,t.y,1.2,'已维修','#6ee7a8',13); UI.sync();
  return true;
}
function propAt(x,y,pad){
  for(const o of S.obstacles) if(dist2(x,y,o.x,o.y)<((o.r+(pad||0))*TILE)**2)return o;
  return null;
}

/* ---------- the Core ---------- */
function coreLv(id){ return S.coreUp[id]||0; }
function applyCoreUpgrades(keepRatio){
  const ratio=keepRatio?clamp(S.core.hp/S.core.maxHp,0,1):1;
  S.core.maxHp=Math.round((CORE.hp+700*coreLv('hp'))*S.diff.core);
  S.core.hp=Math.round(S.core.maxHp*ratio);
  S.core.maxShield=Math.round(S.core.maxHp*.12*coreLv('shield'));
  if(S.core.shield===undefined)S.core.shield=0;
  S.core.shield=Math.min(S.core.shield,S.core.maxShield);
  S.core.dmgMul=1+.35*coreLv('dmg');
  S.core.guns=CORE.guns+coreLv('guns');
  S.core.regen=9*coreLv('regen');
}
function damageCore(dmg,src){
  if(S.core.shield>0){ const a=Math.min(S.core.shield,dmg); S.core.shield-=a; dmg-=a; S.core.shieldT=4;
    if(S.core.shield<=0){shock(CX,CY,.6,4,'#8ef0e4',.6);sfx('hit',.8);} }
  if(dmg<=0){ S.core.flash=.2; return; }
  S.core.hp-=dmg; S.core.flash=.25; shake(.14); S.flash=Math.max(S.flash,.18);
  sfx('corehit',.7);
  if(src)burstFx(lerp(src.x,CX,.5),lerp(src.y,CY,.5),.7,'#2f6bff',6,4,.12);
  if(S.core.hp<=0){ S.core.hp=0; endGame(false); }
  UI.sync();
}
function updateCore(dt){
  if(S.core.flash>0)S.core.flash-=dt;
  const regen=(S.st.coreRegen||0)+(S.core.regen||0);
  if(regen&&S.core.hp<S.core.maxHp&&S.core.hp>0)
    S.core.hp=Math.min(S.core.maxHp,S.core.hp+regen*dt);
  if(S.core.shieldT>0)S.core.shieldT-=dt;
  else if(S.core.maxShield>0&&S.core.shield<S.core.maxShield)
    S.core.shield=Math.min(S.core.maxShield,S.core.shield+S.core.maxShield*.09*dt);
  S.core.cool-=dt;
  const rate=CORE.gunRate*(S.core.guns||CORE.guns)*(S.overT>0?2.5:1);
  if(S.core.cool<=0){
    let best=null,bv=1e18;
    nearEnemies(CX,CY,CORE.gunRange*TILE,e=>{ if(!e.alive)return;
      const dd=dist2(CX,CY,e.x,e.y);
      if(dd<(CORE.gunRange*TILE)**2&&dd<bv){bv=dd;best=e;} });
    if(best){
      S.core.cool=1/rate;
      S.core.ang=Math.atan2(-(best.y-CY),best.x-CX);
      const a=Math.atan2(best.y-CY,best.x-CX);
      const ox=CX+Math.cos(a)*CORE.r*TILE, oy=CY+Math.sin(a)*CORE.r*TILE;
      beam({x:ox,y:oy,z:.9},{x:best.x,y:best.y,z:.5},'#9fd8ff',2,.1);
      hurt(best,CORE.gunDmg*(1+S.wave*.09)*(S.core.dmgMul||1),{});
      muzzle(ox,oy,.9,'#9fd8ff',3,a);
      sfx('shoot',.35,1.5);
    }
  }
}

/* ---------- player ---------- */
function healPlayer(v){ S.P.hp=Math.min(S.st.maxHp,S.P.hp+v); }
function hurtPlayer(dmg,src){
  const P=S.P;
  if(!P.alive||P.iframe>0||P.dashT>0)return;
  let d=dmg*S.st.dr;
  if(P.shield>0){ const a=Math.min(P.shield,d); P.shield-=a; d-=a;
    shock(P.x,P.y,.4,1.2,'#8fa4d8',.3);
    if(P.shield<=0)toast('力场耗尽','#8fa4d8');
    if(d<=0){ P.iframe=.35; return; } }
  P.hp-=d; P.iframe=.35; S.flash=Math.max(S.flash,.35); shake(.3); sfx('hurt',.8);
  text(P.x,P.y,1.5,'-'+Math.round(d),'#ff4d5e',15);
  burstFx(P.x,P.y,.5,'#ff4d5e',10,5,.13);
  if(S.st.thorn&&src&&src.alive)hurt(src,S.st.thorn,{pierceArmor:true,fromPlayer:true});
  if(P.hp<=0)killPlayer();
}
function killPlayer(){
  const P=S.P; P.alive=false; P.hp=0; P.deadT=PLAYER.respawn;
  S.playerLives--;
  shake(1.1); S.flash=.6; sfx('lose',.5); hitStop(.18);
  burstFx(P.x,P.y,.6,'#ffffff',40,9,.2);
  shock(P.x,P.y,.3,3,'#ffffff',.8);
  if(S.playerLives<=0){
    log('✖ 最后一条命耗尽');
    toast('最后一条命耗尽 — 防线失守','#ff4d5e');
    endGame(false); return;
  }
  log('⚠ 被击倒 · 剩余 '+S.playerLives+' 条命 · '+PLAYER.respawn+' 秒后重生');
  toast('剩余 '+S.playerLives+' 条命','#ff4d5e');
  UI.sync();
}
function updatePlayer(dt){
  const P=S.P, st=S.st;
  if(!P.alive){
    P.deadT-=dt;
    if(P.deadT<=0&&S.playerLives>0){
      P.alive=true; P.x=CX+rnd(TILE,-TILE); P.y=CY+TILE*2.4;
      P.hp=st.maxHp*.6; P.iframe=2.4;
      shock(P.x,P.y,.3,2.6,'#35e6ff',.7); sfx('level'); log('重新部署完成');
    }
    return;
  }
  if(P.iframe>0)P.iframe-=dt;
  if(P.coolT>0)P.coolT-=dt;
  if(P.rageT>0)P.rageT-=dt;
  if(P.magnetT>0)P.magnetT-=dt;
  if(st.regen)healPlayer(st.regen*dt);
  // standing in a hazard costs you
  const hz=hazardAt(P.x,P.y);
  if(hz){
    const H=HAZARD[hz.kind];
    if(H.dps){
      P.hazT-=dt;
      if(P.hazT<=0){ P.hazT=.4;
        const d=H.dps*.4*st.dr; P.hp-=d;
        text(P.x,P.y,1.5,'-'+Math.round(d),H.c,13);
        S.flash=Math.max(S.flash,.12);
        burstFx(P.x,P.y,.3,H.c,5,3,.1);
        if(P.hp<=0){killPlayer();return;} }
      if(Math.random()<dt*18)part(P.x,P.y,.2,H.c,{sp:rnd(1.6,.3),el:1,life:.45,r:.09,g:-2});
    }
  }

  // movement
  const KM=KEYMAP(), K=S.keys, T=S.touch;
  let mx=0,my=0;
  if(T.on&&T.move.act){ mx=Math.cos(T.move.a)*T.move.m; my=Math.sin(T.move.a)*T.move.m; }
  else {
    if(KM.up)my-=1;
    if(KM.down)my+=1;
    if(KM.left)mx-=1;
    if(KM.right)mx+=1;
  }
  const ml=Math.hypot(mx,my);
  P.moving=ml>0;
  if(ml>0){mx/=ml;my/=ml;}

  if(P.dashCd>0)P.dashCd-=dt;
  if(P.dashT>0){
    P.dashT-=dt;
    const v=st.dashDist*TILE/PLAYER.dashTime;
    P.x+=P.dashDx*v*dt; P.y+=P.dashDy*v*dt;
    part(P.x,P.y,.4,'#9fe8ff',{sp:rnd(1.2,.2),life:.3,r:.13,g:0});
    nearEnemies(P.x,P.y,TILE*1.5,e=>{
      if(!e.alive||e.dashHit)return;
      if(dist2(e.x,e.y,P.x,P.y)>(TILE*1.5)**2)return;
      e.dashHit=1;
      // barge through: shove them off you and interrupt the swing
      const a=Math.atan2(e.y-P.y,e.x-P.x)||P.dashDx;
      const shove=TILE*13/Math.max(1,(e.def.poise||1)*.55);
      e.kbx+=Math.cos(a)*shove; e.kby+=Math.sin(a)*shove;
      e.stagger=Math.max(e.stagger,.3);
      e.atkCd=Math.max(e.atkCd,.45);
      e.recoilT=Math.max(e.recoilT,.35);
      burstFx(e.x,e.y,.5,'#9fe8ff',6,5,.11);
      if(st.shock)hurt(e,st.shock,{fromPlayer:true,pierceArmor:true,ang:a});
    });
  } else {
    // acceleration + friction, so ice actually feels slippery
    const ice=!!hazardAt(P.x,P.y,'ice');
    P.onIce=ice;
    const accel=ice?24:78, fric=ice?1.1:15, cap=st.speed*(ice?1.32:1);
    P.vx+=mx*accel*TILE*dt; P.vy+=my*accel*TILE*dt;
    const f=Math.min(1,fric*dt); P.vx-=P.vx*f; P.vy-=P.vy*f;
    const sp2=Math.hypot(P.vx,P.vy), lim=cap*TILE;
    if(sp2>lim){ P.vx=P.vx/sp2*lim; P.vy=P.vy/sp2*lim; }
    P.x+=P.vx*dt; P.y+=P.vy*dt;
    if(ice&&sp2>TILE&&Math.random()<dt*20)
      part(P.x,P.y,.1,'#dff2ff',{sp:rnd(1.2,.2),el:.15,life:.34,r:.07,g:1});
  }
  if(P.moving)P.face=Math.atan2(my,mx);
  resolveObstacles(P,P.r);
  // never let the player stand inside the Core
  const dc=Math.hypot(P.x-CX,P.y-CY), minD=(CORE.r+P.r)*TILE;
  if(dc<minD&&dc>1e-4){ P.x=CX+(P.x-CX)/dc*minD; P.y=CY+(P.y-CY)/dc*minD; }

  // ---- aiming: the barrel tracks a target on its own; you pick which one ----
  let turn=0;
  if(KM.turnL)turn-=1;
  if(KM.turnR)turn+=1;

  if(P.cycleLatch>0)P.cycleLatch-=dt;
  if(!targetValid(P.lock))P.lock=null;

  // the right stick aims absolutely and pulls the trigger while held
  if(T.on&&T.aim.act){
    P.lock=null;
    P.aim=norm(P.aim+norm(T.aim.a-P.aim)*Math.min(1,dt*16));
    P.fine=false;
  } else if(KM.fine){
    // free aim: hold to steer the barrel by hand (for lining up a specific spot)
    P.lock=null;
    if(turn!==0){
      P.turnHold=Math.min(1,P.turnHold+dt/PLAYER.turnRamp);
      const spd=lerp(PLAYER.turnSpeed,PLAYER.turnSpeedMax,P.turnHold*P.turnHold)*PLAYER.turnFine*2.2;
      P.aim=norm(P.aim+turn*spd*dt);
    } else P.turnHold=0;
  } else {
    if(!P.lock)P.lock=bestTarget();
    if(turn!==0&&P.cycleLatch<=0){
      const nx=cycleTarget(P.lock,turn);
      if(nx){ P.lock=nx; P.cycleLatch=.2; sfx('pick',.35,1.25); }
      else { // nothing to cycle: fall back to steering by hand
        P.turnHold=Math.min(1,P.turnHold+dt/PLAYER.turnRamp);
        P.aim=norm(P.aim+turn*lerp(PLAYER.turnSpeed,PLAYER.turnSpeedMax,P.turnHold*P.turnHold)*dt);
      }
    }
    if(P.lock){
      const t=P.lock;
      t.x=t.ref.x; t.y=t.ref.y;
      const want=Math.atan2(t.y-P.y,t.x-P.x);
      P.aim=norm(P.aim+norm(want-P.aim)*Math.min(1,dt*PLAYER.lockTrack));
    }
  }
  P.fine=KM.fine;

  const aiming=KM.fire||(T.on&&T.aim.act&&T.aim.m>.35);
  if(KM.dash&&!P.dashLatch)dash();
  P.dashLatch=KM.dash;
  P.aiming=aiming;
  // down (or shift) holds a charge
  const wantCharge=KM.charge||(T.on&&T.charge);
  if(wantCharge&&!P.charging&&P.overheat<=0){ P.charging=true; P.charge=0; }
  if(!wantCharge&&P.charging) releaseCharge();

  if(P.kick>0)P.kick=Math.max(0,P.kick-dt*7);
  if(P.flashT>0)P.flashT-=dt;

  // heat / overheat
  if(P.overheat>0){
    P.overheat-=dt; P.heat=Math.max(0,P.heat-st.heatMax*dt/PLAYER.overheatLock);
    if(P.overheat<=0){ P.heat=0; sfx('pick',.5,.7); }
  } else {
    P.heat=Math.max(0,P.heat-st.heatCool*dt);
  }
  if(P.chgCd>0)P.chgCd-=dt;

  // right button charges a piercing slug
  if(P.charging&&P.overheat<=0){
    P.charge=Math.min(PLAYER.chargeMax,P.charge+dt);
    if(Math.random()<dt*40){
      const a=P.aim+rnd(TAU); const d=TILE*(1.1-P.charge*.7);
      part(P.x+Math.cos(a)*d,P.y+Math.sin(a)*d,.5,'#9fe8ff',{sp:.2,life:.16,r:.07,g:0});
    }
  }

  // ---- ultimate: a steerable annihilation beam ----
  if(K['q']&&!P.ultLatch&&P.ult>=1&&P.ultT<=0){
    P.ultT=PLAYER.ultTime; P.ult=0;
    shake(.9); S.flash=Math.max(S.flash,.35); hitStop(.1);
    shock(P.x,P.y,.4,5,'#ffe89a',.9); shock(P.x,P.y,.4,8,'#fff',1.2);
    sfx('ability',1.2); sfx('boss',.5);
    toast('歼灭光束','#ffe89a');
  }
  P.ultLatch=!!K['q'];
  if(P.ultT>0){
    P.ultT-=dt;
    const R=PLAYER.ultRange*TILE, halfW=PLAYER.ultWidth*TILE*.5;
    const ex=P.x+Math.cos(P.aim)*R, ey=P.y+Math.sin(P.aim)*R;
    nearEnemies((P.x+ex)/2,(P.y+ey)/2,R,e=>{
      if(!e.alive)return;
      if(ptSegDist(e.x,e.y,P.x,P.y,ex,ey)<halfW+e.r){
        hurt(e,PLAYER.ultDps*(1+S.wave*.06)*dt,
          {fromPlayer:true,pierceArmor:true,noNum:true,ang:P.aim,poiseMul:3});
      }
    });
    for(const rf of S.rifts) if(rf.alive&&ptSegDist(rf.x,rf.y,P.x,P.y,ex,ey)<halfW+RIFT.r*TILE)
      damageRift(rf,PLAYER.ultDps*2.2*dt);
    for(const o of S.obstacles.slice()) if(ptSegDist(o.x,o.y,P.x,P.y,ex,ey)<halfW+o.r*TILE)
      damageProp(o,PLAYER.ultDps*.9*dt,P.aim);
    // beam body
    for(let i=0;i<3;i++){
      const t2=Math.random();
      part(lerp(P.x,ex,t2),lerp(P.y,ey,t2),.55+rnd(.3,-.2),pick(['#fff6d0','#ffe89a','#ffffff']),
        {sp:rnd(3,.4),ang:P.aim+Math.PI/2*(Math.random()<.5?1:-1),life:.16,r:.16,g:0});
    }
    beam({x:P.x,y:P.y,z:.55},{x:ex,y:ey,z:.55},'#fff6d0',8,.06);
    beam({x:P.x,y:P.y,z:.55},{x:ex,y:ey,z:.55},'#ffffff',3,.06);
    shake(.06);
    if(Math.random()<dt*30)shock(lerp(P.x,ex,Math.random()),lerp(P.y,ey,Math.random()),.2,1.1,'#ffe89a',.3);
    P.iframe=Math.max(P.iframe,.05);
  }

  // primary: fires for as long as an arrow key is held
  P.cool-=dt;
  if(aiming&&!P.charging&&P.overheat<=0&&P.cool<=0&&P.ultT<=0){
    P.cool=1/(st.rate*(S.overT>0?2.5:1)*(P.rageT>0?1.25:1));
    firePrimary();
  }

  // drones  // drones
  if(st.drones>0){
    P.droneAng+=dt*2.2;
    for(let i=0;i<st.drones;i++){
      const a=P.droneAng+i/st.drones*TAU, R=TILE*1.5;
      const dxp=P.x+Math.cos(a)*R, dyp=P.y+Math.sin(a)*R;
      if(Math.random()<dt*30)part(dxp,dyp,.55,'#35e6ff',{sp:.4,life:.22,r:.08,g:0});
      nearEnemies(dxp,dyp,TILE*.55,e=>{
        if(!e.alive||e.droneCd>0)return;
        if(dist2(e.x,e.y,dxp,dyp)<(TILE*.55)**2){
          e.droneCd=.45; hurt(e,st.dmg*.55,{fromPlayer:true});
          burstFx(dxp,dyp,.55,'#35e6ff',5,5,.1); } });
    }
  }
}
function firePrimary(){
  const P=S.P, st=S.st;
  const n=st.multi, spread=n>1?.14:0;
  const mz=TILE*.62;
  for(let i=0;i<n;i++){
    const a=P.aim+(i-(n-1)/2)*spread+rnd(.026,-.026);
    const crit=st.crit&&Math.random()<st.crit;
    S.shots.push({kind:'pbullet',x:P.x+Math.cos(a)*mz,y:P.y+Math.sin(a)*mz,z:.55,
      dx:Math.cos(a),dy:Math.sin(a),ang:a,sp:PLAYER.bulletSp*TILE,d:0,maxD:st.range*TILE*1.15,
      dmg:st.dmg*(P.rageT>0?1.8:1),crit,pierce:st.pierce,explo:st.explo,hit:new Set(),
      color:crit?'#fff2b0':'#bfe9ff',r:PLAYER.bulletR,len:.62});
  }
  if(P.coolT<=0)P.heat=Math.min(st.heatMax,P.heat+st.heatPerShot);
  if(P.heat>=st.heatMax){ P.overheat=PLAYER.overheatLock; sfx('err',.8);
    burstFx(P.x+Math.cos(P.aim)*mz,P.y+Math.sin(P.aim)*mz,.55,'#ff8a2d',14,4,.11);
    text(P.x,P.y,1.6,'过热!','#ff8a2d',15); }
  P.flashT=.055; P.kick=1; shake(.018);
  muzzleFx(P.x+Math.cos(P.aim)*mz,P.y+Math.sin(P.aim)*mz,.55,P.aim,'#ffd58a',1);
  ejectCasing(P);
  sfx('shoot',.55,rnd(1.14,.9));
}
function releaseCharge(){
  const P=S.P, st=S.st;
  if(!P.charging)return;
  P.charging=false;
  const c=P.charge; P.charge=0;
  if(c<.16||P.overheat>0||P.chgCd>0)return;
  const k=c/PLAYER.chargeMax;
  const mul=lerp(PLAYER.chargeMinMul,PLAYER.chargeMaxMul,k);
  const mz=TILE*.7, a=P.aim;
  S.shots.push({kind:'pbullet',x:P.x+Math.cos(a)*mz,y:P.y+Math.sin(a)*mz,z:.55,
    dx:Math.cos(a),dy:Math.sin(a),ang:a,sp:PLAYER.bulletSp*1.6*TILE,d:0,maxD:st.range*TILE*1.6,
    dmg:st.dmg*mul,crit:false,pierce:99,explo:st.explo,hit:new Set(),
    color:'#fff6d0',r:PLAYER.bulletR*(1.5+k),len:1.5+k*1.6,heavy:true});
  P.heat=Math.min(st.heatMax,P.heat+PLAYER.chargeHeat*(.5+k));
  if(P.heat>=st.heatMax)P.overheat=PLAYER.overheatLock;
  P.chgCd=PLAYER.chargeCd; P.flashT=.1; P.kick=2.2;
  shake(.09+k*.16); if(k>.75)hitStop(.05);
  muzzleFx(P.x+Math.cos(a)*mz,P.y+Math.sin(a)*mz,.55,a,'#ffffff',2.2+k*2);
  shock(P.x+Math.cos(a)*mz,P.y+Math.sin(a)*mz,.55,1.1+k*1.3,'#cfefff',.3,.22);
  sfx('snipe',.9,.8);
}
function impactFx(x,y,z,ang,c,n){
  const back=(ang||0)+Math.PI;
  for(let i=0;i<n;i++)
    part(x,y,z,c,{sp:rnd(9,2),ang:back+rnd(1.1,-1.1),el:rnd(.6,-.1),life:rnd(.3,.1),r:rnd(.11,.04)});
  for(let i=0;i<Math.max(2,n/3);i++)
    part(x,y,z,'#ffffff',{sp:rnd(13,4),ang:back+rnd(.5,-.5),el:.1,life:.09,r:.05});
  shock(x,y,z,.5+n*.03,c,.16,.2);
}
function muzzleFx(x,y,z,ang,c,scale){
  const n=(4*scale)|0;
  for(let i=0;i<n;i++)
    part(x,y,z,c,{sp:rnd(11*scale,3),ang:ang+rnd(.34,-.34),el:rnd(.22,-.12),life:rnd(.16,.06),r:rnd(.13,.05)*scale});
  for(let i=0;i<2*scale;i++)
    part(x,y,z,'#ffffff',{sp:rnd(16*scale,6),ang:ang+rnd(.12,-.12),el:0,life:.07,r:.06*scale});
}
function ejectCasing(P){
  const a=P.aim+Math.PI/2*(Math.random()<.5?1:-1);
  part(P.x+Math.cos(P.aim)*TILE*.3,P.y+Math.sin(P.aim)*TILE*.3,.62,'#d8b25a',
    {sp:rnd(3.4,1.6),ang:a,el:rnd(.9,.4),life:.85,r:.055,g:9});
}
/* everything you can shoot — enemies, rifts, scenery — is a cyclable target */
function targetList(){
  const P=S.P, R=S.st.range*TILE, out=[];
  nearEnemies(P.x,P.y,R*1.35,e=>{
    if(!e.alive)return;
    if(dist2(P.x,P.y,e.x,e.y)>(R*1.35)**2)return;
    out.push({k:'enemy',ref:e,x:e.x,y:e.y});
  });
  for(const rf of S.rifts) if(rf.alive&&dist2(P.x,P.y,rf.x,rf.y)<(R*1.7)**2)
    out.push({k:'rift',ref:rf,x:rf.x,y:rf.y});
  for(const o of S.obstacles) if(dist2(P.x,P.y,o.x,o.y)<(R*1.15)**2)
    out.push({k:'prop',ref:o,x:o.x,y:o.y});
  return out;
}
function targetValid(t){
  if(!t)return false;
  const P=S.P, R=S.st.range*TILE;
  if(t.k==='enemy')return t.ref.alive&&dist2(P.x,P.y,t.ref.x,t.ref.y)<(R*1.5)**2;
  if(t.k==='rift') return t.ref.alive&&dist2(P.x,P.y,t.ref.x,t.ref.y)<(R*1.9)**2;
  return S.obstacles.includes(t.ref)&&dist2(P.x,P.y,t.ref.x,t.ref.y)<(R*1.3)**2;
}
function bestTarget(){
  const P=S.P, list=targetList();
  if(!list.length)return null;
  const pri={enemy:0,rift:1,prop:2};
  list.sort((a,b)=>{
    if(pri[a.k]!==pri[b.k])return pri[a.k]-pri[b.k];
    return dist2(P.x,P.y,a.x,a.y)-dist2(P.x,P.y,b.x,b.y);
  });
  return list[0];
}
function cycleTarget(cur,dir){
  const P=S.P, list=targetList();
  if(!list.length)return null;
  // order them by bearing so cycling feels spatial
  list.forEach(t=>t.ang=Math.atan2(t.y-P.y,t.x-P.x));
  list.sort((a,b)=>a.ang-b.ang);
  let i=cur?list.findIndex(t=>t.ref===cur.ref):-1;
  if(i<0){ // not in the list any more: start from whatever is nearest the barrel
    let bv=1e9; list.forEach((t,k)=>{const e2=Math.abs(norm(t.ang-P.aim)); if(e2<bv){bv=e2;i=k;}}); }
  return list[(i+dir+list.length)%list.length];
}
/* pick the enemy that best matches where you are already pointing */
function acquireTarget(aim,exclude,dir){
  const P=S.P, R=S.st.range*TILE*1.4;
  const list=[];
  nearEnemies(P.x,P.y,R,e=>{
    if(!e.alive||e===exclude)return;
    const dd=dist2(P.x,P.y,e.x,e.y); if(dd>R*R)return;
    const ang=Math.atan2(e.y-P.y,e.x-P.x);
    list.push({e,ang,err:norm(ang-aim),d:Math.sqrt(dd)});
  });
  if(!list.length)return null;
  if(dir){
    // cycle clockwise / anticlockwise from the current heading
    const side=list.filter(o=>dir>0?o.err>.02:o.err<-.02);
    const pool=side.length?side:list;
    pool.sort((a,b)=>Math.abs(a.err)-Math.abs(b.err));
    return pool[0].e;
  }
  list.sort((a,b)=>(Math.abs(a.err)*1.6+a.d/TILE*.06)-(Math.abs(b.err)*1.6+b.d/TILE*.06));
  return list[0].e;
}
function assistTarget(aim){
  const P=S.P, R=S.st.range*TILE;
  let best=null,bv=PLAYER.assistCone;
  nearEnemies(P.x,P.y,R,e=>{
    if(!e.alive)return;
    const dd=dist2(P.x,P.y,e.x,e.y); if(dd>R*R)return;
    const err=Math.abs(norm(Math.atan2(e.y-P.y,e.x-P.x)-aim));
    if(err<bv){bv=err;best=e;}
  });
  return best;
}
function dash(){
  const P=S.P, st=S.st;
  if(!P.alive||P.dashT>0||P.dashCd>0)return;
  const KM=KEYMAP();
  let mx=0,my=0;
  if(KM.up)my-=1;
  if(KM.down)my+=1;
  if(KM.left)mx-=1;
  if(KM.right)mx+=1;
  const l=Math.hypot(mx,my);
  if(l>0){P.dashDx=mx/l;P.dashDy=my/l;}
  else{P.dashDx=Math.cos(P.aim);P.dashDy=Math.sin(P.aim);}
  P.dashT=PLAYER.dashTime; P.dashCd=st.dashCd; P.iframe=Math.max(P.iframe,PLAYER.dashTime+.1);
  for(const e of S.enemies)e.dashHit=0;
  shock(P.x,P.y,.3,1.6,'#9fe8ff',.4); sfx('dash',.8);
}

/* ---------- projectiles ---------- */
function updateShots(dt){
  for(let i=S.shots.length-1;i>=0;i--){
    const s=S.shots[i]; let done=false;
    if(s.kind==='pbullet'){
      const step=s.sp*dt; s.d+=step; s.x+=s.dx*step; s.y+=s.dy*step;
      part(s.x,s.y,s.z,s.color,{sp:.2,life:.1,r:.05,g:0});
      nearEnemies(s.x,s.y,TILE*.5,e=>{
        if(done||!e.alive||s.hit.has(e))return;
        if(dist2(e.x,e.y,s.x,s.y)>(TILE*.36+e.r)**2)return;
        s.hit.add(e);
        hurt(e,s.dmg,{fromPlayer:true,crit:s.crit,critMul:2.2,ang:s.ang,
          poiseMul:s.heavy?2.2:1, pierceArmor:!!s.heavy});
        impactFx(s.x,s.y,s.z,s.ang,s.color,s.heavy?11:5);
        if(s.explo)explode(s.x,s.y,s.explo,s.dmg*.6,null,{fromPlayer:true});
        if(s.pierce>0)s.pierce--; else done=true;
      });
      if(!done){
        const pr=propAt(s.x,s.y,.12);
        if(pr&&!s.hit.has(pr)){
          s.hit.add(pr); damageProp(pr,s.dmg*(s.heavy?1.5:1),s.ang);
          impactFx(s.x,s.y,s.z,s.ang,'#cfd8f0',s.heavy?10:5);
          if(s.pierce>0)s.pierce--; else done=true;
        }
      }
      // only the player (and orbital strikes) can close a rift
      if(!done)for(const rf of S.rifts){
        if(!rf.alive||s.hit.has(rf))continue;
        if(dist2(rf.x,rf.y,s.x,s.y)<(RIFT.r*TILE)**2){
          s.hit.add(rf); damageRift(rf,s.dmg*(s.heavy?1.6:1));
          impactFx(s.x,s.y,s.z,s.ang,'#ff8ac0',s.heavy?14:6);
          text(rf.x,rf.y,2.4,Math.round(s.dmg*(s.heavy?1.6:1)),'#ffd7e2',13);
          if(s.pierce>0)s.pierce--; else done=true;
          break;
        }
      }
      if(s.d>s.maxD)done=true;
    } else if(s.kind==='shell'){
      s.t+=dt/s.dur; const k=Math.min(1,s.t);
      s.x=lerp(s.sx,s.tx,k); s.y=lerp(s.sy,s.ty,k);
      s.z=lerp(s.sz,.3,k)+Math.sin(k*Math.PI)*Math.max(1.5,Math.hypot(s.tx-s.sx,s.ty-s.sy)/TILE*.42);
      if(Math.random()<dt*30)part(s.x,s.y,s.z,'#ffb45a',{sp:rnd(.7,.1),life:.3,r:.07,g:0});
      if(k>=1){ explode(s.x,s.y,s.splash,s.dmg,s.src,{stun:s.stun}); done=true; }
    } else if(s.kind==='pierce'){
      const step=s.sp*dt; s.d+=step; s.x+=s.dx*step; s.y+=s.dy*step;
      part(s.x,s.y,s.z,s.color,{sp:.3,life:.16,r:.07,g:0});
      nearEnemies(s.x,s.y,TILE*.6,e=>{
        if(done||!e.alive||s.hit.has(e))return;
        if(e.fly&&!s.src.def.air)return;
        if(dist2(e.x,e.y,s.x,s.y)>(TILE*.42+e.r)**2)return;
        s.hit.add(e); hurt(e,s.dmg,{src:s.src}); burstFx(e.x,e.y,.5,s.color,5,4,.09);
        if(--s.left<=0)done=true;
      });
      if(s.d>s.maxD)done=true;
    } else {
      if(s.tgt&&s.tgt.alive){s.tx=s.tgt.x;s.ty=s.tgt.y;}
      const dx=s.tx-s.x,dy=s.ty-s.y,d=Math.hypot(dx,dy),step=s.sp*dt;
      if(s.kind==='bolt')part(s.x,s.y,s.z,s.color,{sp:.2,life:.13,r:.055,g:0});
      else if(Math.random()<dt*24)part(s.x,s.y,s.z,s.color,{sp:.5,life:.3,r:.07,g:0});
      if(d<=step||d<2){
        s.x=s.tx;s.y=s.ty;
        if(s.splash)explode(s.x,s.y,s.splash,s.dmg,s.src,s);
        else if(s.tgt&&s.tgt.alive){
          hurt(s.tgt,s.dmg,{src:s.src,pen:s.pen});
          if(s.shred)s.tgt.shred=Math.min(s.tgt.armor*.9,(s.tgt.shred||0)+s.shred);
          burstFx(s.x,s.y,s.z,s.color,5,4,.09);
        }
        done=true;
      } else { s.x+=dx/d*step; s.y+=dy/d*step; }
    }
    if(done){ World.removeShot(s); S.shots.splice(i,1); }
  }
  // enemy bullets
  for(let i=S.ebullets.length-1;i>=0;i--){
    const b=S.ebullets[i]; let done=false;
    const step=b.sp*dt; b.d+=step; b.x+=b.dx*step; b.y+=b.dy*step;
    if(Math.random()<dt*20)part(b.x,b.y,b.z,b.color,{sp:.3,life:.2,r:.07,g:0});
    const P=S.P;
    if(P.alive&&dist2(b.x,b.y,P.x,P.y)<(TILE*(P.r+.22))**2){ hurtPlayer(b.dmg,null); impactFx(b.x,b.y,b.z,Math.atan2(b.dy,b.dx),b.color,7); done=true; }
    else if(dist2(b.x,b.y,CX,CY)<(CORE.r*TILE)**2){ damageCore(b.dmg,null); done=true; }
    else if(b.d>b.maxD)done=true;
    if(!done)for(const t of S.towers){
      if(dist2(b.x,b.y,t.x,t.y)<(TILE*.5)**2){ damageTower(t,b.dmg*.7,null);
        impactFx(b.x,b.y,b.z,Math.atan2(b.dy,b.dx),b.color,5); done=true; break; } }
    if(done){ World.removeShot(b); S.ebullets.splice(i,1); }
  }
}
function explode(x,y,radius,dmg,src,o={}){
  const R=radius*TILE;
  if(o.slow&&S.hazards.filter(h=>h.temp!==undefined).length<10){
    const h={kind:'ice',x,y,r:radius*1.25,seed:rnd(99),t:0,phase:'idle',obj:null,temp:5.5};
    S.hazards.push(h); World.addHazardLate(h);
  }
  shock(x,y,.3,radius*1.05,o.slow?'#9fe8ff':o.poison?'#a6e22e':'#ffb45a',.42);
  burstFx(x,y,.4,o.slow?'#9fe8ff':o.poison?'#a6e22e':'#ffb45a',o.slow||o.poison?12:20,o.slow||o.poison?5:8,.14);
  if(!o.slow&&!o.poison){shake(.04);sfx('boom',.5);}
  nearEnemies(x,y,R+30,e=>{
    if(!e.alive)return;
    if(e.fly&&src&&!src.def.air)return;
    const dd=Math.sqrt(dist2(x,y,e.x,e.y));
    if(dd>R+e.r)return;
    const fall=clamp(1-(dd/R)*.45,.5,1);
    hurt(e,dmg*fall,{src,fromPlayer:o.fromPlayer});
    if(o.slow)applySlow(e,o.slow,2.1);
    if(o.freeze&&Math.random()<o.freeze)applyStun(e,1.1);
    if(o.stun)applyStun(e,o.stun);
    if(o.poison){ if(o.poison>=e.poisonDps){e.poisonDps=o.poison;e.poisonSrc=src;} e.poisonT=4.2; if(o.plague)e.poisonPlague=true; }
    if(o.shred)e.shred=Math.min(e.armor*.9,(e.shred||0)+o.shred);
    if(o.vuln){e.vuln=o.vuln;e.vulnT=4;}
  });
}

/* ---------- field pickups: short-lived, worth breaking formation for ---------- */
/* Weighted by need, the way most action games do it: no medkits at full health,
   and a pity rule so a dying player is not left dry. */
function choosePickup(){
  const P=S.P, st=S.st;
  const hpF=P?clamp(P.hp/st.maxHp,0,1):1;
  const coreF=clamp(S.core.hp/S.core.maxHp,0,1);
  const heatF=P?clamp(P.heat/st.heatMax,0,1):0;
  const alive=S.enemies.length;
  const drops=S.drops.length;
  // pity: badly hurt and nothing healing has shown up in a while
  if(hpF<.35&&S.sinceMed>=4){ S.sinceMed=0; return 'medkit'; }
  const w={
    medkit: hpF>.85?.12:hpF>.6?1:hpF>.35?3.2:6.5,
    shield: hpF>.8?.6:hpF>.5?1.8:3.0,
    coolant: heatF>.6?2.8:heatF>.3?1.4:.7,
    rage:   1.5,
    stasis: alive>26?3.0:alive>14?1.6:.6,
    magnet: drops>28?2.4:drops>14?1.2:.4,
    mend:   coreF>.9?.25:coreF>.65?1.2:coreF>.4?3.0:5.5,
  };
  let total=0; for(const k in w)total+=w[k];
  let r=Math.random()*total;
  for(const k in w){ r-=w[k]; if(r<=0){
    S.sinceMed=k==='medkit'?0:S.sinceMed+1;
    return k; } }
  return 'rage';
}
function spawnPickup(kind,x,y){
  const K=kind||choosePickup();
  if(x===undefined){
    let tries=0;
    do{ const a=rnd(TAU), d=(4+rnd(11))*TILE;
      x=clamp(CX+Math.cos(a)*d,TILE*2,W-TILE*2);
      y=clamp(CY+Math.sin(a)*d*.8,TILE*2,H-TILE*2);
    }while(++tries<30&&(S.obstacles.some(o=>dist2(x,y,o.x,o.y)<((o.r+1)*TILE)**2)
      ||S.hazards.some(h=>HAZARD[h.kind].solid&&dist2(x,y,h.x,h.y)<((h.r+1)*TILE)**2)));
  }
  const p={kind:K,x,y,t:0,life:PICKUPS[K].life,obj:null};
  S.pickups.push(p); World.addPickup(p);
  shock(x,y,.3,1.4,PICKUPS[K].c,.5);
  return p;
}
function clearPickups(){ for(const p of S.pickups)World.removePickup(p); S.pickups.length=0; }
function takePickup(p){
  const D=PICKUPS[p.kind], st=S.st, P=S.P;
  switch(p.kind){
    case 'medkit': healPlayer(70); text(P.x,P.y,1.6,'+70','#6ee7a8',16); break;
    case 'coolant': P.heat=0; P.overheat=0; P.coolT=22; break;
    case 'rage': P.rageT=25; break;
    case 'shield': P.shield=260; break;
    case 'stasis':
      for(const e of S.enemies){ if(!e.alive)continue; applyStun(e,6.5); applySlow(e,.5,9);
        shock(e.x,e.y,.3,.9,'#bfe4ff',.5); }
      S.flash=Math.max(S.flash,.2); break;
    case 'magnet':
      for(const d of S.drops){ d.x=P.x+rnd(TILE,-TILE); d.y=P.y+rnd(TILE,-TILE); }
      P.magnetT=20; break;
    case 'mend':
      S.core.hp=Math.min(S.core.maxHp,S.core.hp+S.core.maxHp*.14);
      shock(CX,CY,.5,4,'#2f6bff',.7); break;
  }
  toast(D.n+' · '+D.d,D.c);
  burstFx(p.x,p.y,.5,D.c,22,6,.15);
  shock(p.x,p.y,.3,1.8,D.c,.5);
  sfx('up'); log('拾取 '+D.n);
  World.removePickup(p);
  S.pickups.splice(S.pickups.indexOf(p),1);
  UI.sync();
}
function updatePickups(dt){
  const P=S.P;
  // nothing spawns for free: every pickup is dropped by something you killed
  for(let i=S.pickups.length-1;i>=0;i--){
    const p=S.pickups[i];
    p.t+=dt;
    if(p.t>=p.life){ World.removePickup(p); S.pickups.splice(i,1); continue; }
    if(P.alive&&dist2(P.x,P.y,p.x,p.y)<(TILE*.85)**2){ takePickup(p); continue; }
    if(Math.random()<dt*6)part(p.x,p.y,.3,PICKUPS[p.kind].c,{sp:rnd(.8,.2),el:1,life:.5,r:.07,g:-1});
  }
}
/* ---------- drops & levelling ---------- */
function updateDrops(dt){
  const P=S.P;
  const R=S.st.pickup*TILE*(P&&P.magnetT>0?2.6:1);
  for(let i=S.drops.length-1;i>=0;i--){
    const d=S.drops[i]; d.t+=dt;
    if(P.alive){
      const dd=dist2(d.x,d.y,P.x,P.y);
      if(dd<R*R){
        const dist=Math.sqrt(dd)||1;
        const pull=Math.min(1,(1-dist/R)*2+.35)*16*TILE*dt;
        d.x+=(P.x-d.x)/dist*pull; d.y+=(P.y-d.y)/dist*pull;
      }
      if(dd<(TILE*.55)**2){
        if(d.kind==='xp'){ gainXp(d.v); sfx('pick',.35,rnd(1.2,.95)); }
        else { S.scrap+=d.v; S.earned+=d.v; sfx('scrap',.3,rnd(1.2,.95)); }
        part(d.x,d.y,.4,d.kind==='xp'?'#35e6ff':'#ffc247',{sp:2,life:.3,r:.1});
        S.drops.splice(i,1); UI.sync(); continue;
      }
    }
    if(d.t>50)S.drops.splice(i,1);
  }
}
function gainXp(v){
  S.xp+=v;
  while(S.xp>=S.xpNeed){
    S.xp-=S.xpNeed; S.level++; S.xpNeed=xpForLevel(S.level);
    if(levelGivesCard(S.level)) S.pendingCards++;
    else levelBonus();
  }
}
// the in-between levels: no menu, no pause -- just a bump and a flash
function levelBonus(){
  const st=S.st, add=Math.round(PLAYER.hp*LEVEL_BONUS.hp);
  st.maxHp+=add; st.dmg*=1+LEVEL_BONUS.dmg;
  if(S.P){ S.P.hp=Math.min(st.maxHp,S.P.hp+add);
    shock(S.P.x,S.P.y,.28,1.9,'#6ee7a8',.55);
    for(let i=0;i<16;i++)part(S.P.x,S.P.y,.5,'#6ee7a8',{sp:rnd(5.5,1.8)}); }
  text(S.P?S.P.x:CX,S.P?S.P.y:CY,1.3,'LV '+S.level+' · +'+add+' HP · 伤害 +6%','#6ee7a8',13);
  sfx('pick',.5,1.5);
  log('等级 '+S.level+' · 属性提升 +'+add+' HP · 伤害 +6%');
  UI.sync();
}
function cardPool(){
  const taken=S.cardCount||{};
  return CARDS.filter(c=>(taken[c.id]||0)<c.max);
}
function offerCards(){
  const pool=cardPool().slice();
  const out=[];
  for(let i=0;i<3&&pool.length;i++) out.push(pool.splice((Math.random()*pool.length)|0,1)[0]);
  S.cards=out; S.paused=true; sfx('level');
  UI.showCards(out);
}
function takeCard(c){
  S.cardCount=S.cardCount||{};
  S.cardCount[c.id]=(S.cardCount[c.id]||0)+1;
  const before=S.st.maxHp;
  c.ap(S.st);
  if(S.st.maxHp>before)S.P.hp=S.st.maxHp;
  if(c.id==='hp')S.P.hp=S.st.maxHp;
  S.cards=null; S.pendingCards--;
  shock(S.P.x,S.P.y,.3,2.4,'#ffc247',.7);
  for(let i=0;i<30;i++)part(S.P.x,S.P.y,.5,'#ffc247',{sp:rnd(7,2)});
  log('等级 '+S.level+' · 获得「'+c.n+'」');
  if(S.pendingCards>0)offerCards(); else {S.paused=false;UI.hideCards();}
  recalcBuffs(); UI.sync();
}

/* ---------- rifts: the swarm has a source, and the source can be killed ---------- */
function riftCount(w){ return clamp(1+Math.floor(w/3),1,4); }
function placeRifts(n){
  clearRifts();
  const base=rnd(TAU);
  for(let i=0;i<n;i++){
    let x,y,tries=0;
    do{
      const a=base+i/n*TAU+rnd(.5,-.5), d=(11+rnd(5))*TILE;
      x=clamp(CX+Math.cos(a)*d,TILE*2.4,W-TILE*2.4);
      y=clamp(CY+Math.sin(a)*d*.82,TILE*2.4,H-TILE*2.4);
    }while(++tries<40&&S.obstacles.some(o=>dist2(x,y,o.x,o.y)<((o.r+RIFT.r+.6)*TILE)**2));
    const hp=RIFT.hp*(1+RIFT.hpPerWave*(S.wave-1))*S.diff.hp;
    const r={x,y,hp,maxHp:hp,queue:[],t:0,alive:true,flash:0,obj:null,idx:i};
    S.rifts.push(r); World.addRift(r);
  }
  shake(.35); sfx('boss',.55);
}
function clearRifts(){ for(const r of S.rifts)World.removeRift(r); S.rifts.length=0; }
function damageRift(r,dmg){
  if(!r.alive)return;
  r.hp-=dmg; r.flash=.14;
  if(r.hp<=0){
    r.alive=false;
    const left=r.queue.length; r.queue.length=0;
    const scrap=Math.round(RIFT.scrap*(1+S.wave*.16)*S.diff.rw*(1+S.st.scrapGain));
    dropLoot(r.x,r.y,scrap,Math.round(RIFT.xp*(1+S.wave*.1)),true);
    burstFx(r.x,r.y,1.0,'#ff3d8a',60,10,.26);
    shock(r.x,r.y,.3,5,'#ff3d8a',.9); shock(r.x,r.y,.3,3,'#ffd7e2',.6);
    shake(.8); hitStop(.16); S.flash=Math.max(S.flash,.25); sfx('boom',1.1);
    text(r.x,r.y,2.2,'裂隙关闭!','#ff8ac0',18);
    spawnPickup(null,r.x,r.y);
    log('✦ 裂隙关闭 · 截断 '+left+' 个增援 · +'+scrap+' 碎片');
    World.removeRift(r);
    if(S.rifts.every(x=>!x.alive)&&S.waveActive)log('全部裂隙已封闭');
  }
}
function updateRifts(dt){
  for(const r of S.rifts){
    if(!r.alive)continue;
    if(r.flash>0)r.flash-=dt;
    r.t+=dt;
    while(r.queue.length&&r.queue[0].t<=r.t){
      const q=r.queue.shift();
      const a=rnd(TAU), d=rnd(RIFT.r*TILE*.75);
      spawnUnit(q.type,r.x+Math.cos(a)*d,r.y+Math.sin(a)*d);
      burstFx(r.x,r.y,.9,'#ff8ac0',5,4,.1);
    }
    if(Math.random()<dt*16){ const a=rnd(TAU),d=rnd(RIFT.r*TILE);
      part(r.x+Math.cos(a)*d,r.y+Math.sin(a)*d,.3,'#ff3d8a',{sp:rnd(1.4,.3),el:1.2,life:.8,r:.09,g:-1.6}); }
  }
}
function riftsPending(){ return S.rifts.some(r=>r.alive&&r.queue.length); }

/* ---------- salvage: stand still to strip it ---------- */
function spawnSalvage(){
  const n=clamp(1+Math.floor(S.wave/4),1,3);
  for(let i=0;i<n;i++){
    let x,y,tries=0;
    do{ const a=rnd(TAU), d=(5.5+rnd(9))*TILE;
      x=clamp(CX+Math.cos(a)*d,TILE*2,W-TILE*2);
      y=clamp(CY+Math.sin(a)*d*.8,TILE*2,H-TILE*2);
    }while(++tries<40&&S.obstacles.some(o=>dist2(x,y,o.x,o.y)<((o.r+1.4)*TILE)**2));
    const s={x,y,p:0,amount:Math.round(SALVAGE.amount*(1+S.wave*.14)*S.diff.rw),obj:null};
    S.salvage.push(s); World.addSalvage(s);
  }
}
function clearSalvage(){ for(const s of S.salvage)World.removeSalvage(s); S.salvage.length=0; }
function updateHazards(dt){
  for(let i=S.hazards.length-1;i>=0;i--){ const h=S.hazards[i];
    if(h.temp!==undefined){ h.temp-=dt; if(h.temp<=0){ World.removeHazard(h); S.hazards.splice(i,1); } } }
  for(const h of S.hazards){
    const H=HAZARD[h.kind];
    if(h.kind!=='steam')continue;
    h.t+=dt;
    const cyc=H.period;
    const tt=h.t%cyc;
    const warn=tt>cyc-H.warn-H.burst&&tt<=cyc-H.burst;
    const burst=tt>cyc-H.burst;
    h.phase=burst?'burst':warn?'warn':'idle';
    if(burst&&!h.fired){
      h.fired=true;
      shock(h.x,h.y,.2,h.r*1.5,'#e8f4ff',.5);
      for(let i=0;i<26;i++)part(h.x+rnd(h.r*TILE,-h.r*TILE),h.y+rnd(h.r*TILE,-h.r*TILE),.2,'#e8f4ff',
        {sp:rnd(5,1),el:1.4,life:rnd(.9,.4),r:.16,g:-2.2});
      sfx('flame',.9,.6);
      const R=h.r*TILE;
      nearEnemies(h.x,h.y,R,e=>{ if(!e.alive||e.fly)return;
        if(dist2(e.x,e.y,h.x,h.y)>R*R)return;
        hurt(e,H.dmg*(1+S.wave*.08),{pierceArmor:true});
        const a=Math.atan2(e.y-h.y,e.x-h.x);
        e.x+=Math.cos(a)*TILE*1.1; e.y+=Math.sin(a)*TILE*1.1; });
      const P=S.P;
      if(P.alive&&dist2(P.x,P.y,h.x,h.y)<R*R){
        hurtPlayer(H.dmg*.6,null);
        const a=Math.atan2(P.y-h.y,P.x-h.x);
        P.vx+=Math.cos(a)*TILE*14; P.vy+=Math.sin(a)*TILE*14;
      }
    }
    if(!burst)h.fired=false;
  }
}
function updateSalvage(dt){
  const P=S.P;
  for(let i=S.salvage.length-1;i>=0;i--){
    const s=S.salvage[i];
    const near=P.alive&&dist2(P.x,P.y,s.x,s.y)<(SALVAGE.r*TILE)**2;
    if(near&&!P.moving&&P.dashT<=0){
      s.p+=dt/SALVAGE.time;
      if(Math.random()<dt*26){const a=rnd(TAU),d=rnd(SALVAGE.r*TILE);
        part(s.x+Math.cos(a)*d,s.y+Math.sin(a)*d,.2,'#ffc247',{sp:1.2,el:1,life:.4,r:.08,g:-2});}
      if(s.p>=1){
        const amt=Math.round(s.amount*(1+S.st.scrapGain));
        S.scrap+=amt; S.earned+=amt;
        text(s.x,s.y,1.4,'+'+amt,'#ffc247',18);
        burstFx(s.x,s.y,.5,'#ffc247',28,7,.16);
        shock(s.x,s.y,.3,2,'#ffc247',.6); sfx('up');
        log('残骸拆解完成 · +'+amt+' 碎片');
        World.removeSalvage(s); S.salvage.splice(i,1); UI.sync(); continue;
      }
    } else if(s.p>0){ s.p=Math.max(0,s.p-dt*.5); }
  }
}

/* ---------- waves ---------- */
function startWave(){
  if(S.waveActive)return;
  S.wave++; S.rest=0; S.qt=0; S.waveActive=true;
  const comp=waveComp(S.wave);
  const flat=[];
  for(const g of comp) for(let i=0;i<g.n;i++) flat.push({t:g.d+i*g.g,type:g.t});
  flat.sort((a,b)=>a.t-b.t);
  placeRifts(riftCount(S.wave));
  flat.forEach((e,i)=>S.rifts[i%S.rifts.length].queue.push(e));
  for(const r of S.rifts)r.queue.sort((a,b)=>a.t-b.t);
  S.queue=[];
  clearSalvage(); spawnSalvage();
  banner('WAVE '+String(S.wave).padStart(2,'0'));
  sfx('wave'); log('第 '+S.wave+' 波来袭 · '+flat.length+' 个单位 · '+S.rifts.length+' 道裂隙');
  UI.sync();
}
function waveDone(){
  S.waveActive=false;
  clearRifts();
  const bonus=20+S.wave*6;
  S.scrap+=bonus; S.earned+=bonus;
  log('第 '+S.wave+' 波清除 · 奖励 '+bonus+' 碎片');
  if(S.wave>S.best){S.best=S.wave;saveBest();}
  S.stageWaves++;
  const st=STAGES[S.stage];
  if(S.stageWaves>=st.waves){
    if(st.finale){ S.victory=true; endGame(true); return; }
    beginTeleport(); return;
  }
  S.rest=REST;
  UI.sync();
}
/* ---------- teleport between regions ---------- */
function beginTeleport(){
  S.teleporting=true; S.paused=true;
  clearSalvage();
  // the core packs your turrets back into scrap and carries them with you
  let refund=0;
  for(const t of S.towers){ refund+=t.spent; World.removeTower(t); }
  S.towers=[]; S.sel=null; S.build=null;
  S.scrap+=refund;
  for(const e of S.enemies)World.removeEnemy(e);
  S.enemies=[]; S.drops=[]; S.shots=[]; S.ebullets=[];
  shock(CX,CY,.5,9,'#35e6ff',1.2); shake(.7); sfx('win');
  log('区域清空 · 炮塔回收 '+refund+' 碎片');
  UI.showTeleport(refund);
}
function nextStage(){
  S.stage++; S.stageWaves=0; S.teleporting=false;
  S.stageStartWave=S.wave;
  if(S.playerLives<S.diff.lives){ S.playerLives++; log('区域肃清 · 恢复 1 条命'); }
  const st=STAGES[S.stage];
  S.map=MAPS.find(m=>m.id===st.map);
  S.obstacles=buildArena(S.map);
  S.hazards=buildHazards(S.map,S.obstacles);
  applyCoreUpgrades(false); recalcPower();
  S.core.shield=S.core.maxShield;
  S.scrap+=220*coreLv('store');
  S.P=Object.assign(newPlayer(),{hp:S.st.maxHp});
  S.cam.x=CX; S.cam.y=CY;
  S.rifts=[]; S.salvage=[];
  World.buildBoard(); World.addPlayer(); World.updateLinks();
  World.setRange(null); World.setGhost(null);
  S.rest=REST+4; S.paused=false;
  banner(st.name);
  log('▶ 传送完成 · '+st.name);
  UI.hideTeleport(); UI.sync();
}
function callEarly(){
  if(S.waveActive){sfx('err');return;}
  const bonus=Math.ceil(S.rest)*4;
  if(bonus>0){S.scrap+=bonus;S.earned+=bonus;log('提前出击 · +'+bonus+' 碎片');}
  startWave();
}

/* ---------- retry the current region instead of the whole campaign ---------- */
function retryStage(){
  S.retries++;
  const st=STAGES[S.stage];
  S.wave=S.stageStartWave; S.stageWaves=0;
  S.over=false; S.running=true; S.paused=false; S.teleporting=false; S.victory=false;
  S.waveActive=false; S.queue=[]; S.qt=0; S.rest=REST+3;
  S.playerLives=S.diff.lives;
  applyCoreUpgrades(false); S.core.shield=S.core.maxShield;
  S.core.flash=0; S.core.cool=0;
  // keep what you learned; refund the turrets you had standing
  let refund=0;
  for(const t of S.towers){ refund+=Math.round(t.spent*.8); World.removeTower(t); }
  S.towers=[]; S.sel=null; S.build=null;
  S.scrap=Math.max(S.scrap+refund, 140+S.stage*130);
  for(const e of S.enemies)World.removeEnemy(e);
  for(const s of S.shots)World.removeShot(s);
  for(const s of S.ebullets)World.removeShot(s);
  for(const p of S.pickups)World.removePickup(p);
  for(const cl of S.clouds)World.removeCloud(cl);
  clearRifts(); clearSalvage();
  S.enemies=[];S.shots=[];S.ebullets=[];S.drops=[];S.pickups=[];S.clouds=[];
  S.parts=[];S.texts=[];S.beams=[];S.shocks=[];S.magma=[];
  S.map=MAPS.find(m=>m.id===st.map);
  S.obstacles=buildArena(S.map); S.hazards=buildHazards(S.map,S.obstacles);
  S.P=Object.assign(newPlayer(),{hp:S.st.maxHp});
  S.cam.x=CX; S.cam.y=CY;
  for(const a of ABILITIES)S.abil[a.id]={cd:0};
  S.shake=0; S.flash=0; S.hitStop=0;
  World.buildBoard(); World.addPlayer(); World.updateLinks();
  World.setRange(null); World.setGhost(null);
  banner('RETRY · '+st.name);
  log('▶ 重试 '+st.name+'（保留等级 '+S.level+' 与核心升级）');
  UI.hideEnd(); UI.sync();
}

/* ---------- abilities ---------- */
function abilityAimPoint(){
  const P=S.P, d=TILE*5.2;
  return {x:clamp(P.x+Math.cos(P.aim)*d,TILE,W-TILE), y:clamp(P.y+Math.sin(P.aim)*d,TILE,H-TILE)};
}
function useAbility(id){
  const a=ABILITIES.find(x=>x.id===id), st=S.abil[id];
  if(!st||st.cd>0){sfx('err');return;}
  if(a.aim){ const p=abilityAimPoint(); fireAbility(a,p.x,p.y); return; }
  fireAbility(a,0,0);
}
function fireAbility(a,x,y){
  S.abil[a.id].cd=a.cd; S.aim=null; sfx('ability');
  if(a.id==='strike'){
    const dmg=a.dmg*(1+S.wave*.11);
    shake(1.1); S.flash=.3;
    shock(x,y,.3,a.r*1.5,'#ff9a3d',.9,.3); shock(x,y,.3,a.r*2.4,'#ffe89a',1.3,.2);
    for(let i=0;i<70;i++)part(x,y,.4,pick(['#ffb45a','#ff6b3d','#fff2b0']),{sp:rnd(15,3),r:rnd(.3,.1)});
    beam({x,y,z:14},{x,y,z:.3},'#ffe89a',6,.35);
    nearEnemies(x,y,a.r*TILE+40,e=>{ if(!e.alive)return;
      const d=Math.sqrt(dist2(x,y,e.x,e.y));
      if(d<a.r*TILE+e.r){ hurt(e,dmg*clamp(1-(d/(a.r*TILE))*.4,.6,1),
          {pierceArmor:true,fromPlayer:true,ang:Math.atan2(e.y-y,e.x-x)});
        applyStun(e,.6); } });
    for(const rf of S.rifts){ if(rf.alive&&dist2(x,y,rf.x,rf.y)<(a.r*TILE+RIFT.r*TILE)**2)damageRift(rf,dmg*1.2); }
    for(const o of S.obstacles.slice()){ if(dist2(x,y,o.x,o.y)<(a.r*TILE+o.r*TILE)**2)damageProp(o,dmg*.6,0); }
    sfx('boom',1.2);
  } else if(a.id==='freeze'){
    S.flash=.22;
    for(const e of S.enemies){ if(!e.alive)continue;
      applyStun(e,3); applySlow(e,.5,5.5);
      shock(e.x,e.y,.3,.9,'#9fe8ff',.5); burstFx(e.x,e.y,.5,'#cbf1ff',8,4,.1); }
    log('绝对冰封 · 全场冻结');
  } else if(a.id==='over'){
    S.overT=9;
    for(const t of S.towers){ shock(t.x,t.y,.35,1.5,'#ffc247',.6);
      for(let i=0;i<12;i++)part(t.x,t.y,.5,'#ffc247',{sp:rnd(5,1)}); }
    log('火力过载 · 射速 +150%');
  }
  UI.sync();
}

/* ---------- main loop ---------- */
function sim(dt){
  S.time+=dt;
  if(S.overT>0)S.overT-=dt;
  if(S.comboT>0){S.comboT-=dt;if(S.comboT<=0)S.combo=0;}
  for(const id in S.abil) if(S.abil[id].cd>0)S.abil[id].cd=Math.max(0,S.abil[id].cd-dt);

  if(S.waveActive){
    S.qt+=dt;
    updateRifts(dt);
    if(!riftsPending()&&!S.enemies.some(e=>e.alive))waveDone();
  } else if(S.rest>0){ S.rest-=dt; if(S.rest<=0)startWave();
    for(const t of S.towers) if(t.hp<t.maxHp) t.hp=Math.min(t.maxHp,t.hp+t.maxHp*.22*dt);
  }
  for(const o of S.obstacles) if(o.flash>0)o.flash-=dt;
  for(const t of S.towers){ if(t.flash>0)t.flash-=dt; if(t.hitT>0)t.hitT-=dt;
    if(t.hp>=t.maxHp*.6)t.criedFor=0; }
  if(S.towerAlarm>0)S.towerAlarm-=dt;
  updateClouds(dt);
  updateHazards(dt);
  updateSalvage(dt);
  updatePickups(dt);

  rebuildGrid();
  updatePlayer(dt);
  updateCore(dt);

  for(let i=S.enemies.length-1;i>=0;i--){ const e=S.enemies[i];
    if(!e.alive){S.enemies.splice(i,1);continue;}
    if(e.droneCd>0)e.droneCd-=dt;
    updateEnemy(e,dt); }

  for(const t of S.towers){
    if(t.def.support)continue;
    const s=tstat(t);
    if(t.key==='frost'&&s.aura){ frostAura(t,s,dt); t.target=null; continue; }
    const R=s.range*TILE;
    if(!t.target||!t.target.alive||!inRange(t,t.target,R)||S.time-(t.retarget||0)>.4){
      t.target=findTarget(t,s); t.retarget=S.time;
    }
    if(t.key==='flame'){ if(t.target||s.ring)flameTick(t,s,dt); continue; }
    t.cool-=dt;
    if(t.target&&t.cool<=0){ t.cool=1/s.rate; towerFire(t,s); }
  }

  updateShots(dt);
  updateDrops(dt);
  if(S.pendingCards>0&&!S.cards)offerCards();

  for(let i=S.parts.length-1;i>=0;i--){ const p=S.parts[i]; p.t+=dt;
    if(p.t>=p.life){S.parts.splice(i,1);continue;}
    p.x+=p.vx*TILE*dt; p.y+=p.vy*TILE*dt; p.z+=p.vz*dt; p.vz-=p.g*dt;
    if(p.z<.05){p.z=.05;p.vz*=-.35;p.vx*=.6;p.vy*=.6;} }
  for(let i=S.beams.length-1;i>=0;i--){ S.beams[i].t+=dt; if(S.beams[i].t>=S.beams[i].life)S.beams.splice(i,1); }
  for(let i=S.shocks.length-1;i>=0;i--){ S.shocks[i].t+=dt; if(S.shocks[i].t>=S.shocks[i].life)S.shocks.splice(i,1); }
  for(let i=S.texts.length-1;i>=0;i--){ const x=S.texts[i]; x.t+=dt; x.z+=x.vz*dt; x.vz*=.94;
    if(x.t>=x.life)S.texts.splice(i,1); }
  for(let i=S.magma.length-1;i>=0;i--){ const m=S.magma[i]; m.t+=dt; if(m.t>=m.life)S.magma.splice(i,1); }

  if(S.toast){ S.toast.t+=dt; if(S.toast.t>=S.toast.life)S.toast=null; }
  for(const t of S.towers) if(t.riseT>0)t.riseT-=dt;
  if(S.shake>0)S.shake=Math.max(0,S.shake-dt*3.2);
  if(S.flash>0)S.flash=Math.max(0,S.flash-dt*2.2);

  // camera anchor
  if(S.P.alive){ S.cam.x=S.P.x; S.cam.y=S.P.y; }
  else { S.cam.x=lerp(S.cam.x,CX,.05); S.cam.y=lerp(S.cam.y,CY,.05); }
}
let lastT=0;
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(.05,(now-lastT)/1000); lastT=now;
  if(S.running&&!S.paused&&!S.over){
    let scale=1;
    if(S.hitStop>0){ S.hitStop=Math.max(0,S.hitStop-dt); scale=.18; }
    let left=dt*S.speed*scale, guard=0;
    while(left>0&&guard++<6){ const st=Math.min(.033,left); sim(st); left-=st; }
  }
  World.frame(dt,now/1000);
  drawOverlay();
  UI.tick(dt);
}
