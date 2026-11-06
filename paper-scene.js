import * as THREE from './vendor/three.module.min.js';

// The SVG remains the authoritative artwork. Its alpha channel also defines
// perforations in the lit surfaces and the short side walls of the paper.
async function rasterize(svg) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const url = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml'}));
  try {
    const image = await new Promise((resolve,reject) => {
      const img = new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=url;
    });
    const ctx=canvas.getContext('2d'); ctx.drawImage(image,0,0,1024,1024);
    ctx.globalCompositeOperation='source-atop';
    let seed=17;
    for(let i=0;i<19000;i++) {
      seed=(seed*16807)%2147483647;const x=seed%1024;
      seed=(seed*16807)%2147483647;const y=seed%1024;
      ctx.fillStyle=i%2?'rgba(255,237,196,.065)':'rgba(67,15,9,.055)';
      ctx.fillRect(x,y,1+(i%3),.7);
    }
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}

const curl=(x,y)=>.035*Math.sin(x*.9)*Math.cos(y*.65);
function wedgeGeometry(start,end) {
  const segments=Math.max(24,Math.ceil((end-start)*35));
  const positions=[0,0,curl(0,0)],uv=[.5,.5],indices=[];
  for(let i=0;i<=segments;i++) {
    const a=start+(end-start)*i/segments,x=3.6*Math.cos(a),y=3.6*Math.sin(a);
    positions.push(x,y,curl(x,y));uv.push(x/5+.5,y/5+.5);
    if(i>0)indices.push(0,i,i+1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

function paperEdges(canvas) {
  const res=384,c=document.createElement('canvas');c.width=c.height=res;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,res,res);
  const alpha=ctx.getImageData(0,0,res,res).data;
  const present=(x,y)=>x>=0&&x<res&&y>=0&&y<res&&alpha[(y*res+x)*4+3]>150;
  const positions=[];
  const quad=(a,b)=>{
    const ax=(a[0]/res-.5)*5,ay=(.5-a[1]/res)*5,bx=(b[0]/res-.5)*5,by=(.5-b[1]/res)*5;
    const az=curl(ax,ay),bz=curl(bx,by),d=.025;
    positions.push(ax,ay,az,bx,by,bz,bx,by,bz-d,ax,ay,az,bx,by,bz-d,ax,ay,az-d);
  };
  for(let y=0;y<res;y++)for(let x=0;x<res;x++)if(present(x,y)) {
    if(!present(x-1,y))quad([x,y],[x,y+1]);
    if(!present(x+1,y))quad([x+1,y+1],[x+1,y]);
    if(!present(x,y-1))quad([x+1,y],[x,y]);
    if(!present(x,y+1))quad([x,y+1],[x+1,y+1]);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();return geo;
}

export async function createPaperScene(container,svg,{hero=false,fold=4,color='#b92d2c',onContextLoss}={}) {
  const canvas=await rasterize(svg);
  let renderer;
  try { renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'}); }
  catch { throw new Error('当前设备不支持 WebGL，已使用纸张光影视图。'); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.8));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.82;
  renderer.setClearColor(0x000000,0);
  renderer.domElement.setAttribute('aria-label',hero?'立体纸雕，移动鼠标观察光影':'剪纸立体展台，拖动旋转，滚轮缩放');
  renderer.domElement.setAttribute('role','img');renderer.domElement.tabIndex=hero?-1:0;
  container.append(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(hero?36:38,1,.1,60);camera.position.set(0,0,hero?8.1:8.4);
  const ambient=new THREE.HemisphereLight(0xfff4dc,0x847052,1.5);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xfff0cb,2.5);key.position.set(-3,4,8);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-4;key.shadow.camera.right=4;
  key.shadow.camera.top=4;key.shadow.camera.bottom=-4;key.shadow.camera.near=.5;key.shadow.camera.far=20;
  key.shadow.normalBias=.01;key.shadow.bias=-.0001;key.shadow.radius=3;key.shadow.blurSamples=12;scene.add(key);
  const rim=new THREE.DirectionalLight(0xffc88c,.55);rim.position.set(3,-2,3);scene.add(rim);
  const backdropMaterial=hero?new THREE.ShadowMaterial({color:0x665238,opacity:.3}):new THREE.MeshStandardMaterial({color:0xe8ddc5,roughness:1,metalness:0});
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(100,100),backdropMaterial);backdrop.position.z=-.85;backdrop.receiveShadow=true;scene.add(backdrop);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const faceMaterial=new THREE.MeshStandardMaterial({map:texture,alphaTest:.5,alphaToCoverage:true,side:THREE.DoubleSide,roughness:.96,metalness:0});
  const backMaterial=faceMaterial.clone();backMaterial.color.set(0xcdad91);
  const edgeMaterial=new THREE.MeshStandardMaterial({color:new THREE.Color(color).multiplyScalar(.7),roughness:1,side:THREE.DoubleSide});
  const paper=new THREE.Group();scene.add(paper);paper.position.y=.06;
  const pieces=[];const count=hero?8:Math.max(1,fold);
  for(let k=0;k<count;k++) {
    const group=new THREE.Group(),geo=wedgeGeometry(k/count*Math.PI*2,(k+1)/count*Math.PI*2);
    const top=new THREE.Mesh(geo,faceMaterial);top.castShadow=true;top.receiveShadow=false;
    const bottom=new THREE.Mesh(geo,backMaterial);bottom.position.z=-.025;bottom.castShadow=true;
    group.add(top,bottom);paper.add(group);pieces.push(group);
  }
  const edges=new THREE.Mesh(paperEdges(canvas),edgeMaterial);edges.castShadow=true;paper.add(edges);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let disposed=false,visible=true,raf=0,drag=null,rotation={x:hero?-.2:-.28,y:hero?-.34:-.25,z:-.09};
  let target={...rotation},turning=false,start=performance.now()-(hero||reduce?4000:0),lightMode='warm',dirty=true;
  const resources=[];
  function listen(el,event,fn,opts){el.addEventListener(event,fn,opts);resources.push(()=>el.removeEventListener(event,fn,opts));}
  function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;}
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);resize();
  const intersection=new IntersectionObserver(e=>{visible=e[0].isIntersecting;});intersection.observe(container);
  function setLight(mode) {
    lightMode=mode;dirty=true;
    if(mode==='moon'){key.color.set('#c6e5f5');key.position.set(4,2.5,7);key.intensity=2.4;ambient.intensity=1.3;rim.color.set('#d9edff');rim.intensity=.6;backdropMaterial.color.set('#b9cbd0');faceMaterial.emissive.set('#000000');faceMaterial.emissiveIntensity=0;}
    else if(mode==='window'){key.color.set('#fff1be');key.position.set(-4,1.5,5);key.intensity=2.8;ambient.intensity=1.3;rim.color.set('#fff9d4');rim.intensity=1.1;backdropMaterial.color.set('#eee3bf');faceMaterial.emissive.set(color);faceMaterial.emissiveIntensity=.08;}
    else{key.color.set('#fff0cb');key.position.set(-3,4,8);key.intensity=2.5;ambient.intensity=1.5;rim.color.set('#ffc88c');rim.intensity=.55;backdropMaterial.color.set('#e8ddc5');faceMaterial.emissive.set('#000000');faceMaterial.emissiveIntensity=0;}
  }
  function reset(){target={x:hero?-.2:-.28,y:hero?-.34:-.25,z:-.09};camera.position.z=hero?8.1:8.4;turning=false;dirty=true;}
  function replay(){start=performance.now();dirty=true;}
  const el=renderer.domElement;
  listen(el,'pointerdown',e=>{if(hero)return;drag={x:e.clientX,y:e.clientY,rx:target.x,ry:target.y};el.setPointerCapture(e.pointerId);});
  listen(el,'pointermove',e=>{
    if(hero&&!reduce){const r=el.getBoundingClientRect();target.y=-.34+(e.clientX-r.left-r.width/2)/r.width*.6;target.x=-.2+(e.clientY-r.top-r.height/2)/r.height*.4;}
    if(drag){target.y=drag.ry+(e.clientX-drag.x)*.008;target.x=Math.max(-1.3,Math.min(1.3,drag.rx+(e.clientY-drag.y)*.007));}
  });
  listen(el,'pointerup',()=>{drag=null;});listen(el,'pointercancel',()=>{drag=null;});
  listen(el,'pointerleave',()=>{if(hero)reset();});
  if(!hero) {
    listen(el,'wheel',e=>{e.preventDefault();camera.position.z=THREE.MathUtils.clamp(camera.position.z+e.deltaY*.008,5.7,13);dirty=true;},{passive:false});
    listen(el,'keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(e.key)){e.preventDefault();dirty=true;}if(e.key==='ArrowLeft')target.y-=.12;if(e.key==='ArrowRight')target.y+=.12;if(e.key==='ArrowUp')target.x=Math.max(-1.3,target.x-.12);if(e.key==='ArrowDown')target.x=Math.min(1.3,target.x+.12);if(e.key==='+')camera.position.z=Math.max(5.7,camera.position.z-.3);if(e.key==='-')camera.position.z=Math.min(13,camera.position.z+.3);if(e.key==='0')reset();});
  }
  listen(el,'webglcontextlost',e=>{e.preventDefault();onContextLoss?.();});
  function frame(now) {
    if(disposed)return;raf=requestAnimationFrame(frame);
    const dialog=container.closest('dialog');if(!visible||document.hidden||(dialog&&!dialog.open))return;
    if(turning&&!drag)target.y+=.006;
    const moving=Math.abs(target.x-rotation.x)+Math.abs(target.y-rotation.y)+Math.abs(target.z-rotation.z)>.0001;
    const blend=reduce?1:.085;
    rotation.x+=(target.x-rotation.x)*blend;rotation.y+=(target.y-rotation.y)*blend;rotation.z+=(target.z-rotation.z)*blend;
    paper.rotation.set(rotation.x,rotation.y,rotation.z);
    if(hero&&!reduce)paper.position.y=.055+Math.sin(now*.0007)*.028;
    let allOpen=true;
    pieces.forEach((piece,k)=>{
      const progress=reduce?1:THREE.MathUtils.clamp((now-start-k*85)/1400,0,1),ease=1-Math.pow(1-progress,3);
      piece.rotation.x=(1-ease)*(k%2?1.35:-1.35);piece.rotation.y=(1-ease)*(k%2?-.55:.55);
      piece.scale.setScalar(.55+.45*ease);if(progress<1)allOpen=false;
    });
    edges.visible=allOpen;
    if(allOpen&&!moving&&!turning&&!(hero&&!reduce)&&!dirty)return;
    renderer.render(scene,camera);dirty=false;
    container.dataset.ready='true';container.dataset.light=lightMode;
  }
  raf=requestAnimationFrame(frame);
  return {
    setLight,replay,reset,
    setTurning(value){turning=value;},
    dispose(){disposed=true;cancelAnimationFrame(raf);intersection.disconnect();resizeObserver.disconnect();resources.forEach(fn=>fn());const geometries=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());[faceMaterial,backMaterial,edgeMaterial,backdropMaterial].forEach(m=>m.dispose());texture.dispose();renderer.dispose();renderer.forceContextLoss();el.remove();delete container.dataset.ready;}
  };
}
