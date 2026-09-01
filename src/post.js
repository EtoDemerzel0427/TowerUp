/* ===================== BLOOM POST-PROCESS ===================== */
/* three.js core ships no EffectComposer, so this is a hand-rolled
   bright-pass + separable gaussian + additive composite chain. */
const Post=(()=>{
let ren,rtScene,rtA,rtB,scn,cm,quad,mBright,mBlur,mComp,W0,H0,W1,H1;

const VERT=`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`;

const BRIGHT=`
uniform sampler2D tSrc; uniform float uThresh, uKnee; varying vec2 vUv;
void main(){
  vec3 c=texture2D(tSrc,vUv).rgb;
  float l=dot(c,vec3(.2126,.7152,.0722));
  float k=smoothstep(uThresh,uThresh+uKnee,l);
  gl_FragColor=vec4(c*k,1.);
}`;

const BLUR=`
uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
void main(){
  vec3 s=texture2D(tSrc,vUv).rgb*0.227027;
  s+=texture2D(tSrc,vUv+uDir*1.3846).rgb*0.316216;
  s+=texture2D(tSrc,vUv-uDir*1.3846).rgb*0.316216;
  s+=texture2D(tSrc,vUv+uDir*3.2308).rgb*0.070270;
  s+=texture2D(tSrc,vUv-uDir*3.2308).rgb*0.070270;
  gl_FragColor=vec4(s,1.);
}`;

const COMP=`
uniform sampler2D tBase, tBloom; uniform float uAmt; uniform vec2 uRes; varying vec2 vUv;
void main(){
  vec2 d=vUv-0.5;
  // lens dispersion grows toward the edges, so the frame reads like glass
  float ca=dot(d,d)*0.0032;
  vec3 base;
  base.r=texture2D(tBase,vUv+d*ca).r;
  base.g=texture2D(tBase,vUv).g;
  base.b=texture2D(tBase,vUv-d*ca).b;
  vec3 bloom=texture2D(tBloom,vUv).rgb;
  vec3 c=base+bloom*uAmt;
  // grade: lift the shadows toward deep blue, warm the highlights a touch
  float l=dot(c,vec3(0.2126,0.7152,0.0722));
  c=mix(c,vec3(0.04,0.06,0.13)+c*0.92,clamp(1.0-l*2.4,0.0,1.0)*0.55);
  c*=mix(vec3(0.95,0.98,1.06),vec3(1.06,1.01,0.94),clamp(l*1.35,0.0,1.0));
  c=(c-0.5)*1.075+0.5;                       // gentle contrast
  c*=1.0-dot(d,d)*0.42;                      // vignette
  // ShaderMaterial gets no automatic output chunks: encode linear -> sRGB by hand
  c=clamp(c,0.0,1.0);
  vec3 lo=c*12.92, hi=1.055*pow(c,vec3(1.0/2.4))-0.055;
  c=mix(hi,lo,step(c,vec3(0.0031308)));
  gl_FragColor=vec4(c,1.);
}`;

function makeMat(frag,uniforms){
  return new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:frag,uniforms,
    depthTest:false,depthWrite:false,toneMapped:false});
}
function init(renderer){
  ren=renderer;
  const v=new THREE.Vector2(); ren.getDrawingBufferSize(v);
  W0=Math.max(2,Math.floor(v.x)); H0=Math.max(2,Math.floor(v.y));
  W1=Math.max(2,Math.floor(W0/2)); H1=Math.max(2,Math.floor(H0/2));
  const opt={type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,
    depthBuffer:true,stencilBuffer:false};
  rtScene=new THREE.WebGLRenderTarget(W0,H0,opt);
  rtScene.texture.colorSpace=THREE.LinearSRGBColorSpace;
  const o2=Object.assign({},opt,{depthBuffer:false});
  rtA=new THREE.WebGLRenderTarget(W1,H1,o2);
  rtB=new THREE.WebGLRenderTarget(W1,H1,o2);
  rtA.texture.colorSpace=rtB.texture.colorSpace=THREE.LinearSRGBColorSpace;

  mBright=makeMat(BRIGHT,{tSrc:{value:null},uThresh:{value:.74},uKnee:{value:.28}});
  mBlur  =makeMat(BLUR,  {tSrc:{value:null},uDir:{value:new THREE.Vector2()}});
  mComp  =makeMat(COMP,  {tBase:{value:null},tBloom:{value:null},uAmt:{value:.58},
    uRes:{value:new THREE.Vector2(W0,H0)}});

  scn=new THREE.Scene(); cm=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mBright); quad.frustumCulled=false; scn.add(quad);
}
function pass(mat,target){ quad.material=mat; ren.setRenderTarget(target); ren.clear(); ren.render(scn,cm); }
function render(scene,cam){
  if(!rtScene){ ren.setRenderTarget(null); ren.render(scene,cam); return; }
  ren.setRenderTarget(rtScene); ren.clear(); ren.render(scene,cam);
  mBright.uniforms.tSrc.value=rtScene.texture; pass(mBright,rtA);
  for(let i=0;i<2;i++){
    mBlur.uniforms.tSrc.value=rtA.texture; mBlur.uniforms.uDir.value.set(1/W1,0); pass(mBlur,rtB);
    mBlur.uniforms.tSrc.value=rtB.texture; mBlur.uniforms.uDir.value.set(0,1/H1); pass(mBlur,rtA);
  }
  mComp.uniforms.tBase.value=rtScene.texture; mComp.uniforms.tBloom.value=rtA.texture;
  pass(mComp,null);
}
function setAmount(a){ if(mComp)mComp.uniforms.uAmt.value=a; }
function resize(){
  if(!ren||!rtScene)return;
  const v=new THREE.Vector2(); ren.getDrawingBufferSize(v);
  const w=Math.max(2,Math.floor(v.x)), h=Math.max(2,Math.floor(v.y));
  if(w===W0&&h===H0)return;
  W0=w; H0=h; W1=Math.max(2,Math.floor(w/2)); H1=Math.max(2,Math.floor(h/2));
  rtScene.setSize(W0,H0); rtA.setSize(W1,H1); rtB.setSize(W1,H1);
  mComp.uniforms.uRes.value.set(W0,H0);
}
return {init,render,setAmount,resize};
})();
