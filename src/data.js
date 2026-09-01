/* ===================== CONFIG & DATA ===================== */
const TILE=40, COLS=46, ROWS=28, W=COLS*TILE, H=ROWS*TILE;
const CX=W/2, CY=H/2;                 // arena centre = the Core
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rnd=(a=1,b=0)=>b+Math.random()*(a-b);
const pick=a=>a[(Math.random()*a.length)|0];
const dist2=(ax,ay,bx,by)=>{const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy;};
const norm=a=>((a+Math.PI)%TAU+TAU)%TAU-Math.PI;

/* ---------- the Core you must protect ---------- */
/* The Core's own battery was quietly doing 29% of all damage in the run -- more
   than the turrets the player actually built, and needing no input whatsoever.
   It is meant to be the last thing standing between the swarm and the objective,
   not a third of your damage. The 主炮强化 / 增设炮口 upgrades still let a player
   invest back into it if that is the build they want. */
const CORE={hp:3000,r:1.5,guns:4,gunDmg:12,gunRate:.5,gunRange:6.0};

/* ---------- player ---------- */
const PLAYER={
  hp:120, speed:7.4, r:.42,
  dmg:16, rate:6.2, range:10, bulletSp:44, bulletR:.13,
  dashDist:5.2, dashTime:.16, dashCd:1.9,
  turnSpeed:1.75, turnSpeedMax:5.6, turnRamp:.6, turnFine:.38,
  lockTrack:11, assistCone:.26, assistPull:1.9,
  // ultimate: charged by damage dealt, unleashes a steerable annihilation beam
  ultNeed:2400, ultTime:3.6, ultDps:520, ultWidth:1.15, ultRange:16,
  pickup:2.6, respawn:5,
  // manual fire: every shot builds heat, overheat locks you out
  heatPerShot:7.8, heatMax:100, heatCool:30, overheatLock:1.4,
  // right button: hold to charge a piercing slug
  chargeMax:1.05, chargeMinMul:1.1, chargeMaxMul:6.5, chargeHeat:26, chargeCd:.35,

};

/* ---------- arenas ---------- */
/* ---------- biomes: each region gets its own ground, light, props and hazards ---------- */
const BIOMES={
 deck:{ground:'metal',fog:0x05060e,fogD:.019,sunC:0xdfeaff,sunI:2.15,
   hemiSky:0x6b81c4,hemiGnd:0x0b0e1c,hemiI:1.0,rimA:0x35e6ff,rimB:0xff3d8a,
   wall:'#2a3355',trim:'#2f8fb4',dust:[.3,.7,1],
   gTint:'#59637f', gRep:5.0, gNorm:.55, gRough:.92,
   props:['crate','pipe','antenna'],hazard:'steam',hazardN:4,density:.55},
 ruins:{ground:'ruins',fog:0x0b1108,fogD:.021,sunC:0xffeec4,sunI:2.05,
   hemiSky:0x93ad74,hemiGnd:0x11160b,hemiI:1.05,rimA:0x9fe06a,rimB:0xffb45a,
   wall:'#3b4232',trim:'#7aa049',dust:[.7,.9,.5],
   gTint:'#5f6650', gRep:5.4, gNorm:.6, gRough:.95,
   props:['column','rubble','tree'],hazard:'chasm',hazardN:4,density:.32},
 tundra:{ground:'snow',fog:0x0c1424,fogD:.024,sunC:0xeaf6ff,sunI:2.5,
   hemiSky:0x9fc4ec,hemiGnd:0x16203a,hemiI:1.25,rimA:0xbfe4ff,rimB:0x7fa8ff,
   wall:'#43587e',trim:'#a8d8ff',dust:[.8,.92,1],
   gTint:'#8195b8', gRep:5.6, gNorm:.45, gRough:.7,
   props:['icerock','icespire','deadtree'],hazard:'ice',hazardN:5,density:.6},
 forge:{ground:'basalt',fog:0x140704,fogD:.026,sunC:0xffd0a0,sunI:1.7,
   hemiSky:0x8a4a30,hemiGnd:0x1c0b06,hemiI:.95,rimA:0xff6b3d,rimB:0xffc247,
   wall:'#3a231c',trim:'#ff7a3a',dust:[1,.55,.25],
   gTint:'#4b3f3a', gRep:5.2, gNorm:.6, gRough:.9,
   props:['basalt','slag','vent'],hazard:'lava',hazardN:5,density:.42},
 void:{ground:'void',fog:0x0a0616,fogD:.023,sunC:0xd8c0ff,sunI:1.9,
   hemiSky:0x7050b0,hemiGnd:0x0f0a1c,hemiI:1.05,rimA:0xb06cff,rimB:0x35e6ff,
   wall:'#2c2046',trim:'#a06cff',dust:[.75,.55,1],
   gTint:'#4a4166', gRep:5.0, gNorm:.5, gRough:.8,
   props:['shard','monolith','floatrock'],hazard:'corrupt',hazardN:5,density:.6},
};
const MAPS=[
 {id:'ring',name:'钢铁前哨',biome:'deck',desc:'金属甲板，掩体环绕核心，蒸汽喷口不定时爆发',
  obstacles:'ring'},
 {id:'pillars',name:'苔痕废墟',biome:'ruins',desc:'断柱与枯树密布，地面裂开的深渊阻断地面部队',
  obstacles:'pillars'},
 {id:'open',name:'霜蚀冻原',biome:'tundra',desc:'开阔雪原，冰面会让你和敌人一起打滑',
  obstacles:'sparse'},
 {id:'forge',name:'熔炉回廊',biome:'forge',desc:'玄武岩长墙切割战场，岩浆池灼烧一切地面单位',
  obstacles:'corridor'},
 {id:'gate',name:'终焉之门',biome:'void',desc:'虚空裸地，侵蚀区加速敌人并腐蚀你的护甲',
  obstacles:'arena'},
];

