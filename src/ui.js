/* ===================== OVERLAY + UI ===================== */
const $=id=>document.getElementById(id);
const el={scrap:$('vScrap'),power:$('vPower'),mul:$('vMul'),lives:$('vLives'),
  livesChip:document.querySelector('.chip.lives'),xpNote:$('xpNote'),powerChip:document.querySelector('.chip.power'),wave:$('vWave'),core:$('vCore'),coreFill:$('coreFill'),
  corebar:document.querySelector('.corebar'),
  level:$('vLevel'),xpFill:$('xpFill'),hpFill:$('hpFill'),hp:$('vHp'),
  hptrack:document.querySelector('.hptrack'),dashFill:$('dashFill'),heatFill:$('heatFill'),heatWord:$('heatWord'),
  ultFill:$('ultFill'),ultWord:$('ultWord'),ultRow:document.querySelector('.ultrow'),
  heatRow:document.querySelector('.heatrow'),
  ovlTerm:$('ovlTerm'),termHint:$('termHint'),termGrid:$('termGrid'),termScrap:$('termScrap'),bTermClose:$('bTermClose'),
  shop:$('shop'),secBuild:$('secBuild'),secInsp:$('secInsp'),wavePrev:$('wavePrev'),
  waveTag:$('waveTag'),bNext:$('bNext'),nextBonus:$('nextBonus'),log:$('log'),perks:$('perks'),
  banner:$('banner'),bannerT:$('bannerT'),abilities:$('abilities'),mini:$('mini'),
  bSpeed:$('bSpeed'),bPause:$('bPause'),bSound:$('bSound'),bLayout:$('bLayout'),bestTag:$('bestTag'),
  ovlHelp:$('ovlHelp'),ovlTutDone:$('ovlTutDone'),
  layoutPicks:$('layoutPicks'),tipBox:$('tipBox'),
  ovlStart:$('ovlStart'),ovlEnd:$('ovlEnd'),ovlCards:$('ovlCards'),cardRow:$('cardRow'),
  ovlTele:$('ovlTele'),teleTitle:$('teleTitle'),teleSub:$('teleSub'),stageLine:$('stageLine'),
  upGrid:$('upGrid'),teleScrap:$('teleScrap'),bNextStage:$('bNextStage'),kStage:$('kStage'),
  endBox:$('endBox'),mapPicks:$('mapPicks'),diffPicks:$('diffPicks'),bPlay:$('bPlay'),
  buildHint:$('buildHint'),respawn:$('respawn'),respawnT:$('respawnT')};
const mctx=el.mini.getContext('2d');
const L2turn=()=>S.layout==='right'?'A/D':'←/→';

