/* ===================== CORE ===================== */
const cv=document.getElementById('game');
const fx2d=document.getElementById('fx2d'), c2=fx2d.getContext('2d');
let VW=1200, VH=680;   // render shape follows the board's real aspect

const S={
  map:MAPS[0], diff:DIFFS[1], running:false, over:false, paused:false, speed:1,
  scrap:200, wave:0, time:0, rest:0, waveActive:false, victory:false, qt:0,
  core:{x:CX,y:CY,hp:3000,maxHp:3000,flash:0,cool:0,ang:0},
  P:null,                                   // the player unit
  towers:[], enemies:[], shots:[], ebullets:[], drops:[], parts:[], texts:[],
  rifts:[], salvage:[], hazards:[], props:[], pickups:[], clouds:[],
  beams:[], shocks:[], magma:[], obstacles:[],
  queue:[], build:null, sel:null, aim:null, shake:0, flash:0, combo:0, comboT:0,
  kills:0, earned:0, abil:{}, overT:0, sound:true, best:0, layout:'right',
  lastKill:0, purge:0, armorHint:false, autoFire:true,
  level:1, xp:0, xpNeed:0, cards:null, pendingCards:0, playerLives:3, pickT:0,
  stage:0, stageWaves:0, stageStartWave:0, coreUp:{}, teleporting:false, retries:0,
  keys:{}, mouse:{x:CX,y:CY-200,down:false,moved:0},
  toast:null, hitStop:0, sinceMed:0, hover:null, towerAlarm:0,
  touch:{on:false, charge:false, r:56,
    move:{a:0,m:0,act:false,ox:0,oy:0,x:0,y:0},
    aim:{a:0,m:0,act:false,ox:0,oy:0,x:0,y:0}},
  cam:{x:CX,y:CY},
};