/* ---------- destructible scenery: every prop is a thing you can use ---------- */
const PROPS={
 crate:    {n:'弹药箱',   hp:70,  scrap:11, fx:'blast',  boom:1, d:'⚠ 击毁会剧烈殉爆，重创周围一大片敌人'},
 pipe:     {n:'高压管道', hp:90,  scrap:9, fx:'steam',  d:'击毁喷出高压蒸汽，灼伤并减速'},
 antenna:  {n:'信号塔',   hp:80,  scrap:12, fx:'emp',    d:'击毁释放电磁脉冲，击晕周围敌人'},
 column:   {n:'断柱',     hp:150, scrap:12, fx:'rubble', d:'倒塌后碎石堆减速经过的敌人'},
 rubble:   {n:'碎石堆',   hp:60,  scrap:8,  fx:'none',   d:'普通掩体，可清除以打开射界'},
 tree:     {n:'枯树',     hp:50,  scrap:6,  fx:'none',   d:'普通掩体，可清除以打开射界'},
 icerock:  {n:'冰封巨岩', hp:110, scrap:12, fx:'frost',  d:'碎裂时冻结并减速周围敌人'},
 icespire: {n:'冰晶尖塔', hp:80,  scrap:14, fx:'frost',  d:'碎裂时冻结并减速周围敌人'},
 deadtree: {n:'冻僵枯木', hp:50,  scrap:6,  fx:'none',   d:'普通掩体'},
 basalt:   {n:'玄武岩柱', hp:140, scrap:10, fx:'none',   d:'坚固掩体'},
 slag:     {n:'熔渣堆',   hp:90,  scrap:14, fx:'lava',   boom:1, d:'⚠ 击毁后熔渣喷涌，形成岩浆池'},
 vent:     {n:'排气塔',   hp:100, scrap:16, fx:'fire',   boom:1, d:'⚠ 击毁喷发烈焰，点燃周围敌人'},
 shard:    {n:'虚空碎晶', hp:80,  scrap:16, fx:'void',   d:'击碎释放虚空脉冲，并短暂强化你的火力'},
 monolith: {n:'方尖碑',   hp:170, scrap:22, fx:'void',   d:'击碎释放虚空脉冲，并短暂强化你的火力'},
 floatrock:{n:'浮空岩',   hp:90,  scrap:12, fx:'crush',  d:'击毁后砸落，重创下方敌人'},
};

/* ---------- terrain hazards ---------- */
const HAZARD={
 lava:  {r:[1.5,2.6], dps:26,  c:'#ff5a20', name:'岩浆池'},
 ice:   {r:[2.2,3.6], c:'#bfe4ff', name:'冰面'},
 /* A solid disc that did nothing but take up room, and swallowed any loot that
    landed in it. It now has three uses: you can dash across it, anything knocked
    into it falls, and drops get nudged back out. */
 chasm: {r:[1.4,2.4], c:'#6a4aa0', name:'深渊裂口', solid:true, leapable:true, pit:true},
 steam: {r:[1.3,2.0], dmg:34, c:'#cfe6ff', name:'蒸汽喷口', period:4.2, warn:1.0, burst:.55},
 corrupt:{r:[1.8,3.0], dps:11, c:'#b06cff', name:'侵蚀区'},
};

/* ---------- campaign: five regions, then the finale ---------- */
const STAGES=[
 /* slots: how many turrets this region lets you hold at once. Tuned per region
    rather than a flat +1, because the regions are not equally hard: region one is
    a five-wave tutorial, region three onwards is where the counts climb. */
 {map:'ring',    name:'第一区 · 前哨',   waves:5, slots:4, desc:'金属甲板 · 当心蒸汽喷口'},
 {map:'pillars', name:'第二区 · 废墟',   waves:6, slots:5, desc:'苔痕断柱 · 深渊裂口阻断地面部队'},
 {map:'open',    name:'第三区 · 冻原',   waves:7, slots:7, desc:'开阔雪原 · 冰面让所有人打滑'},
 {map:'forge',   name:'第四区 · 熔炉',   waves:7, slots:8, desc:'玄武岩长墙 · 岩浆池持续灼烧'},
 {map:'gate',    name:'终区 · 终焉之门', waves:5, slots:9, desc:'虚空裸地 · 深渊主宰在此等待', finale:true},
];
/* The original design priced turret spam instead of capping it -- "spamming is
   possible, it is just a bad deal". In practice a well-built line did 70% of all
   damage and the player was a spectator to their own run. A hard cap makes each
   emplacement a decision and puts the fighting back on you; the price ramp stays,
   but gently, since the cap is now the real constraint. */