/* ---------- 2D overlay ---------- */
function drawOverlay(){
  c2.clearRect(0,0,VW,VH);
  // enemy bars
  for(const e of S.enemies){
    if(!e.alive)continue;
    const h=(e.fly?1.5:0)+(e.r/TILE)*1.5*(e.scale||1)+.35;
    const p=World.proj(e.x,e.y,h); if(!p.vis||p.x<-60||p.x>VW+60||p.y<-60||p.y>VH+60)continue;
    const p2=World.proj(e.x,e.y,h+1), ppu=Math.abs(p.y-p2.y);
    const w=clamp(ppu*(e.r/TILE)*3.0*(e.scale||1),18,90), bh=Math.max(3,ppu*.085);
    const hpf=clamp(e.hp/e.maxHp,0,1);
    if(hpf<.995||e.shield<e.maxShield*.995||e.boss){
      c2.fillStyle='rgba(4,6,14,.5)'; c2.fillRect(p.x-w/2,p.y,w,bh);
      c2.fillStyle=e.mini?'#ffc247':e.affixDef?e.affixDef.c:hpf>.5?'#6ee7a8':hpf>.22?'#ffc247':'#ff4d5e';
      c2.fillRect(p.x-w/2,p.y,w*hpf,bh);
      if(e.affixDef&&!e.boss){
        c2.font='700 9.5px "Chakra Petch",sans-serif'; c2.textAlign='center';
        c2.fillStyle=e.affixDef.c; c2.fillText(e.name,p.x,p.y-6);
      }
      if(e.maxShield>0&&e.shield>0){ c2.fillStyle='rgba(120,240,228,.95)';
        c2.fillRect(p.x-w/2,p.y-bh-1.2,w*clamp(e.shield/e.maxShield,0,1),bh*.6); }
    }
    // poise: fill it and the thing staggers, however heavy it is
    if(e.poise>0&&e.alive){
      const pf=clamp(e.poise/e.poiseMax,0,1), py=p.y+bh+1.2, ph=Math.max(2,bh*.5);
      c2.fillStyle='rgba(4,6,14,.5)'; c2.fillRect(p.x-w/2,py,w,ph);
      c2.fillStyle=pf>.8?'#fff2b0':'#ffc247';
      c2.fillRect(p.x-w/2,py,w*pf,ph);
    }
    if(e.stagger>0&&e.alive){
      c2.font='700 10px "Chakra Petch",sans-serif'; c2.fillStyle='#ffe89a'; c2.textAlign='center';
      c2.fillText('硬直',p.x,p.y-bh-7);
    }
    let sx=p.x-w/2, sy=p.y+bh+(e.poise>0?bh*.5+2.4:2.5), R=Math.max(1.4,bh*.45);
    const pips=[];
    if(e.burnT>0)pips.push('#ff8a2d'); if(e.poisonT>0)pips.push('#a6e22e');
    if(e.slowT>0)pips.push('#5fd0ff'); if(e.stun>0)pips.push('#ffffff');
    if(e.vulnT>0)pips.push('#ff3d8a'); if(e.markT>0)pips.push('#ffd54a');
    if(e.shred>0)pips.push('#c98cff');
    pips.forEach((c,i)=>{c2.fillStyle=c;c2.beginPath();c2.arc(sx+R+i*(R*2.6),sy+R,R,0,TAU);c2.fill();});
    // committed sapper: show WHO is going for your guns and WHICH gun, so intercepting
    // is a read rather than a coin-flip you never see
    if(e.sapT&&!e.sapT.dead&&e.sapT.hp>0){
      const tp=World.proj(e.sapT.x,e.sapT.y,.9);
      if(tp.vis){
        const ph=(S.time*3.2+e.seed)%1;
        c2.save();
        c2.setLineDash([5,5]); c2.lineDashOffset=-S.time*26;
        c2.strokeStyle='rgba(255,138,58,'+(.30+.16*Math.sin(S.time*5+e.seed))+')';
        c2.lineWidth=1.6;
        c2.beginPath(); c2.moveTo(p.x,p.y+bh*2); c2.lineTo(tp.x,tp.y); c2.stroke();
        c2.restore();
        const my=p.y-bh-(e.affixDef&&!e.boss?17:7)-3*ph;
        c2.font='700 12px "Chakra Petch",sans-serif'; c2.textAlign='center';
        c2.lineWidth=3; c2.strokeStyle='rgba(3,5,12,.9)';
        c2.strokeText('\u2692',p.x,my);
        c2.fillStyle='#ff8a3a'; c2.fillText('\u2692',p.x,my);
      }
    }
  }
  // floating text
  c2.textAlign='center'; c2.textBaseline='middle';
  for(const t of S.texts){
    const p=World.proj(t.x,t.y,t.z); if(!p.vis)continue;
    const k=1-t.t/t.life, a=k<.35?k/.35:1;
    c2.globalAlpha=a; c2.font='700 '+t.size+'px "Share Tech Mono",monospace';
    c2.lineWidth=3.5; c2.strokeStyle='rgba(3,5,12,.9)'; c2.strokeText(t.s,p.x,p.y);
    c2.fillStyle=t.c; c2.fillText(t.s,p.x,p.y);
  }
  c2.globalAlpha=1;

  // aim indicator: a reticle thrown out along the firing stick
  if(S.running&&S.P&&S.P.alive){
    const P=S.P, st=S.st;
    const hot=P.overheat>0, chg=P.charging?P.charge/PLAYER.chargeMax:0, fine=P.fine;
    const reach=st.range*TILE*(P.charging?1.5:1);
    const tx=P.x+Math.cos(P.aim)*reach, ty=P.y+Math.sin(P.aim)*reach;
    const a0=World.proj(P.x+Math.cos(P.aim)*TILE*.8,P.y+Math.sin(P.aim)*TILE*.8,.45);
    const a1=World.proj(tx,ty,.45);
    if(a0.vis&&a1.vis){
      const col=hot?'rgba(255,77,94,.55)':chg>0?'rgba(255,246,208,.75)':'rgba(159,232,255,.45)';
      c2.strokeStyle=col; c2.lineWidth=chg>0?2.2:1.3;
      c2.setLineDash(chg>0?[]:[7,9]); c2.beginPath();
      c2.moveTo(a0.x,a0.y); c2.lineTo(a1.x,a1.y); c2.stroke(); c2.setLineDash([]);
      const R=hot?13:9-chg*3;
      c2.strokeStyle=hot?'rgba(255,77,94,.95)':chg>0?'rgba(255,246,208,.95)':'rgba(159,232,255,.9)';
      c2.lineWidth=1.8; c2.beginPath(); c2.arc(a1.x,a1.y,R,0,TAU); c2.stroke();
      c2.beginPath();
      c2.moveTo(a1.x-R-7,a1.y); c2.lineTo(a1.x-R-2,a1.y);
      c2.moveTo(a1.x+R+2,a1.y); c2.lineTo(a1.x+R+7,a1.y);
      c2.moveTo(a1.x,a1.y-R-7); c2.lineTo(a1.x,a1.y-R-2);
      c2.moveTo(a1.x,a1.y+R+2); c2.lineTo(a1.x,a1.y+R+7); c2.stroke();
      if(chg>0){ c2.strokeStyle='rgba(255,246,208,.95)'; c2.lineWidth=3;
        c2.beginPath(); c2.arc(a1.x,a1.y,R+11,-Math.PI/2,-Math.PI/2+TAU*chg); c2.stroke(); }
      if(fine&&!hot){ c2.strokeStyle='rgba(159,232,255,.55)'; c2.lineWidth=1;
        c2.beginPath(); c2.arc(a1.x,a1.y,R+6,0,TAU); c2.stroke();
        c2.font='600 9.5px "Chakra Petch",sans-serif'; c2.fillStyle='#9fd8ff';
        c2.textAlign='center'; c2.fillText('精确瞄准',a1.x,a1.y+R+17); }
      if(hot){ c2.font='700 11px "Chakra Petch",sans-serif'; c2.fillStyle='#ff8a8a';
        c2.textAlign='center'; c2.fillText('枪管过热',a1.x,a1.y+R+18); }
      // ultimate ready: say so right where the player is looking
      if(P.ult>=1&&P.ultT<=0){
        const b=(Math.sin(S.time*7)+1)*.5;
        c2.save();
        c2.strokeStyle='rgba(255,232,154,'+(.45+b*.5)+')'; c2.lineWidth=2.5;
        c2.beginPath(); c2.arc(a1.x,a1.y,R+13+b*3,0,TAU); c2.stroke();
        c2.font='700 13px "Chakra Petch",sans-serif'; c2.textAlign='center';
        c2.fillStyle='rgba(8,11,23,.8)';
        const tw2=c2.measureText('Q · 歼灭光束就绪').width+16;
        c2.fillRect(a1.x-tw2/2,a1.y-R-34,tw2,20);
        c2.strokeStyle='rgba(255,232,154,'+(.6+b*.4)+')'; c2.lineWidth=1.4;
        c2.strokeRect(a1.x-tw2/2,a1.y-R-34,tw2,20);
        c2.fillStyle='rgba(255,232,154,'+(.75+b*.25)+')';
        c2.fillText('Q · 歼灭光束就绪',a1.x,a1.y-R-20);
        c2.restore();
      }
    }
    // current target bracket
    if(P.lock&&P.lock.ref){
      const T=P.lock, ref=T.ref;
      const lp=World.proj(ref.x,ref.y,(T.k==='enemy'?(ref.fly?1.5:0)+.45:T.k==='rift'?2.4:ref.r*1.4+.4));
      if(lp.vis){
        const s2=13+Math.sin(S.time*6)*1.6;
        c2.strokeStyle='rgba(255,200,90,.95)'; c2.lineWidth=2;
        for(const [sx2,sy2] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
          c2.beginPath();
          c2.moveTo(lp.x+sx2*s2, lp.y+sy2*s2-sy2*6);
          c2.lineTo(lp.x+sx2*s2, lp.y+sy2*s2);
          c2.lineTo(lp.x+sx2*s2-sx2*6, lp.y+sy2*s2);
          c2.stroke();
        }
        c2.strokeStyle='rgba(255,200,90,.25)'; c2.lineWidth=1;
        c2.setLineDash([4,6]);
        c2.beginPath(); c2.moveTo(a0.x,a0.y); c2.lineTo(lp.x,lp.y); c2.stroke();
        c2.setLineDash([]);
        const label=T.k==='rift'?'裂隙':T.k==='prop'?((PROPS[ref.kind]||{}).n||'掩体'):(ref.def?ref.def.name:'目标');
        const far=!lockInReach(T);
        c2.font='600 9.5px "Chakra Petch",sans-serif'; c2.fillStyle=far?'#ff9d6a':'#ffc85a';
        c2.textAlign='center'; c2.fillText(label+(far?' · 射程外，靠近':' · '+L2turn()+' 切换'),lp.x,lp.y-s2-7);
      }
    }
    // build ghost sits under your feet
    if(S.build){
      const {c,r}=playerTile();
      const p2=World.proj((c+.5)*TILE,(r+.5)*TILE,.1);
      if(p2.vis){ const ok=canBuild(c,r);
        c2.font='600 11px "Chakra Petch",sans-serif'; c2.textAlign='center';
        c2.fillStyle=ok?'#9fd8ff':'#ff8a8a';
        c2.fillText(ok?'E 建造':'此处不可建造',p2.x,p2.y+26); }
    }
  }

  // off-screen core pointer when you wander away
  if(S.running&&S.P){
    const cp=World.proj(CX,CY,1.4);
    if(!cp.vis||cp.x<20||cp.x>VW-20||cp.y<20||cp.y>VH-20){
      const ang=Math.atan2(cp.y-VH/2,cp.x-VW/2)+(cp.vis?0:Math.PI);
      const rx=VW/2+Math.cos(ang)*(VW/2-42), ry=VH/2+Math.sin(ang)*(VH/2-42);
      c2.save(); c2.translate(rx,ry); c2.rotate(ang);
      c2.fillStyle='rgba(53,230,255,.9)';
      c2.beginPath(); c2.moveTo(13,0); c2.lineTo(-8,7); c2.lineTo(-8,-7); c2.closePath(); c2.fill();
      c2.restore();
      c2.font='600 10px "Chakra Petch",sans-serif'; c2.fillStyle='#9fd8ff'; c2.textAlign='center';
      c2.fillText('核心',rx,ry+20);
    }
  }

  // every turret carries a condition bar; damaged ones shout about it
  for(const t of S.towers){
    const p=World.proj(t.x,t.y,1.35); if(!p.vis)continue;
    const f=clamp(t.hp/t.maxHp,0,1), full=f>.999;
    const w2=full?34:44, bh2=full?3:4.5;
    c2.fillStyle=full?'rgba(4,6,14,.45)':'rgba(4,6,14,.7)';
    c2.fillRect(p.x-w2/2,p.y,w2,bh2);
    c2.fillStyle=full?'rgba(110,231,168,.55)':f>.5?'#6ee7a8':f>.25?'#ffc247':'#ff4d5e';
    c2.fillRect(p.x-w2/2,p.y,w2*f,bh2);
    if(!full){
      c2.strokeStyle='rgba(0,0,0,.5)'; c2.lineWidth=1; c2.strokeRect(p.x-w2/2,p.y,w2,bh2);
      c2.font='700 9px "Chakra Petch",sans-serif'; c2.textAlign='center';
      c2.fillStyle=f<.4?'#ff8a8a':'#ffc247';
      c2.fillText(f<.4?'R 维修!':Math.round(f*100)+'%',p.x,p.y-5);
    }
    // level pips so you can read a turret's rank at a glance
    for(let i=0;i<t.lvl;i++){ c2.fillStyle=t.elite!=null?'#ffc247':t.def.c;
      c2.fillRect(p.x-w2/2+i*6,p.y+bh2+2,4,2.5); }
  }
  // field pickups: name, effect and the countdown before they vanish
  for(const p of S.pickups){
    const D=PICKUPS[p.kind];
    const pt=World.proj(p.x,p.y,1.5); if(!pt.vis)continue;
    const left=p.life-p.t;
    c2.font='700 12px "Chakra Petch",sans-serif'; c2.textAlign='center';
    c2.fillStyle=left<4.5?'#ff8a8a':D.c;
    c2.fillText(D.gl+' '+D.n,pt.x,pt.y);
    c2.font='400 10px "Chakra Petch",sans-serif'; c2.fillStyle='rgba(200,215,240,.8)';
    c2.fillText(D.d,pt.x,pt.y+13);
    c2.font='700 10px "Share Tech Mono",monospace';
    c2.fillStyle=left<4.5?'#ff8a8a':'rgba(200,215,240,.65)';
    c2.fillText(Math.ceil(left)+'s',pt.x,pt.y+26);
  }
  // turret under attack: flash the frame and mark it
  if(S.towerAlarm>0){
    const a=Math.min(1,S.towerAlarm/1.4)*(.16+Math.sin(S.time*16)*.07);
    c2.strokeStyle='rgba(255,77,94,'+a+')'; c2.lineWidth=6;
    c2.strokeRect(3,3,VW-6,VH-6);
    c2.font='700 13px "Chakra Petch",sans-serif'; c2.textAlign='center';
    c2.fillStyle='rgba(255,138,138,'+Math.min(1,S.towerAlarm)+')';
    c2.fillText('⚠ 炮塔遭到攻击',VW/2,VH-128);
  }
  for(const t of S.towers){
    if(!(t.hitT>0))continue;
    const p=World.proj(t.x,t.y,1.7); if(!p.vis)continue;
    const b=(Math.sin(S.time*18)+1)*.5;
    c2.strokeStyle='rgba(255,77,94,'+(.45+b*.5)+')'; c2.lineWidth=2;
    c2.beginPath(); c2.arc(p.x,p.y+16,20+b*4,0,TAU); c2.stroke();
  }
  // rift bars
  for(const r of S.rifts){
    if(!r.alive)continue;
    const p=World.proj(r.x,r.y,2.5); if(!p.vis)continue;
    const w=74,bh=7;
    c2.fillStyle='rgba(4,6,14,.72)'; c2.fillRect(p.x-w/2-2,p.y-2,w+4,bh+4);
    c2.fillStyle='#ff3d8a'; c2.fillRect(p.x-w/2,p.y,w*clamp(r.hp/r.maxHp,0,1),bh);
    c2.strokeStyle='rgba(255,61,138,.5)';c2.lineWidth=1;c2.strokeRect(p.x-w/2-2.5,p.y-2.5,w+5,bh+5);
    c2.font='600 10px "Chakra Petch",sans-serif';c2.fillStyle='#ffd7e2';c2.textAlign='center';
    const surge=r.surgeWarn>0?'涌潮 '+r.surgeWarn.toFixed(1)+'s':(r.queue.length||r.overLeft>0)&&r.surgeT!==undefined?'涌潮 '+Math.ceil(r.surgeT)+'s':null;
    c2.fillStyle=r.surgeWarn>0?'#ff8ac0':'#ffd7e2';
    c2.fillText('裂隙 '+(r.queue.length?('增援 '+r.queue.length):'已空')+(surge?' · '+surge:''),p.x,p.y-9);
    if(r.surgeWarn>0){ const b=(Math.sin(S.time*18)+1)*.5;
      c2.strokeStyle='rgba(255,61,138,'+(.4+b*.5)+')'; c2.lineWidth=2.5;
      c2.strokeRect(p.x-w/2-5,p.y-5,w+10,bh+10); }
  }
  // if a destructible prop is your current target, show the area its payoff covers
  // the dashed blast ring used to sit on screen for any crate within 9 tiles,
  // which in region one is always; now only when you are about to be inside it
  let blastProp=null;
  if(S.P&&S.P.alive){
    for(const o of S.obstacles){ const P0=PROPS[o.kind];
      if(P0&&P0.boom&&dist2(S.P.x,S.P.y,o.x,o.y)<((o.r+3.9)*TILE)**2){ blastProp=o; break; } }
  }
  if(blastProp||(S.P&&S.P.lock&&S.P.lock.k==='prop')){
    const o=blastProp||S.P.lock.ref, P0=PROPS[o.kind]||{};
    if(P0.fx&&P0.fx!=='none'){
      const R=P0.boom?(o.r+3.4):(o.r+1.6);
      const c0=World.proj(o.x,o.y,.06);
      const c1=World.proj(o.x+R*TILE,o.y,.06);
      if(c0.vis){
        const rp=Math.abs(c1.x-c0.x);
        const col=P0.fx==='blast'||P0.fx==='fire'||P0.fx==='lava'?'255,160,60'
                 :P0.fx==='frost'?'150,220,255':P0.fx==='void'?'190,120,255':'200,220,255';
        c2.strokeStyle='rgba('+col+',.75)'; c2.lineWidth=2; c2.setLineDash([6,6]);
        c2.beginPath(); c2.ellipse(c0.x,c0.y,rp,rp*.62,0,0,TAU); c2.stroke(); c2.setLineDash([]);
        c2.fillStyle='rgba('+col+',.08)'; c2.fill();
        c2.font='700 11px "Chakra Petch",sans-serif'; c2.fillStyle='rgba('+col+',.95)';
        c2.textAlign='center'; c2.fillText('击毁范围',c0.x,c0.y+rp*.62+13);
      }
    }
  }
  // scenery you are standing next to: name it and show what breaking it does
  if(S.P&&S.P.alive){
    let near=null,bv=(3.2*TILE)**2;
    for(const o of S.obstacles){ const dd=dist2(S.P.x,S.P.y,o.x,o.y);
      if(dd<bv){bv=dd;near=o;} }
    if(near){
      const P0=PROPS[near.kind]||{n:'掩体',d:''};
      const p=World.proj(near.x,near.y,near.r*1.5+.5);
      if(p.vis){
        const w2=64, dmgd=near.hp<near.maxHp;
        c2.font='600 11px "Chakra Petch",sans-serif'; c2.textAlign='center';
        c2.fillStyle='#cfd8f0'; c2.fillText(P0.n,p.x,p.y-6);
        if(P0.d){ c2.font='400 9.5px "Chakra Petch",sans-serif'; c2.fillStyle='rgba(159,232,255,.75)';
          c2.fillText(P0.d,p.x,p.y+7); }
        if(dmgd){
          c2.fillStyle='rgba(4,6,14,.6)'; c2.fillRect(p.x-w2/2,p.y+13,w2,4);
          c2.fillStyle='#cfd8f0'; c2.fillRect(p.x-w2/2,p.y+13,w2*clamp(near.hp/near.maxHp,0,1),4);
        }
      }
    }
  }
  // salvage prompt
  for(const s of S.salvage){
    const p=World.proj(s.x,s.y,1.5); if(!p.vis)continue;
    const P=S.P, near=P&&P.alive&&dist2(P.x,P.y,s.x,s.y)<(SALVAGE.r*TILE)**2;
    c2.font='600 11px "Chakra Petch",sans-serif'; c2.textAlign='center';
    if(near){ c2.fillStyle=P.moving?'#ff8a8a':'#ffe89a';
      c2.fillText(P.moving?'站定不动以拆解':'拆解中 '+Math.round(s.p*100)+'%',p.x,p.y); }
    else { c2.fillStyle='rgba(255,194,71,.75)'; c2.fillText('残骸 +'+s.amount,p.x,p.y); }
  }
  // boss bar
  const boss=S.enemies.find(e=>e.alive&&e.boss)||S.enemies.find(e=>e.alive&&e.mini);
  if(boss){
    const w=520,x=(VW-w)/2,y=88;
    c2.fillStyle='rgba(4,6,14,.82)';c2.fillRect(x-2,y-2,w+4,18);
    c2.fillStyle='#1a1030';c2.fillRect(x,y,w,14);
    c2.fillStyle='#ff3d8a';c2.fillRect(x,y,w*clamp(boss.hp/boss.maxHp,0,1),14);
    c2.strokeStyle='rgba(255,61,138,.5)';c2.lineWidth=1;c2.strokeRect(x-2.5,y-2.5,w+5,19);
    c2.font='600 12px "Chakra Petch",sans-serif';c2.fillStyle='#ffd7e2';c2.textAlign='center';
    c2.fillText((boss.name||boss.def.name)+'  '+Math.max(0,Math.round(boss.hp)),VW/2,y-11);
  }
  if(S.build){
    c2.font='600 12px "Chakra Petch",sans-serif';c2.fillStyle='#9fd8ff';c2.textAlign='center';
    c2.fillText('已选「'+TOWERS[S.build].name+'」 · 走到位置按 E 建造 · ESC 取消',VW/2,VH-112);
  }
  if(S.flash>0){
    const g=c2.createRadialGradient(VW/2,VH/2,VH*.28,VW/2,VH/2,VH*.85);
    g.addColorStop(0,'rgba(255,40,70,0)');g.addColorStop(1,'rgba(255,40,70,'+(S.flash*.8)+')');
    c2.fillStyle=g;c2.fillRect(0,0,VW,VH);
  }
  if(S.P&&S.P.alive&&S.P.hp<S.st.maxHp*.3&&S.running){
    const a=.12+Math.sin(S.time*7)*.06;
    const g=c2.createRadialGradient(VW/2,VH/2,VH*.3,VW/2,VH/2,VH*.8);
    g.addColorStop(0,'rgba(255,40,70,0)');g.addColorStop(1,'rgba(255,40,70,'+a+')');
    c2.fillStyle=g;c2.fillRect(0,0,VW,VH);
  }
  if(S.overT>0){
    c2.strokeStyle='rgba(255,194,71,'+(.25+Math.sin(S.time*10)*.12)+')';c2.lineWidth=3;
    c2.strokeRect(1.5,1.5,VW-3,VH-3);
  }
  // ultimate ready / firing: glow the whole frame so it cannot be missed
  if(S.P&&(S.P.ult>=1||S.P.ultT>0)&&S.running){
    const firing=S.P.ultT>0;
    const b=(Math.sin(S.time*(firing?16:5))+1)*.5;
    const gg=c2.createLinearGradient(0,0,0,VH);
    const a=firing?.30+b*.14:.12+b*.12;
    gg.addColorStop(0,'rgba(255,232,154,'+a+')');
    gg.addColorStop(.18,'rgba(255,232,154,0)');
    gg.addColorStop(.82,'rgba(255,232,154,0)');
    gg.addColorStop(1,'rgba(255,232,154,'+a+')');
    c2.fillStyle=gg; c2.fillRect(0,0,VW,VH);
    if(!firing){
      c2.font='700 15px "Chakra Petch",sans-serif'; c2.textAlign='center';
      c2.fillStyle='rgba(255,232,154,'+(.6+b*.4)+')';
      c2.fillText('◆ 歼灭光束就绪 · 按 Q 释放 ◆',VW/2,34);
    }
  }
  if(S.toast){
    const k=S.toast.t/S.toast.life, a=k<.12?k/.12:k>.75?(1-k)/.25:1;
    const y=VH-64-(1-Math.min(1,k*6))*10;
    c2.font='700 17px "Chakra Petch",sans-serif'; c2.textAlign='center';
    const w2=c2.measureText(S.toast.msg).width+34;
    c2.globalAlpha=a*.82; c2.fillStyle='#080b17';
    c2.fillRect(VW/2-w2/2,y-19,w2,32);
    c2.globalAlpha=a; c2.strokeStyle=S.toast.col; c2.lineWidth=1.5;
    c2.strokeRect(VW/2-w2/2,y-19,w2,32);
    c2.fillStyle=S.toast.col; c2.fillText(S.toast.msg,VW/2,y-1);
    c2.globalAlpha=1;
  }
  if(S.touch.on){
    for(const slot of ['move','aim']){
      const st=S.touch[slot]; if(!st.act)continue;
      const col=slot==='move'?'159,232,255':'255,232,154';
      c2.strokeStyle='rgba('+col+',.35)'; c2.lineWidth=2;
      const R=S.touch.r||56;
      c2.beginPath(); c2.arc(st.ox,st.oy,R,0,TAU); c2.stroke();
      c2.fillStyle='rgba('+col+',.18)'; c2.fill();
      c2.beginPath(); c2.arc(st.ox+Math.cos(st.a)*st.m*R,st.oy+Math.sin(st.a)*st.m*R,R*.38,0,TAU);
      c2.fillStyle='rgba('+col+',.55)'; c2.fill();
    }
  }
  drawMini();
}

