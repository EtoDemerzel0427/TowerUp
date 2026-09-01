/* ===================== 新手训练 =====================
   The game has accumulated a lot of verbs: two movement schemes, a lock-on gun
   with a heat bar and a heavy shot, capped emplacements that upgrade / refit /
   elite-branch, three tactical skills, rifts that only the player can close, and
   salvage that only pays out if you stand still. A wall of text does not teach
   any of that. This runs the player through every one of them in a controlled
   arena and refuses to advance until the thing has actually been done.

   Steps declare what they need on screen (setup) and how to tell it happened
   (done). Everything is checked against real game state -- the tutorial drives
   nothing on the player's behalf. */

const Tutor = (function(){
  let active=false, i=0, holdT=0, doneT=0, started=false;
  const c={moved:0, dashes:0, kills:0, cycles:0, heavy:0, sel:0, helped:false};
  let prevDash=false, prevCycle=0, prevShots=0, prevKills=0, prevRifts=0, prevSalv=0;

  const K=()=>layoutHint();
  const kb=(...keys)=>keys.map(x=>'<b>'+x+'</b>').join('');
  const touch=()=>S.touch.on;

  function wipe(){
    for(const e of S.enemies)World.removeEnemy(e,false);
    S.enemies.length=0;
    for(const r of S.rifts)World.removeRift(r);
    S.rifts.length=0;
    clearSalvage();
    for(const s of S.shots)World.removeShot(s); S.shots.length=0;
    for(const b of S.ebullets)World.removeShot(b); S.ebullets.length=0;
  }
  function dummy(type,dist,ang,opt,hpMul){
    const a=ang!==undefined?ang:rnd(TAU);
    const x=clamp(S.P.x+Math.cos(a)*dist*TILE,TILE*2,W-TILE*2);
    const y=clamp(S.P.y+Math.sin(a)*dist*TILE,TILE*2,H-TILE*2);
    const e=spawnEnemyAt(type,x,y,hpMul!=null?hpMul:1,opt);
    e.atkMul=0.35;                    // training dummies hit softly
    return e;
  }

  const STEPS=[
    { t:'移动',
      d:()=>'用 '+kb(...K().move.split(' ').filter(Boolean))+' 走动。'+
            (touch()?'手机上是<u>左半屏</u>拖动，拇指按下的位置就是摇杆原点。':''),
      hint:'走上一段距离',
      setup(){}, done(){ return c.moved>7*TILE; },
      prog(){ return Math.min(1,c.moved/(7*TILE)); } },

    { t:'冲刺',
      d:()=>'按 '+kb('Shift')+' 冲刺。冲刺<u>带无敌帧</u>，能穿过敌人、打断它们的攻击，是最重要的保命手段。'+
            (touch()?'手机上是右侧的「冲刺」键。':''),
      hint:'冲刺一次',
      setup(){}, done(){ return c.dashes>=1; } },

    { t:'自动瞄准与开火',
      d:()=>'枪口会<u>自己锁定</u>最近的敌人，你不用调方向。按 '+kb(K().fire)+' 开火。'+
            (touch()?'手机上默认<u>连瞄带打全自动</u>，不用管右半屏。':'（按 '+kb('F')+' 可开启自动开火，开了连扳机都不用按）'),
      hint:'消灭 3 个目标',
      setup(){ wipe(); for(let n=0;n<3;n++)dummy('grunt',6+n,n*2.1,null,.5); },
      done(){ return c.kills>=3; },
      prog(){ return Math.min(1,c.kills/3); } },

    { t:'切换目标',
      d:()=>'锁定的不一定是你想打的。按 '+kb(...K().turn.split('/').map(s=>s.trim()))+' 换一个目标。',
      hint:'切换一次目标',
      setup(){ wipe(); for(let n=0;n<3;n++)dummy('runner',7,n*2.1,null,.6); },
      done(){ return c.cycles>=1; } },

    { t:'蓄力重击 · 破甲',
      d:()=>'这只<u>重装兵护甲很厚</u>，普通子弹只能打出 15% 伤害（会跳「护甲」两个字）。'+
            '<u>按住 '+kb(K().fire)+' 不放</u>——边打边蓄力，松手就是一发重击，'+
            '<u>完全无视护甲</u>。（也可以用专用蓄力键 '+kb(K().charge)+'）'+
            (touch()?'手机上是「蓄力」键。':''),
      hint:'用蓄力重击打掉它',
      setup(){ wipe(); const e=dummy('brute',6,-Math.PI/2,null,.55); e.armor=40; e.sp=0; },
      done(){ return c.heavy>=1 && !S.enemies.some(e=>e.alive); } },

    { t:'建造炮塔',
      d:()=>'按 '+kb('1')+'～'+kb('8')+' 选型号，走到位置按 '+kb('E')+' 就地建造。'+
            '<u>炮塔有数量上限</u>，每区不同，所以每一座都是决定。'+
            (touch()?'手机上点「菜单」选型号，再点「建造」。':''),
      hint:'建造一座炮塔',
      setup(){ wipe(); S.scrap=1200; selectBuild('arrow'); },
      done(){ return S.towers.length>=1; } },

    { t:'升级炮塔',
      d:()=>'站在炮塔旁按 '+kb('R')+' 升级它。数量有上限，<u>变强要靠升级</u>。'+
            '结构受损时，同一个键会先修好它。'+(touch()?'手机上点「升级」。':''),
      hint:'把它升到 LV2',
      setup(){ S.scrap=1200; },
      done(){ return S.towers.some(t=>t.lvl>=2); } },

    { t:'隔空选中与改造',
      d:()=>'按 '+kb('[')+kb(']')+' 可以<u>隔空</u>切换已建的炮塔，不必走过去。'+
            '选中后按 '+kb('1')+'～'+kb('8')+' 挑一个型号，再按 '+kb('V')+' 就地改造——'+
            '保留位置和塔位，按出售价折抵。',
      hint:'把这座塔改造成别的型号',
      setup(){ S.scrap=1500; selectBuild('cannon'); },
      done(){ return S.towers.some(t=>t.key!=='arrow'); } },

    { t:'出售',
      d:()=>'按 '+kb('T')+' 出售脚下或选中的炮塔，返还 70%。塔位紧张时，拆掉一座换个思路很正常。',
      hint:'卖掉一座炮塔',
      setup(){ Tutor._tw=S.towers.length; },
      done(){ return S.towers.length<Tutor._tw; } },

    { t:'战术技能 · 三个都试一遍',
      d:()=>ABILITIES.map(a=>kb(a.key)+' '+a.n+'（'+a.desc+'）').join('<br>')+
            '<br>冷却各自独立。'+(touch()?'手机上在左下角的技能栏。':''),
      hint:'依次放出三个技能',
      setup(){ wipe(); for(let n=0;n<6;n++)dummy('swarm',7,n*1.05,null,.5);
        for(const a of ABILITIES)S.abil[a.id].cd=0;
        Tutor._ab={}; },
      done(){ for(const a of ABILITIES) if(S.abil[a.id].cd>0)Tutor._ab[a.id]=1;
        return ABILITIES.every(a=>Tutor._ab&&Tutor._ab[a.id]); },
      prog(){ const n=Tutor._ab?Object.keys(Tutor._ab).length:0; return n/ABILITIES.length; } },

    { t:'歼灭光束',
      d:()=>'造成伤害会积攒大招。攒满后按 '+kb('Q')+' 释放一道可以扫过战场的光束。'+
            (touch()?'手机上是「大招」键。':''),
      hint:'释放大招',
      setup(){ wipe(); S.P.ult=1; S.P.ultT=0;
        for(let n=0;n<4;n++)dummy('grunt',8,n*1.57,null,.6); },
      done(){ return S.P.ultT>0; } },

    { t:'关闭裂隙',
      d:()=>'裂隙是敌人的来源，<u>只有你的子弹和轨道轰炸能伤害它</u>——炮塔打不动。'+
            '不关掉它就会一直涌出增援。关闭若干道可换取<u>永久炮塔位</u>。',
      hint:'打掉这道裂隙',
      setup(){ wipe();
        const a=rnd(TAU);
        const r={x:clamp(CX+Math.cos(a)*7*TILE,TILE*3,W-TILE*3),
                 y:clamp(CY+Math.sin(a)*6*TILE,TILE*3,H-TILE*3),
                 hp:420,maxHp:420,queue:[],t:0,alive:true,flash:0,obj:null,idx:0,
                 over:0,overLeft:0,overflowing:false};
        S.rifts.push(r); World.addRift(r); },
      done(){ return !S.rifts.some(r=>r.alive); } },

    { t:'拆解残骸',
      d:()=>'金色残骸能换一笔碎片，但必须<u>站着不动</u>把它拆完——移动或冲刺都会中断进度。'+
            '在战场中央站定三秒，是要付出代价的。',
      hint:'拆解一处残骸',
      setup(){ wipe(); clearSalvage();
        const a=rnd(TAU);
        const s={x:clamp(S.P.x+Math.cos(a)*3.5*TILE,TILE*2,W-TILE*2),
                 y:clamp(S.P.y+Math.sin(a)*3.5*TILE,TILE*2,H-TILE*2),
                 p:0,amount:120,obj:null};
        S.salvage.push(s); World.addSalvage(s); },
      done(){ return S.salvage.length===0; },
      prog(){ return S.salvage.length?S.salvage[0].p:1; } },

    { t:'完整操作指南',
      d:()=>'剩下的快捷键——'+kb('G')+' 提前出击、'+kb('T')+' 出售、'+kb('Tab')+' 加速、'+
            kb('P')+' 暂停、'+kb('M')+' 音效、'+kb(',')+' 切换布局——都在指南里。'+
            '按 '+kb('H')+' 打开看看，随时可以再按 '+kb('H')+' 调出来。',
      hint:'按 H 打开指南',
      setup(){ wipe(); },
      done(){ return c.helped; } },
  ];

  function card(){
    const el=document.getElementById('tut');
    if(!el)return;
    if(!active){ el.classList.add('hide'); return; }
    el.classList.remove('hide');
    const s=STEPS[i];
    const p=s.prog?clamp(s.prog(),0,1):(s.done()?1:0);
    el.innerHTML=
      '<div class="tut-n">训练 '+(i+1)+' / '+STEPS.length+'</div>'+
      '<div class="tut-t">'+s.t+'</div>'+
      '<div class="tut-d">'+s.d()+'</div>'+
      '<div class="tut-goal"><i style="width:'+Math.round(p*100)+'%"></i>'+
        '<span>'+(doneT>0?'完成 ✓':s.hint)+'</span></div>'+
      '<button class="tut-skip" id="tutSkip">跳过训练</button>';
    const sk=document.getElementById('tutSkip');
    if(sk)sk.onclick=()=>{ ac(); Tutor.stop(true); };
  }

  function enter(n){
    i=n; doneT=0; holdT=.35;
    c.moved=0; c.dashes=0; c.kills=0; c.cycles=0; c.heavy=0; c.helped=false;
    prevKills=S.kills; prevRifts=S.riftsClosed||0;
    const P=S.P; P.hp=S.st.maxHp; P.heat=0; P.overheat=0;
    S.scrap=Math.max(S.scrap,600);
    STEPS[i].setup();
    card();
    sfx('pick',.5,1.1);
  }

  return {
    get active(){ return active; },
    start(){
      active=true; started=true; i=0;
      S.tutorial=true;
      S.running=true; S.over=false; S.paused=false; S.victory=false;
      S.waveActive=false; S.rest=0; S.wave=0; S.speed=1;
      S.playerLives=99;
      S.st=freshStats(); S.P=newPlayer(); S.P.hp=S.st.maxHp;
      S.scrap=1200; S.level=1; S.xp=0; S.xpNeed=xpForLevel(1);
      S.towers.length=0; S.drops.length=0; S.pickups.length=0;
      for(const a of ABILITIES)S.abil[a.id]={cd:0};
      wipe();
      S.cam.x=S.P.x; S.cam.y=S.P.y;
      prevDash=false; prevCycle=0; prevShots=S.shots.length;
      prevSalv=S.salvage.length;
      enter(0);
      UI.sync();
    },
    stop(skipped){
      active=false; S.tutorial=false; S.running=false;
      wipe(); S.towers.length=0;
      const el=document.getElementById('tut'); if(el)el.classList.add('hide');
      try{ localStorage.setItem('abyss2_tutorial_done','1'); }catch(e){}
      UI.onTutorialEnd(!!skipped);
    },
    /* every check reads real game state; the tutorial never acts for the player */
    update(dt){
      if(!active)return;
      const P=S.P;
      if(P&&P.alive){
        if(P.moving)c.moved+=Math.hypot(P.vx,P.vy)*dt;
        const d=P.dashT>0;
        if(d&&!prevDash)c.dashes++;
        prevDash=d;
        if(P.cycleLatch>prevCycle+.0001)c.cycles++;
        prevCycle=P.cycleLatch;
        if(P.hp<S.st.maxHp*.5)P.hp=S.st.maxHp;   // nobody fails a tutorial
      }
      if(S.kills>prevKills){ c.kills+=S.kills-prevKills; prevKills=S.kills; }
      for(const s of S.shots) if(s.heavy&&!s._tut){ s._tut=true; c.heavy++; }
      const hv=document.getElementById('ovlHelp');
      if(hv&&!hv.classList.contains('hide'))c.helped=true;

      if(holdT>0){ holdT-=dt; return; }
      if(doneT>0){
        doneT-=dt;
        if(doneT<=0){
          if(i+1>=STEPS.length){ Tutor.stop(false); return; }
          enter(i+1);
        }
        return;
      }
      if(STEPS[i].done()){
        doneT=1.15;
        sfx('level'); shock(S.P.x,S.P.y,.3,2.2,'#6ee7a8',.6);
        text(S.P.x,S.P.y,2,'完成 ✓','#6ee7a8',18);
        card();
        return;
      }
      if(Math.random()<dt*3)card();     // keep the progress bar alive
    },
    redraw(){ if(active)card(); },
    steps(){ return STEPS.length; },
  };
})();