/* ---------- arena helpers ---------- */
const inArena=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function buildArena(m){
  const rng=mulberry(hashStr(m.id)), O=[];
  const B0=BIOMES[m.biome]||BIOMES.deck;
  const BP=B0.props, DENS=B0.density||1;
  const push=(x,y,r,role)=>{
    if(dist2(x,y,CX,CY)<((CORE.r+2.6)*TILE)**2)return;      // keep the Core's apron clear
    for(const o of O) if(dist2(x,y,o.x,o.y)<((r+o.r)*TILE+18)**2)return;
    if(x<TILE*1.5||y<TILE*1.5||x>W-TILE*1.5||y>H-TILE*1.5)return;
    if(rng()>DENS)return;                      // biome density thins the clutter
    // role only decides scale; the visible prop comes from the biome set
    const kind=role==='pillar'?BP[0]:BP[1+((rng()*(BP.length-1))|0)];
    const P0=PROPS[kind]||{hp:80,scrap:10,fx:'none'};
    const hp=Math.round(P0.hp*(.7+r*.55));
    O.push({x,y,r,kind,role,seed:rng()*99,hp,maxHp:hp,flash:0,obj:null});
  };
  if(m.obstacles==='ring'){
    for(let i=0;i<10;i++){const a=i/10*TAU+rng()*.2, d=(6.2+rng()*1.1)*TILE;
      push(CX+Math.cos(a)*d,CY+Math.sin(a)*d,rnd(1.05,.72),i%3===0?'pillar':'rock');}
    for(let i=0;i<14;i++){const a=rng()*TAU, d=(11+rng()*7)*TILE;
      push(CX+Math.cos(a)*d,CY+Math.sin(a)*d*.62,rnd(1.25,.7),rng()<.4?'block':'rock');}
  }else if(m.obstacles==='pillars'){
    for(let i=0;i<46;i++){const a=rng()*TAU, d=(4.6+rng()*15)*TILE;
      push(CX+Math.cos(a)*d,CY+Math.sin(a)*d*.66,rnd(.95,.55),rng()<.55?'pillar':'rock');}
  }else if(m.obstacles==='corridor'){
    for(let k=-2;k<=2;k++){
      if(k===0)continue;
      const x=CX+k*7.4*TILE;
      for(let j=-4;j<=4;j++){ if(Math.abs(j)<1)continue;
        push(x,CY+j*2.3*TILE,rnd(1.1,.8),'block'); }
    }
    for(let i=0;i<10;i++){const a=rng()*TAU,d=(6+rng()*10)*TILE;
      push(CX+Math.cos(a)*d,CY+Math.sin(a)*d*.6,rnd(1.0,.6),'rock');}
  }else if(m.obstacles==='arena'){
    for(let i=0;i<4;i++){const a=i/4*TAU+Math.PI/4;
      push(CX+Math.cos(a)*6.5*TILE,CY+Math.sin(a)*5.2*TILE,1.5,'pillar');}
    for(let i=0;i<6;i++){const a=rng()*TAU,d=(13+rng()*6)*TILE;
      push(CX+Math.cos(a)*d,CY+Math.sin(a)*d*.6,rnd(1.2,.8),'rock');}
  }else{
    for(let i=0;i<9;i++){const a=rng()*TAU, d=(7+rng()*12)*TILE;
      push(CX+Math.cos(a)*d,CY+Math.sin(a)*d*.6,rnd(1.4,.85),rng()<.5?'block':'rock');}
  }
  return O;
}
/* ---------- terrain hazards ---------- */
function buildHazards(m,obstacles){
  const B=BIOMES[m.biome]||BIOMES.deck;
  const kind=B.hazard, def=HAZARD[kind];
  const rng=mulberry(hashStr(m.id+'hz')), out=[];
  let guard=0;
  while(out.length<B.hazardN&&guard++<400){
    const a=rng()*TAU, d=(6+rng()*13)*TILE;
    const x=clamp(CX+Math.cos(a)*d,TILE*3,W-TILE*3);
    const y=clamp(CY+Math.sin(a)*d*.8,TILE*3,H-TILE*3);
    const r=def.r[0]+rng()*(def.r[1]-def.r[0]);
    if(dist2(x,y,CX,CY)<((CORE.r+r+2.6)*TILE)**2)continue;
    if(obstacles.some(o=>dist2(x,y,o.x,o.y)<((o.r+r+.5)*TILE)**2))continue;
    if(out.some(o=>dist2(x,y,o.x,o.y)<((o.r+r+1.2)*TILE)**2))continue;
    out.push({kind,x,y,r,seed:rng()*99,t:rng()*4,phase:'idle',obj:null});
  }
  return out;
}
function hazardAt(x,y,kind){
  for(const h of S.hazards){
    if(kind&&h.kind!==kind)continue;
    if(dist2(x,y,h.x,h.y)<(h.r*TILE)**2)return h;
  }
  return null;
}
/* push a circle out of every obstacle it overlaps */
/* Turrets are solid. Returns whichever turret the unit is touching, plus how
   hard it is leaning on it — the caller decides if that counts as "blocked". */
function resolveTowers(e,radius){
  let touch=null, deepest=0;
  for(const t of S.towers){
    const R=(0.44+radius)*TILE, dx=e.x-t.x, dy=e.y-t.y, d2=dx*dx+dy*dy;
    if(d2<R*R&&d2>1e-6){
      const d=Math.sqrt(d2), k=(R-d)/d;
      e.x+=dx*k; e.y+=dy*k;
      if(R-d>deepest){ deepest=R-d; touch=t; }
    }
  }
  return touch;
}
function resolveObstacles(e,radius){
  for(const h of S.hazards){
    if(!HAZARD[h.kind].solid)continue;
    const R=(h.r+radius)*TILE, dx=e.x-h.x, dy=e.y-h.y, d2=dx*dx+dy*dy;
    if(d2<R*R&&d2>1e-6){ const d=Math.sqrt(d2), k=(R-d)/d; e.x+=dx*k; e.y+=dy*k; }
  }
  for(const o of S.obstacles){
    const R=(o.r+radius)*TILE, dx=e.x-o.x, dy=e.y-o.y, d2=dx*dx+dy*dy;
    if(d2<R*R&&d2>1e-6){ const d=Math.sqrt(d2), k=(R-d)/d; e.x+=dx*k; e.y+=dy*k; }
  }
  e.x=clamp(e.x,TILE*.6,W-TILE*.6); e.y=clamp(e.y,TILE*.6,H-TILE*.6);
}
function blockedTile(c,r){
  const x=(c+.5)*TILE, y=(r+.5)*TILE;
  if(dist2(x,y,CX,CY)<((CORE.r+1.15)*TILE)**2)return true;
  for(const o of S.obstacles) if(dist2(x,y,o.x,o.y)<((o.r+.55)*TILE)**2)return true;
  for(const h of S.hazards) if(dist2(x,y,h.x,h.y)<((h.r+.4)*TILE)**2)return true;
  return false;
}
function canBuild(c,r){
  if(c<1||r<1||c>=COLS-1||r>=ROWS-1)return false;
  if(blockedTile(c,r))return false;
  return !S.towers.some(t=>t.col===c&&t.row===r);
}
function towerAt(c,r){return S.towers.find(t=>t.col===c&&t.row===r)||null;}