/* ---------- minimap ---------- */
function drawMini(){
  const w=el.mini.width,h=el.mini.height,sx=w/W,sy=h/H;
  mctx.clearRect(0,0,w,h);
  mctx.fillStyle='#080c18'; mctx.fillRect(0,0,w,h);
  mctx.fillStyle='#161d33';
  for(const o of S.obstacles) mctx.fillRect(o.x*sx-o.r*2,o.y*sy-o.r*1.6,o.r*4,o.r*3.2);
  // core
  const hp=S.core.hp/S.core.maxHp;
  mctx.fillStyle=hp>.5?'#2f6bff':hp>.25?'#ffc247':'#ff4d5e';
  mctx.beginPath();mctx.arc(CX*sx,CY*sy,5,0,TAU);mctx.fill();
  mctx.strokeStyle='rgba(53,230,255,.35)';mctx.lineWidth=1;
  mctx.beginPath();mctx.arc(CX*sx,CY*sy,9,0,TAU);mctx.stroke();
  // towers
  for(const t of S.towers){ mctx.fillStyle=t.def.c; mctx.fillRect(t.x*sx-1.5,t.y*sy-1.5,3,3); }
  // rifts + salvage
  for(const r of S.rifts){ if(!r.alive)continue;
    if(r.surgeWarn>0){ mctx.fillStyle='rgba(255,61,138,'+(.25+.35*Math.abs(Math.sin(S.time*12)))+')';
      mctx.beginPath();mctx.arc(r.x*sx,r.y*sy,11,0,TAU);mctx.fill(); }
    mctx.strokeStyle='#ff3d8a';mctx.lineWidth=2;
    mctx.beginPath();mctx.arc(r.x*sx,r.y*sy,5,0,TAU);mctx.stroke();
    mctx.fillStyle='rgba(255,61,138,.35)';mctx.beginPath();mctx.arc(r.x*sx,r.y*sy,5,0,TAU);mctx.fill(); }
  for(const s of S.salvage){ mctx.fillStyle='#ffc247';
    mctx.fillRect(s.x*sx-2.5,s.y*sy-2.5,5,5); }
  // enemies
  for(const e of S.enemies){ if(!e.alive)continue;
    mctx.fillStyle=e.boss?'#ff3d8a':e.fly?'#5fd0ff':'#ff6b8a';
    const r=e.boss?3.5:1.6;
    mctx.fillRect(e.x*sx-r,e.y*sy-r,r*2,r*2); }
  // player
  if(S.P&&S.P.alive){ mctx.fillStyle='#ffffff';
    mctx.beginPath();mctx.arc(S.P.x*sx,S.P.y*sy,3,0,TAU);mctx.fill();
    mctx.strokeStyle='rgba(255,255,255,.6)';mctx.beginPath();
    mctx.arc(S.P.x*sx,S.P.y*sy,6,0,TAU);mctx.stroke(); }
  // camera box
  mctx.strokeStyle='rgba(255,255,255,.18)';mctx.lineWidth=1;
  mctx.strokeRect((S.cam.x-13*TILE)*sx,(S.cam.y-7*TILE)*sy,26*TILE*sx,14*TILE*sy);
}

/* ---------- icons / shop ---------- */
const ICON={};
function buildIcons(){
  const r=new THREE.WebGLRenderer({antialias:true,alpha:true});
  r.setSize(140,140); r.setPixelRatio(2);
  r.outputColorSpace=THREE.SRGBColorSpace; r.toneMapping=THREE.ACESFilmicToneMapping; r.toneMappingExposure=1.75;
  const sc=new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0x6a7cb6,0x0a0c18,1.1));
  const d=new THREE.DirectionalLight(0xffffff,1.7); d.position.set(3,6,4); sc.add(d);
  const d2=new THREE.DirectionalLight(0x35e6ff,.7); d2.position.set(-4,2,-3); sc.add(d2);
  const cm=new THREE.PerspectiveCamera(30,1,.1,50); cm.position.set(1.75,1.65,2.05); cm.lookAt(0,.56,0);
  for(const k of TKEYS){ const g=makeTower(k,3,null); sc.add(g);
    r.render(sc,cm); ICON[k]=r.domElement.toDataURL('image/png'); sc.remove(g); }
  r.dispose();
}
function buildShop(){
  el.shop.innerHTML='';
  TKEYS.forEach(k=>{
    const d=TOWERS[k];
    const b=document.createElement('button');
    b.className='card'; b.dataset.k=k;
    b.innerHTML='<span class="hk">'+d.hotkey+'</span><img src="'+ICON[k]+'" alt=""><div>'+
      '<div class="cn">'+d.name+'</div><div class="cc"><span data-cost>'+d.cost+'</span></div>'+
      '<div class="lockmsg" data-lock></div></div><span class="lockbadge">🔒</span>';
    b.onclick=()=>selectBuild(k);
    el.shop.appendChild(b);
  });
}
function selectBuild(k){
  if(!towerUnlocked(k)){ sfx('err'); toast(TOWERS[k].name+' 尚未解锁 · '+unlockText(k),'#8d96bd'); return; }
  if(S.touch.on&&sheetOpen&&S.build!==k){
    S.build=k; S.aim=null; selectTower(null); UI.sync();
    toggleSheet(false);
    toast('已选「'+TOWERS[k].name+'」 · 走到位置按「建造」','#9fd8ff');
    return;
  }
  if(S.build===k){S.build=null;World.setGhost(null);World.setRange(null);}
  else{S.build=k;S.aim=null;selectTower(null);}
  UI.sync();
}

/* ---------- inspector ---------- */
const MODES=[['core','守核'],['close','最近'],['strong','最强'],['weak','残血']];
/* Cycling 1-8 armed a turret type but showed it only as a highlighted row in a
   side panel you are not looking at mid-fight. Put the thing you are about to
   place on the board itself, with what it costs and what it does. */
