/* ===================== PROCEDURAL MODELS ===================== */
const G={}, MATC={};
function geo(k,f){ return G[k]||(G[k]=f()); }
const _TR={};
function texRepeat(t,r){
  if(!t)return null; if(r===1)return t;
  const k=t.uuid+'@'+r; if(_TR[k])return _TR[k];
  const c=t.clone(); c.needsUpdate=true; c.repeat.set(r,r); c.wrapS=c.wrapT=THREE.RepeatWrapping;
  return _TR[k]=c;
}
function mat(color,o={}){
  const key=color+JSON.stringify(o);
  if(MATC[key]&&!o.unique)return MATC[key];
  const rp=o.rep||1;
  const m=new THREE.MeshStandardMaterial({
    color:new THREE.Color(color),
    roughness:o.rough!==undefined?o.rough:.62,
    metalness:o.metal!==undefined?o.metal:.35,
    emissive:new THREE.Color(o.em||'#000000'),
    emissiveIntensity:o.ei!==undefined?o.ei:1,
    flatShading:!!o.flat,
    transparent:!!o.trans, opacity:o.op!==undefined?o.op:1,
    envMapIntensity:o.envi!==undefined?o.envi:1.15,
  });
  if(o.tex==='panel'){ m.map=texRepeat(TEX.panel,rp); m.normalMap=texRepeat(TEX.panelN,rp);
    m.roughnessMap=texRepeat(TEX.panelR,rp); m.normalScale=new THREE.Vector2(o.ns||.85,o.ns||.85); }
  else if(o.tex==='rock'){ m.map=texRepeat(TEX.rock,rp); m.normalMap=texRepeat(TEX.rockN,rp);
    m.normalScale=new THREE.Vector2(o.ns||1.2,o.ns||1.2); }
  else if(o.tex==='hazard'){ m.map=texRepeat(TEX.hazard,rp); }
  if(!o.unique)MATC[key]=m;
  return m;
}
/* Fresnel rim light. Units used to be lit only by the sun and a dim hemisphere, so
   their unlit sides went black and a 20-pixel enemy read as a smudge on the deck.
   A view-dependent glow along the silhouette, in the unit's own colour, is what
   makes a small model pop against the ground at this camera distance. */
function rimLight(m,color,strength=1.0,power=2.6){
  if(!m||!m.isMeshStandardMaterial)return m;
  const col=new THREE.Color(color);
  m.userData.rim={col,strength,power};
  m.onBeforeCompile=sh=>{
    sh.uniforms.uRimC={value:col}; sh.uniforms.uRimI={value:strength}; sh.uniforms.uRimP={value:power};
    sh.fragmentShader=sh.fragmentShader
      .replace('#include <common>','#include <common>\nuniform vec3 uRimC; uniform float uRimI; uniform float uRimP;')
      .replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n'+
        '{ vec3 nV=normalize(vViewPosition); float fr=pow(1.0-clamp(dot(normal,nV),0.0,1.0),uRimP);\n'+
        '  totalEmissiveRadiance += uRimC*fr*uRimI; }');
  };
  m.customProgramCacheKey=()=>'rim';
  return m;
}
function rimTree(g,color,strength,power){
  g.traverse(o=>{ if(o.isMesh&&o.material&&o.material.isMeshStandardMaterial)rimLight(o.material,color,strength,power); });
}
function glowMat(color,op=.9,side){
  return new THREE.MeshBasicMaterial({color:new THREE.Color(color),transparent:true,opacity:op,
    blending:THREE.AdditiveBlending,depthWrite:false,side:side||THREE.FrontSide});
}
function m3(g,m,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;return o;}

const DARK='#2c3457', DARK2='#454e7d', METAL='#7681ad';
/* a turned profile reads far richer than a bare cylinder */
function lathe(pts,seg=20){
  return new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[0],p[1])),seg);
}
function contactShadow(g,r,y){
  const m0=new THREE.Mesh(geo('blobG',()=>new THREE.PlaneGeometry(1,1)),
    new THREE.MeshBasicMaterial({map:TEX.blob,transparent:true,depthWrite:false,opacity:.85}));
  m0.rotation.x=-Math.PI/2; m0.position.y=(y||0)+.02; m0.scale.setScalar(r*2.6);
  m0.renderOrder=-1; g.add(m0); return m0;
}
const _MX={};
function mixc(a,b,t){
  const k=a+b+t; if(_MX[k])return _MX[k];
  const A=new THREE.Color(a), B=new THREE.Color(b);
  return _MX[k]='#'+A.lerp(B,t).getHexString();
}
function palette(accent){
  return {dark:mixc(DARK,accent,.24), body:mixc(DARK2,accent,.3), metal:mixc(METAL,accent,.26), a:accent};
}

/* ---------- shared tower plinth ---------- */
function plinth(accent,lvl,P){
  const g=new THREE.Group();
  // turned, panelled footing with a chamfer and a recessed collar
  const base=m3(geo('plB',()=>lathe([[0,0],[.54,0],[.54,.07],[.47,.14],[.47,.2],[.41,.24],[.41,.3],[0,.3]],8)),
    mat(P.dark,{rough:.62,metal:.55,tex:'panel',rep:1.6,ns:.7}),0,0,0);
  g.add(base);
  const deck=m3(geo('plD',()=>lathe([[0,0],[.4,0],[.4,.05],[.34,.1],[.34,.16],[0,.16]],8)),
    mat(P.body,{rough:.42,metal:.7,tex:'panel',rep:2.2,ns:.6}),0,.3,0);
  g.add(deck);
  // hazard band + bolt ring
  const band=m3(geo('plH',()=>new THREE.CylinderGeometry(.485,.485,.055,16,1,true)),
    mat('#ffffff',{tex:'hazard',rep:3,rough:.75,metal:.2,ei:.25,em:'#7a5a10'}),0,.175,0);
  g.add(band);
  for(let i=0;i<8;i++){const a=i/8*TAU;
    g.add(m3(geo('plBolt',()=>new THREE.CylinderGeometry(.026,.026,.03,6)),
      mat(METAL,{metal:.9,rough:.3}),Math.cos(a)*.44,.305,Math.sin(a)*.44));}
  contactShadow(g,.62,0);
  const halo=new THREE.Mesh(geo('phalo',()=>new THREE.RingGeometry(.5,.82,36)),glowMat(accent,.1,THREE.DoubleSide));
  halo.rotation.x=-Math.PI/2; halo.position.y=.025; g.add(halo);
  const ring=m3(geo('ringA',()=>new THREE.TorusGeometry(.435,.028,8,32)),mat(accent,{em:accent,ei:2.8,metal:.2,rough:.35}),0,.28,0);
  ring.rotation.x=Math.PI/2; g.add(ring);
  for(let i=0;i<Math.min(3,lvl-1);i++){
    const a=i/3*TAU+.5;
    const p=m3(geo('pyl',()=>new THREE.CylinderGeometry(.035,.055,.3,4)),mat(accent,{em:accent,ei:1.8,metal:.5}),
      Math.cos(a)*.42,.36,Math.sin(a)*.42);
    g.add(p);
  }
  return g;
}
function eliteCrown(g,accent){
  const c=m3(geo('crown',()=>new THREE.TorusGeometry(.3,.022,6,20)),mat('#ffc247',{em:'#ffc247',ei:2.4,metal:.9,rough:.2}),0,.42,0);
  c.rotation.x=Math.PI/2; g.add(c); g.userData.crown=c;
  const halo=new THREE.Mesh(geo('halo',()=>new THREE.RingGeometry(.34,.52,28)),glowMat('#ffc247',.16,THREE.DoubleSide));
  halo.rotation.x=-Math.PI/2; halo.position.y=.06; g.add(halo);
}