const BUILD_STEP=.14;
const TOWER_SLOTS_BASE=4;
/* Extra emplacements beyond the region's allowance come from two places and share
   one ceiling: 扩容基座 bought with scrap, or 据点扩建 earned by closing rifts.
   Rifts are the only thing in the game turrets cannot touch -- closing one means
   leaving the defence line for ~10 seconds to kill the thing spawning the wave --
   so it is the right price for the one resource that decides how much of the
   fighting your turrets get to do. Earning them frees the scrap for upgrades. */
const SLOT_BONUS_MAX=3;
const RIFT_SLOT_STEPS=[2,4,6];   // rifts to close for the 1st / 2nd / 3rd earned slot
const TOWER_HP=[620,940,1300,1760], TOWER_HP_ELITE=520;
const CORE_UP=[
 {id:'logi',  n:'工程模块', gl:'⚙', d:'炮塔造价增幅 -25%（可叠加）',  cost:230, step:95,  max:4},
 {id:'hp',    n:'装甲板',   gl:'⬢', d:'核心最大生命 +700',        cost:220, step:90,  max:8},
 {id:'dmg',   n:'主炮强化', gl:'✦', d:'核心炮台伤害 +35%',        cost:200, step:80,  max:6},
 {id:'guns',  n:'增设炮口', gl:'⁙', d:'核心炮口 +1（射速提升）',   cost:280, step:120, max:4},
 {id:'shield',n:'力场护盾', gl:'◈', d:'核心获得可再生护盾 +12%',   cost:300, step:110, max:5},
 {id:'regen', n:'维修单元', gl:'✚', d:'核心每秒回复 +9',          cost:240, step:90,  max:5},
 {id:'store', n:'传送储备', gl:'⬡', d:'每个新区域额外 +220 碎片',  cost:250, step:90,  max:4},
 {id:'slot',  n:'扩容基座', gl:'▣', d:'炮塔上限 +1（与「据点扩建」共享 +3 上限）', cost:340, step:210, max:3},
 /* Lives were hard-capped at the difficulty's starting count and could never grow,
    and the player's own armour and gun only improved through random level-up cards.
    These three are the steady, purchasable line: you can always work toward them. */
 {id:'life',  n:'备用信标', gl:'✜', d:'命数上限 +1，并立即补满一条', cost:400, step:300, max:3},
 {id:'armor', n:'个人装甲', gl:'⛊', d:'你受到的伤害 -8%（可叠加）',  cost:260, step:120, max:5},
 {id:'power', n:'武器校准', gl:'✧', d:'你的武器伤害 +12%（可叠加）', cost:280, step:130, max:6},
];
function coreUpCost(u,lv){ return u.cost+u.step*lv; }
const DIFFS=[
 {id:'easy',name:'新兵',desc:'4 条命 · 核心 3600 HP · 起始 150 碎片 · 敌人 -20% 生命',core:1.2,scrap:150,hp:.8,rw:1.15,lives:4},
 {id:'norm',name:'老兵',desc:'3 条命 · 核心 3000 HP · 起始 110 碎片 · 标准强度',core:1,scrap:110,hp:1,rw:1,lives:3},
 {id:'hard',name:'深渊',desc:'2 条命 · 核心 2200 HP · 起始 95 碎片 · 敌人 +35% 生命',core:.73,scrap:95,hp:1.35,rw:.95,lives:2},
];