function renderBuildPick(){
  const box=$('buildPick'); if(!box)return;
  const k=S.build;
  if(!k||!TOWERS[k]){ box.classList.add('hide'); return; }
  const d=TOWERS[k];
  const sel=S.sel;   // only what you are actually looking at, not a remembered one
  const refit=sel&&sel.key!==k;
  const cost=refit?swapCost(sel,k):towerCost(k);
  const afford=S.scrap>=cost;
  const full=!refit&&slotsFull();
  const lv1=i=>Array.isArray(i)?i[0]:i;
  let stats='';
  if(d.support)stats='光环 '+lv1(d.range)+' · 伤害+'+Math.round(lv1(d.buffDmg)*100)+'%';
  else stats='伤害 '+lv1(d.dmg)+' · 射速 '+lv1(d.rate)+'/s · 射程 '+lv1(d.range)+(d.air?'':' · 不打空中');
  box.classList.remove('hide');
  box.innerHTML=
    '<img src="'+(ICON[k]||'')+'" alt="">'+
    '<div class="bp-main">'+
      '<div class="bp-t"><span class="hk">'+d.hotkey+'</span>'+d.name+
        '<em>'+d.role+'</em></div>'+
      '<div class="bp-s">'+stats+'</div>'+
      '<div class="bp-a'+(full?' bad':afford?'':' bad')+'">'+
        (full ? '炮塔已满 '+S.towers.length+'/'+towerSlots()+' · 可改造或出售'
              : (refit ? '改造「'+sel.def.name+'」→ 按 <b>V</b> · '+cost+' 碎片'
                       : '按 <b>E</b> 就地建造 · '+cost+' 碎片'))+
      '</div>'+
    '</div>'+
    '<div class="bp-nav">1–8 切换<br>Esc 取消</div>';
}
function renderInspector(){
  const t=S.sel;
  if(!t){el.secInsp.style.display='none';el.secBuild.style.display='';return;}
  el.secInsp.style.display=''; el.secBuild.style.display='none';
  const d=t.def, s=tstat(t);
  let pips='';
  for(let i=0;i<4;i++)pips+='<span class="pip'+(i<t.lvl?' on':'')+'"></span>';
  if(t.elite!=null)pips+='<span class="pip elite"></span>';
  if(t.oc)pips+='<span class="ocpip">超频 \u00d7'+t.oc+'</span>';
  const row=(l,v,frac,extra)=>'<div class="stat"><span class="sl">'+l+'</span><span class="bar"><i style="width:'+
    Math.round(clamp(frac,0,1)*100)+'%"></i></span><span class="sv">'+v+(extra?' <u>'+extra+'</u>':'')+'</span></div>';
  let stats='';
  const bd=(t.bDmg||0)+S.st.twrDmg, br=(t.bRate||0)+S.st.twrRate;
  if(!d.support){
    const dps=d.dmg?(t.key==='flame'?s.dmg:s.dmg*s.rate*(s.cluster||1)*(1+(s.chain||0)*.6)):0;
    stats+=row('伤害',Math.round(s.dmg),s.dmg/300,bd?'+'+Math.round(bd*100)+'%':'');
    stats+=row(t.key==='flame'?'烧灼':'射速',t.key==='flame'?s.burn+'/s':s.rate.toFixed(2)+'/s',
      t.key==='flame'?s.burn/40:s.rate/3,br?'+'+Math.round(br*100)+'%':'');
    stats+=row('射程',s.range.toFixed(1),s.range/11,t.bRange?'+'+Math.round(t.bRange*100)+'%':'');
    stats+=row('DPS',Math.round(dps),dps/500,'');
  }else{
    stats+=row('光环',s.range.toFixed(1),s.range/5,'');
    stats+=row('伤害+',Math.round(s.buffDmg*100)+'%',s.buffDmg/.9,'');
    stats+=row('射速+',Math.round(s.buffRate*100)+'%',s.buffRate/.9,'');
  }
  if(s.splash)stats+=row('溅射',s.splash.toFixed(1),s.splash/2,'');
  if(s.slow)stats+=row('减速',Math.round(s.slow*100)+'%',s.slow/.8,'');
  if(s.chain)stats+=row('连锁',s.chain,s.chain/8,'');
  if(s.poison)stats+=row('毒伤',Math.round(s.poison)+'/s',s.poison/45,'');

  const dmgd=t.hp<t.maxHp*.999;
  stats+=row('结构',Math.round(t.hp)+' / '+t.maxHp,t.hp/t.maxHp,'');

  // refit: swap this emplacement to another type, crediting its sale value
  let refit='<div class="refit"><em>改造为其他型号 · 快捷键 V</em><div class="refitrow">';
  for(const k of TKEYS){
    if(k===t.key)continue;
    const locked=!towerUnlocked(k), c=swapCost(t,k);
    refit+='<button class="rf" data-rf="'+k+'"'+((locked||S.scrap<c)?' disabled':'')+
      ' title="'+TOWERS[k].name+(locked?' · '+unlockText(k):' · '+c+' 碎片')+'">'+
      '<img src="'+ICON[k]+'"><span>'+(locked?'锁':c)+'</span></button>';
  }
  refit+='</div></div>';
  const uc=upgradeCost(t);
  let actions='';
  if(dmgd){
    actions+='<div class="btnrow" style="margin-bottom:7px"><button class="btn up" id="bFix"'+
      (S.scrap<repairCost(t)?' disabled':'')+'>维修结构<small>'+repairCost(t)+' 碎片</small></button></div>';
  }
  if(uc!=null){
    actions='<div class="btnrow"><button class="btn up" id="bUp"'+(S.scrap<uc?' disabled':'')+'>升级至 LV'+(t.lvl+1)+
      '<small>'+uc+' 碎片</small></button><button class="btn sell" id="bSell">出售<small>+'+sellValue(t)+'</small></button></div>';
  }else if(t.elite==null){
    actions='<div style="display:grid;gap:6px;margin-bottom:7px">';
    d.elites.forEach((e,i)=>{ const c=eliteCost(t,i);
      actions+='<button class="btn elite" data-e="'+i+'"'+(S.scrap<c?' disabled':'')+
        '><b>'+e.n+' · '+c+' 碎片</b><span>'+e.d+'</span></button>'; });
    actions+='</div><div class="btnrow"><button class="btn sell" id="bSell" style="flex:1">出售 <small>+'+sellValue(t)+'</small></button></div>';
  }else{
    // LV4 + elite used to end here with a disabled 已达最高强化 button. Overclock
    // keeps the emplacement buyable forever, at a rate that gets worse every step.
    const oc=t.oc||0, occ=overclockCost(t);
    actions=canOverclock(t)
      ? '<div class="btnrow"><button class="btn up" id="bOc"'+(S.scrap<occ?' disabled':'')+
        '>超频 \u00d7'+(oc+1)+'<small>'+occ+' 碎片</small></button>'+
        '<button class="btn sell" id="bSell">出售<small>+'+sellValue(t)+'</small></button></div>'+
        '<div class="desc">每级 +'+Math.round(OC_DMG*100)+'% 伤害、+'+Math.round(OC_RATE*100)+
        '% 射速，代价逐级抬升。当前 +'+Math.round(OC_DMG*oc*100)+'% / +'+Math.round(OC_RATE*oc*100)+'%。</div>'
      : '<div class="btnrow"><button class="btn" disabled>超频已达上限 \u00d7'+oc+'</button>'+
        '<button class="btn sell" id="bSell">出售<small>+'+sellValue(t)+'</small></button></div>';
  }
  el.secInsp.innerHTML=
    '<div class="sec-h"><h2>炮塔</h2><em>击杀 '+t.kills+' · 输出 '+fmt(t.dealt)+'</em></div>'+
    '<div class="insp-top"><img src="'+ICON[t.key]+'" style="width:52px;height:52px;background:var(--panel2);border:1px solid var(--line);border-radius:4px">'+
    '<div><h3>'+d.name+(t.elite!=null?' · '+d.elites[t.elite].n:'')+'</h3>'+
    '<div class="role">'+d.role+'</div><div class="lvpips">'+pips+'</div></div></div>'+
    '<div class="stats">'+stats+'</div>'+
    (d.support?'':'<div class="targeting">'+MODES.map(([m,n])=>
      '<button class="tg'+(t.mode===m?' on':'')+'" data-m="'+m+'">'+n+'</button>').join('')+'</div>')+
    '<div class="desc">'+d.desc+'</div>'+actions+refit+
    '<button class="btn" id="bClose" style="margin-top:7px;width:100%">返回建造列表</button>';
  const up=$('bUp'); if(up)up.onclick=()=>upgradeTower(t);
  const oc2=$('bOc'); if(oc2)oc2.onclick=()=>{overclockTower(t);renderInspector();};
  const fx2=$('bFix'); if(fx2)fx2.onclick=()=>{repairTower(t);renderInspector();};
  const sl=$('bSell'); if(sl)sl.onclick=()=>sellTower(t);
  $('bClose').onclick=()=>selectTower(null);
  el.secInsp.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>eliteTower(t,+b.dataset.e));
  el.secInsp.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{t.mode=b.dataset.m;renderInspector();});
  el.secInsp.querySelectorAll('[data-rf]').forEach(b=>b.onclick=()=>{
    if(swapTower(t,b.dataset.rf)){ selectTower(t); renderInspector(); } });
}
const fmt=n=>n>=10000?(n/1000).toFixed(0)+'k':n>=1000?(n/1000).toFixed(1)+'k':Math.round(n);

function renderWavePrev(){
  const w=S.wave+1;
  // preview has to use the same region-relative cadence the spawner does
  const wlen=STAGES[S.stage].waves, wis=regionWave(wlen);
  const comp=waveComp(w,wis,wlen,S.stage), agg={};
  for(const g of comp)agg[g.t]=(agg[g.t]||0)+g.n;
  el.waveTag.textContent='WAVE '+String(w).padStart(2,'0')+(wis>=wlen?' · BOSS':wis===wlen-1?' · 首领':'');
  const mb=MINIBOSS[S.map.id]||MINIBOSS.ring;
  el.wavePrev.innerHTML=Object.entries(agg).map(([t,n])=>{
    if(t==='__elite')
      return '<span class="wpi elite"><i style="background:#ffc247"></i>精英怪 <b>×'+n+'</b></span>';
    if(t==='__miniboss')
      return '<span class="wpi elite"><i style="background:#ff3d8a"></i>'+mb.n+' <b>×'+n+'</b></span>';
    const E=ENEMIES[t]; if(!E)return '';
    return '<span class="wpi"><i style="background:'+E.c+'"></i>'+E.name+' <b>×'+n+'</b></span>';
  }).join('');
}
function renderPerks(){
  const cc=S.cardCount||{}, keys=Object.keys(cc);
  if(!keys.length){el.perks.innerHTML='<span class="noperk">击杀敌人拾取经验，升级后三选一强化</span>';return;}
  el.perks.innerHTML=keys.map(k=>{const c=CARDS.find(x=>x.id===k);
    return '<span class="pk" title="'+c.d+'"><i>'+c.gl+'</i>'+c.n+' <b>×'+cc[k]+'</b></span>';}).join('');
}

/* ---------- misc ---------- */
function banner(txt){ el.bannerT.textContent=txt; el.banner.classList.remove('go');
  void el.banner.offsetWidth; el.banner.classList.add('go'); }
const logs=[];
function log(s){ logs.unshift(s); if(logs.length>6)logs.pop();
  el.log.innerHTML=logs.map(x=>'<div>'+x+'</div>').join(''); }
function flashMsg(s){ log('⚠ '+s); }
function saveLayout(){ try{localStorage.setItem('abyss2_layout',S.layout);}catch(e){} }
/* auto-fire is on out of the box -- holding the trigger for a 30-wave run is
   fatigue, not skill. Anyone who turns it off keeps it off across sessions. */
function saveAuto(){ try{localStorage.setItem('abyss2_autofire',S.autoFire?'1':'0');}catch(e){} }
function loadAuto(){
  try{ const v=localStorage.getItem('abyss2_autofire'); S.autoFire=(v===null)?true:v==='1'; }
  catch(e){ S.autoFire=true; }
}
function loadLayout(){
  try{
    // one-time migration: the old default put movement on the arrows and gave WASD
    // four separate aiming jobs, which is backwards from what anyone expects
    // v2 forced WASD movement on everyone; the arrows are the intended default,
    // and the free-aim key that used to sit under a WASD walker now announces itself
    if(!localStorage.getItem('abyss2_layout_v3')){
      localStorage.setItem('abyss2_layout_v3','1');
      localStorage.setItem('abyss2_layout','right');
    }
    S.layout=localStorage.getItem('abyss2_layout')||'right';
  }catch(e){ S.layout='right'; }
}
function toggleLayout(){ S.layout=S.layout==='right'?'left':'right'; saveLayout();
  const L=layoutHint(); log('操作布局：'+L.move+' 移动 · '+L.turn+' 旋转 · '+L.fire+' 开火');
  renderTips();
  if(typeof Tutor!=='undefined'&&Tutor.active)Tutor.redraw();   // training text follows the keys
  if(!el.ovlHelp.classList.contains('hide'))renderHelp();
  toast('操作布局：'+L.move+' 移动','#35e6ff'); }
function bestKey(){return 'abyss2_best_'+S.map.id+'_'+S.diff.id;}
function saveBest(){ try{localStorage.setItem(bestKey(),String(S.best));}catch(e){} }
function loadBest(){ try{S.best=+(localStorage.getItem(bestKey())||0);}catch(e){S.best=0;} }

