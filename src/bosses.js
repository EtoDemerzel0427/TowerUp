/* ===================== REGION CHAMPION KITS =====================
   A champion is not a big grunt. Each kit is a small state machine with a tell
   you can read, an attack that hurts, and one specific thing that punishes it.
   update(e,dt) returns true when the kit has taken over the unit's movement for
   this frame (charging, burrowed, winding up); false hands control back to the
   ordinary steering in updateEnemy. */
const BossKit=(()=>{
  const A=()=>atkScale(S.wave);
  const P=()=>S.P;
  const dP=e=>{ const p=P(); return p&&p.alive?Math.hypot(p.x-e.x,p.y-e.y)/TILE:1e9; };
  const angTo=(e,x,y)=>Math.atan2(y-e.y,x-e.x);
  const hurtP=(dmg,src,pierce)=>{ if(P()&&P().alive)hurtPlayer(dmg,src,pierce); };
  const shoveP=(fx,fy,k)=>{ const p=P(); if(!p)return; const a=Math.atan2(p.y-fy,p.x-fx); p.vx+=Math.cos(a)*TILE*k; p.vy+=Math.sin(a)*TILE*k; };

  const KITS={
  /* ---------- 铁颚 · 破障者: the line charge ----------
     Winds up planted for a second with a red line to where it will go, then rams
     down it at 11 tiles/s. Hits you or a turret: heavy damage and a shove. Hits a
     prop or the wall: it stuns itself for three seconds with its core exposed. */
  crusher:{
    init(e){ e.k={cd:4.5,st:'idle',line:null}; },
    update(e,dt){
      const k=e.k, p=P();
      if(e.exposed>0){ e.exposed-=dt; e.curSp=0;
        if(Math.random()<dt*14)part(e.x,e.y,.9,'#ffe89a',{sp:rnd(1.6,.4),el:1.2,life:.4,r:.1,g:-1});
        if(e.exposed<=0){ e.stun=0; text(e.x,e.y,1.4,'恢复','#8d96bd',12); }
        return true; }
      if(k.st==='wind'){
        k.t-=dt; e.curSp=0; e.face=k.a;
        // the tell: a red line down the lane, thicker as the launch nears
        const L=k.len*TILE; const ex=e.x+Math.cos(k.a)*L, ey=e.y+Math.sin(k.a)*L;
        beam({x:e.x,y:e.y,z:.35},{x:ex,y:ey,z:.35},'#ff4d5e',2.5+(1-k.t/1.0)*3,.08);
        if(Math.random()<dt*30)part(e.x-Math.cos(k.a)*e.r,e.y-Math.sin(k.a)*e.r,.4,'#ff8a3a',{sp:rnd(2,.5),ang:k.a+Math.PI+rnd(.6,-.6),el:.3,life:.3,r:.1});
        if(k.t<=0){ k.st='charge'; k.d=0; sfx('dash',1,.6); shock(e.x,e.y,.3,2,'#ff4d5e',.4); shake(.2); }
        return true;
      }
      if(k.st==='charge'){
        const sp=11*TILE*dt; k.d+=sp/TILE;
        e.x+=Math.cos(k.a)*sp; e.y+=Math.sin(k.a)*sp; e.face=k.a; e.curSp=11;
        e.vx=Math.cos(k.a)*11*TILE; e.vy=Math.sin(k.a)*11*TILE;
        if(Math.random()<dt*40)part(e.x,e.y,.3,'#ff8a3a',{sp:rnd(3,1),ang:k.a+Math.PI+rnd(.8,-.8),el:.4,life:.35,r:.13});
        const crash=(why)=>{
          k.st='idle'; k.cd=rnd(7,5.5); e.exposed=3; e.stun=3;
          e.x-=Math.cos(k.a)*TILE*.4; e.y-=Math.sin(k.a)*TILE*.4; e.vx=e.vy=0;
          shock(e.x,e.y,.4,3,'#ffe89a',.7,.25); burstFx(e.x,e.y,.6,'#ffd7a0',30,8,.16); shake(.6); hitStop(.08); sfx('boom',1,.9);
          text(e.x,e.y,1.6+e.r/TILE,'撞晕! 弱点暴露','#ffe89a',17); toast('铁颚撞晕了 · 现在伤害 ×2.5','#ffe89a');
          World.scorch(e.x,e.y,1.2,12);
        };
        // you
        if(p&&p.alive&&Math.hypot(p.x-e.x,p.y-e.y)<e.r+PLAYER.r*TILE+TILE*.3&&p.dashT<=0){
          hurtP(42*A()*(e.atkMul||1),e); shoveP(e.x,e.y,20); shock(e.x,e.y,.4,2.2,'#ff4d5e',.5); shake(.4);
          k.st='idle'; k.cd=rnd(7,5.5); e.recoilT=.4; return true; }
        // a turret in the lane: wrecked, and it keeps going
        for(const t of S.towers) if(Math.hypot(t.x-e.x,t.y-e.y)<e.r+TILE*.55){
          damageTower(t,260*A(),e); burstFx(t.x,t.y,.6,'#ff8a8a',14,6,.13); shake(.3); break; }
        // scenery or the wall: it eats the impact
        const pr=propAt(e.x+Math.cos(k.a)*e.r*.8,e.y+Math.sin(k.a)*e.r*.8,.05);
        if(pr){ damageProp(pr,90,k.a); crash('prop'); return true; }
        if(e.x<TILE*1.1||e.x>W-TILE*1.1||e.y<TILE*1.1||e.y>H-TILE*1.1){ crash('wall'); return true; }
        if(k.d>=k.len){ k.st='idle'; k.cd=rnd(7,5.5); e.recoilT=.3; }
        return true;
      }
      k.cd-=dt;
      const d=dP(e);
      if(k.cd<=0&&d>2.5&&d<12&&e.stagger<=0&&e.stun<=0){
        k.st='wind'; k.t=1.0; k.a=angTo(e,p.x,p.y); k.len=Math.min(15,d+5);
        text(e.x,e.y,1.5+e.r/TILE,'冲撞!','#ff4d5e',17); sfx('pick',.7,.45);
        shock(e.x,e.y,.35,1.6,'#ff4d5e',.6);
        return true;
      }
      return false;
    },
    onDeath(e){},
  },

  /* ---------- 蔓生母株: the brood ----------
     Keeps hatching 裂片 to hide behind, throws a ring of spores you slip between,
     and at 2/3 and 1/3 health burrows, crosses under the deck, and erupts
     elsewhere with a root burst. */
  brood:{
    init(e){ e.k={hatch:3,spore:6,marks:[.66,.33],bury:0,st:'idle'}; },
    update(e,dt){
      const k=e.k, p=P();
      if(k.st==='bury'){
        k.t-=dt; e.buried=1; e.curSp=0;
        if(e.obj)e.obj.scale.setScalar(Math.max(.02,(k.t/1.4)*.4));
        // travelling underground: a ridge of cracks toward the exit
        const f=1-k.t/1.4; const x=lerp(k.x0,k.x1,f), y=lerp(k.y0,k.y1,f);
        if(Math.random()<dt*40)part(x,y,.1,'#8a6a3a',{sp:rnd(1.2,.3),el:1.1,life:.5,r:.1,g:3});
        if(k.t<.6&&!k.warned){ k.warned=true; shock(k.x1,k.y1,.2,2.6,'#ffb45a',.6,.1); text(k.x1,k.y1,1,'根须!','#ffb45a',15); }
        if(k.t<=0){
          e.x=k.x1; e.y=k.y1; e.buried=0; k.st='idle'; if(e.obj)e.obj.scale.setScalar(e.scale||1);
          const R=2.4*TILE;
          shock(e.x,e.y,.3,2.6,'#ffb45a',.6,.2); burstFx(e.x,e.y,.5,'#c9a06a',34,7,.15); shake(.5); sfx('boom',.9,.8);
          if(p&&p.alive&&dist2(p.x,p.y,e.x,e.y)<R*R){ hurtP(34*A(),e); shoveP(e.x,e.y,12); }
          for(const t of S.towers) if(dist2(t.x,t.y,e.x,e.y)<R*R)damageTower(t,160*A(),e);
          for(let i=0;i<3;i++){ const a=rnd(TAU); const s=spawnEnemyAt('spawn',e.x+Math.cos(a)*TILE,e.y+Math.sin(a)*TILE,e.hpMul*.5); if(s)s._brood=e; }
          text(e.x,e.y,1.6+e.r/TILE,'破土而出','#ffb45a',16);
        }
        return true;
      }
      // burrow at the health marks
      if(k.marks.length&&e.hp<=e.maxHp*k.marks[0]){
        k.marks.shift(); k.st='bury'; k.t=1.4; k.x0=e.x; k.y0=e.y;
        // exit: somewhere 6-9 tiles from the Core, away from where it went down
        let bx,by,tries=0; do{ const a=rnd(TAU),d=(6+rnd(3))*TILE; bx=clamp(CX+Math.cos(a)*d,TILE*2,W-TILE*2); by=clamp(CY+Math.sin(a)*d*.8,TILE*2,H-TILE*2); }
        while(++tries<30&&(dist2(bx,by,e.x,e.y)<(6*TILE)**2||propAt(bx,by,1)));
        k.x1=bx; k.y1=by; k.warned=false; e.poise=0; e.stagger=0; e.stun=0;
        burstFx(e.x,e.y,.3,'#8a6a3a',24,5,.14); shock(e.x,e.y,.2,1.8,'#8a6a3a',.5); sfx('toxin',.9,.5);
        text(e.x,e.y,1.4+e.r/TILE,'钻地','#c9a06a',15); toast('蔓生母株钻地了 · 它会从别处炸出来','#ffb45a');
        return true;
      }
      k.hatch-=dt;
      if(k.hatch<=0){ k.hatch=rnd(6,4.5);
        const live=S.enemies.filter(x=>x.alive&&x._brood===e).length;
        if(live<8){ for(let i=0;i<2;i++){ const a=rnd(TAU); const s=spawnEnemyAt('spawn',e.x+Math.cos(a)*e.r,e.y+Math.sin(a)*e.r,e.hpMul*.5); if(s)s._brood=e; }
          burstFx(e.x,e.y,.6,'#ffbe7a',10,4,.1); sfx('toxin',.5,.8); text(e.x,e.y,1.3+e.r/TILE,'孵化','#ffbe7a',12); } }
      k.spore-=dt;
      if(k.spore<=0&&dP(e)<9){
        k.spore=rnd(10,7.5); e.curSp=0;
        text(e.x,e.y,1.5+e.r/TILE,'孢子!','#ffbe7a',16); sfx('pick',.6,.6);
        const n=8, off=rnd(TAU);
        for(let i=0;i<n;i++){ const a=off+i/n*TAU;
          const b={x:e.x+Math.cos(a)*e.r,y:e.y+Math.sin(a)*e.r,z:.55,dx:Math.cos(a),dy:Math.sin(a),sp:5.5*TILE,
            dmg:16*A(),d:0,maxD:9*TILE,color:'#ffbe7a',r:.16,style:'lob'};
          S.ebullets.push(b); World.addShot(b); }
        shock(e.x,e.y,.4,1.8,'#ffbe7a',.5);
      }
      return false;
    },
    onDeath(e){ // the brood dies with the mother
      for(const x of S.enemies) if(x.alive&&x._brood===e){ x.hp=0; kill(x,null,false); }
    },
  },

  /* ---------- 霜髓卫士: the ice wall ----------
     Raises three ice pillars between itself and you; bullets stop at them and its
     shield only regenerates while a pillar stands. Frost nova when you get close. */
  warden:{
    init(e){ e.k={wall:2,nova:5,pillars:[]}; e.maxShield=e.maxShield*1.6; e.shield=e.maxShield; },
    update(e,dt){
      const k=e.k, p=P();
      k.pillars=k.pillars.filter(o=>S.obstacles.includes(o));
      // shield: regenerates hard behind a wall, not at all without one
      if(k.pillars.length){ if(e.shield<e.maxShield){ e.shield=Math.min(e.maxShield,e.shield+e.maxShield*.14*dt); } e.shieldT=Math.max(e.shieldT,.3); }
      else { e.shieldT=Math.max(e.shieldT,9); }   // holds the ordinary regen off
      if(k.st==='nova'){
        k.t-=dt; e.curSp=0;
        if(Math.random()<dt*30){ const a=rnd(TAU),d=rnd(3.2*TILE); part(e.x+Math.cos(a)*d,e.y+Math.sin(a)*d,.2,'#bfe4ff',{sp:rnd(1,.2),el:1.2,life:.4,r:.09,g:-1.5}); }
        if(k.t<=0){ k.st='idle';
          const R=3.2*TILE;
          shock(e.x,e.y,.3,3.4,'#ffffff',.5,.3); shock(e.x,e.y,.3,4,'#8fd0ff',.8,.15); burstFx(e.x,e.y,.5,'#dff2ff',40,9,.16); shake(.6); sfx('frost',1.2,.6);
          if(p&&p.alive&&dist2(p.x,p.y,e.x,e.y)<R*R){ hurtP(30*A(),e); shoveP(e.x,e.y,16); }
          for(const t of S.towers) if(dist2(t.x,t.y,e.x,e.y)<R*R)damageTower(t,120*A(),e);
          // and the deck ices over
          const h={kind:'ice',x:e.x,y:e.y,r:3.0,seed:rnd(99),t:0,phase:'idle',obj:null,temp:7};
          S.hazards.push(h); World.addHazardLate(h);
        }
        return true;
      }
      k.wall-=dt;
      if(k.wall<=0&&p&&p.alive&&dP(e)>2.2){
        k.wall=rnd(13,10);
        const a=angTo(e,p.x,p.y);
        let made=0;
        for(const off of [-.62,0,.62]){
          const aa=a+off, x=e.x+Math.cos(aa)*TILE*2.4, y=e.y+Math.sin(aa)*TILE*2.4;
          if(x<TILE*1.5||x>W-TILE*1.5||y<TILE*1.5||y>H-TILE*1.5)continue;
          if(dist2(x,y,CX,CY)<((CORE.r+1.2)*TILE)**2)continue;
          // its own pillars stand shoulder to shoulder; only foreign scenery blocks a spot
          if(S.obstacles.some(o=>o.temp===undefined&&dist2(x,y,o.x,o.y)<((o.r+.7)*TILE)**2))continue;
          if(k.pillars.some(o=>dist2(x,y,o.x,o.y)<(TILE*.9)**2))continue;
          if(S.towers.some(t=>dist2(x,y,t.x,t.y)<(TILE*.9)**2))continue;
          const o={x,y,r:.6,kind:'icespire',role:'rock',seed:rnd(99),hp:90,maxHp:90,flash:0,obj:null,temp:14};
          S.obstacles.push(o); World.addProp(o); k.pillars.push(o); made++;
          shock(x,y,.2,1.2,'#bfe4ff',.5); burstFx(x,y,.4,'#dff2ff',10,4,.1);
        }
        if(made){ text(e.x,e.y,1.5+e.r/TILE,'冰墙!','#bfe4ff',16); sfx('frost',1,.8);
          if(!k.hinted){ k.hinted=true; toast('冰柱挡住了子弹 · 打碎它，或者绕过去','#bfe4ff'); } }
      }
      k.nova-=dt;
      if(k.nova<=0&&dP(e)<3.6){
        k.nova=rnd(9,7); k.st='nova'; k.t=1.1;
        text(e.x,e.y,1.5+e.r/TILE,'霜爆!','#bfe4ff',17); sfx('pick',.6,.5);
        shock(e.x,e.y,.25,3.2,'#8fd0ff',1.1,.08);
        return true;
      }
      return false;
    },
    onDeath(e){ for(const o of e.k.pillars) if(S.obstacles.includes(o))o.temp=Math.min(o.temp||1,.5); },
  },

  /* ---------- 熔心: the walking eruption ----------
     Leaves magma wherever it walks; every so often drops four meteors around you
     (orange rings first). The volatile affix already makes its death a blast. */
  magma:{
    init(e){ e.k={trail:0,rain:6,meteors:[]}; },
    update(e,dt){
      const k=e.k, p=P();
      k.trail-=dt;
      if(k.trail<=0&&e.curSp>.1){ k.trail=.55;
        if(S.magma.length<26)S.magma.push({x:e.x,y:e.y,r:.85,t:0,life:6,dps:22*A(),src:null}); }
      for(let i=k.meteors.length-1;i>=0;i--){ const m=k.meteors[i]; m.t-=dt;
        if(Math.random()<dt*20)part(m.x+rnd(TILE,-TILE),m.y+rnd(TILE,-TILE),.2,'#ff8a2d',{sp:rnd(1,.2),el:1.3,life:.4,r:.09,g:-1.5});
        if(m.t<=0){ k.meteors.splice(i,1);
          const R=1.6*TILE;
          beam({x:m.x,y:m.y,z:12},{x:m.x,y:m.y,z:.3},'#ffb45a',5,.25);
          shock(m.x,m.y,.3,1.8,'#ffe89a',.5,.3); burstFx(m.x,m.y,.5,'#ff8a2d',26,8,.17); shake(.35); sfx('boom',.8,1.1);
          World.scorch(m.x,m.y,1.3,20);
          if(p&&p.alive&&dist2(p.x,p.y,m.x,m.y)<R*R){ hurtP(38*A(),e); shoveP(m.x,m.y,10); }
          for(const t of S.towers) if(dist2(t.x,t.y,m.x,m.y)<R*R)damageTower(t,150*A(),e);
          if(dist2(CX,CY,m.x,m.y)<(R+CORE.r*TILE)**2)damageCore(90*A(),e);
          if(S.magma.length<26)S.magma.push({x:m.x,y:m.y,r:1.1,t:0,life:5,dps:22*A(),src:null});
        } }
      k.rain-=dt;
      if(k.rain<=0&&p&&p.alive&&dP(e)<14){
        k.rain=rnd(11,8.5);
        for(let i=0;i<4;i++){ const a=i/4*TAU+rnd(.8), d=(i===0?0:rnd(2.6,1.2))*TILE;
          const x=clamp(p.x+Math.cos(a)*d,TILE,W-TILE), y=clamp(p.y+Math.sin(a)*d,TILE,H-TILE);
          k.meteors.push({x,y,t:1.4+i*.12});
          shock(x,y,.2,1.6,'#ff8a2d',1.4+i*.12,.08); }
        text(e.x,e.y,1.5+e.r/TILE,'陨石雨!','#ff8a2d',17); sfx('boss',.5,1.6);
        toast('陨石落点已标出 · 离开橙圈','#ff8a2d');
      }
      return false;
    },
    onDeath(e){},
  },

  /* ---------- 深渊执政官: the gravity well ----------
     Blinks to your flank, then opens a well that drags you in for a heavy strike. */
  archon:{
    init(e){ e.k={blink:4,well:7,st:'idle'}; },
    update(e,dt){
      const k=e.k, p=P();
      if(k.st==='well'){
        k.t-=dt; e.curSp=0;
        const R=6.5*TILE;
        if(p&&p.alive&&dist2(p.x,p.y,e.x,e.y)<R*R){
          const a=angTo(e,p.x,p.y)+Math.PI; const pull=(p.dashT>0?0:1)*TILE*26*dt;
          p.vx+=Math.cos(a)*pull; p.vy+=Math.sin(a)*pull;
          if(Math.random()<dt*24)part(p.x,p.y,.4,'#c98cff',{sp:rnd(2,.5),ang:angTo(p,e.x,e.y),el:.2,life:.3,r:.1}); }
        if(Math.random()<dt*30){ const a=rnd(TAU),d=rnd(R,TILE); part(e.x+Math.cos(a)*d,e.y+Math.sin(a)*d,.3,'#b06cff',{sp:rnd(3,1),ang:a+Math.PI,el:.1,life:.35,r:.1}); }
        if(k.t<=0){ k.st='idle';
          const RR=2.6*TILE;
          shock(e.x,e.y,.4,2.8,'#ffffff',.5,.3); shock(e.x,e.y,.4,3.6,'#b06cff',.8,.2); burstFx(e.x,e.y,.6,'#d0a0ff',40,10,.18); shake(.8); hitStop(.07); sfx('boom',1.2,.7);
          if(p&&p.alive&&dist2(p.x,p.y,e.x,e.y)<RR*RR){ hurtP(55*A(),e); shoveP(e.x,e.y,22); }
          for(const t of S.towers) if(dist2(t.x,t.y,e.x,e.y)<RR*RR)damageTower(t,220*A(),e);
        }
        return true;
      }
      k.blink-=dt;
      if(k.blink<=0&&p&&p.alive&&dP(e)>3.5&&dP(e)<18){
        k.blink=rnd(9,6.5);
        burstFx(e.x,e.y,.5,'#b06cff',20,6,.14); shock(e.x,e.y,.3,1.8,'#b06cff',.4);
        const a=rnd(TAU); e.x=clamp(p.x+Math.cos(a)*TILE*3,TILE*1.5,W-TILE*1.5); e.y=clamp(p.y+Math.sin(a)*TILE*3,TILE*1.5,H-TILE*1.5);
        resolveObstacles(e,e.r/TILE);
        burstFx(e.x,e.y,.5,'#d0a0ff',20,6,.14); sfx('dash',.8,.7); text(e.x,e.y,1.5+e.r/TILE,'瞬移','#d0a0ff',13);
        k.well=Math.min(k.well,1.2);   // a blink is usually followed by the well
      }
      k.well-=dt;
      if(k.well<=0&&p&&p.alive&&dP(e)<6.5){
        k.well=rnd(11,8); k.st='well'; k.t=1.5;
        text(e.x,e.y,1.6+e.r/TILE,'引力井!','#c98cff',18); sfx('boss',.5,1.5);
        shock(e.x,e.y,.25,6.5,'#b06cff',1.5,.06); shock(e.x,e.y,.25,2.6,'#ffffff',1.5,.06);
        if(!k.hinted){ k.hinted=true; toast('引力井 · 朝反方向冲刺，冲刺期间不受拖拽','#c98cff'); }
        return true;
      }
      return false;
    },
    onDeath(e){},
  },
  };

  return {
    init(e){ const K=KITS[e.kit]; if(K)K.init(e); },
    update(e,dt){ const K=KITS[e.kit]; return K?!!K.update(e,dt):false; },
    onDeath(e){ const K=KITS[e.kit]; if(K)K.onDeath(e); },
    has(kit){ return !!KITS[kit]; },
  };
})();