/* ---------- buildable turrets (auto-defend the Core) ---------- */
const TOWERS={
 arrow:{name:'速射弩塔',role:'ARMOUR SHRED',power:1,unlock:0,shape:[1.0,1.35,1.0],cost:45,c:'#7ee787',air:true,hotkey:1,
  desc:'廉价高频的单体射手，对<b>空中单位</b>同样有效。每次命中<b>削甲</b>，'+
       '把重甲目标一层层剥开给别的炮塔打。',
  dmg:[11,17,25,35],rate:[2.0,2.3,2.6,2.9],range:[4.2,4.5,4.8,5.2],up:[55,100,175],
  shredHit:[.6,.9,1.3,1.8],
  elites:[{n:'疾风连弩',c:300,d:'射速 ×2.6，命中<b>无视 12 点护甲</b>并额外削甲 2 点',rate:2.6,pen:12,shredHit:2},
          {n:'穿甲弩炮',c:320,d:'箭矢<b>贯穿</b>直线上的 3 个敌人，伤害 ×1.5',dmg:1.5,pierce:3}]},
 cannon:{name:'重型火炮',role:'SPLASH · GROUND',power:2,unlock:0,shape:[1.45,0.95,1.45],cost:130,c:'#ffa14a',air:false,hotkey:2,
  desc:'抛射炮弹造成<b>范围爆炸</b>，把敌人<b>轰飞并打断</b>它们的动作，无法打空中。'+
       '推开正在拆塔或围核心的一群人最好用。',
  dmg:[34,52,76,106],rate:[.8,.86,.92,1.0],range:[4.4,4.7,5.0,5.4],splash:[1.3,1.45,1.6,1.8],up:[100,175,300],
  knock:[9,11,13,16],stun:[.10,.12,.14,.18],
  elites:[{n:'集束轰炸',c:460,d:'每次发射 3 发散射炮弹',cluster:3,dmg:.62},
          {n:'攻城臼炮',c:500,d:'伤害 ×2.1，爆炸范围 ×1.5，并<b>击晕</b> 0.35 秒',dmg:2.1,splash:1.5,rate:.72,stun:.35}]},
 frost:{name:'霜寒之柱',role:'CONTROL',power:1,unlock:1,shape:[0.95,1.55,0.95],cost:95,c:'#5fd0ff',air:true,hotkey:3,
  desc:'冰弹落地形成<b>寒冰领域</b>，持续减速，并有几率<b>直接冻结</b>。'+
       '被冻住的东西打不动你的核心，也走不到你面前。',
  dmg:[13,20,29,40],rate:[1.3,1.4,1.5,1.6],range:[4.0,4.3,4.6,5.0],splash:[1.1,1.2,1.3,1.45],
  slow:[.45,.53,.62,.72],freeze:[.12,.16,.20,.26],up:[75,130,220],
  elites:[{n:'绝对零度',c:390,d:'25% 概率<b>冻结</b>目标 1.1 秒',freeze:.25,slow:1.2},
          {n:'极寒领域',c:370,d:'转为持续光环：范围内敌人<b>永久减速</b>',aura:true,range:1.35}]},
 tesla:{name:'电弧线圈',role:'CHAIN',power:2,unlock:2,shape:[0.9,1.8,0.9],cost:215,c:'#8b6cff',air:true,hotkey:4,
  desc:'闪电在敌人之间<b>连锁跳跃</b>，每一跳都会<b>短暂麻痹</b>。密集虫群的克星。',
  dmg:[25,36,52,72],rate:[1.2,1.3,1.4,1.5],range:[4.0,4.3,4.6,4.9],chain:[2,3,3,4],
  stun:[.10,.12,.14,.18],up:[130,215,355],
  elites:[{n:'超载电网',c:540,d:'连锁次数提升至 8，衰减大幅降低',chain:8,falloff:.88},
          {n:'磁暴线圈',c:580,d:'伤害 ×1.45，每次命中<b>击晕</b> 0.25 秒',dmg:1.45,stun:.25}]},
 flame:{name:'炽炎喷口',role:'DOT · GROUND',power:2,unlock:1,shape:[1.35,0.8,1.35],cost:115,c:'#ff6b3d',air:false,hotkey:5,
  desc:'持续火焰扇面并叠加<b>灼烧</b>。伤害与灼烧都<b>无视护甲</b>，'+
       '扇面随等级变宽，是贴脸守核心的专家。',
  dmg:[34,52,76,108],rate:[6,6,6,6],range:[4.2,4.7,5.2,5.8],burn:[14,21,30,42],
  cone:[.85,1.0,1.15,1.35],up:[95,160,270],
  elites:[{n:'熔岩喷射',c:430,d:'在地面留下<b>熔岩池</b>，持续灼烧经过的地面单位',magma:true},
          {n:'烈焰风暴',c:450,d:'转为 360° 环形灼烧，射程 ×1.2',ring:true,range:1.2,dmg:.8}]},
 sniper:{name:'轨道狙击',role:'LONG RANGE',power:3,unlock:3,shape:[0.8,2.0,0.8],cost:340,c:'#ffd54a',air:true,hotkey:6,
  desc:'超远射程的单发重狙，<b>无视护甲</b>，默认优先攻击最强目标。'+
       '射速极慢——它负责点掉一个硬目标，清不了场。',
  dmg:[70,104,150,212],rate:[.42,.46,.50,.55],range:[9,9.6,10.2,11],up:[165,280,470],pierceArmor:true,
  elites:[{n:'轨道炮',c:680,d:'光束<b>贯穿</b>整条直线上的所有敌人',rail:true,dmg:1.15},
          {n:'致命标记',c:660,d:'30% 概率暴击 ×3，并<b>标记</b>目标使其受伤 +30%',crit:.3,mark:true}]},
 toxin:{name:'腐毒喷雾',role:'DOT · ARMOR',power:2,unlock:2,shape:[1.25,1.05,1.25],cost:180,c:'#a6e22e',air:true,hotkey:7,
  desc:'释放<b>自主漂移的毒云</b>，在场上游荡，经过的敌人中毒、削甲并减速。毒伤无视护甲。',
  dmg:[9,13,19,26],rate:[1.1,1.2,1.3,1.4],range:[4.2,4.5,4.8,5.2],splash:[1.3,1.45,1.6,1.75],
  poison:[12,18,26,36],shred:[3,4,5,6],up:[110,185,315],
  elites:[{n:'瘟疫源体',c:480,d:'中毒者死亡时<b>扩散</b>毒素给周围敌人',plague:true},
          {n:'腐蚀酸液',c:440,d:'削甲翻倍，并使目标<b>受到的所有伤害 +35%</b>',shred:2,vuln:.35}]},
 beacon:{name:'增幅信标',role:'SUPPORT',power:2,unlock:3,shape:[0.75,1.15,0.75],cost:275,c:'#35e6ff',air:false,hotkey:8,support:true,
  desc:'自身不攻击。<b>大幅强化</b>光环内所有炮塔的伤害与射速。',
  range:[3.6,4.0,4.4,4.9],buffDmg:[.15,.23,.31,.42],buffRate:[.12,.19,.26,.36],up:[150,250,420],
  elites:[{n:'战术核心',c:580,d:'额外提供 +20% 射程，光环内击杀<b>碎片 +25%</b>',buffRange:.2,scrap:.25},
          {n:'过载核心',c:600,d:'射速加成翻倍，伤害加成 ×1.3',buffRate:2,buffDmg:1.3}]},
};
const TKEYS=Object.keys(TOWERS);