const UI={
  onTutorialEnd(skipped){
    for(const t of S.towers)World.removeTower(t); S.towers=[];
    S.P=newPlayer(); S.st=freshStats();
    buildStart(); UI.sync();
    if(skipped){
      el.ovlStart.classList.remove('hide');
      toast('训练已跳过 · 随时可在开始界面重来','#8d96bd');
      return;
    }
    showTutorialDone();
  },
 sync(){
  el.scrap.textContent=S.scrap;
  const lm=maxLives();
  el.lives.textContent='◆'.repeat(Math.max(0,S.playerLives))+'◇'.repeat(Math.max(0,lm-S.playerLives));
  el.livesChip.classList.toggle('low',S.playerLives<=1);
  renderBuildPick();
  el.power.textContent=S.towers.length+'/'+towerSlots();
  const need=riftsForNextSlot();
  el.mul.textContent=(need!=null&&S.riftProgress>0)
    ? '扩建 '+S.riftProgress+'/'+need
    : '×'+buildScale().toFixed(1);
  el.mul.classList.toggle('grow',need!=null&&S.riftProgress>0);
  el.powerChip.classList.toggle('full',slotsFull());
  const stg=STAGES[S.stage];
  el.kStage.textContent=S.endless?'无尽':'第'+(S.stage+1)+'区';
  el.wave.textContent=S.endless?'W'+(S.wave+(S.waveActive?0:1))
    :Math.min(S.stageWaves+(S.waveActive?1:0),stg.waves)+'/'+stg.waves;
  const hp=clamp(S.core.hp/S.core.maxHp,0,1);
  el.coreFill.style.width=(hp*100)+'%';
  el.core.textContent=Math.max(0,Math.round(S.core.hp))+' / '+S.core.maxHp;
  el.corebar.classList.toggle('warn',hp<=.5&&hp>.25);
  el.corebar.classList.toggle('crit',hp<=.25);
  el.bestTag.textContent=S.best?'最佳 W'+S.best:'';
  for(const b of el.shop.children){
    const k=b.dataset.k, c=towerCost(k), locked=!towerUnlocked(k), poor=S.scrap<c;
    b.querySelector('[data-cost]').textContent=locked?'——':c;
    b.querySelector('[data-lock]').textContent=locked?unlockText(k):(poor?'还差 '+(c-S.scrap):'');
    b.classList.toggle('sel',S.build===k&&!locked);
    b.classList.toggle('poor',poor&&!locked);
    b.classList.toggle('locked',locked);
    b.disabled=locked;
  }
  renderInspector(); renderWavePrev(); renderPerks();
  el.bNext.classList.toggle('busy',S.waveActive);
  el.bSpeed.textContent='×'+S.speed;
  el.buildHint.textContent=S.build?'走到位置按 E 建造':'1–8 选择 · E 建造';
  for(const b of el.abilities.children){
    const a=ABILITIES.find(x=>x.id===b.dataset.a);
    b.classList.toggle('armed',S.aim===a.id);
  }
 },
 tick(dt){
  const P=S.P, st=S.st;
  if(P&&st){
    const f=clamp(P.hp/st.maxHp,0,1);
    el.hpFill.style.width=(f*100)+'%';
    el.hp.textContent=Math.max(0,Math.round(P.hp))+' / '+Math.round(st.maxHp);
    el.hptrack.classList.toggle('low',f<.35);
    const buffs=[];
    if(P.shield>0)buffs.push('◈'+Math.round(P.shield));
    if(P.rageT>0)buffs.push('✦'+Math.ceil(P.rageT)+'s');
    if(P.coolT>0)buffs.push('≋'+Math.ceil(P.coolT)+'s');
    // say up front which kind of level is coming, so the rarer card screens read as
    // paced rather than random (buffs still take priority when any are running)
    const nx=levelGivesCard(S.level+1)?'强化选择':'属性提升';
    el.xpNote.textContent=buffs.length?buffs.join('  '):
      '还需 '+Math.max(0,Math.ceil(S.xpNeed-S.xp))+' 经验 · 下一级：'+nx;
    el.level.textContent=S.level;
    el.xpFill.style.width=clamp(S.xp/S.xpNeed,0,1)*100+'%';
    el.dashFill.style.width=(P.dashCd>0?(1-P.dashCd/st.dashCd):1)*100+'%';
    const uf=P.ultT>0?1:clamp(P.ult,0,1);
    el.ultFill.style.width=(uf*100)+'%';
    el.ultRow.classList.toggle('ready',P.ult>=1||P.ultT>0);
    if(S.touch.on){const ub=$('tUlt'); if(ub)ub.classList.toggle('ready',P.ult>=1&&P.ultT<=0);}
    el.ultWord.textContent=P.ultT>0?'释放中 '+P.ultT.toFixed(1)+'s':(P.ult>=1?'Q 歼灭光束':'');
    const hf=clamp(P.heat/st.heatMax,0,1);
    el.heatFill.style.width=(hf*100)+'%';
    el.heatRow.classList.toggle('hot',P.overheat>0);
    el.heatWord.textContent=P.overheat>0?'OVERHEAT':'';
    const dead=!P.alive&&S.running&&!S.over;
    el.respawn.classList.toggle('hide',!dead);
    if(dead)el.respawnT.textContent=Math.ceil(P.deadT);
  }
  if(!S.waveActive&&S.running&&!S.over){
    el.nextBonus.textContent='+'+Math.ceil(S.rest)*4+' 碎片 ('+Math.ceil(S.rest)+'s)';
  }else{ el.nextBonus.textContent=S.waveActive?'进行中':''; }
  // the terminal is only reachable from the Core between waves; say so on the HUD
  // at the moment it becomes usable, or it is a keybind nobody ever discovers
  if(el.termHint){
    const open=typeof coreTermOpen==='function'&&coreTermOpen();
    const ok=open&&coreTermReady();
    // the prompt sits over the panel it opens, so it has to go while it is up
    el.termHint.classList.toggle('hide',!open||!el.ovlTerm.classList.contains('hide'));
    el.termHint.classList.toggle('ready',!!ok);
    el.termHint.textContent=ok?'F · 接入核心终端':'回到核心可接入终端 (F)';
  }
  for(const b of el.abilities.children){
    const st2=S.abil[b.dataset.a]; if(!st2)continue;
    const cool=st2.cd>0;
    b.classList.toggle('cool',cool);
    if(cool)b.querySelector('.cd').textContent=Math.ceil(st2.cd);
  }
 },
 showTeleport(refund){
  const st=STAGES[S.stage], nx=STAGES[S.stage+1];
  el.teleTitle.textContent=st.name+' 已肃清';
  el.teleSub.innerHTML='炮塔已全部回收为 <b style="color:var(--gold)">'+refund+'</b> 碎片带走。'+
    (nx?'下一站：<b style="color:var(--cyan)">'+nx.name+'</b> — '+nx.desc:'');
  el.stageLine.innerHTML=STAGES.map((s,i)=>
    '<span class="sn '+(i<=S.stage?'done':'')+(i===S.stage+1?' cur':'')+'">'+s.name.split(' · ')[1]+'</span>').join('');
  UI.renderUpgrades();
  el.ovlTele.classList.remove('hide');
 },
 hideTeleport(){ el.ovlTele.classList.add('hide'); },
 renderUpgrades(grid,scrapEl){
  grid=grid||el.upGrid; scrapEl=scrapEl||el.teleScrap;
  scrapEl.textContent=S.scrap;
  grid.innerHTML='';
  for(const u2 of CORE_UP){
    const lv=S.coreUp[u2.id]||0, maxed=lv>=u2.max, cost=coreUpCost(u2,lv);
    const b=document.createElement('button');
    b.className='upcard'+(maxed?' maxed':'');
    b.disabled=maxed||S.scrap<cost;
    b.innerHTML='<span class="ur"><i class="ug">'+u2.gl+'</i><b>'+u2.n+'</b>'+
      '<i class="lvl">'+lv+' / '+u2.max+'</i></span>'+
      '<span>'+u2.d+'</span><span class="uc">'+(maxed?'已满级':cost+' 碎片')+'</span>';
    b.onclick=()=>{ if(maxed||S.scrap<cost)return;
      S.scrap-=cost; S.coreUp[u2.id]=lv+1; applyCoreUpgrades(true); recalcPower();
      if(u2.id==='life'){ S.playerLives=Math.min(maxLives(),S.playerLives+1);
        toast('备用信标上线 · 命数 '+S.playerLives+' / '+maxLives(),'#6ee7a8'); }
      sfx('up'); UI.renderUpgrades(grid,scrapEl); UI.sync(); };
    grid.appendChild(b);
  }
 },
 showCards(cards){
  el.cardRow.innerHTML='';
  cards.forEach(c=>{
    const have=(S.cardCount&&S.cardCount[c.id])||0;
    const b=document.createElement('button');
    b.className='ucard';
    b.innerHTML='<span class="ug">'+c.gl+'</span><b>'+c.n+'</b><span>'+c.d+'</span>'+
      '<span class="stack">'+(have?('已有 '+have+' / '+c.max):('上限 '+c.max))+'</span>';
    b.onclick=()=>{ac();takeCard(c);};
    el.cardRow.appendChild(b);
  });
  el.ovlCards.classList.remove('hide');
 },
 hideCards(){ el.ovlCards.classList.add('hide'); },
 hideEnd(){ el.ovlEnd.classList.add('hide'); }
};

/* ---------- touch controls: two virtual sticks plus action buttons ---------- */
function isTouch(){
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}
/* Full stick deflection has to be a real thumb travel, not a board-space constant:
   VW is always 1200 regardless of screen width, so the old fixed 56 meant the aim
   stick hit full tilt after ~17 physical pixels on a phone -- unusable. */
/* iOS Safari keeps its address bar and tab strip on screen in landscape, and 100vh
   is measured as if that chrome were hidden -- so the bottom row of touch buttons
   ended up below the visible area. 100dvh is closer but still lies while the bars
   are animating. visualViewport is the only thing that reports what the player can
   actually see, so publish it as --vph and lay the board out against that. */
function syncViewport(){
  const vv=window.visualViewport;
  const hpx=Math.round(vv?vv.height:innerHeight);
  const wpx=Math.round(vv?vv.width:innerWidth);
  const r=document.documentElement.style;
  r.setProperty('--vph',hpx+'px');
  r.setProperty('--vpw',wpx+'px');
  document.body.classList.toggle('shortscreen',hpx<560);
  if(S.touch.on)S.touch.r=stickRadius();
}
function bindViewport(){
  syncViewport();
  const vv=window.visualViewport;
  if(vv){ vv.addEventListener('resize',syncViewport); vv.addEventListener('scroll',syncViewport); }
  addEventListener('resize',syncViewport);
  addEventListener('orientationchange',()=>{ syncViewport(); setTimeout(syncViewport,160); setTimeout(syncViewport,520); });
  // Safari only settles its chrome a beat after load
  setTimeout(syncViewport,300); setTimeout(syncViewport,900);
}
function stickRadius(){
  const b=document.getElementById('board').getBoundingClientRect();
  if(!b.width)return 56;
  const px=clamp(Math.min(b.width,b.height)*.19,54,104);   // physical travel we want
  return px/b.width*VW;                                     // ...expressed in board units
}
function bindTouch(){
  const ui=$('touchUI');
  if(!isTouch())return;
  S.touch.on=true; ui.classList.remove('hide');
  const board=document.getElementById('board');
  S.touch.r=stickRadius();
  addEventListener('resize',()=>{S.touch.r=stickRadius();});
  const stick=(zoneId,slot)=>{
    const z=$(zoneId); let id=null;
    const st=S.touch[slot];
    const rectPt=(ev)=>{ const b=board.getBoundingClientRect();
      return {x:(ev.clientX-b.left)/b.width*VW, y:(ev.clientY-b.top)/b.height*VH}; };
    z.addEventListener('pointerdown',ev=>{
      if(id!==null)return; id=ev.pointerId; z.setPointerCapture(id);
      ac();
      const p=rectPt(ev); st.ox=p.x; st.oy=p.y; st.x=p.x; st.y=p.y;
      // resting the thumb must not mean "aim due east": hold the current heading
      st.a=(slot==='aim'&&S.P)?S.P.aim:0; st.m=0; st.act=true;
      ev.preventDefault();
    });
    z.addEventListener('pointermove',ev=>{
      if(ev.pointerId!==id)return;
      const p=rectPt(ev); st.x=p.x; st.y=p.y;
      const dx=p.x-st.ox, dy=p.y-st.oy, d=Math.hypot(dx,dy);
      const MAXR=S.touch.r||stickRadius();
      if(d>MAXR){ st.ox+=dx*(1-MAXR/d); st.oy+=dy*(1-MAXR/d); }
      const dx2=st.x-st.ox, dy2=st.y-st.oy, d2=Math.hypot(dx2,dy2);
      st.a=Math.atan2(dy2,dx2); st.m=clamp(d2/MAXR,0,1);
      ev.preventDefault();
    });
    const end=ev=>{ if(ev.pointerId!==id)return; id=null; st.act=false; st.m=0; };
    z.addEventListener('pointerup',end);
    z.addEventListener('pointercancel',end);
    z.addEventListener('pointerleave',end);
  };
  stick('zoneMove','move'); stick('zoneAim','aim');
  const hold=(id,down,up)=>{ const b=$(id);
    b.addEventListener('pointerdown',e=>{e.preventDefault();ac();down();});
    b.addEventListener('pointerup',e=>{e.preventDefault();if(up)up();});
    b.addEventListener('pointercancel',e=>{if(up)up();});
  };
  toast('自动瞄准与开火已开启 · 左摇杆走位','#35e6ff');
  hold('tDash',()=>dash());
  hold('tCharge',()=>{S.touch.charge=true;},()=>{S.touch.charge=false;});
  hold('tUlt',()=>{ S.keys['q']=true; setTimeout(()=>{S.keys['q']=false;},60); });
  hold('tBuild',()=>buildHere());
  hold('tUp',()=>upgradeHere());
  hold('tMenu',()=>toggleSheet());
  $('sheetClose').addEventListener('pointerdown',e=>{e.preventDefault();toggleSheet(false);});
  document.body.classList.add('touchmode');
}
/* the command panel slides away so it never sits on top of the fight */
let sheetOpen=false, sheetWasPaused=false;
function toggleSheet(force){
  sheetOpen=force===undefined?!sheetOpen:force;
  document.querySelector('.rail').classList.toggle('open',sheetOpen);
  $('sheetClose').classList.toggle('hide',!sheetOpen);
  const t=$('tMenu'); if(t)t.textContent=sheetOpen?'✕ 关闭':'☰ 菜单';
  if(sheetOpen){ sheetWasPaused=S.paused; S.paused=true; }
  else if(!sheetWasPaused)S.paused=false;
  // dropping the drawer must not leave a stick stuck down
  S.touch.move.act=false; S.touch.move.m=0;
  S.touch.aim.act=false; S.touch.aim.m=0; S.touch.charge=false;
}

