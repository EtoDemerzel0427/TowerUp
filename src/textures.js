/* ===================== PROCEDURAL TEXTURE LIBRARY =====================
   Everything here is drawn at runtime on a 2D canvas: colour/roughness maps
   plus matching NORMAL maps derived from a height pass with a Sobel filter.
   That relief is what stops the low-poly shapes reading as flat primitives. */
const TEX={};

function cnv(s){const c=document.createElement('canvas');c.width=c.height=s;return c;}
function tex(c,rep=1,srgb=true){
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep,rep);
  if(srgb)t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=8; return t;
}
/* height canvas -> tangent-space normal map */
function heightToNormal(hc,strength=2.2){
  const s=hc.width, src=hc.getContext('2d').getImageData(0,0,s,s).data;
  const out=cnv(s), od=out.getContext('2d').createImageData(s,s), d=od.data;
  const H=(x,y)=>src[(((y+s)%s)*s+((x+s)%s))*4]/255;
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){
    const dx=(H(x-1,y-1)+2*H(x-1,y)+H(x-1,y+1))-(H(x+1,y-1)+2*H(x+1,y)+H(x+1,y+1));
    const dy=(H(x-1,y-1)+2*H(x,y-1)+H(x+1,y-1))-(H(x-1,y+1)+2*H(x,y+1)+H(x+1,y+1));
    let nx=dx*strength, ny=dy*strength, nz=1;
    const l=Math.hypot(nx,ny,nz);
    const i=(y*s+x)*4;
    d[i]=((nx/l)*.5+.5)*255; d[i+1]=((ny/l)*.5+.5)*255; d[i+2]=((nz/l)*.5+.5)*255; d[i+3]=255;
  }
  out.getContext('2d').putImageData(od,0,0);
  const t=new THREE.CanvasTexture(out);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8; return t;
}
function noiseOn(x,s,amt,alpha){
  const img=x.getImageData(0,0,s,s), d=img.data;
  for(let i=0;i<d.length;i+=4){
    const n=(Math.random()-.5)*amt;
    d[i]=clamp(d[i]+n,0,255); d[i+1]=clamp(d[i+1]+n,0,255); d[i+2]=clamp(d[i+2]+n,0,255);
  }
  x.putImageData(img,0,0);
}

/* --- brushed / panelled armour plate --- */
function buildPanel(){
  const s=512, col=cnv(s), h=cnv(s), rgh=cnv(s);
  const cx=col.getContext('2d'), hx=h.getContext('2d'), rx=rgh.getContext('2d');
  cx.fillStyle='#8d97b8'; cx.fillRect(0,0,s,s);
  hx.fillStyle='#9a9a9a'; hx.fillRect(0,0,s,s);
  rx.fillStyle='#8a8a8a'; rx.fillRect(0,0,s,s);
  // irregular panels
  const cuts=[0,96,168,256,312,400,s];
  for(let i=0;i<cuts.length-1;i++)for(let j=0;j<cuts.length-1;j++){
    const x=cuts[i],y=cuts[j],w=cuts[i+1]-x,ht=cuts[j+1]-y;
    const v=.88+Math.random()*.24;
    cx.fillStyle='rgba('+(141*v|0)+','+(151*v|0)+','+(184*v|0)+',1)'; cx.fillRect(x+1,y+1,w-2,ht-2);
    hx.fillStyle='rgb('+(150+Math.random()*22|0)+',0,0)'.replace('rgb','rgba').replace(')',',1)');
    hx.fillStyle='rgb('+(150+(Math.random()*22|0))+','+(150+(Math.random()*22|0))+','+(150+(Math.random()*22|0))+')';
    hx.fillRect(x+2,y+2,w-4,ht-4);
    rx.fillStyle='rgb('+(120+(Math.random()*70|0))+',0,0)';
    rx.fillStyle='#'+((120+(Math.random()*70|0))).toString(16).padStart(2,'0').repeat(3);
    rx.fillRect(x+1,y+1,w-2,ht-2);
  }
  // recessed seams
  hx.strokeStyle='#3a3a3a'; hx.lineWidth=4;
  cx.strokeStyle='rgba(28,34,54,.85)'; cx.lineWidth=3;
  for(const c of cuts){ hx.beginPath();hx.moveTo(c,0);hx.lineTo(c,s);hx.moveTo(0,c);hx.lineTo(s,c);hx.stroke();
                        cx.beginPath();cx.moveTo(c,0);cx.lineTo(c,s);cx.moveTo(0,c);cx.lineTo(s,c);cx.stroke(); }
  // rivets
  for(const c of cuts)for(let k=24;k<s;k+=52){
    for(const [px,py] of [[c,k],[k,c]]){
      hx.fillStyle='#e8e8e8'; hx.beginPath();hx.arc(px,py,3.2,0,TAU);hx.fill();
      cx.fillStyle='rgba(190,200,228,.8)'; cx.beginPath();cx.arc(px,py,2.6,0,TAU);cx.fill();
    }
  }
  // brushed streaks
  cx.globalAlpha=.06;
  for(let i=0;i<420;i++){ cx.strokeStyle=Math.random()<.5?'#ffffff':'#000000'; cx.lineWidth=Math.random()*1.6;
    const y=Math.random()*s; cx.beginPath();cx.moveTo(0,y);cx.lineTo(s,y);cx.stroke(); }
  cx.globalAlpha=1;
  noiseOn(cx,s,16); noiseOn(hx,s,10);
  TEX.panel=tex(col,1); TEX.panelN=heightToNormal(h,2.0); TEX.panelR=tex(rgh,1,false);
}