/* ---------- audio ----------
   Everything is synthesised live. The chain is
       voice -> [dry] -> master bus -> compressor -> out
             -> [send] -> convolver reverb -> master
   The reverb impulse is generated noise, which is what stops the
   whole thing sounding like bare oscillators plugged into the speaker. */
let AC=null, MASTER=null, VERB=null, SEND=null;
function ac(){
  if(!AC){
    try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; }
    const comp=AC.createDynamicsCompressor();
    comp.threshold.value=-18; comp.knee.value=22; comp.ratio.value=7;
    comp.attack.value=.003; comp.release.value=.22;
    MASTER=AC.createGain(); MASTER.gain.value=.85;
    MASTER.connect(comp); comp.connect(AC.destination);
    // generated impulse response: exponentially decaying stereo noise
    const len=Math.floor(AC.sampleRate*1.5), ir=AC.createBuffer(2,len,AC.sampleRate);
    for(let ch=0;ch<2;ch++){
      const d=ir.getChannelData(ch);
      for(let k=0;k<len;k++){
        const t=k/len;
        d[k]=(Math.random()*2-1)*Math.pow(1-t,2.6)*(1-t*.2);
      }
    }
    VERB=AC.createConvolver(); VERB.buffer=ir;
    const vg=AC.createGain(); vg.gain.value=.5;
    VERB.connect(vg); vg.connect(MASTER);
    SEND=AC.createGain(); SEND.gain.value=1; SEND.connect(VERB);
  }
  if(AC&&AC.state==='suspended')AC.resume();
  return AC;
}
let noiseBuf=null;
function noise(){ const a=ac(); if(!a)return null;
  if(!noiseBuf){ noiseBuf=a.createBuffer(1,(a.sampleRate*.8)|0,a.sampleRate); const d=noiseBuf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1; }
  const s=a.createBufferSource(); s.buffer=noiseBuf; s.loop=true;
  s.playbackRate.value=.85+Math.random()*.3; return s; }

