'use strict';
(function(G){
var MS=480,MG=5,MP=80,FIT=220,NOTICE='本地图像处理（阈值/色调分离→轮廓），图片未上传；建议轮廓需人手落剪；非云端大模型。';
function hashString(s){var h=2166136261>>>0;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function clamp(v,a,b){return v<a?a:v>b?b:v;}
function loadImage(file){return new Promise(function(res,rej){if(!file)return rej(new Error('未选择图片'));
function fb(){var u=URL.createObjectURL(file),img=new Image();img.onload=function(){URL.revokeObjectURL(u);res(img);};img.onerror=function(){URL.revokeObjectURL(u);rej(new Error('图片解码失败'));};img.src=u;}
if(typeof createImageBitmap==='function'){createImageBitmap(file).then(res).catch(fb);}else fb();});}
function drawScaled(src,maxSide){var sw=src.width||src.naturalWidth,sh=src.height||src.naturalHeight;if(!sw||!sh)throw new Error('无效图像尺寸');
var sc=Math.min(1,maxSide/Math.max(sw,sh)),w=Math.max(1,Math.round(sw*sc)),h=Math.max(1,Math.round(sh*sc));
var c=document.createElement('canvas');c.width=w;c.height=h;var ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(src,0,0,w,h);
return{canvas:c,ctx:ctx,w:w,h:h,data:ctx.getImageData(0,0,w,h)};}
function toGrayContrast(id){var d=id.data,n=d.length/4,gray=new Float32Array(n),i,g,mn=255,mx=0;
for(i=0;i<n;i++){g=.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2];gray[i]=g;if(g<mn)mn=g;if(g>mx)mx=g;}
var r=mx-mn||1;for(i=0;i<n;i++)gray[i]=(gray[i]-mn)/r*255;return gray;}
function otsu(gray){var hist=new Array(256),i,t;for(i=0;i<256;i++)hist[i]=0;for(i=0;i<gray.length;i++)hist[gray[i]|0]++;
var tot=gray.length,sum=0;for(i=0;i<256;i++)sum+=i*hist[i];var sumB=0,wB=0,wF=0,vMax=0,thr=128;
for(t=0;t<256;t++){wB+=hist[t];if(!wB)continue;wF=tot-wB;if(!wF)break;sumB+=t*hist[t];var mB=sumB/wB,mF=(sum-sumB)/wF,bt=wB*wF*(mB-mF)*(mB-mF);if(bt>vMax){vMax=bt;thr=t;}}return thr;}
function binarize(gray,w,h,thr,levels){var bin=new Uint8Array(w*h),i,lv;levels=levels||2;
if(levels<=2){for(i=0;i<gray.length;i++)bin[i]=gray[i]<thr?1:0;}else{var step=255/(levels-1);for(i=0;i<gray.length;i++){lv=Math.round(gray[i]/step);bin[i]=lv===0?1:0;}}return bin;}
function morphOpen(bin,w,h){var er=new Uint8Array(w*h),out=new Uint8Array(w*h),x,y,k,ok,idx;
for(y=1;y<h-1;y++)for(x=1;x<w-1;x++){idx=y*w+x;ok=1;for(k=-1;k<=1;k++){if(!bin[(y+k)*w+(x-1)]||!bin[(y+k)*w+x]||!bin[(y+k)*w+(x+1)]){ok=0;break;}}er[idx]=ok;}
for(y=1;y<h-1;y++)for(x=1;x<w-1;x++){idx=y*w+x;ok=0;for(k=-1;k<=1;k++){if(er[(y+k)*w+(x-1)]||er[(y+k)*w+x]||er[(y+k)*w+(x+1)]){ok=1;break;}}out[idx]=ok;}return out;}
var DX=[1,1,0,-1,-1,-1,0,1],DY=[0,1,1,1,0,-1,-1,-1];
function contourArea(pts){var a=0,n=pts.length;for(var i=0;i<n;i++){var p=pts[i],q=pts[(i+1)%n];a+=p.x*q.y-q.x*p.y;}return a/2;}
function findContours(bin,w,h){var vis=new Uint8Array(w*h),cs=[],x,y;
function onB(cx,cy){if(!bin[cy*w+cx])return 0;return !bin[(cy-1)*w+cx]||!bin[(cy+1)*w+cx]||!bin[cy*w+(cx-1)]||!bin[cy*w+(cx+1)];}
for(y=1;y<h-1;y++)for(x=1;x<w-1;x++){if(!bin[y*w+x]||vis[y*w+x]||!onB(x,y))continue;
var sx=x,sy=y,pts=[],dir=0,nDir=-1,nx,ny,px,py,sd,guard,i,j,dd;
sd=7;for(i=0;i<8;i++){dd=(sd+i)%8;nx=sx+DX[dd];ny=sy+DY[dd];if(nx>0&&ny>0&&nx<w-1&&ny<h-1&&bin[ny*w+nx]){nDir=dd;break;}}
if(nDir<0){vis[sy*w+sx]=1;continue;}px=sx;py=sy;dir=nDir;guard=w*h*4;
do{pts.push({x:px,y:py});vis[py*w+px]=1;sd=(dir+6)%8;nDir=-1;
for(j=0;j<8;j++){dd=(sd+j)%8;nx=px+DX[dd];ny=py+DY[dd];if(nx>0&&ny>0&&nx<w-1&&ny<h-1&&bin[ny*w+nx]){nDir=dd;break;}}
if(nDir<0)break;px+=DX[nDir];py+=DY[nDir];dir=nDir;guard--;}while((px!==sx||py!==sy)&&guard>0);
if(pts.length>=8){var ar=contourArea(pts);cs.push({points:pts,area:Math.abs(ar)});}}
return cs;}
function dist2(a,b){var dx=a.x-b.x,dy=a.y-b.y;return dx*dx+dy*dy;}
function perp(p,a,b){var dx=b.x-a.x,dy=b.y-a.y;if(!dx&&!dy)return Math.sqrt(dist2(p,a));
var t=((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy);t=clamp(t,0,1);return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));}
function rdp(pts,eps){if(pts.length<3)return pts.slice();var st=[[0,pts.length-1]],keep=new Uint8Array(pts.length);keep[0]=1;keep[pts.length-1]=1;
while(st.length){var rg=st.pop(),s=rg[0],e=rg[1],maxD=0,idx=-1;for(var i=s+1;i<e;i++){var d=perp(pts[i],pts[s],pts[e]);if(d>maxD){maxD=d;idx=i;}}
if(idx>=0&&maxD>eps){keep[idx]=1;st.push([s,idx],[idx,e]);}}
var out=[];for(var k=0;k<pts.length;k++)if(keep[k])out.push(pts[k]);return out;}
function cap(pts,m){if(pts.length<=m)return pts;var out=[],step=(pts.length-1)/(m-1);for(var i=0;i<m;i++)out.push(pts[Math.round(i*step)]);return out;}
function mapToPaper(cs,w,h,fit){var sc=(fit*2)/Math.max(w,h),cx=w/2,cy=h/2;
return cs.map(function(c){return{points:c.points.map(function(p){return{x:(p.x-cx)*sc,y:(p.y-cy)*sc};}),closed:true,kind:'photo-silhouette',area:c.area};});}
function rasterToGuides(imageData,opts){opts=opts||{};var w=imageData.width,h=imageData.height,gray=toGrayContrast(imageData);
var thr=(opts.threshold!=null&&opts.threshold!=='')?+opts.threshold:otsu(gray);thr=clamp(thr|0,1,254);
var bin=binarize(gray,w,h,thr,opts.levels||2);if(opts.open!==false)bin=morphOpen(bin,w,h);
var cs=findContours(bin,w,h),minA=w*h*(opts.minAreaRatio!=null?opts.minAreaRatio:.003);
cs=cs.filter(function(c){return c.area>=minA;}).sort(function(a,b){return b.area-a.area;});
var maxG=opts.maxGuides||MG,maxP=opts.maxPts||MP,eps=opts.epsilon!=null?opts.epsilon:Math.max(1.2,Math.min(w,h)*.008);
cs=cs.slice(0,maxG).map(function(c){var s=rdp(c.points,eps);s=cap(s,maxP);if(s.length<3)s=c.points.slice(0,Math.min(c.points.length,maxP));return{points:s,area:c.area};});
var guides=mapToPaper(cs,w,h,opts.fit!=null?opts.fit:FIT).filter(function(g){return g.points.length>=3;});
return{guides:guides,threshold:thr,width:w,height:h};}
function fromFile(file,opts){opts=opts||{};return loadImage(file).then(function(img){
var maxSide=opts.maxSide||MS;if(opts.lowEnd)maxSide=Math.min(maxSide,320);
var drawn=drawScaled(img,maxSide);if(img.close)try{img.close();}catch(e){}
var result=rasterToGuides(drawn.data,opts),name=(file&&file.name)||'upload',mtime=(file&&file.lastModified)||0,size=(file&&file.size)||0,seed=hashString(name+'|'+size+'|'+mtime);
var meta={prompt:'photo:'+name,seed:seed,engine:'local-photo-posterize-v1',notice:NOTICE,source:'photo',width:result.width,height:result.height,threshold:result.threshold};
if(!result.guides.length)return{guides:[],error:'未找到有效轮廓，请换单主体浅底图或改用词灵感',meta:meta};
return{guides:result.guides,meta:meta};
}).catch(function(err){return{guides:[],error:(err&&err.message)||'照片处理失败',meta:{prompt:'photo:'+((file&&file.name)||'upload'),seed:0,engine:'local-photo-posterize-v1',notice:NOTICE,source:'photo',width:0,height:0,threshold:0}};});}
G.PhotoPapercut={fromFile:fromFile,rasterToGuides:rasterToGuides,hashString:hashString};
})(typeof window!=='undefined'?window:globalThis);