/* ---------- enemies: free-roaming, no rails ----------
   aim: 'core' marches on the Core, 'player' hunts you, 'both' takes whichever is closer  */
const ENEMIES={
 grunt:{name:'深渊步兵',hp:52,sp:2.15,armor:1,xp:4,scrap:2,r:11,c:'#ff6b8a',poiseFrac:.60,breakStun:.65,breakAggro:12.6,poise:1,recoil:.30,siege:1.4,sap:0.1,aim:'core',atk:9,atkRate:1.0,atkR:.55},
 runner:{name:'疾行者',hp:38,sp:4.0,armor:0,xp:5,scrap:2,r:9,c:'#ffd54a',poiseFrac:.50,breakStun:.60,breakAggro:12.6,poise:.8,recoil:.60,aim:'player',atk:7,atkRate:.75,atkR:.5},
 swarm:{name:'虫群',hp:22,sp:3.2,armor:0,xp:2,scrap:1,r:7,c:'#c98cff',poiseFrac:.50,breakStun:.55,breakAggro:10.3,poise:.5,recoil:.35,aim:'both',atk:4,atkRate:.6,atkR:.45},
 brute:{name:'重装兵',hp:205,sp:1.5,armor:14,xp:14,scrap:7,r:15,c:'#8b93b8',poiseFrac:.34,breakStun:1.40,breakAggro:10.3,poise:3.2,siege:2.6,sap:0.7,shot:{dmg:24,rate:3.0,range:6.5,sp:12,style:'mortar',n:1},aim:'core',atk:34,atkRate:1.5,atkR:.75},
 flyer:{name:'浮空体',hp:80,sp:3.0,armor:0,xp:8,scrap:4,r:11,c:'#5fd0ff',fly:true,poiseFrac:.60,breakStun:.70,breakAggro:11.5,poise:.9,recoil:.30,shot:{dmg:13,rate:2.6,range:6.0,sp:17,style:'bolt',n:1},aim:'core',atk:12,atkRate:1.1,atkR:.6},
 shooter:{name:'腐蚀射手',hp:70,sp:1.9,armor:2,xp:9,scrap:4,r:11,c:'#e07be0',poiseFrac:.55,breakStun:.80,breakAggro:11.5,poise:.9,siege:3.0,sap:0.22,aim:'both',
   ranged:true,atk:14,atkRate:1.6,atkR:6.5,keepAway:5.2},
 /* the only heavy with no ranged answer at all: at 1.9 tiles/s against a 7.4 player
    it could never land a hit, so it read as a free kill. It gets a telegraphed
    shield charge instead of a gun -- dodgeable, but it closes the gap. */
 shield:{name:'盾卫',hp:130,shield:140,sp:1.9,armor:5,xp:12,scrap:6,r:13,c:'#4ad2c4',poiseFrac:.52,breakStun:1.10,breakAggro:10.3,poise:2.2,siege:2.2,sap:0.28,aim:'core',atk:18,atkRate:1.2,atkR:.65,
   charge:{windup:.55,sp:9,time:.7,dmg:1.6,cd:[4.5,8],range:[2.4,9]}},
 healer:{name:'亵渎祭司',hp:150,sp:1.8,armor:3,xp:16,scrap:7,r:12,c:'#7ef0a8',poiseFrac:.55,breakStun:.90,breakAggro:11.5,poise:1.2,aim:'core',
   heal:22,healR:3.2,atk:6,atkRate:1.4,atkR:.6,keepAway:3.4},
 splitter:{name:'裂变体',hp:170,sp:2.0,armor:2,xp:12,scrap:6,r:14,c:'#ff9f45',poiseFrac:.65,breakStun:.95,breakAggro:10.3,poise:1.4,recoil:.25,shot:{dmg:18,rate:3.4,range:5.5,sp:11,style:'lob',n:2},siege:2.0,sap:0.2,aim:'core',
   split:['spawn','spawn','spawn'],atk:14,atkRate:1.1,atkR:.65},
 spawn:{name:'裂片',hp:46,sp:3.4,armor:0,xp:2,scrap:1,r:8,c:'#ffbe7a',poiseFrac:.50,breakStun:.55,breakAggro:10.3,poise:.5,recoil:.35,aim:'both',atk:6,atkRate:.8,atkR:.45},
 jug:{name:'攻城巨兽',scale:1.2,hp:1000,sp:1.15,armor:26,xp:34,scrap:19,r:19,c:'#6f7aa8',poiseFrac:.17,breakStun:1.80,breakAggro:11.5,poise:9,siege:3.2,sap:1.0,shot:{dmg:34,rate:3.8,range:9.5,sp:10,style:'siege',n:1},aim:'core',
   noStun:true,atk:70,atkRate:2.0,atkR:.95},
 boss:{name:'深渊领主',scale:1.5,hp:4400,sp:1.25,armor:22,xp:150,scrap:135,r:26,c:'#ff3d8a',poiseFrac:.085,breakStun:1.50,breakAggro:9.2,poise:22,shot:{dmg:27,rate:2.4,range:11,sp:15,style:'volley',n:3},aim:'both',
   noStun:true,slowRes:.6,boss:true,aura:1.25,auraR:4,atk:95,atkRate:1.6,atkR:1.3},
};