const sndClock={};
function sfx(kind,vol=1,rate=1){
  if(!S.sound)return; const a=ac(); if(!a)return;
  const now=a.currentTime;
  if(sndClock[kind]&&now-sndClock[kind]<.035)return; sndClock[kind]=now;

  const bus=a.createGain(); bus.gain.value=1; bus.connect(MASTER);
  const wet=a.createGain(); bus.connect(wet); wet.connect(SEND);
  const setWet=v=>{ wet.gain.value=v; };
  setWet(.16);

  // one oscillator voice with a pitch sweep
  const tone=(f1,f2,t,type,v,dly=0,detune=0)=>{
    const o=a.createOscillator(); o.type=type; o.detune.value=detune;
    o.frequency.setValueAtTime(f1,now+dly);
    o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),now+dly+t);
    const gg=a.createGain();
    gg.gain.setValueAtTime(.0001,now+dly);
    gg.gain.exponentialRampToValueAtTime(Math.max(.0002,v*vol),now+dly+.004);
    gg.gain.exponentialRampToValueAtTime(.0001,now+dly+t);
    o.connect(gg); gg.connect(bus); o.start(now+dly); o.stop(now+dly+t+.03);
  };
  // filtered noise burst
  const air=(t,f,q,v,type='lowpass',dly=0)=>{
    const n=noise(); if(!n)return;
    const bp=a.createBiquadFilter(); bp.type=type;
    bp.frequency.setValueAtTime(f,now+dly);
    bp.frequency.exponentialRampToValueAtTime(Math.max(60,f*.22),now+dly+t);
    bp.Q.value=q;
    const gg=a.createGain();
    gg.gain.setValueAtTime(v*vol,now+dly);
    gg.gain.exponentialRampToValueAtTime(.0001,now+dly+t);
    n.connect(bp); bp.connect(gg); gg.connect(bus);
    n.start(now+dly); n.stop(now+dly+t+.03);
  };
  // sub-bass body: what makes an impact feel heavy
  const body=(f,t,v,dly=0)=>{
    const o=a.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(f,now+dly);
    o.frequency.exponentialRampToValueAtTime(Math.max(18,f*.35),now+dly+t);
    const gg=a.createGain();
    gg.gain.setValueAtTime(v*vol,now+dly);
    gg.gain.exponentialRampToValueAtTime(.0001,now+dly+t);
    o.connect(gg); gg.connect(bus); o.start(now+dly); o.stop(now+dly+t+.03);
  };
  const R=rate;
  switch(kind){
    case 'shoot':                                  // player rifle: click + air + thump
      setWet(.10);
      tone(1500*R,520*R,.045,'square',.045);
      tone(2600*R,900*R,.028,'sawtooth',.022,0,12);
      air(.055,3200,1.4,.05,'highpass');
      body(150,.07,.05); break;
    case 'arrow':
      setWet(.12);
      tone(1700*R,700*R,.05,'square',.035);
      air(.05,4200,2,.03,'highpass'); break;
    case 'cannon':
      setWet(.3);
      air(.34,1100,.9,.3); body(120,.34,.34);
      tone(320,70,.16,'sawtooth',.1); break;
    case 'boom':
      setWet(.42);
      air(.6,1700,.7,.4); body(90,.55,.4);
      tone(240,45,.3,'sawtooth',.12); break;
    case 'frost':
      setWet(.35);
      tone(2400*R,1000*R,.16,'triangle',.05);
      tone(3300*R,1600*R,.13,'sine',.03,.01);
      air(.14,6000,3,.03,'highpass'); break;
    case 'zap':
      setWet(.28);
      tone(200,3600,.045,'sawtooth',.05);
      air(.12,5000,5,.08,'bandpass'); body(90,.1,.08); break;
    case 'snipe':
      setWet(.4);
      tone(3200,260,.2,'sawtooth',.14);
      air(.2,2400,2.2,.12); body(110,.26,.2); break;
    case 'flame': setWet(.14); air(.15,780,.7,.05); break;
    case 'toxin': setWet(.24); tone(620*R,190*R,.15,'sine',.06); air(.1,1400,1.6,.03); break;
    case 'hit':   setWet(.14); tone(420,190,.05,'square',.035); body(140,.07,.05); break;
    case 'dash':  setWet(.22); tone(500,1700,.14,'triangle',.08); air(.18,2400,1.2,.07,'highpass'); break;
    case 'hurt':  setWet(.3);  tone(300,80,.22,'sawtooth',.16); air(.22,700,1,.12); body(70,.28,.16); break;
    case 'corehit': setWet(.4); tone(180,55,.36,'sawtooth',.2); air(.34,480,1,.16); body(55,.4,.24); break;
    case 'pick':  setWet(.16); tone(1300*R,2000*R,.06,'sine',.05); break;
    case 'scrap': setWet(.16); tone(760*R,1200*R,.07,'triangle',.05); break;
    case 'level': [523,659,784,1047].forEach((f,i)=>setTimeout(()=>{if(S.sound)chime(f,.3)},i*70)); break;
    case 'place':
      setWet(.26); tone(360,820,.1,'triangle',.11); tone(820,1500,.1,'sine',.055,.05);
      body(120,.14,.1); break;
    case 'up':    setWet(.3); tone(640,1600,.16,'triangle',.13); tone(1600,2600,.13,'sine',.06,.06); break;
    case 'sell':  setWet(.2); tone(820,260,.16,'triangle',.1); break;
    case 'err':   setWet(.1); tone(230,140,.12,'square',.09); tone(180,110,.12,'square',.05,.03); break;
    case 'leak':  setWet(.35); tone(320,90,.3,'sawtooth',.18); air(.3,520,1,.16); break;
    case 'wave':  setWet(.5); tone(160,440,.45,'sawtooth',.1); body(70,.6,.18); break;
    case 'boss':  setWet(.6); tone(80,42,1.2,'sawtooth',.26); air(1.1,340,.8,.18); body(46,1.3,.3); break;
    case 'ability': setWet(.45); tone(300,1800,.3,'sawtooth',.14); air(.42,2600,1.4,.15); body(90,.36,.16); break;
    case 'lose':  setWet(.55); tone(320,50,1.5,'sawtooth',.24); body(60,1.6,.3); break;
    case 'win':   [523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>{if(S.sound)chime(f,.55)},i*130)); break;
  }
}
function chime(f,len){
  const a=ac(); if(!a)return; const now=a.currentTime;
  const bus=a.createGain(); bus.connect(MASTER);
  const wet=a.createGain(); wet.gain.value=.5; bus.connect(wet); wet.connect(SEND);
  [[1,.14],[2,.05],[3,.025]].forEach(([mul,v])=>{
    const o=a.createOscillator(); o.type='triangle'; o.frequency.value=f*mul;
    const g=a.createGain(); g.gain.setValueAtTime(v,now);
    g.gain.exponentialRampToValueAtTime(.0001,now+len);
    o.connect(g); g.connect(bus); o.start(now); o.stop(now+len+.05);
  });
}
const tone2=chime;
/* ---------- fx primitives (arena pixels + z height in tiles) ---------- */
const _CC={};
const C3=s=>_CC[s]||(_CC[s]=new THREE.Color(s));
function part(x,y,z,c,o={}){
  if(S.parts.length>1100)return;
  const a=o.ang!==undefined?o.ang:rnd(TAU), sp=o.sp!==undefined?o.sp:rnd(4,1);
  const el=o.el!==undefined?o.el:rnd(1.1,-.15), hs=Math.cos(el);
  S.parts.push({x,y,z,vx:Math.cos(a)*sp*hs,vy:Math.sin(a)*sp*hs,vz:Math.sin(el)*sp,
    col:C3(c),r:o.r||rnd(.14,.05),life:o.life||rnd(.8,.3),t:0,g:o.g!==undefined?o.g:5});
}
function burstFx(x,y,z,c,n,sp=5,r=.14){for(let i=0;i<n;i++)part(x,y,z,c,{sp:rnd(sp,sp*.2),r:rnd(r,r*.4)});}
function shock(x,y,z,r,c,life=.45,w=.16){S.shocks.push({x,y,z,r0:r*.12,r1:r,c,t:0,life,w});}
function text(x,y,z,s,c,size=13){if(S.texts.length>70)return;S.texts.push({x,y,z,s,c,size,t:0,life:.9,vz:1.6});}
function beam(a,b,c,w=1,life=.13,jag=0){S.beams.push({a,b,col:C3(c),w,t:0,life,jag,seed:Math.random()*99});}
function shake(v){S.shake=Math.min(1.6,S.shake+v);}
/* a couple of frames of near-freeze so heavy hits land */
function hitStop(t){ S.hitStop=Math.max(S.hitStop,t); }
/* a short, unmissable line at the bottom of the arena */
function toast(msg,col){ S.toast={msg,col:col||'#9fd8ff',t:0,life:1.7}; }