/* ---------- tower builders ---------- */
const TOWER_MODEL={
 arrow(t,d,P){const g=new THREE.Group(),c=d.c;
  const post=m3(geo('apost',()=>lathe([[0,0],[.13,0],[.13,.05],[.08,.09],[.08,.24],[.11,.28],[.11,.32],[0,.32]],10)),
    mat(P.metal,{metal:.8,rough:.35,tex:'panel',rep:2.4,ns:.5}),0,.36,0);g.add(post);
  const body=m3(geo('abody',()=>new THREE.BoxGeometry(.34,.14,.16)),mat(P.body,{metal:.7,rough:.4}),0,.66,0);
  const limbs=new THREE.Group();
  for(const s of[-1,1]){
    const l=m3(geo('alimb',()=>new THREE.BoxGeometry(.05,.05,.4)),mat(c,{em:c,ei:.5,metal:.6}),.06,.66,s*.16);
    l.rotation.x=s*.34; limbs.add(l);
  }
  const bolt=m3(geo('abolt',()=>new THREE.ConeGeometry(.05,.3,6)),mat(c,{em:c,ei:1.6}),.2,.66,0);
  bolt.rotation.z=-Math.PI/2;
  const tur=new THREE.Group(); tur.add(body,limbs,bolt); g.add(tur); g.userData.turret=tur;
  g.userData.muzzle={x:.3,y:.66};
  return g;},
 cannon(t,d,P){const g=new THREE.Group(),c=d.c;
  const drum=m3(geo('cdrum',()=>lathe([[0,0],[.32,0],[.32,.06],[.27,.11],[.27,.2],[.3,.25],[.3,.3],[0,.3]],14)),
    mat(P.body,{metal:.7,rough:.45,tex:'panel',rep:2,ns:.7}),0,.36,0);
  const barrel=m3(geo('cbar',()=>lathe([[.14,0],[.14,.1],[.1,.14],[.1,.5],[.13,.54],[.13,.62],[.105,.66],[.105,.72],[0,.72]],14)),
    mat(P.metal,{metal:.85,rough:.28,tex:'panel',rep:1.4,ns:.5}),.3,.58,0);
  barrel.rotation.z=-Math.PI/2;
  const muz=m3(geo('cmuz',()=>new THREE.TorusGeometry(.12,.035,6,14)),mat(c,{em:c,ei:1.3,metal:.6}),.64,.58,0);
  muz.rotation.y=Math.PI/2;
  const tank=m3(geo('ctank',()=>new THREE.BoxGeometry(.2,.16,.34)),mat(P.dark,{metal:.6}),-.2,.56,0);
  const tur=new THREE.Group(); tur.add(drum,barrel,muz,tank); g.add(tur); g.userData.turret=tur;
  g.userData.muzzle={x:.72,y:.58}; g.userData.recoil=barrel;
  return g;},
 frost(t,d,P){const g=new THREE.Group(),c=d.c;
  const spire=m3(geo('fspire',()=>new THREE.CylinderGeometry(.06,.16,.34,6)),mat(P.body,{metal:.5}),0,.5,0);g.add(spire);
  const crys=m3(geo('fcry',()=>new THREE.OctahedronGeometry(.2,0)),mat(c,{em:c,ei:1.9,metal:.1,rough:.15,trans:true,op:.92}),0,.86,0);
  g.add(crys); g.userData.crystal=crys;
  const orb=new THREE.Group();
  for(let i=0;i<3;i++){const a=i/3*TAU;
    const s=m3(geo('fsh',()=>new THREE.TetrahedronGeometry(.07)),mat(c,{em:c,ei:1.4}),Math.cos(a)*.3,.8,Math.sin(a)*.3);
    orb.add(s);}
  g.add(orb); g.userData.orbit=orb; g.userData.turret=new THREE.Group(); g.add(g.userData.turret);
  g.userData.muzzle={x:0,y:.86};
  return g;},
 tesla(t,d,P){const g=new THREE.Group(),c=d.c;
  const col=m3(geo('tcol',()=>lathe([[0,0],[.17,0],[.17,.06],[.12,.11],[.12,.3],[.15,.34],[.15,.4],[0,.4]],12)),
    mat(P.body,{metal:.75,rough:.35,tex:'panel',rep:2.2,ns:.6}),0,.35,0);g.add(col);
  for(let i=0;i<3;i++){const r=m3(geo('tcoil',()=>new THREE.TorusGeometry(.17,.028,6,18)),
    mat(c,{em:c,ei:1.2,metal:.7}),0,.62+i*.11,0); r.rotation.x=Math.PI/2; g.add(r);}
  const orb=m3(geo('torb',()=>new THREE.SphereGeometry(.13,14,10)),mat(c,{em:c,ei:2.6,metal:.2,rough:.2}),0,1.02,0);
  g.add(orb); g.userData.orb=orb;
  const gl=new THREE.Mesh(geo('torbg',()=>new THREE.SphereGeometry(.2,12,10)),glowMat(c,.12));gl.position.y=1.02;g.add(gl);
  g.userData.turret=new THREE.Group(); g.add(g.userData.turret); g.userData.muzzle={x:0,y:1.02};
  return g;},
 flame(t,d,P){const g=new THREE.Group(),c=d.c;
  const body=m3(geo('flb',()=>lathe([[0,0],[.3,0],[.3,.07],[.25,.12],[.25,.22],[.28,.26],[.28,.32],[0,.32]],12)),
    mat(P.body,{metal:.6,rough:.45,tex:'panel',rep:2,ns:.65}),0,.35,0);
  const noz=m3(geo('fln',()=>new THREE.CylinderGeometry(.055,.11,.46,10)),mat(P.metal,{metal:.8,rough:.35}),.26,.56,0);
  noz.rotation.z=-Math.PI/2;
  const tip=m3(geo('flt',()=>new THREE.TorusGeometry(.08,.028,6,12)),mat(c,{em:c,ei:2.2}),.48,.56,0);
  tip.rotation.y=Math.PI/2;
  const tanks=new THREE.Group();
  for(const s of[-1,1]){const tk=m3(geo('fltk',()=>new THREE.CapsuleGeometry(.07,.16,4,8)),mat('#7a2c18',{metal:.5}),-.22,.58,s*.14);
    tk.rotation.z=Math.PI/2; tanks.add(tk);}
  const tur=new THREE.Group(); tur.add(body,noz,tip,tanks); g.add(tur); g.userData.turret=tur;
  g.userData.muzzle={x:.54,y:.56};
  return g;},
 sniper(t,d,P){const g=new THREE.Group(),c=d.c;
  const mast=m3(geo('smast',()=>lathe([[0,0],[.19,0],[.19,.07],[.13,.13],[.13,.42],[.16,.48],[.16,.56],[.1,.62],[0,.62]],12)),
    mat(P.body,{metal:.7,rough:.36,tex:'panel',rep:2,ns:.6}),0,.35,0);g.add(mast);
  for(let i=0;i<3;i++){const a=i/3*TAU+.7;
    const leg=m3(geo('sleg',()=>new THREE.CylinderGeometry(.025,.03,.5,4)),mat(P.metal,{metal:.8}),Math.cos(a)*.2,.5,Math.sin(a)*.2);
    leg.rotation.set(Math.sin(a)*.35,0,-Math.cos(a)*.35); g.add(leg);}
  const head=m3(geo('shead',()=>new THREE.BoxGeometry(.24,.18,.2)),mat(P.dark,{metal:.75,rough:.3}),0,1.02,0);
  const rail=m3(geo('srail',()=>new THREE.BoxGeometry(1.05,.055,.055)),mat(P.metal,{metal:.9,rough:.25}),.5,1.04,0);
  const em=m3(geo('sem',()=>new THREE.BoxGeometry(.6,.02,.02)),mat(c,{em:c,ei:2}),.42,1.09,0);
  const scope=m3(geo('sscope',()=>new THREE.CylinderGeometry(.045,.045,.22,8)),mat(c,{em:c,ei:1.1,metal:.6}),-.02,1.15,0);
  scope.rotation.z=Math.PI/2;
  const tur=new THREE.Group(); tur.add(head,rail,em,scope); g.add(tur); g.userData.turret=tur;
  g.userData.muzzle={x:1.0,y:1.04}; g.userData.recoil=rail;
  return g;},
 toxin(t,d,P){const g=new THREE.Group(),c=d.c;
  const pot=m3(geo('xpot',()=>lathe([[0,0],[.28,0],[.28,.06],[.22,.1],[.22,.2],[.25,.24],[.25,.28],[0,.28]],12)),
    mat(P.body,{metal:.6,rough:.45,tex:'panel',rep:2,ns:.65}),0,.36,0);g.add(pot);
  const bub=m3(geo('xbub',()=>new THREE.SphereGeometry(.2,16,12)),mat(c,{em:c,ei:1.5,rough:.15,metal:.1,trans:true,op:.85}),0,.76,0);
  g.add(bub); g.userData.bubble=bub;
  const noz=new THREE.Group();
  for(let i=0;i<3;i++){const a=i/3*TAU;
    const n=m3(geo('xnoz',()=>new THREE.ConeGeometry(.05,.16,6)),mat(P.metal,{metal:.8}),Math.cos(a)*.22,.92,Math.sin(a)*.22);
    n.rotation.set(Math.sin(a)*.5,0,-Math.cos(a)*.5); noz.add(n);}
  g.add(noz);
  g.userData.turret=new THREE.Group(); g.add(g.userData.turret); g.userData.muzzle={x:0,y:.9};
  return g;},
 beacon(t,d,P){const g=new THREE.Group(),c=d.c;
  const stem=m3(geo('bstem',()=>lathe([[0,0],[.17,0],[.17,.05],[.1,.1],[.1,.26],[.13,.3],[.13,.34],[0,.34]],12)),
    mat(P.body,{metal:.7,rough:.38,tex:'panel',rep:2.2,ns:.6}),0,.36,0);g.add(stem);
  const core=m3(geo('bcore',()=>new THREE.IcosahedronGeometry(.17,0)),mat(c,{em:c,ei:2.4,metal:.3,rough:.2}),0,.86,0);
  g.add(core); g.userData.core=core;
  const gl=new THREE.Mesh(geo('bglow',()=>new THREE.SphereGeometry(.26,12,10)),glowMat(c,.09));gl.position.y=.86;g.add(gl);
  const r1=m3(geo('bring',()=>new THREE.TorusGeometry(.3,.022,6,26)),mat(c,{em:c,ei:1.3,metal:.6}),0,.86,0);
  const r2=r1.clone(); r2.rotation.x=Math.PI/2.6; r1.rotation.x=Math.PI/2;
  g.add(r1,r2); g.userData.r1=r1; g.userData.r2=r2;
  g.userData.turret=new THREE.Group(); g.add(g.userData.turret); g.userData.muzzle={x:0,y:.86};
  return g;},
};
function makeTower(key,lvl,elite){
  const d=TOWERS[key];
  const g=new THREE.Group();
  const P=palette(d.c);
  const sh0=d.shape||[1,1,1];
  const pl=plinth(d.c,lvl,P); pl.scale.set(1.1*(.75+sh0[0]*.28),1.15,1.1*(.75+sh0[2]*.28)); g.add(pl);
  const top=TOWER_MODEL[key](key,d,P);
  const sh=d.shape||[1,1,1];
  const s=1+(lvl-1)*.055;
  top.scale.set(s*1.14*sh[0], s*1.5*sh[1], s*1.14*sh[2]);
  g.add(top);
  g.userData.turret=top.userData.turret; g.userData.muzzle=top.userData.muzzle;
  g.userData.recoil=top.userData.recoil; g.userData.top=top;
  // muzzle flash rig, parented to the turret so it swings with the barrel
  if(top.userData.turret&&top.userData.muzzle&&!d.support){
    const mz=top.userData.muzzle;
    const fl=new THREE.Group();
    for(let i=0;i<2;i++){
      const q=new THREE.Mesh(geo('twFlash',()=>new THREE.PlaneGeometry(.7,.4)),
        new THREE.MeshBasicMaterial({color:new THREE.Color('#fff0c0'),transparent:true,opacity:.95,
          blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
      q.rotation.x=i*Math.PI/2; fl.add(q);
    }
    const sp=new THREE.Mesh(geo('twSpike',()=>new THREE.ConeGeometry(.15,.5,6)),
      new THREE.MeshBasicMaterial({color:new THREE.Color(d.c),transparent:true,opacity:.9,
        blending:THREE.AdditiveBlending,depthWrite:false}));
    sp.rotation.z=-Math.PI/2; fl.add(sp);
    fl.position.set(mz.x+.12,mz.y,0); fl.visible=false;
    top.userData.turret.add(fl); g.userData.flash=fl;
  }
  if(elite!=null)eliteCrown(g,d.c);
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;
    if(o.material.isMeshStandardMaterial){o.material=o.material.clone();rimLight(o.material,d.c,.4,3.0);}}});
  return g;
}