/* ---------- elite affixes: ordinary units promoted into real threats ---------- */
const AFFIX={
 berserk:{n:'狂暴',c:'#ff5a3d',hp:1.9,sp:1.45,atk:1.35,ai:'hunter',d:'直冲你而来，并会突进扑击'},
 bulwark:{n:'铁壁',c:'#8fa4d8',hp:2.2,armor:1.9,sp:.9,ai:'breaker',d:'优先拆你的炮塔 · 蓄力重击无视你的减伤，但蓄力时可被打断'},
 revenant:{n:'再生',c:'#7ef0a8',hp:2.1,regen:.028,ai:'coward',d:'受伤就后撤回血，必须追上去打死'},
 volatile:{n:'不稳定',c:'#ffc247',hp:1.8,sp:1.25,death:'blast',ai:'bomber',d:'自杀式冲锋，贴近即引爆'},
 warden:{n:'督战',c:'#c98cff',hp:2.2,aura:3.6,ai:'commander',d:'躲在队伍后方指挥，加速并减伤友军'},
 phase:{n:'相位',c:'#5fd0ff',hp:1.9,sp:1.2,dodge:.28,ai:'blink',d:'会闪避，并不断瞬移到你身边'},
};
const AFFIX_KEYS=Object.keys(AFFIX);
/* one named heavy per region, on the wave before the stage boss */
const MINIBOSS={
 ring:   {base:'brute',   n:'铁颚 · 破障者', affix:'bulwark', hp:3.2, scale:1.35, scrap:78, xp:90},
 pillars:{base:'splitter',n:'蔓生母株',     affix:'revenant',hp:3.0, scale:1.4,  scrap:85, xp:95},
 open:   {base:'shield',  n:'霜髓卫士',     affix:'warden',  hp:3.2, scale:1.35, scrap:90, xp:100},
 forge:  {base:'jug',     n:'熔心',         affix:'volatile',hp:2.4, scale:1.25, scrap:110, xp:120},
 gate:   {base:'jug',     n:'深渊执政官',   affix:'berserk', hp:2.8, scale:1.3,  scrap:130, xp:140},
};

/* ---------- field pickups: short-lived, worth running for ---------- */
const PICKUPS={
 medkit:{n:'医疗包',   gl:'✚', c:'#6ee7a8', life:26, d:'立即回复一半的最大生命'},
 coolant:{n:'冷却剂',  gl:'≋', c:'#5fd0ff', life:24, d:'枪管冷却，22 秒内完全不产生热量'},
 rage:  {n:'狂怒剂',   gl:'✦', c:'#ff5a3d', life:22, d:'25 秒内武器伤害 +80%、射速 +25%'},
 shield:{n:'力场核心', gl:'◈', c:'#8fa4d8', life:24, d:'获得可吸收 260 点伤害的护盾'},
 stasis:{n:'时停装置', gl:'❄', c:'#bfe4ff', life:20, d:'全场敌人冻结 6.5 秒'},
 magnet:{n:'磁暴',     gl:'◌', c:'#ffc247', life:22, d:'吸取全场掉落物，并 20 秒内扩大拾取范围'},
 mend:  {n:'核心修补', gl:'⬢', c:'#2f6bff', life:28, d:'核心回复 14% 生命'},
};
const PICKUP_KEYS=Object.keys(PICKUPS);

/* ---------- waves: spawn at the arena rim, from every side ---------- */
function eliteCount(w){ return w<4?0:Math.min(6,1+Math.floor((w-4)/3)); }
/* Each region ends on its own boss, with its named heavy the wave before.
   This used to key off the global wave number (w%5), but the regions are 5/6/7/7/5
   waves long, so from region two onward the cadence drifted: the boss landed
   mid-region and the region's *final* wave was a bigger ordinary wave than the
   boss wave itself. wis = 1-based wave inside the region, wlen = region length. */