/* --- per-biome ground -----------------------------------------------------
   Real CC0 PBR scans from ambientCG (see assets/CREDITS.txt), loaded on demand.
   They are deliberately tinted DOWN so the floor recedes and the units read:
   a loud floor turns the arena into a rug you cannot fight on.               */
const GROUND={};
const TEXLOADER=new THREE.TextureLoader();
function loadGroundMap(file,srgb,onFail){
  const t2=TEXLOADER.load('assets/'+file,undefined,undefined,()=>{ if(onFail)onFail(); });
  t2.wrapS=t2.wrapT=THREE.RepeatWrapping;
  if(srgb)t2.colorSpace=THREE.SRGBColorSpace;
  t2.anisotropy=8;
  return t2;
}
function groundTex(kind){
  if(GROUND[kind])return GROUND[kind];
  let failed=false;
  const fail=()=>{ if(failed)return; failed=true;
    const fb=proceduralGround(kind);
    GROUND[kind].col.image=fb.col.image; GROUND[kind].col.needsUpdate=true;
    GROUND[kind].nrm.image=fb.nrm.image; GROUND[kind].nrm.needsUpdate=true; };
  const col=loadGroundMap(kind+'_col.jpg',true,fail);
  const nrm=loadGroundMap(kind+'_nrm.jpg',false,fail);
  const rgh=loadGroundMap(kind+'_rgh.jpg',false,null);
  return GROUND[kind]={col,nrm,rgh};
}
/* offline fallback: a low-contrast generated surface, same restraint as above */
function proceduralGround(kind){
  const s=512, col=cnv(s), h=cnv(s);
  const cx=col.getContext('2d'), hx=h.getContext('2d');
  const base={metal:'#5b6480',ruins:'#6a6c58',snow:'#aebdd6',basalt:'#4a423e',void:'#4a4058'}[kind]||'#5b6480';
  cx.fillStyle=base; cx.fillRect(0,0,s,s);
  hx.fillStyle='#8c8c8c'; hx.fillRect(0,0,s,s);
  const rn=(a,b)=>a+Math.random()*(b-a);
  for(let i=0;i<260;i++){ const x=rn(0,s),y=rn(0,s),r=rn(18,90);
    const g2=cx.createRadialGradient(x,y,0,x,y,r);
    g2.addColorStop(0,'rgba(255,255,255,.05)');g2.addColorStop(1,'rgba(0,0,0,0)');
    cx.fillStyle=g2; cx.fillRect(x-r,y-r,r*2,r*2); }
  for(let i=0;i<40;i++){ let x=rn(0,s),y=rn(0,s);
    hx.strokeStyle='#5a5a5a'; hx.lineWidth=rn(2,6); hx.beginPath(); hx.moveTo(x,y);
    for(let k=0;k<6;k++){ x+=rn(-70,70); y+=rn(-70,70); hx.lineTo(x,y); } hx.stroke(); }
  noiseOn(cx,s,12); noiseOn(hx,s,16);
  return {col:tex(col,1), nrm:heightToNormal(h,1.2)};
}

/* --- rock / concrete for cover --- */
function buildRock(){
  const s=512, col=cnv(s), h=cnv(s);
  const cx=col.getContext('2d'), hx=h.getContext('2d');
  cx.fillStyle='#39405e'; cx.fillRect(0,0,s,s);
  hx.fillStyle='#8a8a8a'; hx.fillRect(0,0,s,s);
  for(let i=0;i<900;i++){ const x=Math.random()*s,y=Math.random()*s,r=3+Math.random()*26;
    const v=.7+Math.random()*.6;
    cx.fillStyle='rgba('+(57*v|0)+','+(64*v|0)+','+(94*v|0)+',.5)';
    cx.beginPath();cx.arc(x,y,r,0,TAU);cx.fill();
    const hv=110+Math.random()*80|0;
    hx.fillStyle='rgb('+hv+','+hv+','+hv+')';
    hx.beginPath();hx.arc(x,y,r*.8,0,TAU);hx.fill(); }
  // cracks
  hx.strokeStyle='#3a3a3a'; hx.lineWidth=3; cx.strokeStyle='rgba(12,16,30,.7)'; cx.lineWidth=2;
  for(let i=0;i<24;i++){ let x=Math.random()*s,y=Math.random()*s;
    hx.beginPath();hx.moveTo(x,y);cx.beginPath();cx.moveTo(x,y);
    for(let k=0;k<6;k++){ x+=(Math.random()-.5)*90; y+=(Math.random()-.5)*90; hx.lineTo(x,y); cx.lineTo(x,y); }
    hx.stroke();cx.stroke(); }
  noiseOn(cx,s,20); noiseOn(hx,s,18);
  TEX.rock=tex(col,1); TEX.rockN=heightToNormal(h,2.4);
}

/* --- hazard chevrons for the core apron --- */
function buildHazard(){
  const s=256,c=cnv(s),x=c.getContext('2d');
  x.fillStyle='#12172a';x.fillRect(0,0,s,s);
  x.save();x.rotate(-.7);
  for(let i=-s;i<s*2;i+=64){ x.fillStyle=(i/64)%2?'#f0b429':'#12172a'; x.fillRect(i,-s,32,s*3); }
  x.restore();
  x.globalAlpha=.35;noiseOn(x,s,26);x.globalAlpha=1;
  TEX.hazard=tex(c,1);
}
/* --- soft contact shadow blob --- */
function buildBlob(){
  const s=128,c=cnv(s),x=c.getContext('2d');
  const g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  g.addColorStop(0,'rgba(0,0,0,.72)');g.addColorStop(.55,'rgba(0,0,0,.32)');g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g;x.fillRect(0,0,s,s);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;TEX.blob=t;
}
function buildAllTextures(){ buildPanel(); buildRock(); buildHazard(); buildBlob(); }