/* ---------- input ---------- */
function bindInput(){
  const b=document.getElementById('board');
  b.addEventListener('pointermove',ev=>{
    const p=World.pick(ev.clientX,ev.clientY);
    if(!p)return;
    S.mouse.x=p.px; S.mouse.y=p.py;
    if(S.aim){const a=ABILITIES.find(x=>x.id===S.aim);World.setAim(true,p.px,p.py,a.r||2);}
    else World.setAim(false);
    if(S.build){
      const ok=canBuild(p.col,p.row);
      World.setGhost(S.build,p.col,p.row,ok);
    }
  });
  b.addEventListener('contextmenu',ev=>ev.preventDefault());
  b.addEventListener('pointerdown',ev=>{
    if(!S.running||S.over)return;
    if(S.touch.on&&ev.pointerType==='touch')return;   // sticks own the board on touch
    ac();
    const p=World.pick(ev.clientX,ev.clientY); if(!p)return;
    S.mouse.x=p.px; S.mouse.y=p.py;
    if(ev.button!==0)return;
    if(S.build){ placeTower(S.build,p.col,p.row); return; }
    const t=towerAt(p.col,p.row);
    if(t)selectTower(t===S.sel?null:t);
  });
  addEventListener('keydown',ev=>{
    const k=ev.key.toLowerCase();
    if(['w','a','s','d','q','arrowup','arrowdown','arrowleft','arrowright',' ','shift','tab'].includes(k))ev.preventDefault();
    S.keys[k]=true;
    if(ev.repeat)return;
    if(k==='escape'){
      if(!el.ovlTerm.classList.contains('hide')){ closeCoreTerm(); return; }
      if(!el.ovlHelp.classList.contains('hide')){ closeHelp(); return; }
      if(!el.ovlTutDone.classList.contains('hide')){ el.ovlTutDone.classList.add('hide');
        el.ovlStart.classList.remove('hide'); return; }
      if(S.pauseMenu){ togglePause(); return; }
      // something armed or selected: Esc clears that first; a bare Esc is the pause menu
      if(S.build||S.sel){ S.build=null;World.setGhost(null);selectTower(null);UI.sync();return; }
      if(S.running&&!S.over&&!S.cards&&!S.teleporting)togglePause();
      return;}
    // the level-up screen is keyboard-driven too: 1 / 2 / 3 picks a card
    if(S.cards){ const n=parseInt(k,10);
      if(n>=1&&n<=S.cards.length){ ac(); takeCard(S.cards[n-1]); }
      return; }
    if(S.teleporting&&(k==='enter'||k===' ')){ if(!el.ovlTele.classList.contains('hide')){ ac(); nextStage(); } return; }
    if(!S.running)return;
    // F is the charge key. It only doubles as the terminal key at the one moment the
    // terminal can actually open -- between waves, at the Core, with the line full.
    // It used to try every press and toast "战斗中无法接入终端" on every charge shot.
    if(k==='f'){
      if(!el.ovlTerm.classList.contains('hide')){ closeCoreTerm(); return; }
      if(coreTermReady()){ openCoreTerm(); return; }
    }
    if(!el.ovlTerm.classList.contains('hide'))return;
    if(S.pauseMenu){
      if(k==='p')togglePause();
      else if(k==='h'||k==='?'||k==='/'){ togglePause(false); openHelp(true); }
      else if(k==='m'){ toggleSound(); renderPauseMenu(); }
      else if(k==='o'){ toggleAuto(); renderPauseMenu(); }
      else if(k===','){ toggleLayout(); renderPauseMenu(); }
      return; }
    if(k==='e'){ buildHere(); return; }
    if(k==='r'){ upgradeHere(); return; }
    if(k==='t'){ sellHere(); return; }
    // with a hard cap on emplacements you spend most of the game upgrading rather
    // than building, so reaching a turret should not mean walking to it
    if(k==='['||k===']'){ cycleTowerSel(k===']'?1:-1); return; }
    if(k==='v'){ refitSelected(); return; }
    if(k==='g'){ callEarly(); return; }
    if(k==='p'){ togglePause(); return; }
    if(k==='tab'){ cycleSpeed(); return; }
    if(k==='m'){ toggleSound(); return; }
    if(k==='o'){ toggleAuto(); return; }
    if(k==='h'||k==='?'||k==='/'){ toggleHelp(); return; }
    if(k===','){ toggleLayout(); return; }
    const n=parseInt(k,10);
    if(n>=1&&n<=8){const key=TKEYS.find(x=>TOWERS[x].hotkey===n);if(key)selectBuild(key);return;}
    const ab=ABILITIES.find(a=>a.key.toLowerCase()===k);
    if(ab)useAbility(ab.id);
  });
  addEventListener('keyup',ev=>{ S.keys[ev.key.toLowerCase()]=false; });
  addEventListener('blur',()=>{ S.keys={}; if(S.P)S.P.charging=false; });
  // alt-tab away mid-wave and the run should be waiting where you left it, not
  // three enemies further along the moment the tab regains focus
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&S.running&&!S.over&&!S.paused&&S.waveActive)togglePause(true);
  });
  bindTouch();
  bindViewport();
  el.bNext.onclick=()=>{ac();callEarly();};
  el.bSpeed.onclick=cycleSpeed;
  el.bPause.onclick=()=>togglePause();
  el.bSound.onclick=toggleSound;
  el.bLayout.onclick=toggleLayout;
  const tb=$('bTut'); if(tb)tb.onclick=()=>{ac();startTutorial();};
  const h1=$('bHelp'); if(h1)h1.onclick=openHelp;
  const h2=$('bHelp2'); if(h2)h2.onclick=toggleHelp;
  const ab=$('bAuto'); if(ab){ ab.onclick=toggleAuto;
    ab.classList.toggle('on',S.autoFire); ab.textContent=S.autoFire?'⊙':'⊘'; }
}
/* step the selection through your turrets so R / T can act on one from anywhere */
/* 1-8 arms a type, [ ] picks the turret, V refits it -- so changing what an
   emplacement is does not mean walking over and paying full price again */
function refitSelected(){
  const remembered=(S.refitT&&S.towers.includes(S.refitT))?S.refitT:null;
  const t=S.sel||nearestTower(1.4)||remembered;
  if(!t){ sfx('err'); toast('先用 [ ] 选中一座炮塔','#8d96bd'); return; }
  if(!S.build){ sfx('err'); toast('先按 1–8 选择要改造成的型号','#8d96bd'); return; }
  if(swapTower(t,S.build)){ S.usedRefitKey=true; selectTower(t); renderInspector(); }
}
function cycleTowerSel(dir){
  if(!S.towers.length){ sfx('err'); toast('还没有炮塔','#8d96bd'); return; }
  const list=S.towers.slice().sort((a,b)=>(a.row-b.row)||(a.col-b.col));
  const i=S.sel?list.indexOf(S.sel):-1;
  const t=list[((i<0?(dir>0?-1:0):i)+dir+list.length)%list.length];
  selectTower(t); S.usedTowerCycle=true; sfx('pick',.35,1.2); UI.sync();
  const up=upgradeCost(t);
  toast(t.def.name+' LV'+t.lvl+(up!=null?' · R 升级需 '+up:' · 已满级')+
        (S.build&&S.build!==t.key?' · V 改造为'+TOWERS[S.build].name+' 需 '+swapCost(t,S.build):''),t.def.c);
}

/* ---------- controls guide ----------
   The game grew a lot of verbs: two movement schemes, a lock-on gun with a heavy
   shot and a heat bar, capped turret emplacements with upgrades / elite branches /
   refits, three tactical skills, and rifts that have to be closed by hand. One
   screen that lists every one of them, keyed to the layout actually in use. */
function helpRows(){
  const L=layoutHint(), touch=S.touch.on;
  const k=(...keys)=>'<span class="hkey">'+keys.map(x=>'<b>'+x+'</b>').join('')+'</span>';
  const row=(keys,text)=>'<div class="hrow">'+k(...keys)+'<span>'+text+'</span></div>';
  const move=L.move.split(' ').filter(Boolean);
  const sec=(title,rows)=>'<div class="hsec"><h3>'+title+'</h3>'+rows.join('')+'</div>';

  const moveSec=sec('移动与生存',[
    row(move,'移动'),
    row(['Shift'],'冲刺 · <u>带无敌帧</u>，可穿过敌人并打断它们的攻击'),
    row(['—'],'血量归零会损失一条命，5 秒后在核心旁重新部署'),
  ]);
  const fightSec=sec('战斗',[
    row(['—'],'<u>默认自动开火</u> · 枪口自动锁定最近的敌人并开火，你只管走位'),
    row([L.fire],'手动扳机 · 按住＝强制连射，<u>会一直打到过热</u>（自动开火会留余量给蓄力）· 打掩体也用它'),
    row(['O'],'开关自动开火 · HUD 上的 <b>⊙</b> 是同一个开关，关掉就回到全手动'+(touch?'':'（设置会记住）')),
    row(L.turn.split('/').map(x=>x.trim()),'切换锁定目标'),
    row([L.charge],'蓄力重击 · 按住蓄力、松手发射，<u>无视护甲</u>，破重甲专用 · '+
      '<u>此键不随布局改变</u>（'+L.charge2+' 同样可用）'),
    row([L.fine],'按住＝自由瞄准 · <u>会暂时关闭自动跟枪</u>，打特定位置时才用'),
    row(['Q'],'歼灭光束 · 造成伤害积攒，满了释放'),
  ]);
  const towerSec=sec('炮塔',[
    row(['1','–','8'],'选择要建造的炮塔型号'),
    row(['E'],'在脚下建造 · 若脚下已有塔，则<u>改造</u>成当前选中的型号'),
    row(['R'],'升级脚下或选中的炮塔 · 结构受损时先维修'),
    row(['T'],'出售（返还 70%）'),
    row(['[',']'],'切换已建炮塔 · 可<u>隔空</u>升级、出售、改造'),
    row(['V'],'把选中的炮塔改造为 1–8 所选型号 · 保留位置与塔位'),
    row(['Esc'],'取消建造 / 取消选中'),
    row(['—'],'LV4 且已选精英分支后可反复<u>超频</u> · 每级更贵，是溢出碎片的去处'),
  ]);
  const coreSec=sec('核心终端',[
    row(['F'],'<u>塔位建满后</u>，波次间隙站在核心旁接入 · 购买核心永久升级'),
    row(['—'],'命数上限、个人装甲、武器校准都在这里 · <u>不随区域重置</u>'),
    row(['—'],'区域传送时也会自动打开同一份升级列表'),
  ]);
  const skillSec=sec('技能与节奏',[
    row(['Z'],ABILITIES[0].n+' · '+ABILITIES[0].desc),
    row(['X'],ABILITIES[1].n+' · '+ABILITIES[1].desc),
    row(['C'],ABILITIES[2].n+' · '+ABILITIES[2].desc),
    row(['G'],'提前出击 · 跳过剩余休整时间，按剩余秒数换碎片'),
    row(['Tab'],'加速 ×1 / ×2 / ×3'),
    row(['P','Esc'],'暂停菜单 · 音量、布局、返回主菜单都在里面 · 切走标签页会自动暂停'),
    row(['1','2','3'],'升级三选一时直接按数字选卡 · 传送界面按 <b>Enter</b> 出发'),
  ]);
  const sysSec=sec('系统',[
    row(['H'],'打开 / 关闭本指南'),
    row(['M'],'音效开关'),
    row([','],'切换操作布局（WASD 移动 ↔ 方向键移动）'),
  ]);
  const touchSec=sec('手机（横屏）',[
    row(['左半屏'],'移动摇杆 · 拇指按下的位置即摇杆原点'),
    row(['右半屏'],'瞄准摇杆 · <u>可选</u>，用来手动修正枪口；不碰它就是全自动'),
    row(['冲刺'],'带无敌帧的位移'),
    row(['蓄力'],'按住蓄力、松手发射的破甲重击'),
    row(['大招'],'歼灭光束'),
    row(['菜单'],'拉出建造面板（会暂停）· <u>建造</u> / <u>升级</u> 作用于脚下'),
  ]);

  return '<div class="helpgrid">'+moveSec+fightSec+towerSec+coreSec+skillSec+sysSec+touchSec+'</div>'+
    '<div class="hnote">'+
    '<div><b>护甲</b>：重甲敌人会把普通子弹削到 15%，屏幕上跳「护甲」两字就是这个。用<u>蓄力重击</u>，它完全无视护甲。</div>'+
    '<div><b>架势崩溃</b>：只有<u>你的</u>命中会积累敌人的架势条，打满会让它踉跄倒地。炮塔的火力只能让它们原地一顿，不能崩架势。</div>'+
    '<div><b>精英</b>：带词缀的、名字带前缀的、以及首领和 BOSS，受到<u>炮塔伤害只有 45%</u>。杂兵交给炮塔，有名字的东西得你自己打。</div>'+
    '<div><b>裂隙</b>：每波会开若干道裂隙，<u>只有你的子弹和轨道轰炸能伤害它</u>。开着的裂隙会周期性<u>涌潮</u>：预警 2.6 秒后一口气涌出一整群，'+
      '炮塔线吃不下这种尖峰，你得去顶。关掉它涌潮就停，并累积「据点扩建」，2 / 4 / 6 道各永久 +1 炮塔位。</div>'+
    '<div><b>BOSS 二阶段</b>：区域 BOSS 与攻城巨兽掉到半血会狂暴：更快、齐射更多，并会<u>震地</u>——脚下先出现粉色预警圈，圈没消失前冲刺出去。</div>'+
    '<div><b>炮塔上限</b>：每个区域能同时拥有的炮塔数是固定的（第一区 4 座，逐区递增）。变强靠<u>升级和改造</u>，不是靠数量。</div>'+
    '<div><b>残骸</b>：站着不动 2.9 秒拆解。拆解期间会张开护场——<u>你受到的伤害减半</u>，'+
      '靠近的敌人被拖慢。完成后除了碎片，还给<u>大招 +22%</u> 和两份应急医疗；'+
      '<u>周围敌人越多，碎片给得越多</u>（最高 ×2.2）。移动或冲刺会中断。</div>'+
    '<div><b>深渊裂口</b>：地面单位绕着走，但你可以<u>冲刺越过</u>。'+
      '被击退或架势崩溃<u>撞进去的敌人直接坠落身亡</u>——火炮的击退和你的冲刺撞击都能用它杀人。</div>'+
    '</div>';
}
function renderHelp(){
  $('helpBox').innerHTML=
    '<div class="helphead"><h2>操作指南</h2><em>H 关闭</em></div>'+
    '<div class="sub" style="text-align:left;letter-spacing:.1em">当前布局：'+
      (S.layout==='left'?'WASD 移动':'方向键移动')+' · 按 <b>,</b> 可切换</div>'+
    helpRows()+
    '<button class="play" id="bHelpClose" style="margin-top:18px">明白了</button>';
  $('bHelpClose').onclick=closeHelp;
}
let helpWasPaused=false, helpFromPause=false;
function openHelp(fromPause){
  S.helpSeen=true;   // recorded here, not polled: opening it pauses the sim
  renderHelp();
  helpFromPause=!!fromPause;
  helpWasPaused=S.paused;
  if(S.running)S.paused=true;
  el.ovlHelp.classList.remove('hide');
}
function closeHelp(){
  if(el.ovlHelp.classList.contains('hide'))return;
  el.ovlHelp.classList.add('hide');
  if(S.running&&!helpWasPaused)S.paused=false;
  // opened from the pause menu: go back to it rather than straight into the fight
  if(helpFromPause){ helpFromPause=false; togglePause(true); }
}
function toggleHelp(){ el.ovlHelp.classList.contains('hide')?openHelp():closeHelp(); }
/* The core upgrade tree used to exist only inside the region-teleport overlay.
   That put more than half of a run's scrap — and the whole life/armour/weapon
   line — behind four moments, and made it unreachable for good in the last
   region. The terminal opens the same tree between waves, standing at the Core. */