const BOSSPLAN=[
 {t:'jug', n:1},   // 第一区 · 攻城巨兽
 {t:'jug', n:1},   // 第二区 · 攻城巨兽（更硬，但还不是领主）
 {t:'boss',n:1},   // 第三区 · 深渊领主
 {t:'boss',n:1},   // 第四区
 {t:'boss',n:2},   // 终区
];
function waveComp(w,wis,wlen,stage){
  if(wis===undefined){ wis=((w-1)%5)+1; wlen=5; stage=Math.floor((w-1)/5); }
  const out=[]; const add=(t,n,g,d=0,o)=>out.push(Object.assign({t,n,g,d},o||{}));
  const isBoss = wis>=wlen;
  // Region one is five waves long, so a named heavy at wave 4 and the region boss
  // at wave 5 put two heavies back to back in the tutorial region -- half of all
  // measured runs ended right there. The champion joins from region two on.
  const isMini = wlen>=3 && wis===wlen-1 && stage>=1;
  if(isMini)add('__miniboss',1,0,2.5);          // the named heavy, one wave before the boss
  const el=eliteCount(w);
  if(el)add('__elite',el,2.2,3.5);
  if(isBoss){
    const plan=BOSSPLAN[Math.min(stage,BOSSPLAN.length-1)];
    add(plan.t,plan.n,2.2,0);
    add('grunt',8+w*1.4|0,.3,1.5);
    add('runner',4+w*.5|0,.35,4);
    if(w>=10)add('shield',2+Math.floor(w/8),.8,6);
    if(w>=15)add('flyer',4+Math.floor(w/6),.5,3);
    return out;
  }
  /* Region one ends on 23 units; region two used to open on 43 -- a doubling that
     lands the wave after a teleport refunds and removes every turret you own.
     Ramp the trash counts more gently through the early regions. */
  /* Region three was putting 38-47 enemies on screen at once, ~30 of them inside
     your own view, on top of 800 particles and 250 loot orbs. At that density you
     are not fighting anything, you are spraying into soup. Fewer bodies, so each
     one is a thing you can see and react to. */
  // the gap floors were .16s, so a late wave arrived faster than it could die and
  // piled up on screen; same content, spread out enough to read
  const pk=packScale(w), sq=n=>Math.max(1,Math.round(n/pk));
  add('grunt',sq(Math.min(24,4+w*1.15|0)),Math.max(.32,.55-w*.014));
  if(w>=2)add('runner',sq(Math.min(14,1+w*.6|0)),Math.max(.34,.45-w*.012),1.5);
  if(w>=3)add('swarm',sq(Math.min(26,3+w*1.15|0)),Math.max(.19,.22-w*.006),2.5);
  if(w>=5)add('flyer',Math.min(20,1+(w-4)*.9|0),Math.max(.22,.5-w*.012),3.2);
  if(w>=6)add('shooter',Math.min(14,1+(w-5)*.6|0),.9,4.5);
  if(w>=7)add('brute',Math.min(16,1+(w-6)*.6|0),1.0,2.0);
  if(w>=9&&w%2===1)add('shield',Math.min(14,1+(w-8)*.5|0),.9,5.0);
  if(w>=11)add('splitter',Math.min(12,1+(w-10)*.45|0),1.1,6.0);
  if(w>=13&&w%2===0)add('healer',Math.min(7,1+(w-12)*.3|0),1.5,3.5);
  if(w>=16&&w%3===1)add('jug',Math.min(4,1+Math.floor((w-15)/4)),2.0,7.0);
  return out;
}
/* A rift used to go inert the moment its scripted queue drained -- it sat there
   as scenery for the rest of the wave, so closing one late bought you nothing and
   the "cuts off reinforcements" promise was mostly false. An open rift now keeps
   producing. The budget is finite so a wave still terminates, but it is big enough
   that leaving one open for a whole wave genuinely costs you. */
const RIFT={hp:400,hpPerWave:.40,r:1.15,scrap:150,xp:110,
  overflowPool:['grunt','runner','swarm'],
  overflowEvery:w=>clamp(5.4-w*.13,2.4,5.4),
  overflowBudget:w=>3+Math.floor(w*.7)};
const SALVAGE={amount:80,time:2.9,r:1.5};
const LINK_R=3.3;
/* Measured over region 1-3: enemy health climbed 151% while the player's own gun
   climbed 12%, and the extra exponential term switched on at wave 10 -- exactly
   where region two ends. That is where runs were dying. Start it later. */
/* Late waves expressed difficulty as more bodies, and 40+ identical grunts is not
   a fight, it is soup you spray into. Past the early regions the same health
   budget buys fewer, tougher trash units instead: counts are divided by this and
   each survivor's health is multiplied by it, so the wave weighs the same but you
   can actually see the thing you are shooting. */
