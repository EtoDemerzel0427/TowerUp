/* ===================== 3D WORLD ===================== */
const WX=x=>x/TILE-COLS/2, WZ=y=>y/TILE-ROWS/2;
const HALFW=COLS/2, HALFH=ROWS/2;

const World=(()=>{
let scene,cam,ren,ray,boardEl,dust,groundPlane;
let partGeo,partPts,partPos,partCol;
let beamGeo,beamLines,beamPos,beamCol;
let shockPool=[],magmaPool=[],dropPool=[];
let ghost=null,rangeRing=null,rangeDisc=null,selRing=null,aimRing=null,hoverPlate=null;
let playerObj=null,coreObj=null,coreRing=null,boardGroup=null,linkLines=null;
const L={};
const PMAX=1300, BMAX=1600;
const CAM_OFF=new THREE.Vector3(0,15.8,8.9);
let camTarget=new THREE.Vector3(0,0,0);
const propObjs=[], hazObjs=[];

/* ---------- procedural textures ---------- */
function texDot(){
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.35,'rgba(255,255,255,.55)');
  g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function texEnv(){
  const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'#243a6e');g.addColorStop(.42,'#16203c');g.addColorStop(.55,'#0a0e1c');g.addColorStop(1,'#05070f');
  x.fillStyle=g;x.fillRect(0,0,512,256);
  const blob=(bx,by,r,col,a)=>{const rg=x.createRadialGradient(bx,by,0,bx,by,r);
    rg.addColorStop(0,col);rg.addColorStop(1,'rgba(0,0,0,0)');x.globalAlpha=a;x.fillStyle=rg;
    x.fillRect(bx-r,by-r,r*2,r*2);x.globalAlpha=1;};
  blob(150,54,120,'#eaf2ff',1); blob(400,96,150,'#35e6ff',.55);
  blob(60,150,140,'#ff3d8a',.32); blob(300,230,180,'#0d2b3a',.6);
  const t=new THREE.CanvasTexture(c);
  t.mapping=THREE.EquirectangularReflectionMapping; t.colorSpace=THREE.SRGBColorSpace; return t;
}
let DOT;

/* ---------- init ---------- */
function init(){
  boardEl=document.getElementById('board');
  ren=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:false,powerPreference:'high-performance'});
  ren.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  ren.setSize(VW,VH,false);
  ren.shadowMap.enabled=true; ren.shadowMap.type=THREE.PCFSoftShadowMap;
  ren.toneMapping=THREE.ACESFilmicToneMapping; ren.toneMappingExposure=1.32;
  ren.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();
  scene.background=new THREE.Color('#05060e');
  scene.fog=new THREE.FogExp2(0x05060e,.019);
  cam=new THREE.PerspectiveCamera(46,VW/VH,.5,160);
  ray=new THREE.Raycaster();
  DOT=texDot();
  buildAllTextures();
  window.LAVA=groundTex('lava');

  const pmrem=new THREE.PMREMGenerator(ren);
  scene.environment=pmrem.fromEquirectangular(texEnv()).texture; pmrem.dispose();

  L.hemi=new THREE.HemisphereLight(0x6b81c4,0x0b0e1c,1.0); scene.add(L.hemi);
  L.fill=new THREE.DirectionalLight(0x9fb6ff,.55); L.fill.position.set(-4,9,16); scene.add(L.fill);
  const sun=L.sun=new THREE.DirectionalLight(0xdfeaff,2.15);
  sun.position.set(11,26,10); sun.castShadow=true;
  // phones get a quarter-size shadow map: soft PCF over 2048² on a mobile GPU is
  // the single most expensive thing in the frame, and the top-down camera hides it
  const coarse=matchMedia('(pointer: coarse)').matches;
  sun.shadow.mapSize.set(coarse?1024:2048,coarse?1024:2048);
  const sc=sun.shadow.camera; sc.left=-26;sc.right=26;sc.top=18;sc.bottom=-18;sc.near=1;sc.far=70;
  sun.shadow.bias=-.0012; sun.shadow.normalBias=.02;
  scene.add(sun); scene.add(sun.target);
  World_sun=sun;
  L.rim=new THREE.DirectionalLight(0x35e6ff,.6); L.rim.position.set(-14,7,-10); scene.add(L.rim);
  L.rim2=new THREE.DirectionalLight(0xff3d8a,.42); L.rim2.position.set(13,5,-12); scene.add(L.rim2);

  partGeo=new THREE.BufferGeometry();
  partPos=new Float32Array(PMAX*3); partCol=new Float32Array(PMAX*3);
  partGeo.setAttribute('position',new THREE.BufferAttribute(partPos,3));
  partGeo.setAttribute('color',new THREE.BufferAttribute(partCol,3));
  partPts=new THREE.Points(partGeo,new THREE.PointsMaterial({size:.19,map:DOT,vertexColors:true,
    transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
  partPts.frustumCulled=false; scene.add(partPts);

  beamGeo=new THREE.BufferGeometry();
  beamPos=new Float32Array(BMAX*3); beamCol=new Float32Array(BMAX*3);
  beamGeo.setAttribute('position',new THREE.BufferAttribute(beamPos,3));
  beamGeo.setAttribute('color',new THREE.BufferAttribute(beamCol,3));
  beamLines=new THREE.LineSegments(beamGeo,new THREE.LineBasicMaterial({vertexColors:true,
    transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  beamLines.frustumCulled=false; scene.add(beamLines);

  const rg=new THREE.RingGeometry(.82,1,48);
  for(let i=0;i<40;i++){const m=new THREE.Mesh(rg,glowMat('#ffffff',0,THREE.DoubleSide));
    m.rotation.x=-Math.PI/2; m.visible=false; scene.add(m); shockPool.push(m);}
  const cg=new THREE.CircleGeometry(1,26);
  for(let i=0;i<22;i++){const m=new THREE.Mesh(cg,glowMat('#ff6b3d',0));
    m.rotation.x=-Math.PI/2; m.visible=false; scene.add(m); magmaPool.push(m);}

  rangeRing=new THREE.Mesh(new THREE.RingGeometry(.97,1,80),glowMat('#35e6ff',.55,THREE.DoubleSide));
  rangeRing.rotation.x=-Math.PI/2; rangeRing.visible=false; scene.add(rangeRing);
  rangeDisc=new THREE.Mesh(new THREE.CircleGeometry(1,64),glowMat('#35e6ff',.055));
  rangeDisc.rotation.x=-Math.PI/2; rangeDisc.visible=false; scene.add(rangeDisc);
  selRing=new THREE.Mesh(new THREE.RingGeometry(.56,.64,6),glowMat('#ffc247',.85,THREE.DoubleSide));
  selRing.rotation.x=-Math.PI/2; selRing.visible=false; scene.add(selRing);
  aimRing=new THREE.Mesh(new THREE.RingGeometry(.86,1,64),glowMat('#ff4d5e',.7,THREE.DoubleSide));
  aimRing.rotation.x=-Math.PI/2; aimRing.visible=false; scene.add(aimRing);
  hoverPlate=new THREE.Mesh(new THREE.BoxGeometry(.94,.06,.94),glowMat('#35e6ff',.3));
  hoverPlate.visible=false; scene.add(hoverPlate);

  groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.05);
  Post.init(ren);
  addEventListener('resize',fit);
  addEventListener('orientationchange',()=>setTimeout(fit,120));
  fit();
}
let World_sun=null;
function fit(){
  // match the render shape to the element, so portrait phones do not get a letterbox slit
  const b=boardEl.getBoundingClientRect();
  if(b.width>2&&b.height>2){
    // a full-screen phone is around 0.46 wide/tall; the old .62 floor letterboxed it
    const ar=clamp(b.width/b.height,.42,2.1);
    VW=1200; VH=Math.round(1200/ar);
  }
  // VW/VH stay the logical space the HUD draws in; the render buffer is capped
  // separately so a tall phone does not end up rendering a 3MP frame with bloom
  if(ren){
    // setSize is multiplied by the pixel ratio, so cap against the real buffer
    const pr=ren.getPixelRatio()||1;
    let rw=VW, rh=VH; const MAXPIX=2.1e6, pix=rw*pr*rh*pr;
    if(pix>MAXPIX){ const k=Math.sqrt(MAXPIX/pix); rw=Math.round(rw*k); rh=Math.round(rh*k); }
    ren.setSize(rw,rh,false);
  }
  if(cam){ cam.aspect=VW/VH; cam.updateProjectionMatrix(); }
  const dpr=Math.min(2,devicePixelRatio||1);
  fx2d.width=Math.round(VW*dpr); fx2d.height=Math.round(VH*dpr);
  c2.setTransform(fx2d.width/VW,0,0,fx2d.height/VH,0,0);
  if(typeof Post!=='undefined'&&Post.resize)Post.resize();
}

/* ---------- arena ---------- */
function buildBoard(){
  if(boardGroup){scene.remove(boardGroup); disposeTree(boardGroup);}
  boardGroup=new THREE.Group(); scene.add(boardGroup);
  const rng=mulberry(hashStr(S.map.id));

  const B=BIOMES[S.map.biome]||BIOMES.deck;
  // retune the whole lighting rig to the region
  scene.fog.color.set(B.fog); scene.fog.density=B.fogD;
  scene.background.set(B.fog);
  L.sun.color.set(B.sunC); L.sun.intensity=B.sunI;
  L.hemi.color.set(B.hemiSky); L.hemi.groundColor.set(B.hemiGnd); L.hemi.intensity=B.hemiI;
  L.rim.color.set(B.rimA); L.rim2.color.set(B.rimB);
  const G=groundTex(B.ground);
  [G.col,G.nrm,G.rgh].forEach(t2=>{ if(t2)t2.repeat.set(COLS/B.gRep,ROWS/B.gRep); });
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(COLS,ROWS,1,1),
    new THREE.MeshStandardMaterial({
      map:G.col, normalMap:G.nrm, roughnessMap:G.rgh,
      color:new THREE.Color(B.gTint),          // tint the scan down so it recedes
      normalScale:new THREE.Vector2(B.gNorm,B.gNorm),
      roughness:B.gRough, metalness:B.ground==='metal'?.35:.1,
      envMapIntensity:B.ground==='snow'?1.2:.8}));
  floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; boardGroup.add(floor);

  const under=new THREE.Mesh(new THREE.BoxGeometry(COLS+2.4,1.4,ROWS+2.4),mat('#0a0d1a',{rough:.95,metal:.1}));
  under.position.y=-.72; boardGroup.add(under);

  // containment wall
  const wallM=mat(B.wall,{rough:.66,metal:.45,tex:'panel',rep:6,ns:.85});
  const mk=(w,h,d,x,y,z)=>{const b=m3(new THREE.BoxGeometry(w,h,d),wallM,x,y,z);boardGroup.add(b);return b;};
  mk(COLS+2.4,1.5,1.2,0,.6,-HALFH-.6); mk(COLS+2.4,1.5,1.2,0,.6,HALFH+.6);
  mk(1.2,1.5,ROWS+2.4,-HALFW-.6,.6,0); mk(1.2,1.5,ROWS+2.4,HALFW+.6,.6,0);
  for(const [w,d,x,z] of [[COLS+2.4,.08,0,-HALFH-.6],[COLS+2.4,.08,0,HALFH+.6],
                          [.08,ROWS+2.4,-HALFW-.6,0],[.08,ROWS+2.4,HALFW+.6,0]]){
    const s=new THREE.Mesh(new THREE.BoxGeometry(w,.05,d),glowMat(B.trim,.55));
    s.position.set(x,1.36,z); boardGroup.add(s);
  }

  // core apron: a glowing danger ring around what you must protect
  coreRing=new THREE.Mesh(new THREE.RingGeometry(CORE.r+1.0,CORE.r+1.18,72),glowMat('#35e6ff',.32,THREE.DoubleSide));
  coreRing.rotation.x=-Math.PI/2; coreRing.position.set(0,.05,0); boardGroup.add(coreRing);
  const apron=new THREE.Mesh(new THREE.CircleGeometry(CORE.r+1.05,64),glowMat('#0d5f7a',.16));
  apron.rotation.x=-Math.PI/2; apron.position.y=.04; boardGroup.add(apron);

  coreObj=makeCore(); coreObj.position.set(0,0,0); boardGroup.add(coreObj);

  // biome props replace the old generic blocks
  propObjs.length=0;
  for(const o of S.obstacles){
    const g=makeProp(o.kind,o); g.position.set(WX(o.x),0,WZ(o.y)); boardGroup.add(g);
    o.obj=g;
    g.userData.mats=[]; g.traverse(x=>{ if(x.isMesh&&x.material&&x.material.isMeshStandardMaterial){
      x.material=x.material.clone(); g.userData.mats.push([x.material,x.material.emissive.clone(),x.material.emissiveIntensity]); } });
    propObjs.push({g,seed:o.seed,float:g.userData.float,o});
  }
  hazObjs.length=0;
  for(const h of S.hazards){
    const g=makeHazard(h); g.position.set(WX(h.x),0,WZ(h.y)); boardGroup.add(g);
    h.obj=g; hazObjs.push(h);
  }

  // spawn markers on the rim
  for(let i=0;i<12;i++){
    const a=i/12*TAU;
    const x=clamp(Math.cos(a)*HALFW*1.02,-HALFW-.3,HALFW+.3);
    const z=clamp(Math.sin(a)*HALFH*1.02,-HALFH-.3,HALFH+.3);
    const m=new THREE.Mesh(new THREE.RingGeometry(.34,.46,16),glowMat('#ff3d8a',.4,THREE.DoubleSide));
    m.rotation.x=-Math.PI/2; m.position.set(x,.06,z); boardGroup.add(m);
  }

  const dn=300, dp=new Float32Array(dn*3), dc=new Float32Array(dn*3);
  for(let i=0;i<dn;i++){dp[i*3]=(rng()*2-1)*(HALFW+4);dp[i*3+1]=rng()*9;dp[i*3+2]=(rng()*2-1)*(HALFH+4);
    const v=.3+rng()*.5;dc[i*3]=v*B.dust[0];dc[i*3+1]=v*B.dust[1];dc[i*3+2]=v*B.dust[2];}
  const dg=new THREE.BufferGeometry();
  dg.setAttribute('position',new THREE.BufferAttribute(dp,3));
  dg.setAttribute('color',new THREE.BufferAttribute(dc,3));
  dust=new THREE.Points(dg,new THREE.PointsMaterial({size:.09,map:DOT,vertexColors:true,transparent:true,
    opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false}));
  boardGroup.add(dust);
}
function disposeTree(o){o.traverse(n=>{if(n.geometry)n.geometry.dispose();
  if(n.material){(Array.isArray(n.material)?n.material:[n.material]).forEach(m=>m.dispose&&m.dispose());}});}

/* ---------- entities ---------- */
function addPlayer(){ if(playerObj){scene.remove(playerObj);disposeTree(playerObj);}
  playerObj=makePlayer(); playerObj.scale.setScalar(1.3); scene.add(playerObj); }
function addTower(t){ const g=makeTower(t.key,t.lvl,t.elite);
  g.position.set(t.col+.5-HALFW,.36,t.row+.5-HALFH); scene.add(g); t.obj=g; }
function refreshTower(t){ if(t.obj){scene.remove(t.obj);disposeTree(t.obj);} addTower(t); }
function removeTower(t){ if(t.obj){scene.remove(t.obj);disposeTree(t.obj);t.obj=null;} }
function addEnemy(e){ const g=makeEnemy(e.type); g.scale.multiplyScalar(e.scale||1);
  if(e.affixDef){ const ring=makeEliteRing(e.affixDef.c,!!e.mini);
    ring.scale.setScalar(1/(e.scale||1)*(e.r/12)); g.add(ring); g.userData.eliteRing=ring; }
  // sappers carry a breaching torch -- you can pick them out of the pack before they
  // peel off, so intercepting is a decision instead of a surprise
  if(e.sapper){
    const t=new THREE.Group();
    const rod=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,7,6),
      mat({c:0x2a2f42,rough:.6,metal:.8}));
    rod.position.y=3.5; t.add(rod);
    const flame=new THREE.Mesh(new THREE.ConeGeometry(1.5,4.2,8),
      new THREE.MeshBasicMaterial({color:0xff8a3a,transparent:true,opacity:.9}));
    flame.position.y=8.6; t.add(flame);
    t.position.set(e.r*.85,e.r*.5,0);
    t.scale.setScalar(1/(e.scale||1));
    g.add(t); g.userData.torch=flame;
  }
  scene.add(g); e.obj=g;
  e.matEm=[]; g.traverse(o=>{if(o.isMesh&&o.material.isMeshStandardMaterial)
    e.matEm.push([o.material,o.material.emissiveIntensity,o.material.emissive.clone()]);}); }
const corpses=[];
function removeEnemy(e,violent){
  if(!e.obj)return;
  if(violent&&corpses.length<26){
    corpses.push({g:e.obj,t:0,life:.45,spin:rnd(6,-6),y0:e.obj.position.y});
    e.obj=null; return;
  }
  scene.remove(e.obj); disposeTree(e.obj); e.obj=null;
}
function updateCorpses(dt){
  for(let i=corpses.length-1;i>=0;i--){
    const c=corpses[i]; c.t+=dt;
    const k=c.t/c.life;
    if(k>=1){ scene.remove(c.g); disposeTree(c.g); corpses.splice(i,1); continue; }
    c.g.scale.setScalar(Math.max(.02,(1-k)*(1-k)));
    c.g.rotation.y+=c.spin*dt;
    c.g.rotation.z=k*1.6;
    c.g.position.y=c.y0-k*.25;
  }
}
function removeProp(o){
  if(o.obj){ boardGroup.remove(o.obj); disposeTree(o.obj); o.obj=null; }
  const i=propObjs.findIndex(p=>p.o===o); if(i>=0)propObjs.splice(i,1);
}
function addHazardLate(h){
  const g=makeHazard(h); g.position.set(WX(h.x),0,WZ(h.y)); boardGroup.add(g); h.obj=g; hazObjs.push(h);
}
function removeHazard(h){
  if(h.obj){ boardGroup.remove(h.obj); disposeTree(h.obj); h.obj=null; }
  const i=hazObjs.indexOf(h); if(i>=0)hazObjs.splice(i,1);
}
function addCloud(c){ const g=makeCloud(c); g.position.set(WX(c.x),0,WZ(c.y)); scene.add(g); c.obj=g; }
function removeCloud(c){ if(c.obj){ scene.remove(c.obj); disposeTree(c.obj); c.obj=null; } }
function addPickup(p){ const g=makePickup(p.kind); g.position.set(WX(p.x),0,WZ(p.y)); scene.add(g); p.obj=g; }
function removePickup(p){ if(p.obj){ scene.remove(p.obj); disposeTree(p.obj); p.obj=null; } }
function addRift(r){ const g=makeRift(); g.position.set(WX(r.x),0,WZ(r.y)); scene.add(g); r.obj=g; }
function removeRift(r){ if(r.obj){scene.remove(r.obj);disposeTree(r.obj);r.obj=null;} }
function addSalvage(s){ const g=makeSalvage(); g.position.set(WX(s.x),0,WZ(s.y)); scene.add(g); s.obj=g; }
function removeSalvage(s){ if(s.obj){scene.remove(s.obj);disposeTree(s.obj);s.obj=null;} }
/* resonance wiring drawn between linked turrets */
function updateLinks(){
  if(!linkLines){
    const geo2=new THREE.BufferGeometry();
    geo2.setAttribute('position',new THREE.BufferAttribute(new Float32Array(600*3),3));
    linkLines=new THREE.LineSegments(geo2,new THREE.LineBasicMaterial({
      color:new THREE.Color('#35e6ff'),transparent:true,opacity:.34,
      blending:THREE.AdditiveBlending,depthWrite:false}));
    linkLines.frustumCulled=false; scene.add(linkLines);
  }
  const pos=linkLines.geometry.attributes.position.array; let i=0;
  const done=new Set();
  for(const t of S.towers)for(const o of (t.links||[])){
    const k=t.col*4096+t.row+'-'+(o.col*4096+o.row);
    const k2=(o.col*4096+o.row)+'-'+(t.col*4096+t.row);
    if(done.has(k)||done.has(k2)||i>=594)continue;
    done.add(k);
    pos[i*3]=WX(t.x); pos[i*3+1]=.5; pos[i*3+2]=WZ(t.y); i++;
    pos[i*3]=WX(o.x); pos[i*3+1]=.5; pos[i*3+2]=WZ(o.y); i++;
  }
  linkLines.geometry.setDrawRange(0,i);
  linkLines.geometry.attributes.position.needsUpdate=true;
}
function addShot(s){
  const c=s.color, g=new THREE.Group();
  if(s.len){
    // tracer: an elongated core with an additive streak behind it
    const core=new THREE.Mesh(geo('trG',()=>new THREE.CapsuleGeometry(1,2,4,8)),
      new THREE.MeshBasicMaterial({color:new THREE.Color(c)}));
    core.rotation.z=Math.PI/2; core.scale.set(s.r,s.len*.5,s.r);
    const streak=new THREE.Mesh(geo('trS',()=>new THREE.PlaneGeometry(1,1)),
      new THREE.MeshBasicMaterial({color:new THREE.Color(c),transparent:true,opacity:.5,
        blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
    streak.rotation.x=-Math.PI/2; streak.scale.set(s.len*3.2,1,s.r*4.4);
    streak.position.x=-s.len*1.3;
    const streak2=streak.clone(); streak2.rotation.set(0,0,0); streak2.scale.set(s.len*3.2,s.r*4.4,1);
    g.add(core,streak,streak2);
    if(s.heavy){
      const halo=new THREE.Mesh(geo('trH',()=>new THREE.SphereGeometry(1,10,8)),glowMat(c,.4));
      halo.scale.setScalar(s.r*3.2); g.add(halo);
    }
  } else {
    const core=new THREE.Mesh(geo('shotG',()=>new THREE.SphereGeometry(1,8,6)),mat(c,{em:c,ei:2.6,metal:.2}));
    core.scale.setScalar(s.r||.11);
    const gl=new THREE.Mesh(geo('shotGl',()=>new THREE.SphereGeometry(1,8,6)),glowMat(c,.3));
    gl.scale.setScalar((s.r||.11)*2.9);
    g.add(core,gl);
  }
  scene.add(g); s.obj=g; }
function removeShot(s){ if(s.obj){scene.remove(s.obj);s.obj=null;} }

/* ---------- indicators ---------- */
function setRange(x,y,r,color){
  if(r==null){rangeRing.visible=rangeDisc.visible=false;return;}
  rangeRing.visible=rangeDisc.visible=true;
  rangeRing.position.set(WX(x),.09,WZ(y)); rangeRing.scale.setScalar(r);
  rangeDisc.position.set(WX(x),.08,WZ(y)); rangeDisc.scale.setScalar(r);
  rangeRing.material.color.set(color); rangeDisc.material.color.set(color);
}
function setGhost(key,c,r,ok){
  if(!key){ if(ghost)ghost.visible=false; hoverPlate.visible=false; return; }
  if(!ghost||ghost.userData.key!==key){
    if(ghost){scene.remove(ghost);disposeTree(ghost);}
    ghost=makeTower(key,1,null); ghost.userData.key=key;
    ghost.traverse(o=>{if(o.isMesh){o.castShadow=false;o.material=o.material.clone();
      o.material.transparent=true;o.material.opacity=.5;o.material.depthWrite=false;}});
    scene.add(ghost);
  }
  ghost.visible=true; ghost.position.set(c+.5-HALFW,.36,r+.5-HALFH);
  hoverPlate.visible=true; hoverPlate.position.set(c+.5-HALFW,.1,r+.5-HALFH);
  hoverPlate.material.color.set(ok?'#35e6ff':'#ff4d5e');
}
function setSel(t){ if(!t){selRing.visible=false;return;}
  selRing.visible=true; selRing.position.set(t.col+.5-HALFW,.09,t.row+.5-HALFH); }
function setAim(on,x,y,r){ aimRing.visible=on; if(on){aimRing.position.set(WX(x),.09,WZ(y));aimRing.scale.setScalar(r);} }

/* ---------- picking / projection ---------- */
const _v2=new THREE.Vector2(), _v3=new THREE.Vector3();
function pick(clientX,clientY){
  const b=boardEl.getBoundingClientRect();
  if(!b.width||!b.height)return null;
  const nx=((clientX-b.left)/b.width)*2-1, ny=-((clientY-b.top)/b.height)*2+1;
  _v2.set(nx,ny); ray.setFromCamera(_v2,cam);
  const hit=ray.ray.intersectPlane(groundPlane,_v3);
  if(!hit)return null;
  const px=(hit.x+HALFW)*TILE, py=(hit.z+HALFH)*TILE;
  return {px,py,col:Math.floor(px/TILE),row:Math.floor(py/TILE)};
}
function proj(x,y,z){
  _v3.set(WX(x),z,WZ(y)); _v3.project(cam);
  return {x:(_v3.x*.5+.5)*VW, y:(-_v3.y*.5+.5)*VH, vis:_v3.z<1};
}

/* ---------- per-frame ---------- */
function frame(dt,now){
  // camera follows the player, clamped so we never stare off the arena
  const ar=VW/VH;
  /* The camera was framed for a wide screen. On a full-height portrait phone the
     aspect drops to ~0.46, which squeezes the horizontal field of view down to
     about 22 degrees -- you simply cannot see what is walking in from the sides.
     Widen the lens and pull back as the screen narrows to win that view back. */
  const REF_AR=1200/680;
  let wantFov=46, pull=1;
  if(ar<REF_AR){
    const k=clamp(REF_AR/ar,1,3.9);
    wantFov=Math.min(74,46*Math.pow(k,.42));
    pull=Math.min(1.75,Math.pow(k,.30));
  }
  if(Math.abs(cam.fov-wantFov)>.01){ cam.fov=wantFov; cam.updateProjectionMatrix(); }
  const marginX=ar<1?5.4:7.2, marginZ=ar<1?6.5:3.6;
  const tx=clamp(WX(S.cam.x),-HALFW+marginX,HALFW-marginX);
  const tz=clamp(WZ(S.cam.y),-HALFH+marginZ,HALFH-marginZ);
  camTarget.x=lerp(camTarget.x,tx,Math.min(1,dt*6));
  camTarget.z=lerp(camTarget.z,tz,Math.min(1,dt*6));
  const sh=S.shake;
  cam.position.set(camTarget.x+CAM_OFF.x*pull+(Math.random()-.5)*sh,CAM_OFF.y*pull+(Math.random()-.5)*sh,
                   camTarget.z+CAM_OFF.z*pull+(Math.random()-.5)*sh);
  cam.lookAt(camTarget.x+(Math.random()-.5)*sh*.4,0,camTarget.z);
  if(World_sun){ World_sun.position.set(camTarget.x+11,26,camTarget.z+10);
    World_sun.target.position.set(camTarget.x,0,camTarget.z); World_sun.target.updateMatrixWorld(); }

  if(dust)dust.rotation.y+=dt*.012;
  updateCorpses(dt);

  // core
  if(coreObj){
    const u=coreObj.userData;
    u.dia.rotation.y+=dt*.55; u.dia.position.y=1.35+Math.sin(now*1.3)*.08;
    u.inner.rotation.y-=dt*1.1; u.inner.position.y=u.dia.position.y;
    if(u.wire){u.wire.rotation.y=u.dia.rotation.y;u.wire.position.y=u.dia.position.y;
      u.wire.material.opacity=.75+Math.sin(now*2.4)*.2;}
    if(u.gyro){u.gyro.rotation.y+=dt*.8;u.gyro.position.y=u.dia.position.y;}
    if(u.gyro2){u.gyro2.rotation.y-=dt*1.25;u.gyro2.position.y=u.dia.position.y;}
    u.guns.rotation.y=S.core.ang;
    const f=S.core.flash>0?S.core.flash:0;
    u.dia.material.emissiveIntensity=.75+f*7;
    if(coreRing){const hp=S.core.hp/S.core.maxHp;
      coreRing.material.color.set(hp>.5?'#35e6ff':hp>.25?'#ffc247':'#ff4d5e');
      coreRing.material.opacity=.3+Math.sin(now*3)*.06+(1-hp)*.3;}
  }

  // player
  const P=S.P;
  if(playerObj&&P){
    playerObj.visible=P.alive;
    playerObj.position.set(WX(P.x),0,WZ(P.y));
    playerObj.rotation.y=-P.face;
    const u=playerObj.userData;
    if(u.arm)u.arm.rotation.y=-(P.aim-P.face);
    const bob=P.moving?Math.abs(Math.sin(now*11))*.05:Math.sin(now*2)*.02;
    playerObj.position.y=bob+(P.dashT>0?.12:0);
    if(u.jet)u.jet.scale.set(P.dashT>0?2.6:(P.moving?1.2:.5),1,1);
    if(u.flash){ const on=P.flashT>0;
      u.flash.visible=on;
      if(on){ const k=P.flashT/.055; u.flash.scale.setScalar(.7+k*.75+(P.kick>1?.6:0));
        u.flash.rotation.x=Math.random()*3.14; } }
    if(u.gun)u.gun.position.x=.3-P.kick*.11;
    if(u.ultBeam){
      const on=P.ultT>0;
      u.ultBeam.visible=on;
      if(on){
        const L=PLAYER.ultRange, k=Math.min(1,P.ultT/ .25), fade=Math.min(1,(PLAYER.ultTime-P.ultT)/.18);
        const wob=1+Math.sin(now*40)*.06;
        u.ultParts.forEach((b,i)=>{ b.scale.set(wob*(1+i*.05),L,wob*(1+i*.05));
          b.position.x=.5+L*.5; });
        u.ultBall.scale.setScalar(1+Math.sin(now*30)*.18);
        u.ultBeam.scale.setScalar(Math.min(k,fade)*.4+.6);
      }
    }
    if(u.charge){ const c=P.charging?P.charge/PLAYER.chargeMax:0;
      u.charge.visible=c>.04;
      u.charge.scale.setScalar(.35+c*1.5);
      u.charge.material.opacity=.35+c*.55; }
    if(u.ring){
      const ready=P.ult>=1&&P.ultT<=0;
      u.ring.material.opacity=.4+Math.sin(now*(ready?7:4))*(ready?.3:.12)+(P.iframe>0?.35:0);
      u.ring.material.color.set(ready?'#ffe89a':P.iframe>0?'#ffffff':'#35e6ff');
      u.ring.scale.setScalar(ready?1+Math.sin(now*7)*.14:1);
    }
    // charged-up aura on the unit itself
    if(u.halo===undefined){
      const h=new THREE.Mesh(geo('plUltHalo',()=>new THREE.SphereGeometry(.8,14,12)),
        glowMat('#ffe89a',0));
      h.position.y=.45; playerObj.add(h); u.halo=h;
    }
    if(u.halo){
      const ready=P.ult>=1&&P.ultT<=0;
      u.halo.material.opacity=ready?.10+Math.sin(now*7)*.06:0;
      u.halo.scale.setScalar(1+Math.sin(now*5)*.08);
    }
  }

  // towers
  for(const t of S.towers){
    const o=t.obj; if(!o)continue;
    if(o.userData.turret&&t.target){
      const a=Math.atan2(-(t.target.y-t.y),(t.target.x-t.x));
      const cur=o.userData.turret.rotation.y;
      o.userData.turret.rotation.y=cur+norm(a-cur)*Math.min(1,dt*11);
    }
    const u=o.userData, top=u.top&&u.top.userData;
    if(u.crown)u.crown.rotation.z+=dt*1.2;
    if(top){
      if(top.crystal){top.crystal.rotation.y+=dt*.9;top.crystal.position.y=.86+Math.sin(now*1.7+t.col)*.05;}
      if(top.orbit)top.orbit.rotation.y-=dt*1.5;
      if(top.orb)top.orb.scale.setScalar(1+Math.sin(now*7+t.row)*.07);
      if(top.bubble)top.bubble.scale.set(1+Math.sin(now*3.3)*.05,1+Math.cos(now*4.1)*.06,1+Math.sin(now*3.7)*.05);
      if(top.core){top.core.rotation.y+=dt*1.1;top.core.rotation.x+=dt*.6;}
      if(top.r1)top.r1.rotation.z+=dt*1.3;
      if(top.r2)top.r2.rotation.y+=dt*1.7;
    }
    if(t.recoil>0){ t.recoil=Math.max(0,t.recoil-dt*5);
      if(u.recoil)u.recoil.position.x=(t.key==='sniper'?.5:.3)-t.recoil*.26; }
    if(u.flash){
      const on=t.recoil>.55;
      u.flash.visible=on;
      if(on){ const k=(t.recoil-.55)/.45;
        u.flash.scale.setScalar(.5+k*1.0);
        u.flash.rotation.x=Math.random()*3.14; }
    }
    // a freshly built turret rises out of the deck
    if(t.riseT>0){ const k=1-t.riseT/.45;
      o.position.y=.36-(1-k)*1.5;
      o.scale.setScalar(.55+k*.45);
    } else if(o.scale.x!==1){ o.position.y=.36; o.scale.setScalar(1); }
    // damage tint
    if(t.flash>0&&o.userData.top){ o.userData.top.rotation.z=Math.sin(now*40)*.05; }
    else if(o.userData.top) o.userData.top.rotation.z=0;
  }

  // enemies
  for(const e of S.enemies){
    const o=e.obj; if(!o)continue;
    const hy=e.fly?1.5+Math.sin(now*2.2+e.seed)*.12:0;
    o.position.set(WX(e.x),hy,WZ(e.y));
    o.rotation.y=-e.face;
    o.rotation.z=e.stagger>0?Math.sin(now*22)*.09:0;
    const u=o.userData;
    if(u.spin)u.spin.rotation.y+=dt*1.4;
    if(u.r1)u.r1.rotation.z+=dt*2.1;
    if(u.r2)u.r2.rotation.y+=dt*1.5;
    if(u.orb){u.orb.rotation.y+=dt*2;u.orb.position.y=.68+Math.sin(now*3+e.seed)*.06;}
    if(u.spikes)u.spikes.rotation.y+=dt*.5;
    if(u.ring)u.ring.rotation.z+=dt*.9;
    if(u.legs){const k=now*Math.max(.4,e.curSp)*4+e.seed;
      u.legs.children.forEach((l,i)=>{l.position.y=(e.type==='brute'?.12:.1)+Math.abs(Math.sin(k+i*1.7))*.09;});}
    if(u.shieldMesh)u.shieldMesh.visible=e.shield>0;
    if(!e.fly&&!u.legs)o.position.y=Math.abs(Math.sin(now*Math.max(.4,e.curSp)*3+e.seed))*.05;
    if(e.matEm){
      const f=e.flash>0?e.flash:0, frozen=e.stun>0, chilled=e.slowT>0;
      // burning and poisoned used to look exactly like healthy: only a couple of
      // stray particles a second. Colour the unit so the effect is readable at a glance.
      const burning=e.burnT>0, poisoned=e.poisonT>0, shredded=(e.shred||0)>0;
      const brk=e.breakFlash>0?e.breakFlash/.5:0, stag=e.stagger>0;
      for(const [m,ei,ec] of e.matEm){
        m.emissiveIntensity=ei+f*4+brk*6+(stag?1.2:0)+(burning?.9:0)+(poisoned?.5:0);
        if(brk>0)m.emissive.setRGB(1,.92,.6);
        else if(stag)m.emissive.setRGB(.9,.75,.35);
        else if(f>0)m.emissive.setRGB(1,1,1);
        else if(frozen)m.emissive.setRGB(.35,.75,1);
        else if(burning)m.emissive.copy(ec).lerp(new THREE.Color(1,.42,.12),.7);
        else if(poisoned)m.emissive.copy(ec).lerp(new THREE.Color(.55,.95,.15),.6);
        else if(chilled)m.emissive.copy(ec).lerp(new THREE.Color(.2,.5,.9),.45);
        else if(shredded)m.emissive.copy(ec).lerp(new THREE.Color(1,.85,.55),.3);
        else m.emissive.copy(ec);
      }
    }
  }

  // terrain hazards
  for(const h of hazObjs){
    const o=h.obj; if(!o)continue; const u=o.userData;
    if(h.kind==='lava'&&u.pool){
      u.pool.material.color.setHSL(.045,.8,.58+Math.sin(now*1.7+h.seed)*.07);
      u.pool.material.opacity=.88+Math.sin(now*2.3+h.seed)*.06;
      if(Math.random()<dt*3){const a=Math.random()*TAU,d=Math.random()*h.r*TILE;
        part(h.x+Math.cos(a)*d,h.y+Math.sin(a)*d,.2,'#ff9a3d',{sp:rnd(2.2,.5),el:1.3,life:.7,r:.11,g:2.4});}
    } else if(h.kind==='chasm'&&u.glow){
      u.glow.material.opacity=.14+Math.sin(now*1.4+h.seed)*.06;
    } else if(h.kind==='corrupt'){
      if(u.glyph)u.glyph.rotation.z+=dt*.5;
      if(u.ring)u.ring.material.emissiveIntensity=1.0+Math.sin(now*2.6+h.seed)*.5;
      if(Math.random()<dt*4){const a=Math.random()*TAU,d=Math.random()*h.r*TILE;
        part(h.x+Math.cos(a)*d,h.y+Math.sin(a)*d,.15,'#b06cff',{sp:rnd(1,.2),el:1.4,life:1.0,r:.08,g:-1.2});}
    } else if(h.kind==='steam'){
      const warn=h.phase==='warn', burst=h.phase==='burst';
      if(u.warn){ u.warn.material.opacity=warn?(.35+Math.sin(now*22)*.25):0; }
      if(u.col){ u.col.material.opacity=burst?.42:0;
        u.col.scale.y=burst?1:.2; }
    }
  }
  for(const p of propObjs){
    if(p.float){ p.float.position.y=1.35+Math.sin(now*.9+p.seed)*.16; p.float.rotation.y+=dt*.12; }
    if(p.g.userData.warn){                       // explosive crates blink
      const b=(Math.sin(now*4+p.seed)+1)*.5;
      p.g.userData.warn.material.emissiveIntensity=1.4+b*3.4;
      if(p.g.userData.warnHalo)p.g.userData.warnHalo.material.opacity=.12+b*.22;
    }
    const o=p.o;
    if(o&&p.g.userData.mats){
      const f=o.flash>0?o.flash/.14:0;
      const hurtGlow=o.hp<o.maxHp?(1-o.hp/o.maxHp)*.5:0;
      for(const [m,ec,ei] of p.g.userData.mats){
        m.emissiveIntensity=ei+f*5+hurtGlow;
        if(f>0)m.emissive.setRGB(1,1,1);
        else if(hurtGlow>0)m.emissive.setRGB(.8*hurtGlow,.25*hurtGlow,.12*hurtGlow);
        else m.emissive.copy(ec);
      }
      p.g.position.x=WX(o.x)+(f>0?(Math.random()-.5)*.09:0);
      p.g.position.z=WZ(o.y)+(f>0?(Math.random()-.5)*.09:0);
    }
  }

  // drifting gas
  for(const c of S.clouds){
    const o=c.obj; if(!o)continue;
    o.position.set(WX(c.x),0,WZ(c.y));
    const fade=Math.min(1,(c.life-c.t)/1.6)*Math.min(1,c.t/.4);
    for(const b of o.userData.blobs){
      b.m.position.x=Math.cos(b.a+now*.5)*c.r*.45;
      b.m.position.z=Math.sin(b.a+now*.5)*c.r*.45;
      b.m.position.y=.45+Math.sin(now*1.6+b.ph)*.22;
      // three LV4 clouds over the Core used to stack into an opaque green wall
      // you could not see enemies through; thinner blobs, same radius
      b.m.material.opacity=.09*fade;
    }
    o.userData.pad.material.opacity=.08*fade;
    o.rotation.y+=dt*.35;
  }
  // field pickups
  for(const p of S.pickups){
    const o=p.obj; if(!o)continue; const u=o.userData;
    o.position.y=Math.sin(now*2.4+p.x)*.09;
    u.shell.rotation.y+=dt*1.3; u.shell.rotation.x+=dt*.5;
    u.ring.rotation.z+=dt*1.9;
    u.pad.material.opacity=.3+Math.sin(now*4)*.12;
    const left=p.life-p.t;
    if(left<4.5){ const blink=Math.sin(now*(left<2?26:13))>0;   // about to vanish
      o.visible=blink; } else o.visible=true;
  }
  // elite rings
  for(const e of S.enemies){ const o=e.obj; if(!o)continue;
    if(o.userData.eliteRing)o.userData.eliteRing.rotation.y+=dt*1.1;
    const f=o.userData.torch;
    if(f){ const k=e.sapT?1:.55;                       // flares up once it has picked a target
      f.scale.setScalar(k*(.85+.3*Math.sin(S.time*11+e.seed)));
      f.material.opacity=k*(.7+.25*Math.sin(S.time*9+e.seed)); }
  }
  // rifts
  for(const r of S.rifts){
    const o=r.obj; if(!o)continue;
    const u=o.userData;
    u.ring.rotation.z+=dt*.7; u.ring2.rotation.z-=dt*1.5;
    u.swirl.rotation.z-=dt*2.4;
    const pulse=1+Math.sin(now*3+r.idx)*.05+(r.flash>0?.22:0);
    u.ring.scale.setScalar(pulse); u.swirl.scale.setScalar(pulse);
    u.ring.material.emissiveIntensity=2.4+(r.flash>0?7:0);
    u.scar.material.opacity=.24+Math.sin(now*2+r.idx)*.06;
    o.position.y=Math.sin(now*1.6+r.idx)*.06;
  }
  // salvage
  for(const s of S.salvage){
    const o=s.obj; if(!o)continue;
    const u=o.userData;
    u.beacon.position.y=.75+Math.sin(now*3)*.08; u.beacon.rotation.y+=dt*2;
    u.ring.material.opacity=.25+Math.sin(now*4)*.08+(s.p>0?.3:0);
    // the progress arc was rebuilt as a fresh geometry every single frame of a
    // channel; rebuild only when it has visibly moved (about 40 times a strip)
    const pq=s.p>0?Math.ceil(clamp(s.p,0,1)*40)/40:0;
    if(u.progQ!==pq){
      u.progQ=pq;
      if(u.prog){ o.remove(u.prog); u.prog.geometry.dispose(); u.prog=null; }
      if(pq>0){
        const ng=new THREE.Mesh(new THREE.RingGeometry(SALVAGE.r*.72,SALVAGE.r*.9,48,1,-Math.PI/2,TAU*pq),
          glowMat('#ffe89a',.95,THREE.DoubleSide));
        ng.rotation.x=-Math.PI/2; ng.position.y=.08; o.add(ng); u.prog=ng;
      }
    }
  }
  if(linkLines)linkLines.material.opacity=.24+Math.sin(now*2.2)*.1;

  for(const s of S.shots) if(s.obj){ s.obj.position.set(WX(s.x),s.z,WZ(s.y));
    if(s.ang!==undefined)s.obj.rotation.y=-s.ang; }
  for(const s of S.ebullets) if(s.obj)s.obj.position.set(WX(s.x),s.z,WZ(s.y));

  // drops
  dropPool.forEach(m=>m.visible=false);
  for(let i=0;i<S.drops.length&&i<dropPool.length;i++){
    const d=S.drops[i]; let m=dropPool[i];
    if(m.userData.kind!==d.kind){ scene.remove(m); disposeTree(m);
      m=makeDrop(d.kind); m.userData.kind=d.kind; dropPool[i]=m; scene.add(m); }
    m.visible=true;
    m.position.set(WX(d.x),.3+Math.sin(now*4+i)*.08,WZ(d.y));
    m.rotation.y=now*2+i;
  }

  // particles
  let pi=0;
  for(const p of S.parts){
    if(pi>=PMAX)break;
    const k=1-p.t/p.life;
    partPos[pi*3]=WX(p.x); partPos[pi*3+1]=p.z; partPos[pi*3+2]=WZ(p.y);
    partCol[pi*3]=p.col.r*k; partCol[pi*3+1]=p.col.g*k; partCol[pi*3+2]=p.col.b*k; pi++;
  }
  partGeo.setDrawRange(0,pi);
  partGeo.attributes.position.needsUpdate=true; partGeo.attributes.color.needsUpdate=true;

  // beams
  let bi=0;
  for(const b of S.beams){
    const k=1-b.t/b.life, segs=b.jag?5:1;
    for(let i=0;i<segs&&bi<BMAX-2;i++){
      const t1=i/segs,t2=(i+1)/segs;
      const jx=b.jag?Math.sin(b.seed+i*3.1)*b.jag:0, jz=b.jag?Math.cos(b.seed+i*2.3)*b.jag:0;
      const jx2=b.jag&&i<segs-1?Math.sin(b.seed+(i+1)*3.1)*b.jag:0, jz2=b.jag&&i<segs-1?Math.cos(b.seed+(i+1)*2.3)*b.jag:0;
      beamPos[bi*3]=lerp(WX(b.a.x),WX(b.b.x),t1)+jx;
      beamPos[bi*3+1]=lerp(b.a.z,b.b.z,t1)+(b.jag?Math.sin(b.seed+i)*b.jag*.5:0);
      beamPos[bi*3+2]=lerp(WZ(b.a.y),WZ(b.b.y),t1)+jz;
      beamCol[bi*3]=b.col.r*k;beamCol[bi*3+1]=b.col.g*k;beamCol[bi*3+2]=b.col.b*k; bi++;
      beamPos[bi*3]=lerp(WX(b.a.x),WX(b.b.x),t2)+jx2;
      beamPos[bi*3+1]=lerp(b.a.z,b.b.z,t2)+(b.jag&&i<segs-1?Math.sin(b.seed+i+1)*b.jag*.5:0);
      beamPos[bi*3+2]=lerp(WZ(b.a.y),WZ(b.b.y),t2)+jz2;
      beamCol[bi*3]=b.col.r*k;beamCol[bi*3+1]=b.col.g*k;beamCol[bi*3+2]=b.col.b*k; bi++;
    }
  }
  beamGeo.setDrawRange(0,bi);
  beamGeo.attributes.position.needsUpdate=true; beamGeo.attributes.color.needsUpdate=true;

  shockPool.forEach((m,i)=>{const s=S.shocks[i];
    if(!s){m.visible=false;return;}
    const k=s.t/s.life; m.visible=true;
    m.position.set(WX(s.x),s.z+.02,WZ(s.y));
    m.scale.setScalar(lerp(s.r0,s.r1,1-(1-k)*(1-k)));
    m.material.color.set(s.c); m.material.opacity=(1-k)*.8;
  });
  magmaPool.forEach((m,i)=>{const p=S.magma[i];
    if(!p){m.visible=false;return;}
    m.visible=true; m.position.set(WX(p.x),.06,WZ(p.y)); m.scale.setScalar(p.r);
    m.material.opacity=.28+Math.sin(now*6+i)*.07;
  });

  Post.render(scene,cam);
}
function initDropPool(){
  for(let i=0;i<90;i++){const m=makeDrop('xp'); m.userData.kind='xp'; m.visible=false; scene.add(m); dropPool.push(m);}
}
return {init,buildBoard,frame,pick,proj,
  get lights(){return L;},addTower,removeTower,refreshTower,addEnemy,removeEnemy,
  addShot,removeShot,addPlayer,initDropPool,setRange,setGhost,setSel,setAim,fit,
  addRift,removeRift,addSalvage,removeSalvage,updateLinks,removeProp,addHazardLate,removeHazard,
  addPickup,removePickup,addCloud,removeCloud,
  get scene(){return scene;}, get cam(){return cam;}};
})();