function coreTermOpen(){
  /* Gated on a full emplacement line on purpose. Scrap early on belongs in the
     defence; opened from wave 1 it is a way to starve your own towers and lose.
     Full slots is exactly the state the terminal exists for — the point where
     scrap keeps coming in and the turrets have nowhere left to put it. */
  return S.running&&!S.over&&!S.waveActive&&!S.cards&&!S.teleporting&&
    S.P&&S.P.alive&&slotsFull();
}
function coreTermReady(){
  return coreTermOpen()&&!S.paused&&Math.hypot(S.P.x-CX,S.P.y-CY)/TILE<=CORE_TERM_R;
}
function openCoreTerm(){
  if(!coreTermReady()){
    if(!S.running||S.over)return;
    if(S.waveActive)toast('战斗中无法接入终端 · 清完这一波再来','#8d96bd');
    else if(!slotsFull())toast('塔位未满 '+S.towers.length+'/'+towerSlots()+' · 先把防线建满','#8d96bd');
    else toast('需要靠近核心 · F 接入终端','#8d96bd');
    return; }
  S.paused=true; UI.renderUpgrades(el.termGrid,el.termScrap);
  el.ovlTerm.classList.remove('hide'); sfx('ability',.5);
}
function closeCoreTerm(){
  if(el.ovlTerm.classList.contains('hide'))return;
  el.ovlTerm.classList.add('hide'); S.paused=false;
}
/* Pause is a menu, not a dimmed frame: resume, the guide, sound and volume, and a
   way back to the menu that cannot be hit by accident. */
function togglePause(force){
  if(S.cards||S.teleporting||!S.running||S.over)return;
  // another overlay already owns the pause (help / terminal / drawer): leave it alone
  if(!S.pauseMenu&&S.paused)return;
  const on=force===undefined?!S.pauseMenu:!!force;
  if(on===!!S.pauseMenu)return;
  S.pauseMenu=on; S.paused=on;
  if(on){ S.keys={}; if(S.P)S.P.charging=false; renderPauseMenu(); }
  const ovl=$('ovlPause'); if(ovl)ovl.classList.toggle('hide',!on);
  el.bPause.textContent=on?'▶':'⏸'; el.bPause.classList.toggle('on',on);
}
let menuConfirmT=0;
function renderPauseMenu(){
  const box=$('pauseBox'); if(!box)return;
  const L=layoutHint(), stg=STAGES[S.stage];
  box.innerHTML=
    '<div class="title" style="font-size:34px">暂停</div>'+
    '<div class="sub">'+(S.endless?'无尽 · 第 '+S.wave+' 波':stg.name+' · 第 '+S.wave+' 波')+' · '+S.diff.name+'</div>'+
    '<div class="rule"></div>'+
    '<div class="pmgrid">'+
      '<button class="play" id="pmResume">继续 <small>P / Esc</small></button>'+
      '<div class="btnrow">'+
        '<button class="btn" id="pmHelp">操作指南 <small>H</small></button>'+
        '<button class="btn" id="pmAuto">自动开火：'+(S.autoFire?'开':'关')+' <small>O</small></button>'+
      '</div>'+
      '<div class="pmrow"><span>音量</span>'+
        '<input type="range" id="pmVol" min="0" max="100" value="'+Math.round((S.volume==null?1:S.volume)*100)+'">'+
        '<button class="btn" id="pmMute" style="flex:0 0 74px">'+(S.sound?'♪ 开':'✕ 静音')+'</button></div>'+
      '<div class="pmrow"><span>布局</span><span class="pmval">'+L.move+' 移动 · '+L.turn+' 换目标</span>'+
        '<button class="btn" id="pmLayout" style="flex:0 0 74px">切换 <small>,</small></button></div>'+
      '<button class="btn danger" id="pmMenu">返回主菜单</button>'+
    '</div>';
  $('pmResume').onclick=()=>togglePause(false);
  $('pmHelp').onclick=()=>{ togglePause(false); openHelp(true); };
  $('pmAuto').onclick=()=>{ toggleAuto(); renderPauseMenu(); };
  $('pmMute').onclick=()=>{ toggleSound(); renderPauseMenu(); };
  $('pmLayout').onclick=()=>{ toggleLayout(); renderPauseMenu(); };
  $('pmVol').oninput=e=>setVolume(e.target.value/100);
  const pm=$('pmMenu');
  pm.onclick=()=>{
    // two presses inside two seconds: an accidental click must not end a run
    if(performance.now()-menuConfirmT>2000){ menuConfirmT=performance.now();
      pm.textContent='再按一次确认 · 本局进度将丢失'; return; }
    togglePause(false);
    // the training run has its own teardown; leaving it half-alive would put its
    // step card on top of the next real game
    if(typeof Tutor!=='undefined'&&Tutor.active){ Tutor.stop(true); return; }
    S.running=false; S.over=true; S.paused=false;
    $('ovlPause').classList.add('hide');
    el.ovlStart.classList.remove('hide'); buildStart();
  };
}
function cycleSpeed(){S.speed=S.speed===1?2:S.speed===2?3:1;el.bSpeed.textContent='×'+S.speed;
  el.bSpeed.classList.toggle('on',S.speed>1);}
function toggleSound(){S.sound=!S.sound;el.bSound.classList.toggle('on',S.sound);el.bSound.textContent=S.sound?'♪':'✕';
  saveAudio();}
function setVolume(v){ S.volume=clamp(+v||0,0,1); if(MASTER)MASTER.gain.value=.85*S.volume; saveAudio(); }
function saveAudio(){ try{ localStorage.setItem('abyss2_audio',JSON.stringify({on:S.sound,vol:S.volume})); }catch(e){} }
function loadAudio(){
  S.volume=1;
  try{ const a=JSON.parse(localStorage.getItem('abyss2_audio')||'null');
    if(a){ S.sound=a.on!==false; S.volume=clamp(+a.vol,0,1); if(isNaN(S.volume))S.volume=1; } }catch(e){}
  el.bSound.classList.toggle('on',S.sound); el.bSound.textContent=S.sound?'♪':'✕';
}
function toggleAuto(){ S.autoFire=!S.autoFire; saveAuto();
  const b=$('bAuto'); if(b){ b.classList.toggle('on',S.autoFire); b.textContent=S.autoFire?'⊙':'⊘'; }
  toast(S.autoFire?'自动开火：开 · 锁定敌人／裂隙后自动射击':'自动开火：关 · 需按住 '+layoutHint().fire+' 开火',
        S.autoFire?'#6ee7a8':'#8d96bd'); renderTips(); }


function buildAbilities(){
  el.abilities.innerHTML='';
  for(const a of ABILITIES){
    S.abil[a.id]={cd:0};
    const b=document.createElement('button');
    b.className='ab'; b.dataset.a=a.id; b.title=a.n+' — '+a.desc;
    b.innerHTML='<span class="key">'+a.key+'</span><span class="gl">'+a.gl+'</span><span class="nm">'+a.n+'</span><span class="cd">0</span>';
    b.onclick=()=>{ac();useAbility(a.id);};
    el.abilities.appendChild(b);
  }
}

/* ---------- start / end ---------- */
let pickMap=MAPS[0], pickDiff=DIFFS[1];
/* Five region cards used to be five copies of the same blue grid -- the biomes
   only differed once you were standing in them. Tint each card with its region's
   ground and wall colours and draw its hazards, so the choice reads at a glance. */