/* ---------- enemy builders ---------- */
function limbSet(g,c,n,y,r,size){
  const L=new THREE.Group();
  for(let i=0;i<n;i++){const a=i/n*TAU;
    const l=m3(geo('limb'+size,()=>new THREE.CapsuleGeometry(size,size*1.6,3,6)),mat(c,{metal:.3,rough:.7}),
      Math.cos(a)*r,y,Math.sin(a)*r);
    L.add(l);}
  g.add(L); return L;
}
const ENEMY_MODEL={
 /* hunched carapace trooper: shell over a glowing core, blade arms, tripod gait */
 grunt(c){const g=new THREE.Group();
  const P=palette(c);
  const shell=m3(geo('gr_s',()=>lathe([[0,0],[.2,.03],[.26,.14],[.24,.3],[.14,.4],[0,.43]],9)),
    mat(P.dark,{metal:.35,rough:.55,flat:true,em:c,ei:.22}),0,.26,0);
  const ridge=m3(geo('gr_r',()=>new THREE.BoxGeometry(.06,.16,.34)),
    mat(c,{em:c,ei:1.5,metal:.4}),-.02,.5,0);
  const core=m3(geo('gr_c',()=>new THREE.SphereGeometry(.1,10,8)),mat(c,{em:c,ei:2.4}),.06,.3,0);
  const head=m3(geo('gr_h',()=>lathe([[0,0],[.1,.04],[.11,.12],[.05,.2],[0,.21]],8)),
    mat('#2a1826',{metal:.5,rough:.4,flat:true}),.15,.42,0);
  const eye=m3(geo('gr_e',()=>new THREE.SphereGeometry(.038,6,6)),mat(c,{em:c,ei:3.4}),.22,.45,0);
  g.add(shell,ridge,core,head,eye);
  for(const s of[-1,1]){
    const blade=m3(geo('gr_b',()=>new THREE.ConeGeometry(.05,.34,4)),
      mat('#3b2436',{metal:.6,rough:.35,flat:true}),.1,.3,s*.2);
    blade.rotation.set(0,0,-1.1); blade.rotation.y=s*.4; g.add(blade);
  }
  g.userData.legs=limbSet(g,'#2a1826',3,.1,.16,.038); return g;},

 /* swept dart: low, fast, trailing light */
 runner(c){const g=new THREE.Group();
  const body=m3(geo('ru_b',()=>lathe([[0,0],[.09,.06],[.13,.2],[.1,.42],[.03,.52],[0,.54]],8)),
    mat(c,{metal:.55,rough:.3,em:c,ei:.7,flat:true}),0,.24,0);
  body.rotation.z=-Math.PI/2; body.position.x=-.16;
  const snout=m3(geo('ru_n',()=>new THREE.ConeGeometry(.075,.26,7)),
    mat('#3a2a10',{metal:.7,rough:.25}),.3,.24,0); snout.rotation.z=-Math.PI/2;
  const eye=m3(geo('ru_e',()=>new THREE.SphereGeometry(.04,6,6)),mat('#fff2b0',{em:'#fff2b0',ei:3}),.26,.28,0);
  g.add(body,snout,eye);
  for(const s of[-1,1]){
    const fin=m3(geo('ru_f',()=>new THREE.BoxGeometry(.26,.09,.03)),
      mat(c,{em:c,ei:1.2,metal:.5}),-.12,.3,s*.1);
    fin.rotation.set(s*.5,0,.35); g.add(fin);
  }
  const tr=new THREE.Mesh(geo('ru_t',()=>new THREE.PlaneGeometry(.62,.13)),glowMat(c,.28));
  tr.rotation.x=-Math.PI/2; tr.position.set(-.38,.06,0); g.add(tr);
  g.userData.legs=limbSet(g,'#3a2a10',4,.09,.13,.027); return g;},

 /* beetle: domed shell, twitching legs */
 swarm(c){const g=new THREE.Group();
  const sh=m3(geo('sw_s',()=>lathe([[0,0],[.15,.02],[.17,.09],[.1,.16],[0,.17]],8)),
    mat(c,{em:c,ei:.85,flat:true,metal:.3,rough:.5}),0,.14,0);
  const eye=m3(geo('sw_e',()=>new THREE.SphereGeometry(.035,6,6)),mat('#fff',{em:c,ei:3}),.12,.16,0);
  g.add(sh,eye); g.userData.spin=sh;
  g.userData.legs=limbSet(g,'#33204a',4,.06,.11,.022); return g;},

 /* siege trooper: slab of frontal armour on four legs */
 brute(c){const g=new THREE.Group();
  const P=palette(c);
  const hull=m3(geo('br_h',()=>new THREE.BoxGeometry(.46,.34,.4)),
    mat(P.body,{metal:.62,rough:.42,tex:'panel',rep:1.2,ns:.9}),-.02,.4,0);
  const plate=m3(geo('br_p',()=>lathe([[0,0],[.26,.02],[.3,.12],[.28,.28],[.16,.36],[0,.38]],7)),
    mat('#5b6690',{metal:.8,rough:.28,tex:'panel',rep:1.1,ns:1.0}),.2,.42,0);
  plate.rotation.z=-Math.PI/2;
  const vent=m3(geo('br_v',()=>new THREE.BoxGeometry(.05,.18,.3)),mat('#ff4d5e',{em:'#ff4d5e',ei:1.6}),.3,.42,0);
  const head=m3(geo('br_hd',()=>new THREE.BoxGeometry(.16,.14,.22)),mat('#2b3046',{metal:.7}),.12,.64,0);
  const eye=m3(geo('br_e',()=>new THREE.BoxGeometry(.03,.05,.15)),mat('#ff4d5e',{em:'#ff4d5e',ei:3.2}),.2,.64,0);
  g.add(hull,plate,vent,head,eye);
  for(const s of[-1,1]){
    const sp=m3(geo('br_s',()=>new THREE.ConeGeometry(.06,.3,5)),
      mat('#7d88ad',{metal:.85,rough:.25,flat:true}),-.1,.6,s*.19);
    sp.rotation.set(s*.5,0,-.4); g.add(sp);
  }
  g.userData.legs=limbSet(g,'#343b58',4,.13,.22,.055); return g;},

 /* drifting pod: fins spin, tendrils hang */
 flyer(c){const g=new THREE.Group();
  const pod=m3(geo('fl_p',()=>lathe([[0,0],[.13,.06],[.18,.16],[.14,.28],[.05,.34],[0,.35]],10)),
    mat(c,{em:c,ei:1.0,flat:true,metal:.45,rough:.3}),0,-.17,0);
  const eye=m3(geo('fl_e',()=>new THREE.SphereGeometry(.07,10,8)),mat('#eaffff',{em:'#bfefff',ei:2.8}),0,-.02,0);
  const r1=m3(geo('fl_r',()=>new THREE.TorusGeometry(.3,.022,6,26)),mat(c,{em:c,ei:1.5}),0,0,0);
  r1.rotation.x=Math.PI/2;
  const r2=r1.clone(); r2.rotation.set(Math.PI/2,0,Math.PI/3);
  const fins=new THREE.Group();
  for(let i=0;i<4;i++){const a=i/4*TAU;
    const f=m3(geo('fl_f',()=>new THREE.BoxGeometry(.22,.02,.09)),mat(c,{em:c,ei:1.1,metal:.5}),
      Math.cos(a)*.22,.02,Math.sin(a)*.22);
    f.rotation.y=-a; f.rotation.z=.35; fins.add(f);}
  const tent=new THREE.Group();
  for(let i=0;i<3;i++){const a=i/3*TAU;
    const t=m3(geo('fl_t',()=>new THREE.CylinderGeometry(.012,.03,.34,5)),
      mat('#2a5a70',{em:c,ei:.5}),Math.cos(a)*.09,-.38,Math.sin(a)*.09); tent.add(t);}
  const gl=new THREE.Mesh(geo('fl_g',()=>new THREE.SphereGeometry(.26,10,8)),glowMat(c,.08));
  g.add(pod,eye,r1,r2,fins,tent,gl);
  g.userData.spin=fins; g.userData.r1=r1; g.userData.r2=r2; return g;},

 /* tripod artillery: braced legs and a long acid barrel */
 shooter(c){const g=new THREE.Group();
  const sac=m3(geo('st_s',()=>lathe([[0,0],[.15,.05],[.19,.16],[.15,.3],[.06,.38],[0,.39]],9)),
    mat(c,{metal:.35,rough:.45,em:c,ei:.6,flat:true}),0,.3,0);
  const bulb=m3(geo('st_b',()=>new THREE.SphereGeometry(.11,12,10)),
    mat('#ff9aff',{em:'#ff8aff',ei:1.8,trans:true,op:.8}),-.04,.5,0);
  const barrel=m3(geo('st_r',()=>lathe([[.055,0],[.055,.2],[.04,.24],[.04,.36],[.07,.4],[0,.4]],8)),
    mat('#4a2050',{metal:.75,rough:.3}),.2,.36,0); barrel.rotation.z=-Math.PI/2;
  const tip=m3(geo('st_t',()=>new THREE.TorusGeometry(.055,.02,6,12)),mat('#ff8aff',{em:'#ff8aff',ei:2.6}),.42,.36,0);
  tip.rotation.y=Math.PI/2;
  g.add(sac,bulb,barrel,tip);
  g.userData.legs=limbSet(g,'#3a1a3a',3,.12,.17,.032); return g;},

 /* carrier locked behind a hex bulwark */
 shield(c){const g=new THREE.Group();
  const body=m3(geo('sh_b',()=>lathe([[0,0],[.16,.04],[.2,.14],[.16,.28],[.06,.34],[0,.35]],8)),
    mat(c,{metal:.5,rough:.4,em:c,ei:.5,flat:true}),0,.26,0);
  const head=m3(geo('sh_h',()=>new THREE.SphereGeometry(.08,10,8)),mat('#12302e',{metal:.6}),.05,.5,0);
  const arm=m3(geo('sh_a',()=>new THREE.BoxGeometry(.2,.06,.06)),mat('#1e3b3a',{metal:.7}),.15,.32,0);
  const sh=m3(geo('sh_s',()=>new THREE.CylinderGeometry(.3,.3,.045,6)),
    mat('#8ef0e4',{em:'#4ad2c4',ei:1.3,trans:true,op:.5,metal:.2}),.3,.34,0);
  sh.rotation.z=Math.PI/2;
  const rim=m3(geo('sh_r',()=>new THREE.TorusGeometry(.3,.022,6,6)),mat('#4ad2c4',{em:'#4ad2c4',ei:2}),.3,.34,0);
  rim.rotation.y=Math.PI/2;
  g.add(body,head,arm,sh,rim);
  g.userData.shieldMesh=sh;
  g.userData.legs=limbSet(g,'#1e3b3a',3,.11,.15,.038); return g;},

 /* hooded priest trailing a censer of green light */
 healer(c){const g=new THREE.Group();
  const robe=m3(geo('he_r',()=>lathe([[0,0],[.24,.02],[.21,.2],[.15,.4],[.1,.5],[0,.52]],10)),
    mat('#1f3a2c',{metal:.2,rough:.75,flat:true}),0,.02,0);
  const hood=m3(geo('he_h',()=>lathe([[0,0],[.12,.03],[.13,.11],[.06,.18],[0,.19]],8)),
    mat('#162c22',{metal:.3,rough:.7}),0,.5,0);
  const face=m3(geo('he_f',()=>new THREE.SphereGeometry(.05,8,6)),mat(c,{em:c,ei:2.6}),.07,.55,0);
  const orb=m3(geo('he_o',()=>new THREE.IcosahedronGeometry(.11,0)),mat(c,{em:c,ei:2.4,flat:true}),0,.82,0);
  const ring=m3(geo('he_g',()=>new THREE.TorusGeometry(.19,.016,6,22)),mat(c,{em:c,ei:1.4}),0,.82,0);
  ring.rotation.x=Math.PI/2.4;
  const gl=new THREE.Mesh(geo('he_gl',()=>new THREE.SphereGeometry(.2,10,8)),glowMat(c,.12)); gl.position.y=.82;
  g.add(robe,hood,face,orb,ring,gl); g.userData.orb=orb; return g;},

 /* pressurised sac webbed with glowing fracture lines */
 splitter(c){const g=new THREE.Group();
  const sac=m3(geo('sp_s',()=>new THREE.IcosahedronGeometry(.27,1)),
    mat(c,{flat:true,metal:.28,rough:.55,em:c,ei:.45}),0,.32,0);
  const cracks=new THREE.LineSegments(
    geo('sp_w',()=>new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.285,1))),
    new THREE.LineBasicMaterial({color:new THREE.Color('#fff0d0'),transparent:true,opacity:.6,
      blending:THREE.AdditiveBlending,depthWrite:false}));
  cracks.position.y=.32;
  const core=m3(geo('sp_c',()=>new THREE.IcosahedronGeometry(.13,0)),
    mat('#fff0d0',{em:c,ei:2.2,flat:true}),0,.32,0);
  g.add(sac,cracks,core); g.userData.spin=sac; g.userData.core=core;
  g.userData.legs=limbSet(g,'#5a3a18',3,.1,.16,.03); return g;},

 spawn(c){const g=new THREE.Group();
  const b=m3(geo('sn_b',()=>new THREE.IcosahedronGeometry(.15,0)),
    mat(c,{flat:true,em:c,ei:1.0,metal:.3}),0,.2,0);
  const e=m3(geo('sn_e',()=>new THREE.SphereGeometry(.05,6,6)),mat('#fff0d0',{em:c,ei:2.6}),.1,.22,0);
  g.add(b,e); g.userData.spin=b; return g;},

 /* siege beast: layered plates, exhaust stacks, a ram on the front */
 jug(c){const g=new THREE.Group();
  const P=palette(c);
  const hull=m3(geo('ju_h',()=>new THREE.BoxGeometry(.66,.4,.52)),
    mat(P.body,{metal:.68,rough:.4,tex:'panel',rep:1.0,ns:1.0}),0,.44,0);
  const deck=m3(geo('ju_d',()=>new THREE.BoxGeometry(.4,.2,.4)),
    mat('#59648f',{metal:.8,rough:.3,tex:'panel',rep:1.4,ns:.8}),-.06,.72,0);
  const ram=m3(geo('ju_r',()=>lathe([[0,0],[.24,.04],[.2,.22],[.08,.34],[0,.36]],6)),
    mat('#98a4cc',{metal:.9,rough:.22,flat:true}),.36,.44,0); ram.rotation.z=-Math.PI/2;
  const eye=m3(geo('ju_e',()=>new THREE.BoxGeometry(.04,.08,.26)),mat('#ff4d5e',{em:'#ff4d5e',ei:3.2}),.13,.74,0);
  g.add(hull,deck,ram,eye);
  for(const s of[-1,1]){
    const tread=m3(geo('ju_t',()=>new THREE.BoxGeometry(.72,.2,.14)),
      mat('#20263c',{metal:.55,rough:.75,tex:'panel',rep:1.6,ns:1.1}),0,.16,s*.3);
    g.add(tread);
    for(let k=-1;k<=1;k++){
      const st2=m3(geo('ju_s',()=>new THREE.CylinderGeometry(.045,.055,.26,6)),
        mat('#2b3252',{metal:.7}),-.18+k*.14,.9,s*.13);
      g.add(st2);
    }
  }
  return g;},

 /* the abyssal lord: caged heart, orbiting blades, crown of spikes */
 boss(c){const g=new THREE.Group();
  const shell=m3(geo('bo_s',()=>new THREE.DodecahedronGeometry(.46,0)),
    mat('#2a1230',{metal:.62,rough:.32,em:c,ei:.3,flat:true}),0,.7,0);
  const wire=new THREE.LineSegments(
    geo('bo_w',()=>new THREE.EdgesGeometry(new THREE.DodecahedronGeometry(.47,0))),
    new THREE.LineBasicMaterial({color:new THREE.Color(c),transparent:true,opacity:.8,
      blending:THREE.AdditiveBlending,depthWrite:false}));
  wire.position.y=.7;
  const core=m3(geo('bo_c',()=>new THREE.SphereGeometry(.21,16,12)),mat(c,{em:c,ei:2.8}),0,.7,0);
  const gl=new THREE.Mesh(geo('bo_g',()=>new THREE.SphereGeometry(.7,14,12)),glowMat(c,.09)); gl.position.y=.7;
  const spikes=new THREE.Group();
  for(let i=0;i<8;i++){const a=i/8*TAU;
    const sp=m3(geo('bo_k',()=>lathe([[0,0],[.075,.05],[.05,.28],[0,.44]],5)),
      mat('#5a1a44',{em:c,ei:.9,metal:.7,flat:true}),Math.cos(a)*.52,.7,Math.sin(a)*.52);
    sp.rotation.set(Math.sin(a)*1.5,0,-Math.cos(a)*1.5); spikes.add(sp);}
  const blades=new THREE.Group();
  for(let i=0;i<3;i++){const a=i/3*TAU;
    const bl=m3(geo('bo_b',()=>new THREE.BoxGeometry(.5,.03,.11)),
      mat(c,{em:c,ei:1.3,metal:.8}),Math.cos(a)*.42,1.15,Math.sin(a)*.42);
    bl.rotation.y=-a; blades.add(bl);}
  const r=m3(geo('bo_r',()=>new THREE.TorusGeometry(.68,.035,8,36)),
    mat(c,{em:c,ei:1.7,metal:.8}),0,.7,0); r.rotation.x=Math.PI/2;
  const legs=new THREE.Group();
  for(let i=0;i<4;i++){const a=i/4*TAU+.6;
    const l=m3(geo('bo_l',()=>lathe([[0,0],[.06,.05],[.04,.4],[.02,.6]],5)),
      mat('#3a1030',{metal:.6,flat:true}),Math.cos(a)*.3,.05,Math.sin(a)*.3);
    l.rotation.set(Math.sin(a)*.35,0,-Math.cos(a)*.35); legs.add(l);}
  g.add(shell,wire,core,gl,spikes,blades,r,legs);
  g.userData.spin=shell; g.userData.spikes=spikes; g.userData.ring=r;
  g.userData.core=core; g.userData.r2=blades;
  return g;},
};
function makeEnemy(type){
  const d=ENEMIES[type];
  const g=(ENEMY_MODEL[type]||ENEMY_MODEL.grunt)(d.c);
  if(!d.fly)contactShadow(g,(d.r/28),0);
  // a touch bigger than before: the camera sits closer now, and a unit still had
  // to be found by its glow dot rather than its shape
  g.scale.setScalar(1.48);
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=false;
    if(o.material.isMeshStandardMaterial){o.material=o.material.clone();
      rimLight(o.material,d.c,d.boss?1.0:.72,2.8);} } });
  return g;
}