const TRASH=['grunt','runner','swarm'];
function packScale(w){ return clamp(1+(w-7)*.13,1,2.8); }
function hpScale(w){return (1+.105*(w-1))*Math.pow(1.035,Math.max(0,w-14));}
function spScale(w){return Math.min(1.45,1+.008*Math.max(0,w-4));}

/* ---------- level-up cards ---------- */
const CARDS=[
 {id:'dmg',   n:'火力强化', gl:'✦', d:'武器伤害 +20%',            max:9, ap:s=>s.dmg*=1.20},
 {id:'rate',  n:'高速循环', gl:'⟳', d:'武器射速 +16%',            max:8, ap:s=>s.rate*=1.16},
 {id:'pierce',n:'穿透弹头', gl:'➤', d:'子弹额外贯穿 1 个敌人',     max:4, ap:s=>s.pierce+=1},
 {id:'multi', n:'散射枪管', gl:'⋔', d:'每次射击多发射 1 发子弹',   max:4, ap:s=>s.multi+=1},
 {id:'explo', n:'爆裂弹药', gl:'✸', d:'子弹命中时小范围爆炸',      max:3, ap:s=>{s.explo+=.55;}},
 {id:'vent',  n:'散热鳍片', gl:'≋', d:'每发子弹产生的热量 -22%',   max:4, ap:s=>s.heatPerShot*=.78},
 {id:'crit',  n:'弱点洞察', gl:'✜', d:'+15% 概率造成 2.2 倍暴击',  max:4, ap:s=>s.crit+=.15},
 {id:'speed', n:'疾风步',   gl:'»', d:'移动速度 +12%',            max:5, ap:s=>s.speed*=1.12},
 {id:'dash',  n:'强化冲刺', gl:'⇉', d:'冲刺冷却 -22%，距离 +12%',  max:4, ap:s=>{s.dashCd*=.78;s.dashDist*=1.12;}},
 {id:'shock', n:'冲击波',   gl:'◎', d:'冲刺时对沿途敌人造成伤害',   max:3, ap:s=>s.shock+=40},
 {id:'hp',    n:'生命源质', gl:'♥', d:'最大生命 +30 并立即回满',    max:6, ap:s=>{s.maxHp+=30;}},
 {id:'regen', n:'再生组织', gl:'✚', d:'每秒回复 1.6 点生命',       max:4, ap:s=>s.regen+=1.6},
 {id:'leech', n:'汲取',     gl:'❖', d:'造成伤害的 4% 转化为生命',   max:4, ap:s=>s.leech+=.04},
 {id:'thorn', n:'荆棘装甲', gl:'✳', d:'近战攻击你的敌人受到反伤',   max:3, ap:s=>s.thorn+=26},
 {id:'armor', n:'复合装甲', gl:'⬢', d:'受到的伤害 -12%',           max:4, ap:s=>s.dr=1-(1-s.dr)*0.88},
 {id:'drone', n:'环绕无人机',gl:'◈', d:'增加 1 架环绕无人机，接触伤害',max:4, ap:s=>s.drones+=1},
 {id:'magnet',n:'磁力场',   gl:'◌', d:'拾取范围 +60%',             max:3, ap:s=>s.pickup*=1.6},
 {id:'repair',n:'修复无人机',gl:'⚒', d:'核心每秒回复 10 点生命',    max:4, ap:s=>s.coreRegen+=10},
 {id:'twr_d', n:'塔基共鸣', gl:'▲', d:'所有炮塔伤害 +16%',         max:6, ap:s=>s.twrDmg+=.16},
 {id:'twr_r', n:'超频塔基', gl:'▼', d:'所有炮塔射速 +16%',         max:6, ap:s=>s.twrRate+=.16},
 {id:'thrift',n:'战地回收', gl:'⬡', d:'炮塔造价 -12%，碎片掉落 +15%',max:4, ap:s=>{s.cost*=.88;s.scrapGain+=.15;}},
];
function xpForLevel(l){ return Math.round(40*Math.pow(l,1.42)+40); }
// Levelling stays frequent so the XP bar keeps paying out, but the *choice* is rarer:
// a card on the first three levels (you build an identity in region 1), then every
// other level. The levels in between hand out a flat stat bump instead.
function levelGivesCard(l){ return l<=6 || l%2===0; }
const LEVEL_BONUS={hp:.08, dmg:.10};

const ABILITIES=[
 /* Cooldowns used to outlast a whole wave cycle, so a tactical skill was really a
    once-per-wave lottery: mistime it and the effect burned down on an empty field.
    Shorter cooldowns, longer effects -- and S.overT now pauses out of combat. */
 {id:'strike',n:'轨道轰炸',gl:'☄',key:'Z',cd:28,aim:true,r:3.4,dmg:460,desc:'在准星处降下毁灭打击'},
 {id:'freeze',n:'绝对冰封',gl:'❄',key:'X',cd:36,aim:false,desc:'全场敌人冻结 4.5 秒'},
 {id:'over',  n:'火力过载',gl:'⚡',key:'C',cd:34,aim:false,desc:'炮塔与武器射速 +150%，期间枪管不再过热，持续 15 秒'},
];