function miniPreview(canvas,m){
  const x=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const B=BIOMES[m.biome]||BIOMES.deck;
  x.fillStyle=B.gTint;x.fillRect(0,0,w,h);
  x.fillStyle='rgba(4,6,14,.62)';x.fillRect(0,0,w,h);
  x.strokeStyle='rgba(255,255,255,.05)';x.lineWidth=1;
  for(let c=0;c<=COLS;c+=4){x.beginPath();x.moveTo(c/COLS*w,0);x.lineTo(c/COLS*w,h);x.stroke();}
  for(let r=0;r<=ROWS;r+=4){x.beginPath();x.moveTo(0,r/ROWS*h);x.lineTo(w,r/ROWS*h);x.stroke();}
  const obs=buildArena(m), sx=w/W, sy=h/H;
  const hz=buildHazards(m,obs), HZ=HAZARD[B.hazard]||{};
  for(const hh of hz){ x.fillStyle=HZ.c||'#fff'; x.globalAlpha=B.hazard==='chasm'?.5:.28;
    x.beginPath();x.ellipse(hh.x*sx,hh.y*sy,hh.r*TILE*sx,hh.r*TILE*sy*.8,0,0,TAU);x.fill(); }
  x.globalAlpha=1;
  x.fillStyle=B.wall;
  for(const o of obs)x.fillRect(o.x*sx-o.r*2.2,o.y*sy-o.r*1.8,o.r*4.4,o.r*3.6);
  x.strokeStyle=B.trim;x.globalAlpha=.55;x.lineWidth=1.5;x.strokeRect(1,1,w-2,h-2);x.globalAlpha=1;
  x.fillStyle='#2f6bff';x.beginPath();x.arc(CX*sx,CY*sy,6,0,TAU);x.fill();
  x.strokeStyle='rgba(53,230,255,.5)';x.lineWidth=1.4;
  x.beginPath();x.arc(CX*sx,CY*sy,11,0,TAU);x.stroke();
  x.fillStyle='#ff3d8a';
  for(let i=0;i<12;i++){const a=i/12*TAU;
    x.beginPath();x.arc(w/2+Math.cos(a)*w*.47,h/2+Math.sin(a)*h*.45,2.2,0,TAU);x.fill();}
}
const LAYOUTS=[
 {id:'right',n:'方向键移动（默认）',d:'方向键移动 · 自动开火 · A/D 换目标 · W 蓄力 · S 自由瞄准'},
 {id:'left', n:'WASD 移动',        d:'WASD 移动 · 自动开火 · ←/→ 换目标 · ↑ 蓄力 · ↓ 自由瞄准'},
];
function renderTips(){
  const L=layoutHint();
  el.tipBox.innerHTML=
    '<div><b>'+L.move+'</b> 移动 · <b>Shift</b> 冲刺（带无敌帧）</div>'+
    (S.autoFire
      ? '<div><b>自动瞄准并开火</b>：只管走位，枪口会自己锁敌开火（<b>O</b> 或 HUD 的 <b>⊙</b> 可关闭）</div>'
        +'<div><b>'+L.turn+'</b> 换目标 · <b>'+L.fire+'</b> 按住＝强制连射（可打到过热，也用来打掩体）</div>'
      : '<div><b>自动跟枪</b>：枪口对准当前目标 · <b>'+L.turn+'</b> 换目标（<b>O</b> 或 HUD 的 <b>⊙</b> 可开启）</div>'
        +'<div><b>'+L.fire+'</b> 开火（按住连射）</div>')+
    '<div><b>'+L.fine+'</b> 按住＝自由瞄准 · <b>'+L.charge+'</b> 蓄力重击（无视护甲）</div>'+
    '<div><b>Q</b> 歼灭光束（造成伤害充能，满了可释放）</div>'+
    '<div><b>1–8</b> 选炮塔 · <b>E</b> 就地建造 · <b>R</b> 升级 · <b>T</b> 出售</div>'+
    '<div><b>[ ]</b> 切换已建炮塔 · <b>V</b> 改造为 1–8 选中的型号（保留位置）</div>'+
    '<div>炮塔<b>有数量上限</b>，每个区域不同 · 靠升级和改造变强，不是靠数量</div>'+
    '<div>核心周围 <b>4.2 格</b>内不能建塔——炮塔要架在外围守路口，不能全堆在核心身上</div>'+
    '<div><b>关闭裂隙</b>（只有你打得动）可「据点扩建」，永久提升炮塔上限</div>'+
    '<div><b>Z X C</b> 战术技能 · <b>G</b> 提前出击 · <b>Tab</b> 加速 · <b>P</b> 暂停</div>';
}
function buildStart(){
  el.layoutPicks.innerHTML='';
  LAYOUTS.forEach(L=>{
    const b=document.createElement('button');
    b.className='pick'+(S.layout===L.id?' on':'');
    b.innerHTML='<b>'+L.n+'</b><span>'+L.d+'</span>';
    b.onclick=()=>{S.layout=L.id;saveLayout();buildStart();renderTips();};
    el.layoutPicks.appendChild(b);
  });
  renderTips();
  el.mapPicks.innerHTML='';
  STAGES.forEach((st,i)=>{
    const m=MAPS.find(x=>x.id===st.map);
    const b=document.createElement('div');
    b.className='pick'+(i===0?' on':'');
    b.innerHTML='<canvas width="240" height="146"></canvas><b>'+st.name+
      ' <span style="color:var(--dim2);font-weight:400">· '+st.waves+' 波</span></b><span>'+st.desc+'</span>';
    el.mapPicks.appendChild(b); miniPreview(b.querySelector('canvas'),m);
  });
  el.diffPicks.innerHTML='';
  DIFFS.forEach(d=>{
    const b=document.createElement('button');
    b.className='pick'+(d===pickDiff?' on':'');
    b.innerHTML='<b>'+d.name+'</b><span>'+d.desc+'</span>';
    b.onclick=()=>{pickDiff=d;buildStart();};
    el.diffPicks.appendChild(b);
  });
}
/* the training run lives in its own sandbox: no waves, no losing, and every step
   gated on the player actually performing the action */
/* Finishing the training used to just drop you back on the menu with a toast, so
   there was no moment that said you were done. Give it an ending. */
function showTutorialDone(){
  const L=layoutHint();
  const k=s=>'<b>'+s+'</b>';
  const learned=[
    ['移动与冲刺', L.move+' 走位 · Shift 冲刺带无敌帧'],
    ['自动开火', '枪口自己锁敌开火 · '+L.turn+' 换目标 · '+L.fire+' 强制连射'],
    ['蓄力破甲', L.charge+' 按住蓄力，重击无视护甲'],
    ['炮塔', '1–8 选型号 · E 建造 · R 升级 · [ ] 选中 · V 改造 · T 出售'],
    ['技能与大招', 'Z X C 三个战术技能 · Q 歼灭光束'],
    ['裂隙与残骸', '裂隙只有你打得动，关掉可换炮塔位 · 残骸要站定拆解'],
  ];
  $('tutDoneBox').innerHTML=
    '<div class="title" style="font-size:34px">训练完成</div>'+
    '<div class="sub">TRAINING COMPLETE · 14 / 14</div>'+
    '<div class="rule"></div>'+
    '<div class="tdgrid">'+learned.map(([a,b])=>
      '<div class="tdrow"><span>'+a+'</span><em>'+b+'</em></div>').join('')+'</div>'+
    '<div class="hnote" style="margin-top:14px">'+
      '<div>随时按 '+k('H')+' 调出完整操作指南，'+k(',')+' 可切换移动键位。</div>'+
      '<div>训练可以在开始界面重来，不会影响记录。</div>'+
    '</div>'+
    '<button class="play" id="bTutGo" style="margin-top:16px">进入战场</button>'+
    '<button class="btn" id="bTutHelp" style="width:100%;margin-top:8px">再看一遍操作指南</button>';
  el.ovlTutDone.classList.remove('hide');
  sfx('win');
  $('bTutGo').onclick=()=>{ ac(); el.ovlTutDone.classList.add('hide');
    el.ovlStart.classList.remove('hide'); };
  $('bTutHelp').onclick=()=>{ ac(); openHelp(); };
}
function startTutorial(){
  el.ovlStart.classList.add('hide'); el.ovlEnd.classList.add('hide');
  el.ovlCards.classList.add('hide'); el.ovlTele.classList.add('hide');
  closeHelp();
  S.diff=pickDiff; S.map=MAPS[0];
  S.obstacles=buildArena(S.map); S.hazards=buildHazards(S.map,S.obstacles);
  S.stage=0; S.stageWaves=0; S.coreUp={}; applyCoreUpgrades(false);
  S.core.hp=S.core.maxHp;
  for(const t of S.towers)World.removeTower(t); S.towers=[];
  logs.length=0; el.log.innerHTML='';
  World.buildBoard(); World.addPlayer(); World.updateLinks();
  selectTower(null); World.setRange(null); World.setGhost(null);
  Tutor.start();
  log('新手训练开始 · 共 '+Tutor.steps()+' 步');
}
function startGame(){
  ac();
  S.diff=pickDiff;
  S.stage=0; S.stageWaves=0; S.stageStartWave=0; S.coreUp={}; S.teleporting=false;
  S.retries=0; S.sinceMed=0; S.endless=false;
  if(S.pauseMenu){ S.pauseMenu=false; $('ovlPause').classList.add('hide'); el.bPause.textContent='⏸'; el.bPause.classList.remove('on'); }
  S.map=MAPS.find(m=>m.id===STAGES[0].map);
  S.obstacles=buildArena(S.map);
  S.hazards=buildHazards(S.map,S.obstacles);
  S.core.flash=0; S.core.cool=0; S.core.shield=0; S.core.shieldT=0;
  applyCoreUpgrades(false); S.core.shield=S.core.maxShield;
  S.scrap=pickDiff.scrap; S.wave=0; S.time=0; S.rest=REST; S.qt=0;
  S.running=true; S.over=false; S.paused=false; S.victory=false; S.speed=1; S.waveActive=false;
  S.kills=0; S.earned=0; S.combo=0; S.comboT=0; S.overT=0; S.overArmed=false; S.build=null; S.aim=null; S.sel=null;
  S.lastKill=0; S.purge=0; S.armorHint=false; S.eliteHint=false; S.fineHint=false;
  S.slotEarned=0; S.riftProgress=0; S.riftsClosed=0;
  S.shake=0; S.flash=0;
  S.level=1; S.xp=0; S.xpNeed=xpForLevel(1); S.pendingCards=0; S.cards=null; S.cardCount={};
  S.st=freshStats(); S.P=newPlayer();
  S.cam.x=CX; S.cam.y=CY; recalcPower();
  for(const t of S.towers)World.removeTower(t);
  for(const e of S.enemies)World.removeEnemy(e);
  for(const s of S.shots)World.removeShot(s);
  for(const s of S.ebullets)World.removeShot(s);
  for(const r of S.rifts)World.removeRift(r);
  for(const s of S.salvage)World.removeSalvage(s);
  for(const c of S.clouds)World.removeCloud(c);
  S.clouds=[];
  for(const p of S.pickups)World.removePickup(p);
  S.pickups=[]; S.pickT=14;
  S.playerLives=pickDiff.lives;
  S.rifts=[];S.salvage=[];
  S.towers=[];S.enemies=[];S.shots=[];S.ebullets=[];S.drops=[];
  S.parts=[];S.texts=[];S.beams=[];S.shocks=[];S.magma=[];S.queue=[];
  for(const a of ABILITIES)S.abil[a.id]={cd:0};
  logs.length=0; el.log.innerHTML='';
  World.buildBoard(); World.addPlayer(); World.updateLinks(); recalcPower(); loadBest();
  selectTower(null); World.setRange(null); World.setGhost(null);
  el.ovlStart.classList.add('hide'); el.ovlEnd.classList.add('hide'); el.ovlCards.classList.add('hide');
  el.ovlTele.classList.add('hide');
  el.bSpeed.textContent='×1'; el.bSpeed.classList.remove('on');
  log('第一区 · 前哨 · '+Math.ceil(REST)+' 秒后第一波来袭');
  banner('DEFEND'); UI.sync();
}
function endGame(win){
  if(S.over&&!win)return;
  if(win){ sfx('win'); S.paused=true; }
  else { S.over=true; S.running=false; S.paused=false; sfx('lose'); shake(1.2); }
  if(S.pauseMenu){ S.pauseMenu=false; $('ovlPause').classList.add('hide'); }
  if(S.wave>S.best){S.best=S.wave;saveBest();}
  el.ovlCards.classList.add('hide');
  const st=STAGES[S.stage];
  el.endBox.innerHTML=
    '<div class="endt" style="color:'+(win?'#6ee7a8':'#ff4d5e')+'">'+(win?'核心守住了':'核心陷落')+'</div>'+
    '<div class="sub">'+st.name+' · '+S.map.name+' · '+S.diff.name+'</div>'+
    '<div class="endgrid">'+
      '<div class="eg"><b>'+(S.stage+1)+'/'+STAGES.length+'</b><span>Region</span></div>'+
      '<div class="eg"><b>'+S.wave+'</b><span>Waves</span></div>'+
      '<div class="eg"><b>'+S.kills+'</b><span>Kills</span></div>'+
      '<div class="eg"><b>'+S.level+'</b><span>Level</span></div>'+
    '</div>'+
    (win?'<button class="play" id="bAgain">继续挑战无尽</button>'+
         '<div class="retrynote">波次不再停止，敌人持续增强 · 保留全部炮塔、等级与升级</div>'
        :'<button class="play" id="bRetry">重试本区 · '+st.name+'</button>'+
         '<div class="retrynote">保留 <b>等级 '+S.level+'</b>、全部强化卡与核心升级，炮塔按 80% 折算返还</div>'+
         '<button class="btn" id="bAgain" style="width:100%;margin-top:8px">从第一区重新开始</button>')+
    '<button class="btn" id="bMenu" style="width:100%;margin-top:8px">返回主菜单</button>';
  el.ovlEnd.classList.remove('hide');
  const rt=$('bRetry'); if(rt)rt.onclick=()=>{ac();retryStage();};
  $('bAgain').onclick=()=>{ ac(); if(win){ el.ovlEnd.classList.add('hide'); beginEndless(); } else startGame(); };
  $('bMenu').onclick=()=>{el.ovlEnd.classList.add('hide');el.ovlStart.classList.remove('hide');
    S.running=false;S.over=true;buildStart();};
}

/* ---------- boot ---------- */
function boot(){
  World.init(); World.initDropPool(); loadLayout(); loadAuto(); loadAudio();
  S.st=freshStats(); S.P=newPlayer();
  S.obstacles=buildArena(pickMap);
  S.hazards=buildHazards(pickMap,S.obstacles);
  buildIcons(); buildShop(); buildAbilities(); buildStart(); bindInput();
  World.buildBoard(); World.addPlayer();
  S.running=false;
  el.bPlay.onclick=startGame;
  el.bNextStage.onclick=()=>{ac();nextStage();};
  el.bTermClose.onclick=()=>{ac();closeCoreTerm();};
  UI.sync();
  try{ if(!localStorage.getItem('abyss2_tutorial_done')){
    localStorage.setItem('abyss2_seen_help','1'); startTutorial(); } }catch(e){}
  requestAnimationFrame(loop);
}
boot();