/* ---------- the player unit ---------- */
function makePlayer(){
  const g=new THREE.Group();
  const AC='#ffffff', GL='#35e6ff', HOT='#ff9a3d';
  const skirt=m3(geo('pl0',()=>lathe([[0,0],[.38,0],[.38,.06],[.3,.12],[.3,.18],[0,.18]],10)),
    mat('#c9d6f0',{metal:.78,rough:.26,tex:'panel',rep:1.8,ns:.5}),0,.04,0); g.add(skirt);
  contactShadow(g,.44,0);
  const torso=m3(geo('pl1',()=>new THREE.CapsuleGeometry(.21,.2,6,16)),
    mat(AC,{metal:.6,rough:.22,em:GL,ei:.28,tex:'panel',rep:1.4,ns:.5}),0,.44,0); g.add(torso);
  const chest=m3(geo('pl2',()=>new THREE.BoxGeometry(.12,.12,.3)),
    mat(GL,{em:GL,ei:2.4,metal:.4}),.1,.5,0); g.add(chest);
  const head=m3(geo('pl3',()=>new THREE.SphereGeometry(.13,14,10)),
    mat('#e9f2ff',{metal:.6,rough:.2}),0,.72,0); g.add(head);
  const visor=m3(geo('pl4',()=>new THREE.BoxGeometry(.06,.07,.2)),
    mat(GL,{em:GL,ei:3.2}),.1,.73,0); g.add(visor);
  // gun arm (yaws to the aim direction)
  const arm=new THREE.Group();
  const gun=m3(geo('pl5',()=>new THREE.BoxGeometry(.46,.1,.11)),mat('#aab8dc',{metal:.85,rough:.2}),.3,.46,0);
  const muz=m3(geo('pl6',()=>new THREE.TorusGeometry(.07,.026,6,12)),mat(HOT,{em:HOT,ei:2.2}),.55,.46,0);
  muz.rotation.y=Math.PI/2;
  const grip=m3(geo('pl7',()=>new THREE.BoxGeometry(.1,.16,.1)),mat('#8f9ec6',{metal:.8}),.16,.4,0);
  arm.add(gun,muz,grip);
  // muzzle flash: a cross-billboard star that pops for a couple of frames
  const fl=new THREE.Group();
  for(let i=0;i<2;i++){
    const q=new THREE.Mesh(geo('plFlash',()=>new THREE.PlaneGeometry(.62,.34)),
      new THREE.MeshBasicMaterial({color:new THREE.Color('#fff0c0'),transparent:true,opacity:.95,
        blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
    q.rotation.x=i*Math.PI/2; q.position.set(.72,.46,0); fl.add(q);
  }
  const spike=new THREE.Mesh(geo('plSpike',()=>new THREE.ConeGeometry(.13,.4,6)),
    new THREE.MeshBasicMaterial({color:new THREE.Color('#ffd58a'),transparent:true,opacity:.9,
      blending:THREE.AdditiveBlending,depthWrite:false}));
  spike.rotation.z=-Math.PI/2; spike.position.set(.72,.46,0); fl.add(spike);
  fl.visible=false; arm.add(fl);
  // charge glow at the muzzle
  const chg=new THREE.Mesh(geo('plChg',()=>new THREE.SphereGeometry(.16,12,10)),
    new THREE.MeshBasicMaterial({color:new THREE.Color('#9fe8ff'),transparent:true,opacity:.8,
      blending:THREE.AdditiveBlending,depthWrite:false}));
  chg.position.set(.6,.46,0); chg.visible=false; arm.add(chg);
  g.add(arm); g.userData.arm=arm; g.userData.flash=fl; g.userData.charge=chg; g.userData.gun=gun;
  // shoulder pods
  for(const s of[-1,1]){
    const pod=m3(geo('pl8',()=>new THREE.BoxGeometry(.14,.12,.1)),mat('#d3ddf6',{metal:.7}),-.02,.58,s*.24);
    g.add(pod);
  }
  // thruster glow + ground marker so the player is never lost in a crowd
  const jet=new THREE.Mesh(geo('pl9',()=>new THREE.ConeGeometry(.11,.34,8)),glowMat(GL,.5));
  jet.position.set(-.24,.34,0); jet.rotation.z=Math.PI/2; g.add(jet); g.userData.jet=jet;
  const ring=new THREE.Mesh(geo('plr',()=>new THREE.RingGeometry(.44,.56,32)),glowMat(GL,.55,THREE.DoubleSide));
  ring.rotation.x=-Math.PI/2; ring.position.y=.03; g.add(ring); g.userData.ring=ring;
  // annihilation beam, parented to the aiming arm
  const ub=new THREE.Group();
  const core2=new THREE.Mesh(geo('ub1',()=>new THREE.CylinderGeometry(.16,.22,1,16,1,true)),
    new THREE.MeshBasicMaterial({color:new THREE.Color('#ffffff'),transparent:true,opacity:.95,
      blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  const mid=new THREE.Mesh(geo('ub2',()=>new THREE.CylinderGeometry(.34,.46,1,18,1,true)),
    new THREE.MeshBasicMaterial({color:new THREE.Color('#ffe89a'),transparent:true,opacity:.55,
      blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  const outer=new THREE.Mesh(geo('ub3',()=>new THREE.CylinderGeometry(.58,.8,1,18,1,true)),
    new THREE.MeshBasicMaterial({color:new THREE.Color('#ffb45a'),transparent:true,opacity:.22,
      blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  [core2,mid,outer].forEach(b=>{ b.rotation.z=-Math.PI/2; b.position.set(.5,.46,0); ub.add(b); });
  const muzzleBall=new THREE.Mesh(geo('ub4',()=>new THREE.SphereGeometry(.42,14,12)),
    new THREE.MeshBasicMaterial({color:new THREE.Color('#fff6d0'),transparent:true,opacity:.85,
      blending:THREE.AdditiveBlending,depthWrite:false}));
  muzzleBall.position.set(.55,.46,0); ub.add(muzzleBall);
  ub.visible=false; arm.add(ub);
  g.userData.ultBeam=ub; g.userData.ultParts=[core2,mid,outer]; g.userData.ultBall=muzzleBall;
  const halo=new THREE.Mesh(geo('plh',()=>new THREE.SphereGeometry(.46,12,10)),glowMat(GL,.05));
  halo.position.y=.42; g.add(halo);
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;
    if(o.material.isMeshStandardMaterial){o.material=o.material.clone();rimLight(o.material,GL,.9,2.5);}}});
  return g;
}

/* ---------- the Core you defend ---------- */
function makeCore(){
  const g=new THREE.Group(), C='#35e6ff';
  const pad=m3(geo('co0',()=>lathe([[0,0],[CORE.r+.85,0],[CORE.r+.85,.1],[CORE.r+.62,.2],
      [CORE.r+.62,.28],[CORE.r+.5,.36],[0,.36]],28)),
    mat('#2b3558',{metal:.55,rough:.62,tex:'panel',rep:5,ns:.8}),0,0,0); g.add(pad);
  const haz=m3(geo('coH',()=>new THREE.CylinderGeometry(CORE.r+.87,CORE.r+.87,.1,36,1,true)),
    mat('#ffffff',{tex:'hazard',rep:6,rough:.8,metal:.2,em:'#7a5a10',ei:.22}),0,.05,0); g.add(haz);
  contactShadow(g,CORE.r+1.1,0);
  const rim=m3(geo('co1',()=>new THREE.TorusGeometry(CORE.r+.5,.06,8,40)),
    mat(C,{em:C,ei:2.2,metal:.6}),0,.32,0); rim.rotation.x=Math.PI/2; g.add(rim);
  // the blue diamond, floating in a caged armature
  const dia=m3(geo('co2',()=>new THREE.OctahedronGeometry(CORE.r*.82,0)),
    mat('#2f6bff',{metal:.5,rough:.18,em:'#2f6bff',ei:.75,flat:true}),0,1.35,0);
  g.add(dia); g.userData.dia=dia;
  // edge-lit wireframe over the facets
  const wire=new THREE.LineSegments(
    geo('co2w',()=>new THREE.EdgesGeometry(new THREE.OctahedronGeometry(CORE.r*.845,0))),
    new THREE.LineBasicMaterial({color:new THREE.Color('#bfe4ff'),transparent:true,opacity:.9,
      blending:THREE.AdditiveBlending,depthWrite:false}));
  wire.position.y=1.35; g.add(wire); g.userData.wire=wire;
  // containment cage: struts + equatorial gyro ring
  const cage=new THREE.Group();
  for(let i=0;i<6;i++){ const a=i/6*TAU;
    const s=m3(geo('coS',()=>lathe([[0,0],[.055,0],[.055,.9],[.03,1.0],[0,1.0]],6)),
      mat('#8fa3d6',{metal:.9,rough:.24}),Math.cos(a)*(CORE.r*.95),.55,Math.sin(a)*(CORE.r*.95));
    s.rotation.z=Math.cos(a)*.22; s.rotation.x=-Math.sin(a)*.22; cage.add(s); }
  g.add(cage);
  const gyro=m3(geo('coG',()=>new THREE.TorusGeometry(CORE.r*1.02,.035,8,44)),
    mat('#7fd6ff',{em:'#35e6ff',ei:1.4,metal:.8,rough:.25}),0,1.35,0);
  gyro.rotation.x=Math.PI/2.3; g.add(gyro); g.userData.gyro=gyro;
  const gyro2=m3(geo('coG2',()=>new THREE.TorusGeometry(CORE.r*1.14,.022,6,44)),
    mat('#7fd6ff',{em:'#35e6ff',ei:1.0,metal:.8,rough:.25}),0,1.35,0);
  gyro2.rotation.z=Math.PI/3; g.add(gyro2); g.userData.gyro2=gyro2;
  const inner=m3(geo('co3',()=>new THREE.OctahedronGeometry(CORE.r*.4,0)),
    mat('#bfe4ff',{em:'#9fd8ff',ei:2.8,flat:true}),0,1.35,0); g.add(inner); g.userData.inner=inner;
  const halo=new THREE.Mesh(geo('co4',()=>new THREE.SphereGeometry(CORE.r*1.15,14,12)),glowMat(C,.07));
  halo.position.y=1.35; g.add(halo);
  // four barrels, like the original
  const guns=new THREE.Group();
  for(let i=0;i<4;i++){
    const a=i/4*TAU+Math.PI/4, sub=new THREE.Group();
    sub.position.set(Math.cos(a)*(CORE.r*.72),.55,Math.sin(a)*(CORE.r*.72));
    sub.rotation.y=-a;
    sub.add(m3(geo('co5',()=>new THREE.CylinderGeometry(.15,.19,.16,8)),mat('#3c4670',{metal:.7,rough:.4}),0,0,0));
    const bar=m3(geo('co6',()=>new THREE.CylinderGeometry(.05,.065,.44,8)),mat('#9fb0dc',{metal:.85,rough:.22}),.2,.04,0);
    bar.rotation.z=-Math.PI/2; sub.add(bar);
    const tip=m3(geo('co7',()=>new THREE.SphereGeometry(.05,8,6)),mat(C,{em:C,ei:2.2}),.42,.04,0); sub.add(tip);
    guns.add(sub);
  }
  g.add(guns); g.userData.guns=guns;
  const pylons=new THREE.Group();
  for(let i=0;i<4;i++){ const a=i/4*TAU;
    const p=m3(geo('co8',()=>new THREE.CylinderGeometry(.07,.11,1.15,5)),mat(C,{em:C,ei:.9,metal:.6}),
      Math.cos(a)*(CORE.r+.28),.6,Math.sin(a)*(CORE.r+.28)); pylons.add(p); }
  g.add(pylons);
  g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;
    if(o.material.isMeshStandardMaterial){o.material=o.material.clone();rimLight(o.material,C,.5,2.8);}}});
  return g;
}

/* ---------- arena cover ---------- */
function makeObstacle(o){
  let mesh;
  if(o.kind==='pillar'){
    mesh=m3(geo('ob_p',()=>lathe([[0,0],[1.0,0],[1.0,.16],[.86,.3],[.86,2.3],[.98,2.44],[.98,2.6],[0,2.6]],9)),
      mat('#333c60',{rough:.82,metal:.28,tex:'rock',rep:1.6,ns:1.1}),0,-1.3,0);
    mesh.scale.set(o.r,rnd(1.25,.8),o.r); mesh.position.y=mesh.scale.y*1.3;
  }else if(o.kind==='block'){
    mesh=m3(geo('ob_b',()=>new THREE.BoxGeometry(1.7,1.25,1.7)),
      mat('#39426a',{rough:.78,metal:.3,tex:'panel',rep:1.1,ns:.9}),0,0,0);
    mesh.scale.set(o.r,rnd(1.1,.7),o.r); mesh.position.y=mesh.scale.y*.62;
    mesh.rotation.y=o.seed;
  }else{
    mesh=m3(geo('ob_r',()=>new THREE.DodecahedronGeometry(1.0,1)),
      mat('#2e3654',{rough:.9,metal:.18,tex:'rock',rep:1.3,ns:1.4}),0,0,0);
    mesh.scale.set(o.r,o.r*.8,o.r); mesh.position.y=o.r*.5;
    mesh.rotation.set(o.seed*.3,o.seed,o.seed*.2);
  }
  const g=new THREE.Group(); g.add(mesh); contactShadow(g,o.r*1.15,0);
  const trim=new THREE.Mesh(geo('ob_t',()=>new THREE.RingGeometry(.92,1.0,24)),glowMat('#2a6a8a',.3,THREE.DoubleSide));
  trim.rotation.x=-Math.PI/2; trim.position.y=.04; trim.scale.setScalar(o.r*1.05); g.add(trim);
  g.traverse(x=>{if(x.isMesh){x.castShadow=true;x.receiveShadow=true;}});
  return g;
}

/* ---------- pickups ---------- */
function makeDrop(kind){
  const c=kind==='xp'?'#35e6ff':kind==='hp'?'#6ee7a8':'#ffc247';
  const g=new THREE.Group();
  const m=m3(kind==='xp'?geo('dr_x',()=>new THREE.OctahedronGeometry(.15,0))
            :kind==='hp'?geo('dr_h',()=>new THREE.BoxGeometry(.2,.2,.2))
                        :geo('dr_s',()=>new THREE.TetrahedronGeometry(.17)),
    mat(c,{em:c,ei:1.7,metal:.4,flat:true}),0,0,0);
  m.castShadow=false; g.add(m); g.userData.spin=m;
  const gl=new THREE.Mesh(geo('dr_g',()=>new THREE.SphereGeometry(.17,10,8)),glowMat(c,.2));
  g.add(gl);
  return g;
}

/* ---------- rift: where the swarm pours in from ---------- */
function makeRift(){
  const g=new THREE.Group(), C='#ff3d8a', C2='#ff8ac0';
  const ring=m3(geo('rf1',()=>new THREE.TorusGeometry(RIFT.r,.12,10,40)),
    mat(C,{em:C,ei:2.4,metal:.6,rough:.3}),0,1.05,0);
  g.add(ring); g.userData.ring=ring;
  const ring2=m3(geo('rf2',()=>new THREE.TorusGeometry(RIFT.r*.72,.055,8,32)),
    mat(C2,{em:C2,ei:2.0,metal:.6}),0,1.05,0);
  g.add(ring2); g.userData.ring2=ring2;
  // the tear itself
  const maw=new THREE.Mesh(geo('rf3',()=>new THREE.CircleGeometry(RIFT.r*.94,40)),
    new THREE.MeshBasicMaterial({color:new THREE.Color('#2a0418'),transparent:true,opacity:.95,
      side:THREE.DoubleSide,depthWrite:false}));
  maw.position.y=1.05; g.add(maw);
  const swirl=new THREE.Mesh(geo('rf4',()=>new THREE.RingGeometry(RIFT.r*.2,RIFT.r*.9,32,3)),
    glowMat(C,.5,THREE.DoubleSide));
  swirl.position.y=1.06; g.add(swirl); g.userData.swirl=swirl;
  // shaft of light + ground scar
  const col=new THREE.Mesh(geo('rf5',()=>new THREE.CylinderGeometry(RIFT.r*.85,RIFT.r*.5,5,20,1,true)),
    glowMat(C,.09,THREE.DoubleSide));
  col.position.y=3.2; g.add(col);
  const scar=new THREE.Mesh(geo('rf6',()=>new THREE.CircleGeometry(RIFT.r*1.7,36)),glowMat('#7a0f34',.3));
  scar.rotation.x=-Math.PI/2; scar.position.y=.05; g.add(scar); g.userData.scar=scar;
  // anchoring spikes
  for(let i=0;i<5;i++){ const a=i/5*TAU;
    const s=m3(geo('rf7',()=>new THREE.ConeGeometry(.12,1.1,5)),mat('#4a1030',{em:C,ei:.5,metal:.5,flat:true}),
      Math.cos(a)*RIFT.r*1.15,.5,Math.sin(a)*RIFT.r*1.15);
    s.rotation.set(Math.sin(a)*.4,0,-Math.cos(a)*.4); g.add(s); }
  g.traverse(o=>{if(o.isMesh)o.castShadow=false;});
  return g;
}
/* ---------- salvage: stand still to strip it for scrap ---------- */
function makeSalvage(){
  const g=new THREE.Group();
  const heap=new THREE.Group();
  for(let i=0;i<7;i++){
    const s=.18+Math.random()*.3;
    const b=m3(geo('sv1',()=>new THREE.BoxGeometry(1,1,1)),
      mat('#5a6488',{metal:.72,rough:.5,tex:'panel',rep:1.1,ns:.8}),
      rnd(.5,-.5),s*.5,rnd(.5,-.5));
    b.scale.set(s*1.6,s,s*1.3); b.rotation.set(rnd(.5),rnd(TAU),rnd(.5)); heap.add(b);
  }
  const beacon=m3(geo('sv2',()=>new THREE.ConeGeometry(.1,.5,6)),
    mat('#ffc247',{em:'#ffc247',ei:2.4}),0,.75,0);
  heap.add(beacon); g.add(heap); g.userData.beacon=beacon;
  contactShadow(g,.7,0);
  const ring=new THREE.Mesh(geo('sv3',()=>new THREE.RingGeometry(SALVAGE.r*.92,SALVAGE.r,48,1)),
    glowMat('#ffc247',.35,THREE.DoubleSide));
  ring.rotation.x=-Math.PI/2; ring.position.y=.06; g.add(ring); g.userData.ring=ring;
  const prog=new THREE.Mesh(geo('sv4',()=>new THREE.RingGeometry(SALVAGE.r*.72,SALVAGE.r*.88,48,1,0,0.001)),
    glowMat('#ffe89a',.9,THREE.DoubleSide));
  prog.rotation.x=-Math.PI/2; prog.position.y=.07; g.add(prog); g.userData.prog=prog;
  return g;
}

/* ===================== BIOME PROPS ===================== */
function rr(seed,i){ const x=Math.sin(seed*127.1+i*311.7)*43758.5453; return x-Math.floor(x); }

const PROP={
 /* --- deck: industrial --- */
 crate(o){const g=new THREE.Group();
  const n=2+((rr(o.seed,1)*3)|0);
  for(let i=0;i<n;i++){
    const s=.55+rr(o.seed,i*3)*.4, hgt=s*.8;
    const b=m3(geo('pr_cr',()=>new THREE.BoxGeometry(1,1,1)),
      mat('#4a5476',{metal:.6,rough:.5,tex:'panel',rep:1.2,ns:.9}),
      (rr(o.seed,i*3+1)-.5)*.7,hgt/2+i*.05,(rr(o.seed,i*3+2)-.5)*.7);
    b.scale.set(s,hgt,s); b.rotation.y=rr(o.seed,i*7)*TAU; g.add(b);
    const strap=m3(geo('pr_cs',()=>new THREE.BoxGeometry(1.03,.07,1.03)),
      mat('#ffffff',{tex:'hazard',rep:2,rough:.7,metal:.2,em:'#7a5a10',ei:.5}),
      b.position.x,hgt*.62,b.position.z);
    strap.scale.set(s,1,s); strap.rotation.y=b.rotation.y; g.add(strap);
  }
  // warning beacon: this one goes off
  const led=m3(geo('pr_cl',()=>new THREE.SphereGeometry(.11,10,8)),
    mat('#ff4d5e',{em:'#ff4d5e',ei:3.2}),0,.95,0);
  g.add(led); g.userData.warn=led;
  const halo=new THREE.Mesh(geo('pr_ch',()=>new THREE.RingGeometry(.9,1.15,24)),
    glowMat('#ff8a3d',.22,THREE.DoubleSide));
  halo.rotation.x=-Math.PI/2; halo.position.y=.05; g.add(halo); g.userData.warnHalo=halo;
  return g;},
 pipe(o){const g=new THREE.Group();
  const M=mat('#5a6488',{metal:.85,rough:.32,tex:'panel',rep:1.6,ns:.6});
  const a=m3(geo('pr_pa',()=>new THREE.CylinderGeometry(.19,.19,1.7,12)),M,0,.85,0);
  const b=m3(geo('pr_pb',()=>new THREE.TorusGeometry(.42,.19,10,16,Math.PI/2)),M,0,1.7,.42);
  b.rotation.set(Math.PI/2,0,0);
  const c=m3(geo('pr_pc',()=>new THREE.CylinderGeometry(.19,.19,1.1,12)),M,0,2.12,1.0);
  c.rotation.x=Math.PI/2;
  const v=m3(geo('pr_pv',()=>new THREE.TorusGeometry(.24,.05,8,18)),
    mat('#ffc247',{em:'#ffc247',ei:.8,metal:.7}),0,1.15,0); v.rotation.x=Math.PI/2;
  g.add(a,b,c,v); g.rotation.y=rr(o.seed,1)*TAU; return g;},
 antenna(o){const g=new THREE.Group();
  const base=m3(geo('pr_ab',()=>lathe([[0,0],[.5,0],[.5,.16],[.3,.28],[.3,.36],[0,.36]],8)),
    mat('#3d4670',{metal:.7,rough:.4,tex:'panel',rep:2,ns:.8}),0,0,0);
  const mast=m3(geo('pr_am',()=>new THREE.CylinderGeometry(.07,.11,2.6,7)),
    mat('#7681ad',{metal:.85,rough:.3}),0,1.65,0);
  const dish=m3(geo('pr_ad',()=>new THREE.SphereGeometry(.5,16,10,0,TAU,0,Math.PI*.42)),
    mat('#9fb0dc',{metal:.7,rough:.32,side:2}),0,2.9,0);
  dish.rotation.set(-.7,rr(o.seed,2)*TAU,0);
  const led=m3(geo('pr_al',()=>new THREE.SphereGeometry(.08,8,6)),
    mat('#ff4d5e',{em:'#ff4d5e',ei:2.6}),0,3.1,0);
  g.add(base,mast,dish,led); return g;},

 /* --- ruins: broken stone and dead wood --- */
 column(o){const g=new THREE.Group();
  const M=mat('#6b6f58',{rough:.85,metal:.1,tex:'rock',rep:1.3,ns:1.1});
  const base=m3(geo('pr_cb',()=>lathe([[0,0],[.62,0],[.62,.14],[.5,.22],[.5,.3],[0,.3]],10)),M,0,0,0);
  g.add(base);
  const hgt=1.3+rr(o.seed,1)*1.6;
  const shaft=m3(geo('pr_cf',()=>new THREE.CylinderGeometry(.38,.44,1,14)),M,0,.3+hgt/2,0);
  shaft.scale.y=hgt; g.add(shaft);
  // fluting
  for(let i=0;i<10;i++){const a=i/10*TAU;
    const f=m3(geo('pr_cg',()=>new THREE.CylinderGeometry(.05,.055,1,6)),
      mat('#5c604a',{rough:.9,metal:.08}),Math.cos(a)*.4,.3+hgt/2,Math.sin(a)*.4);
    f.scale.y=hgt; g.add(f);}
  if(rr(o.seed,2)<.55){
    const cap=m3(geo('pr_cc',()=>new THREE.BoxGeometry(1.15,.26,1.15)),M,0,.3+hgt+.13,0);
    cap.rotation.y=rr(o.seed,3)*.4; g.add(cap);
  } else { shaft.rotation.z=(rr(o.seed,4)-.5)*.35; }
  for(let i=0;i<4;i++){const a=rr(o.seed,i+9)*TAU,d=.8+rr(o.seed,i+13)*.7;
    const s=.14+rr(o.seed,i+17)*.22;
    const rk=m3(geo('pr_cr2',()=>new THREE.DodecahedronGeometry(1,0)),M,Math.cos(a)*d,s*.5,Math.sin(a)*d);
    rk.scale.setScalar(s); rk.rotation.set(rr(o.seed,i)*TAU,rr(o.seed,i+2)*TAU,0); g.add(rk);}
  // moss
  const moss=new THREE.Mesh(geo('pr_cm',()=>new THREE.CircleGeometry(1,20)),glowMat('#4a7a2a',.12));
  moss.rotation.x=-Math.PI/2; moss.position.y=.03; moss.scale.setScalar(1.1); g.add(moss);
  return g;},
 rubble(o){const g=new THREE.Group();
  const M=mat('#5f6450',{rough:.9,metal:.08,tex:'rock',rep:1.5,ns:1.3});
  const slab=m3(geo('pr_rs',()=>new THREE.BoxGeometry(1.5,.28,1.0)),M,0,.14,0);
  slab.rotation.set(.12,rr(o.seed,1)*TAU,.07); g.add(slab);
  for(let i=0;i<6;i++){const a=rr(o.seed,i)*TAU,d=rr(o.seed,i+6)*.9,s=.16+rr(o.seed,i+12)*.3;
    const rk=m3(geo('pr_rr',()=>new THREE.DodecahedronGeometry(1,0)),M,Math.cos(a)*d,s*.6,Math.sin(a)*d);
    rk.scale.set(s,s*.75,s); rk.rotation.set(rr(o.seed,i+3)*TAU,rr(o.seed,i+5)*TAU,0); g.add(rk);}
  for(let i=0;i<9;i++){const a=rr(o.seed,i+20)*TAU,d=.4+rr(o.seed,i+26)*1.0;
    const t=m3(geo('pr_rg',()=>new THREE.ConeGeometry(.045,.34,4)),
      mat('#6f9a45',{rough:.9,metal:.05,em:'#2a4a10',ei:.25}),Math.cos(a)*d,.17,Math.sin(a)*d);
    t.rotation.z=(rr(o.seed,i)-.5)*.5; g.add(t);}
  return g;},
 tree(o){ return deadTree(o,'#4a3a26','#3a2e1e',true); },

 /* --- tundra --- */
 icerock(o){const g=new THREE.Group();
  const M=mat('#5c7098',{rough:.55,metal:.2,tex:'rock',rep:1.2,ns:1.2});
  const core=m3(geo('pr_ir',()=>new THREE.DodecahedronGeometry(1,0)),M,0,.5,0);
  core.scale.set(1,.8,1); core.rotation.set(rr(o.seed,1)*TAU,rr(o.seed,2)*TAU,0); g.add(core);
  const snow=m3(geo('pr_is',()=>new THREE.SphereGeometry(1,14,10,0,TAU,0,Math.PI*.42)),
    mat('#dbe9ff',{rough:.75,metal:.05}),0,.72,0);
  snow.scale.set(1.02,.6,1.02); g.add(snow);
  for(let i=0;i<4;i++){const a=rr(o.seed,i+4)*TAU,d=.5+rr(o.seed,i+8)*.5;
    const sp=m3(geo('pr_ic',()=>new THREE.ConeGeometry(.16,.8,5)),
      mat('#bfe4ff',{em:'#7fc8ff',ei:.85,trans:true,op:.8,metal:.15,rough:.15}),
      Math.cos(a)*d,.6,Math.sin(a)*d);
    sp.rotation.set((rr(o.seed,i)-.5)*.7,0,(rr(o.seed,i+1)-.5)*.7); g.add(sp);}
  return g;},
 icespire(o){const g=new THREE.Group();
  for(let i=0;i<5;i++){const a=rr(o.seed,i)*TAU,d=rr(o.seed,i+5)*.55;
    const h2=1.1+rr(o.seed,i+10)*1.9;
    const sp=m3(geo('pr_sp',()=>new THREE.ConeGeometry(.26,1,6)),
      mat('#a8d8ff',{em:'#5fb0ff',ei:1.0,trans:true,op:.72,metal:.2,rough:.12}),
      Math.cos(a)*d,h2/2,Math.sin(a)*d);
    sp.scale.set(.5+rr(o.seed,i+15)*.7,h2,.5+rr(o.seed,i+20)*.7);
    sp.rotation.set((rr(o.seed,i+2)-.5)*.34,rr(o.seed,i+3)*TAU,(rr(o.seed,i+4)-.5)*.34);
    g.add(sp);}
  const gl=new THREE.Mesh(geo('pr_sg',()=>new THREE.SphereGeometry(1,10,8)),glowMat('#7fc8ff',.07));
  gl.position.y=.9; gl.scale.setScalar(1.2); g.add(gl);
  return g;},
 deadtree(o){ return deadTree(o,'#6d7ea0','#8ea4c8',false); },

 /* --- forge --- */
 basalt(o){const g=new THREE.Group();
  const M=mat('#33231e',{rough:.82,metal:.16,tex:'rock',rep:1.1,ns:1.4});
  for(let i=0;i<6;i++){const a=i/6*TAU+rr(o.seed,1),d=rr(o.seed,i+2)*.6;
    const h2=.9+rr(o.seed,i+8)*2.1;
    const col=m3(geo('pr_bc',()=>new THREE.CylinderGeometry(.3,.34,1,6)),M,
      Math.cos(a)*d,h2/2,Math.sin(a)*d);
    col.scale.y=h2; col.rotation.y=rr(o.seed,i)*TAU; g.add(col);
    const cap=new THREE.Mesh(geo('pr_bg',()=>new THREE.CircleGeometry(.3,6)),glowMat('#ff5a20',.22));
    cap.rotation.x=-Math.PI/2; cap.position.set(col.position.x,h2+.01,col.position.z); g.add(cap);}
  return g;},
 slag(o){const g=new THREE.Group();
  const M=mat('#2e1a14',{rough:.7,metal:.3,tex:'rock',rep:1.3,ns:1.3,em:'#4a1200',ei:.35});
  const heap=m3(geo('pr_sl',()=>new THREE.DodecahedronGeometry(1,1)),M,0,.55,0);
  heap.scale.set(1.1,.75,1.1); heap.rotation.set(rr(o.seed,1)*TAU,rr(o.seed,2)*TAU,0); g.add(heap);
  const cracks=new THREE.LineSegments(
    geo('pr_slw',()=>new THREE.EdgesGeometry(new THREE.DodecahedronGeometry(1.02,1))),
    new THREE.LineBasicMaterial({color:new THREE.Color('#ff7a2a'),transparent:true,opacity:.55,
      blending:THREE.AdditiveBlending,depthWrite:false}));
  cracks.position.y=.55; cracks.scale.set(1.1,.75,1.1); cracks.rotation.copy(heap.rotation); g.add(cracks);
  const gl=new THREE.Mesh(geo('pr_slg',()=>new THREE.SphereGeometry(1,10,8)),glowMat('#ff5a20',.1));
  gl.position.y=.5; gl.scale.setScalar(1.3); g.add(gl);
  return g;},
 vent(o){const g=new THREE.Group();
  const M=mat('#4a3630',{metal:.7,rough:.45,tex:'panel',rep:1.6,ns:.9});
  const base=m3(geo('pr_vb',()=>lathe([[0,0],[.6,0],[.6,.2],[.44,.32],[.44,.5],[.5,.58],[0,.58]],10)),M,0,0,0);
  const stack=m3(geo('pr_vs',()=>new THREE.CylinderGeometry(.26,.32,1.5,10)),M,0,1.3,0);
  const cap=m3(geo('pr_vc',()=>new THREE.TorusGeometry(.3,.07,8,16)),
    mat('#ff7a3a',{em:'#ff5a20',ei:1.2,metal:.6}),0,2.05,0); cap.rotation.x=Math.PI/2;
  const glow=new THREE.Mesh(geo('pr_vg',()=>new THREE.CircleGeometry(.26,14)),glowMat('#ff9a3d',.5));
  glow.rotation.x=-Math.PI/2; glow.position.y=2.07; g.add(glow);
  g.add(base,stack,cap); return g;},

 /* --- void --- */
 shard(o){const g=new THREE.Group();
  for(let i=0;i<3;i++){const a=rr(o.seed,i)*TAU,d=rr(o.seed,i+3)*.5;
    const h2=1.0+rr(o.seed,i+6)*1.8;
    const sh=m3(geo('pr_sh',()=>new THREE.OctahedronGeometry(.4,0)),
      mat('#3a2258',{em:'#b06cff',ei:.75,flat:true,metal:.5,rough:.3}),
      Math.cos(a)*d,h2*.5,Math.sin(a)*d);
    sh.scale.set(.55,h2,.55); sh.rotation.set((rr(o.seed,i+1)-.5)*.5,rr(o.seed,i+2)*TAU,0); g.add(sh);}
  const gl=new THREE.Mesh(geo('pr_shg',()=>new THREE.SphereGeometry(1,10,8)),glowMat('#b06cff',.09));
  gl.position.y=.9; gl.scale.setScalar(1.3); g.add(gl);
  return g;},
 monolith(o){const g=new THREE.Group();
  const h2=2.4+rr(o.seed,1)*1.6;
  const M=mat('#241a3a',{rough:.55,metal:.35,tex:'rock',rep:1.1,ns:1.0});
  const stone=m3(geo('pr_mo',()=>new THREE.BoxGeometry(.9,1,.34)),M,0,h2/2,0);
  stone.scale.y=h2; stone.rotation.set((rr(o.seed,2)-.5)*.12,rr(o.seed,3)*TAU,(rr(o.seed,4)-.5)*.12);
  g.add(stone);
  const glyph=new THREE.LineSegments(
    geo('pr_mow',()=>new THREE.EdgesGeometry(new THREE.BoxGeometry(.92,1.02,.36))),
    new THREE.LineBasicMaterial({color:new THREE.Color('#c08cff'),transparent:true,opacity:.7,
      blending:THREE.AdditiveBlending,depthWrite:false}));
  glyph.position.y=h2/2; glyph.scale.y=h2; glyph.rotation.copy(stone.rotation); g.add(glyph);
  for(let i=0;i<3;i++){
    const r2=new THREE.Mesh(geo('pr_mr',()=>new THREE.TorusGeometry(.34,.018,6,20)),
      glowMat('#b06cff',.5));
    r2.position.y=h2*(.3+i*.22); r2.rotation.x=Math.PI/2; g.add(r2);}
  return g;},
 floatrock(o){const g=new THREE.Group();
  const M=mat('#2b2140',{rough:.75,metal:.2,tex:'rock',rep:1.2,ns:1.3});
  const rk=m3(geo('pr_fr',()=>new THREE.DodecahedronGeometry(1,0)),M,0,1.35,0);
  rk.scale.set(1,.7,1); rk.rotation.set(rr(o.seed,1)*TAU,rr(o.seed,2)*TAU,0); g.add(rk);
  g.userData.float=rk;
  const under=new THREE.Mesh(geo('pr_fu',()=>new THREE.ConeGeometry(.8,1.5,12,1,true)),
    glowMat('#b06cff',.14,THREE.DoubleSide));
  under.position.y=.6; under.rotation.x=Math.PI; g.add(under);
  const dust=new THREE.Mesh(geo('pr_fd',()=>new THREE.CircleGeometry(.9,18)),glowMat('#7a4ac0',.1));
  dust.rotation.x=-Math.PI/2; dust.position.y=.03; g.add(dust);
  return g;},
};
function deadTree(o,barkC,tipC,leafy){
  const g=new THREE.Group();
  const bark=mat(barkC,{rough:.92,metal:.05,tex:'rock',rep:1.6,ns:1.1});
  const trunkH=1.5+rr(o.seed,1)*1.5;
  const trunk=m3(geo('pr_tt',()=>lathe([[0,0],[.28,0],[.22,.25],[.17,.6],[.12,1]],9)),bark,0,0,0);
  trunk.scale.y=trunkH; g.add(trunk);
  const branch=(x,y,z,len,ang,tilt,depth)=>{
    const b=m3(geo('pr_tb',()=>new THREE.CylinderGeometry(.035,.075,1,6)),bark,x,y,z);
    b.scale.y=len; b.rotation.set(Math.sin(ang)*tilt,ang,Math.cos(ang)*tilt);
    g.add(b);
    const ex=x+Math.sin(ang)*Math.sin(tilt)*len, ez=z+Math.cos(ang)*Math.sin(tilt)*len;
    const ey=y+Math.cos(tilt)*len*.9;
    if(depth>0){
      branch(ex,ey,ez,len*.62,ang+1.1+rr(o.seed,depth*3)*.8,tilt+.25,depth-1);
      branch(ex,ey,ez,len*.58,ang-1.2-rr(o.seed,depth*5)*.8,tilt+.32,depth-1);
    } else if(leafy&&rr(o.seed,depth+9)<.7){
      const lf=m3(geo('pr_tl',()=>new THREE.IcosahedronGeometry(.32,0)),
        mat(tipC,{rough:.85,metal:.05,flat:true,em:'#1a2a0c',ei:.3}),ex,ey,ez);
      lf.scale.set(1,.7,1); g.add(lf);
    }
  };
  const n=3+((rr(o.seed,2)*2)|0);
  for(let i=0;i<n;i++)
    branch(0,trunkH*.62,0,.8+rr(o.seed,i+4)*.5,i/n*TAU+rr(o.seed,i),.5+rr(o.seed,i+7)*.4,1);
  return g;
}
function makeProp(kind,o){
  const g=(PROP[kind]||PROP.rubble)(o);
  g.scale.setScalar(o.r*.95);
  g.rotation.y=rr(o.seed,42)*TAU;
  contactShadow(g,o.r*1.1,0);
  g.traverse(x=>{if(x.isMesh){x.castShadow=true;x.receiveShadow=true;}});
  return g;
}

/* ===================== HAZARD VISUALS ===================== */
function makeHazard(h){
  const g=new THREE.Group(), H=HAZARD[h.kind];
  if(h.kind==='lava'){
    const lv=(typeof LAVA!=='undefined'&&LAVA)?LAVA:null;
    const pm=new THREE.MeshBasicMaterial({color:new THREE.Color('#ff7028'),transparent:true,opacity:.9});
    if(lv&&lv.col){ const mp=lv.col.clone(); mp.needsUpdate=true;
      mp.wrapS=mp.wrapT=THREE.RepeatWrapping; mp.repeat.set(.9,.9); pm.map=mp; }
    const pool=new THREE.Mesh(geo('hz_l',()=>new THREE.CircleGeometry(1,40)),pm);
    pool.rotation.x=-Math.PI/2; pool.position.y=.05; pool.scale.setScalar(h.r); g.add(pool);
    g.userData.pool=pool;
    const crust=m3(geo('hz_lc',()=>new THREE.TorusGeometry(1,.1,8,40)),
      mat('#2a150e',{rough:.85,metal:.2,em:'#ff3a00',ei:.5}),0,.05,0);
    crust.rotation.x=Math.PI/2; crust.scale.setScalar(h.r); g.add(crust);
    const gl=new THREE.Mesh(geo('hz_lg',()=>new THREE.CircleGeometry(1,32)),glowMat('#ff9a3d',.26));
    gl.rotation.x=-Math.PI/2; gl.position.y=.07; gl.scale.setScalar(h.r*1.25); g.add(gl);
    for(let i=0;i<3;i++){
      const a=rr(h.seed,i)*TAU, d=rr(h.seed,i+3)*h.r*.5;
      const isl=m3(geo('hz_li',()=>new THREE.DodecahedronGeometry(1,0)),
        mat('#241009',{rough:.9,metal:.15,em:'#8a2200',ei:.4,flat:true}),
        Math.cos(a)*d,.07,Math.sin(a)*d);
      isl.scale.set(h.r*.26,h.r*.09,h.r*.22); g.add(isl);
    }
  } else if(h.kind==='ice'){
    const sheet=new THREE.Mesh(geo('hz_i',()=>new THREE.CircleGeometry(1,40)),
      // at the brighter exposure a mirror-finish sheet blew out to a white disc
      new THREE.MeshStandardMaterial({color:new THREE.Color('#9fc4e8'),transparent:true,opacity:.42,
        roughness:.22,metalness:.1,envMapIntensity:.9}));
    sheet.rotation.x=-Math.PI/2; sheet.position.y=.06; sheet.scale.setScalar(h.r); g.add(sheet);
    const rim=m3(geo('hz_ir',()=>new THREE.TorusGeometry(1,.05,6,40)),
      mat('#dff2ff',{em:'#8fd0ff',ei:.7,rough:.2,metal:.1}),0,.06,0);
    rim.rotation.x=Math.PI/2; rim.scale.setScalar(h.r); g.add(rim);
    for(let i=0;i<7;i++){const a=rr(h.seed,i)*TAU,d=rr(h.seed,i+7)*h.r*.8;
      const cr=m3(geo('hz_ic',()=>new THREE.ConeGeometry(.1,.34,5)),
        mat('#bfe4ff',{em:'#7fc8ff',ei:.9,trans:true,op:.7,rough:.1}),
        Math.cos(a)*d,.12,Math.sin(a)*d);
      cr.rotation.set((rr(h.seed,i+2)-.5)*.5,0,(rr(h.seed,i+3)-.5)*.5); g.add(cr);}
  } else if(h.kind==='chasm'){
    const hole=new THREE.Mesh(geo('hz_c',()=>new THREE.CircleGeometry(1,36)),
      new THREE.MeshBasicMaterial({color:new THREE.Color('#05030a')}));
    hole.rotation.x=-Math.PI/2; hole.position.y=.07; hole.scale.setScalar(h.r); g.add(hole);
    const lip=m3(geo('hz_cl',()=>new THREE.TorusGeometry(1,.16,8,36)),
      mat('#3a3550',{rough:.9,metal:.15,tex:'rock',rep:2,ns:1.4}),0,.04,0);
    lip.rotation.x=Math.PI/2; lip.scale.setScalar(h.r); g.add(lip);
    const gl=new THREE.Mesh(geo('hz_cg',()=>new THREE.CircleGeometry(1,30)),glowMat('#8a5ad0',.18));
    gl.rotation.x=-Math.PI/2; gl.position.y=.09; gl.scale.setScalar(h.r*.8); g.add(gl);
    g.userData.glow=gl;
  } else if(h.kind==='steam'){
    const grate=m3(geo('hz_s',()=>lathe([[0,0],[1,0],[1,.1],[.8,.18],[0,.18]],20)),
      mat('#4a5476',{metal:.75,rough:.4,tex:'panel',rep:3,ns:.8}),0,0,0);
    grate.scale.set(h.r,1,h.r); g.add(grate);
    for(let i=0;i<5;i++){
      const sl=m3(geo('hz_ss',()=>new THREE.BoxGeometry(1.4,.06,.16)),
        mat('#0d1220',{rough:.9,metal:.2}),0,.16,(i-2)*.28);
      sl.scale.x=h.r*.9; g.add(sl);}
    // the burst column was a straight-sided cylinder: seen from the game camera a
    // 4-unit-tall tube is a solid cyan rectangle. A tapering plume reads as steam.
    const col=new THREE.Mesh(geo('hz_sc',()=>new THREE.CylinderGeometry(.3,1,3.4,18,1,true)),
      glowMat('#e8f4ff',.0,THREE.DoubleSide));
    col.position.y=1.7; col.scale.set(h.r,1,h.r); g.add(col); g.userData.col=col;
    const warn=new THREE.Mesh(geo('hz_sw',()=>new THREE.RingGeometry(.86,1,32)),glowMat('#ff4d5e',0,THREE.DoubleSide));
    warn.rotation.x=-Math.PI/2; warn.position.y=.2; warn.scale.setScalar(h.r*1.15); g.add(warn);
    g.userData.warn=warn;
  } else { // corrupt
    const patch=new THREE.Mesh(geo('hz_k',()=>new THREE.CircleGeometry(1,36)),glowMat('#8a4ad0',.22));
    patch.rotation.x=-Math.PI/2; patch.position.y=.05; patch.scale.setScalar(h.r); g.add(patch);
    const ring=m3(geo('hz_kr',()=>new THREE.TorusGeometry(1,.045,6,40)),
      mat('#b06cff',{em:'#b06cff',ei:1.2,metal:.5}),0,.06,0);
    ring.rotation.x=Math.PI/2; ring.scale.setScalar(h.r); g.add(ring); g.userData.ring=ring;
    const glyph=new THREE.Mesh(geo('hz_kg',()=>new THREE.RingGeometry(.3,.72,3,1)),
      glowMat('#d0a0ff',.4,THREE.DoubleSide));
    glyph.rotation.x=-Math.PI/2; glyph.position.y=.08; glyph.scale.setScalar(h.r); g.add(glyph);
    g.userData.glyph=glyph;
  }
  return g;
}

/* ---------- field pickup ---------- */
function makePickup(kind){
  const D=PICKUPS[kind], g=new THREE.Group();
  const shell=m3(geo('pk_s',()=>new THREE.OctahedronGeometry(.3,0)),
    mat(D.c,{em:D.c,ei:1.9,flat:true,metal:.4,rough:.25,trans:true,op:.85}),0,.55,0);
  g.add(shell); g.userData.shell=shell;
  const core=m3(geo('pk_c',()=>new THREE.SphereGeometry(.12,12,10)),
    mat('#ffffff',{em:D.c,ei:2.6}),0,.55,0);
  g.add(core);
  const ring=m3(geo('pk_r',()=>new THREE.TorusGeometry(.4,.026,6,28)),
    mat(D.c,{em:D.c,ei:1.5,metal:.6}),0,.55,0);
  ring.rotation.x=Math.PI/2; g.add(ring); g.userData.ring=ring;
  const gl=new THREE.Mesh(geo('pk_g',()=>new THREE.SphereGeometry(.62,12,10)),glowMat(D.c,.12));
  gl.position.y=.55; g.add(gl);
  const pad=new THREE.Mesh(geo('pk_p',()=>new THREE.RingGeometry(.34,.5,26)),glowMat(D.c,.4,THREE.DoubleSide));
  pad.rotation.x=-Math.PI/2; pad.position.y=.05; g.add(pad); g.userData.pad=pad;
  const beam=new THREE.Mesh(geo('pk_b',()=>new THREE.CylinderGeometry(.34,.42,2.6,14,1,true)),
    glowMat(D.c,.07,THREE.DoubleSide));
  beam.position.y=1.3; g.add(beam);
  g.traverse(o=>{if(o.isMesh)o.castShadow=false;});
  return g;
}
/* ---------- champion trim: a silhouette you can pick out of the pack ---------- */
function makeChampionTrim(kit,col){
  const g=new THREE.Group();
  const em=(c,i)=>mat(c,{em:c,ei:i,metal:.6,rough:.3,flat:true});
  if(kit==='crusher'){        // a battering wedge and twin exhaust stacks
    const ram=m3(geo('ch_ram',()=>lathe([[0,0],[.34,.05],[.26,.34],[.1,.5],[0,.52]],6)),mat('#c9b48a',{metal:.9,rough:.2,flat:true}),.42,.42,0);
    ram.rotation.z=-Math.PI/2; g.add(ram);
    for(const sd of [-1,1]){ const st=m3(geo('ch_st',()=>new THREE.CylinderGeometry(.05,.07,.36,6)),mat('#2b3252',{metal:.7}),-.18,.72,sd*.16); g.add(st);
      const fl=new THREE.Mesh(geo('ch_fl',()=>new THREE.ConeGeometry(.07,.22,6)),glowMat('#ff8a3a',.8)); fl.position.set(-.18,.98,sd*.16); g.add(fl); }
    const eye=m3(geo('ch_eye',()=>new THREE.BoxGeometry(.05,.07,.3)),em('#ff4d5e',3.2),.22,.62,0); g.add(eye);
  } else if(kit==='brood'){   // egg sacs hanging off the shell
    for(let i=0;i<5;i++){ const a=i/5*TAU; const p=m3(geo('ch_pod',()=>new THREE.SphereGeometry(.11,8,6)),
        mat('#ffbe7a',{em:'#ffbe7a',ei:1.4,trans:true,op:.85,rough:.2}),Math.cos(a)*.36,.24+Math.sin(i*2.3)*.1,Math.sin(a)*.36); g.add(p); }
    const crown=m3(geo('ch_cr',()=>new THREE.TorusGeometry(.3,.03,6,18)),em(col,1.6),0,.7,0); crown.rotation.x=Math.PI/2; g.add(crown);
  } else if(kit==='warden'){  // ice crystals on the shoulders and a frozen halo
    for(const sd of [-1,1]) for(let i=0;i<2;i++){ const c=m3(geo('ch_ice',()=>new THREE.ConeGeometry(.08,.42,5)),
        mat('#bfe4ff',{em:'#7fc8ff',ei:1.1,trans:true,op:.85,rough:.1}),-.06+i*.12,.5,sd*(.22+i*.06)); c.rotation.set(sd*.5,0,(i-.5)*.4); g.add(c); }
    const halo=m3(geo('ch_hl',()=>new THREE.TorusGeometry(.42,.02,6,24)),em('#8fd0ff',1.4),0,.72,0); halo.rotation.x=Math.PI/2; g.add(halo);
  } else if(kit==='magma'){   // cracked-open hull glowing from inside
    const cr=new THREE.LineSegments(geo('ch_crk',()=>new THREE.EdgesGeometry(new THREE.BoxGeometry(.7,.42,.56))),
      new THREE.LineBasicMaterial({color:new THREE.Color('#ff7a2a'),transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false}));
    cr.position.y=.44; g.add(cr);
    const heart=m3(geo('ch_ht',()=>new THREE.IcosahedronGeometry(.16,0)),em('#ff5a20',3),0,.98,0); g.add(heart);
    const gl=new THREE.Mesh(geo('ch_hg',()=>new THREE.SphereGeometry(.3,10,8)),glowMat('#ff7a2a',.14)); gl.position.y=.98; g.add(gl);
  } else if(kit==='archon'){  // two counter-rotating void rings and a crown of shards
    const r1=m3(geo('ch_r1',()=>new THREE.TorusGeometry(.62,.028,6,32)),em('#b06cff',1.8),0,.7,0); r1.rotation.x=Math.PI/2.4;
    const r2=r1.clone(); r2.rotation.set(Math.PI/2,0,Math.PI/3); g.add(r1,r2); g.userData.r1=r1; g.userData.r2=r2;
    for(let i=0;i<5;i++){ const a=i/5*TAU; const sh=m3(geo('ch_sh',()=>new THREE.OctahedronGeometry(.09,0)),em('#d0a0ff',2.2),Math.cos(a)*.3,1.15,Math.sin(a)*.3); g.add(sh); }
  }
  g.traverse(o=>{ if(o.isMesh)o.castShadow=false; });
  return g;
}
/* ---------- elite marker ring ---------- */
function makeEliteRing(col,mini){
  const g=new THREE.Group();
  const r=m3(geo('el_r',()=>new THREE.TorusGeometry(.55,.035,6,30)),
    mat(col,{em:col,ei:2.2,metal:.6}),0,.06,0);
  r.rotation.x=Math.PI/2; g.add(r);
  const glow=new THREE.Mesh(geo('el_g',()=>new THREE.RingGeometry(.58,.86,30)),
    glowMat(col,mini?.3:.18,THREE.DoubleSide));
  glow.rotation.x=-Math.PI/2; glow.position.y=.04; g.add(glow);
  if(mini){
    for(let i=0;i<3;i++){
      const s=m3(geo('el_s',()=>new THREE.ConeGeometry(.07,.3,4)),mat(col,{em:col,ei:1.6,flat:true}),0,.2,0);
      s.position.set(Math.cos(i/3*TAU)*.62,.2,Math.sin(i/3*TAU)*.62);
      g.add(s);
    }
  }
  g.traverse(o=>{if(o.isMesh)o.castShadow=false;});
  return g;
}

/* ---------- drifting toxin cloud ---------- */
function makeCloud(c){
  const g=new THREE.Group(), C=c.color||'#a6e22e';
  g.userData.blobs=[];
  for(let i=0;i<5;i++){
    const b=new THREE.Mesh(geo('cl_b',()=>new THREE.SphereGeometry(1,10,8)),
      glowMat(C,.16));
    const a=i/5*TAU, d=c.r*.45;
    b.position.set(Math.cos(a)*d,.45+Math.sin(i*2.1)*.22,Math.sin(a)*d);
    b.scale.setScalar(c.r*(.42+Math.random()*.3));
    g.add(b); g.userData.blobs.push({m:b,a,ph:Math.random()*6.28});
  }
  const core=new THREE.Mesh(geo('cl_c',()=>new THREE.SphereGeometry(1,14,12)),glowMat(C,.13));
  core.scale.setScalar(c.r*.75); core.position.y=.5; g.add(core);
  const pad=new THREE.Mesh(geo('cl_p',()=>new THREE.CircleGeometry(1,28)),glowMat(C,.12));
  pad.rotation.x=-Math.PI/2; pad.position.y=.05; pad.scale.setScalar(c.r); g.add(pad);
  g.userData.pad=pad;
  return g;
}
