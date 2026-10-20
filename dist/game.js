'use strict';
const $=id=>document.getElementById(id),canvas=$('space'),ctx=canvas.getContext('2d');
// AU, days, and solar masses. J2000 mean orbital elements, approximate Kepler orbits.
const MU=0.000295912208286,TAU=Math.PI*2,AU_KM=149597870.7;
const planets=[
{name:'MERCURY',r:.387098,e:.20563,inc:7.005,node:48.331,peri:77.457,phase:174.796,size:2439.7,mu:MU*1.6601e-7,color:'#bba396'},
{name:'VENUS',r:.723332,e:.00677,inc:3.395,node:76.680,peri:131.602,phase:50.115,size:6051.8,mu:MU*2.4478e-6,color:'#d6bd86'},
{name:'EARTH',r:1,e:.01671,inc:0,node:0,peri:102.937,phase:357.517,size:6371,mu:MU*3.0035e-6,color:'#77bdde'},
{name:'MARS',r:1.523679,e:.0934,inc:1.850,node:49.558,peri:336.041,phase:19.373,size:3389.5,mu:MU*3.2272e-7,color:'#cb8065'},
{name:'JUPITER',r:5.2026,e:.04849,inc:1.303,node:100.464,peri:14.331,phase:20.020,size:69911,mu:MU*.0009543,color:'#c8ac8e'},
{name:'SATURN',r:9.5549,e:.05551,inc:2.489,node:113.665,peri:93.057,phase:317.02,size:58232,mu:MU*.0002857,color:'#cbbb8b'},
{name:'URANUS',r:19.2184,e:.04630,inc:.773,node:74.006,peri:173.005,phase:142.238,size:25362,mu:MU*.00004365,color:'#8ed5d9'},
{name:'NEPTUNE',r:30.1104,e:.00899,inc:1.770,node:131.784,peri:48.124,phase:256.228,size:24622,mu:MU*.00005149,color:'#718fd9'}];
let time=0,paused=false,duo=false,zoom=1,width=900,height=700,scale=1,ships=[],accumulator=0,last=0,keys=new Set(),flashUntil=0;
let yaw=-.25,tilt=.85,viewRadius=3,follow=false,trueScale=false,daysPerSecond=1,drag=null;
let stars=Array.from({length:330},(_,i)=>({x:Math.abs(Math.sin(i*127.1)*43758.5453%1),y:Math.abs(Math.cos(i*311.7)*23421.634%1),r:i%13===0?1.1:.55,a:.12+(i%6)*.08}));
function orbitalPoint(p,E){const rad=Math.PI/180,O=p.node*rad,i=p.inc*rad,w=(p.peri-p.node)*rad,x=p.r*(Math.cos(E)-p.e),y=p.r*Math.sqrt(1-p.e*p.e)*Math.sin(E),u=x*Math.cos(w)-y*Math.sin(w),v=x*Math.sin(w)+y*Math.cos(w);return{x:u*Math.cos(O)-v*Math.cos(i)*Math.sin(O),y:u*Math.sin(O)+v*Math.cos(i)*Math.cos(O),z:v*Math.sin(i)}}
function bodyAt(p,t){let M=(p.phase*Math.PI/180+Math.sqrt(MU/p.r**3)*t)%TAU,E=M;for(let j=0;j<8;j++)E-=(E-p.e*Math.sin(E)-M)/(1-p.e*Math.cos(E));return orbitalPoint(p,E)}
// Quaternion orientation: steering rotates around the ship's own axes, without pole limits.
function rotateShip(s, yawInput, pitchInput, seconds) {
  const y = -pitchInput, z = yawInput, magnitude = Math.hypot(y, z);
  if (!magnitude) return;
  const half = magnitude * seconds, k = Math.sin(half) / magnitude;
  const [w, x, qy, qz] = s.orientation, b = Math.cos(half), by = y*k, bz = z*k;
  const next = [w*b-qy*by-qz*bz, x*b+qy*bz-qz*by, w*by+qy*b-x*bz, w*bz+qz*b+x*by];
  const norm = Math.hypot(...next);
  s.orientation = next.map(v => v/norm);
}
function forwardDirection(s) {
  const [w,x,y,z] = s.orientation;
  return {x:1-2*(y*y+z*z), y:2*(x*y+w*z), z:2*(x*z-w*y)};
}
const touchPointers = new Map();
function isDown(code) { return keys.has(code) || [...touchPointers.values()].some(p => p.code === code); }
function clearInput() {
  keys.clear(); touchPointers.clear();
  document.querySelectorAll('[data-flight]').forEach(b => { b.classList.remove('pressed'); b.setAttribute('aria-pressed','false'); });
}
let touchVisible=window.matchMedia('(any-pointer: coarse)').matches;
function spawn(i){const b=bodyAt(planets[2],time),next=bodyAt(planets[2],time+.001);return{x:b.x+.008+i*.003,y:b.y,z:b.z+.001,vx:(next.x-b.x)/.001,vy:(next.y-b.y)/.001+.0008,vz:0,orientation:[Math.SQRT1_2,0,0,Math.SQRT1_2],color:i?'#d8b2f6':'#a8eee1',trail:[],burn:0,crashes:ships[i]?.crashes||0}}
function reset(){clearInput();time=0;ships=[];ships=[spawn(0)];if(duo)ships.push(spawn(1));accumulator=0;flashUntil=0;notice('YOU HAVE THE CONTROLS',touchVisible?'Hold steering + THRUST · drag to orbit · pinch to zoom':'W thrust · A / D yaw · Q / E pitch · drag to orbit')}
function gravity(x,y,t,z=0){let d=Math.max(.00465,Math.hypot(x,y,z)),ax=-MU*x/d**3,ay=-MU*y/d**3,az=-MU*z/d**3;for(const p of planets){let b=bodyAt(p,t),dx=b.x-x,dy=b.y-y,dz=b.z-z,q=Math.max(p.size/AU_KM,Math.hypot(dx,dy,dz));ax+=p.mu*dx/q**3;ay+=p.mu*dy/q**3;az+=p.mu*dz/q**3}return{ax,ay,az}}
function step(dt){for(const [i,s] of ships.entries()){const ctrl=i?['ArrowUp','ArrowLeft','ArrowRight','PageUp','PageDown']:['KeyW','KeyA','KeyD','KeyQ','KeyE'];rotateShip(s,(isDown(ctrl[2])?1:0)-(isDown(ctrl[1])?1:0),(isDown(ctrl[3])?1:0)-(isDown(ctrl[4])?1:0),dt/daysPerSecond);s.burn=isDown(ctrl[0])?1:0;const direction=forwardDirection(s);let tx=direction.x*s.burn*.00015,ty=direction.y*s.burn*.00015,tz=direction.z*s.burn*.00015;let g=gravity(s.x,s.y,time,s.z);s.x+=s.vx*dt+.5*(g.ax+tx)*dt*dt;s.y+=s.vy*dt+.5*(g.ay+ty)*dt*dt;s.z+=s.vz*dt+.5*(g.az+tz)*dt*dt;let h=gravity(s.x,s.y,time+dt,s.z);s.vx+=(g.ax+h.ax+2*tx)*.5*dt;s.vy+=(g.ay+h.ay+2*ty)*.5*dt;s.vz+=(g.az+h.az+2*tz)*.5*dt;if(Math.hypot(s.x,s.y,s.z)<.00465||planets.some(p=>{let b=bodyAt(p,time+dt);return Math.hypot(s.x-b.x,s.y-b.y,s.z-b.z)<p.size/AU_KM})){let crashes=s.crashes+1;ships[i]=spawn(i);ships[i].crashes=crashes;notice('PIONEER RECOVERED','Collision detected. Relaunched near Earth.')}if(Math.floor(time*8)!==Math.floor((time+dt)*8)){s.trail.push({x:s.x,y:s.y,z:s.z});if(s.trail.length>1600)s.trail.shift()}}time+=dt}
function notice(a,b){$('notice').replaceChildren(document.createTextNode(a));let span=document.createElement('span');span.textContent=b;$('notice').append(span)}
function circle(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=color;ctx.fill()}
function project(p){const target=follow?ships[0]:{x:0,y:0,z:0},x=p.x-target.x,y=p.y-target.y,z=(p.z||0)-target.z,u=x*Math.cos(yaw)-y*Math.sin(yaw),v=x*Math.sin(yaw)+y*Math.cos(yaw),depth=v*Math.sin(tilt)+z*Math.cos(tilt),perspective=1/(1+depth/(viewRadius/zoom*5));return{x:width/2+u*scale*perspective,y:height*.48+(v*Math.cos(tilt)-z*Math.sin(tilt))*scale*perspective,k:perspective,depth}}
function path(points,color,dash=[]){ctx.beginPath();points.forEach((p,i)=>{let v=project(p);i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y)});ctx.strokeStyle=color;ctx.lineWidth=1;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([])}
function draw(){const dpr=Math.min(2,devicePixelRatio||1),rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr)}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#080f16';ctx.fillRect(0,0,width,height);stars.forEach(s=>{ctx.globalAlpha=s.a;circle(s.x*width,s.y*height,s.r,'#b3d5e1')});ctx.globalAlpha=1;scale=Math.min(width,height-130)/(viewRadius*2)*zoom;
planets.forEach(p=>path(Array.from({length:181},(_,i)=>orbitalPoint(p,i*TAU/180)),'#91b5c02d'));
const bodies=[{name:'SOL',size:695700,color:'#ffd28c',x:0,y:0,z:0},...planets.map(p=>({...p,...bodyAt(p,time)}))].sort((a,b)=>project(b).depth-project(a).depth);
for(const p of bodies){let q=project(p),r=trueScale?p.size/AU_KM*scale*q.k:p.name==='SOL'?16:Math.max(3,Math.log(p.size/2000+1)*2.7);if(q.x<-100||q.x>width+100||q.y<-100||q.y>height+100)continue;if(p.name==='SOL'){let glow=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,65);glow.addColorStop(0,'#ffc77744');glow.addColorStop(1,'#ffc77700');circle(q.x,q.y,65,glow)}if(p.name==='SATURN'&&!trueScale){ctx.strokeStyle='#baab8877';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(q.x,q.y,r*1.8,r*.45,-.3,0,TAU);ctx.stroke()}if(r>.15){let g=ctx.createRadialGradient(q.x-r*.4,q.y-r*.4,0,q.x,q.y,r);g.addColorStop(0,p.color);g.addColorStop(.5,p.color);g.addColorStop(1,'#101b25');circle(q.x,q.y,r,g)}ctx.font='8px monospace';ctx.fillStyle='#8ca7b5';ctx.textAlign='center';ctx.fillText(p.name,q.x,q.y+Math.max(r,3)+14)}
ships.forEach((s,i)=>{if($('trails').checked)path(s.trail,s.color+'55');if($('predict').checked){let p={...s},pts=[{...p}];for(let j=0;j<300;j++){let dt=.15,g=gravity(p.x,p.y,time+j*dt,p.z);p.vx+=g.ax*dt;p.vy+=g.ay*dt;p.vz+=g.az*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;pts.push({...p})}path(pts,s.color+'70',[3,6])}const f=forwardDirection(s);let q=project(s),dir=project({x:s.x+f.x*.01,y:s.y+f.y*.01,z:s.z+f.z*.01});ctx.save();ctx.translate(q.x,q.y);ctx.rotate(Math.atan2(dir.y-q.y,dir.x-q.x));if(s.burn){ctx.fillStyle='#e9bd7a';ctx.beginPath();ctx.moveTo(-6,-3);ctx.lineTo(-17-Math.random()*8,0);ctx.lineTo(-6,3);ctx.fill()}ctx.shadowColor=s.color;ctx.shadowBlur=12;ctx.fillStyle=s.color;ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-6,-5);ctx.lineTo(-3,0);ctx.lineTo(-6,5);ctx.closePath();ctx.fill();ctx.restore();ctx.fillStyle=s.color;ctx.font='8px monospace';ctx.textAlign='left';ctx.fillText('P'+(i+1),q.x+13,q.y-9)});
const s=ships[0],v=Math.hypot(s.vx,s.vy,s.vz)*AU_KM/86400,g=gravity(s.x,s.y,time,s.z);$('speed').textContent=v.toFixed(2);$('speedbar').style.width=Math.min(100,v)+'%';$('distance').textContent=Math.hypot(s.x,s.y,s.z).toFixed(3)+' AU';$('heading').textContent=((Math.atan2(forwardDirection(s).y,forwardDirection(s).x)*180/Math.PI%360+360)%360).toFixed(0)+'°';$('gravity').textContent=(Math.hypot(g.ax,g.ay,g.az)*AU_KM*1000/86400**2).toFixed(4)+' m/s²';$('thrust').textContent=Math.abs(s.burn*100)+'%';$('thrustbar').style.width=Math.abs(s.burn*100)+'%';$('flightState').textContent=s.burn?'BURNING':'COASTING';$('clock').textContent='J2000 + '+time.toFixed(2)+' DAYS';}
function frame(now){let dt=Math.min(.06,(now-last)/1000||0);last=now;if(!paused&&!$('manual').open){accumulator+=dt*daysPerSecond;while(accumulator>=.002){step(.002);accumulator-=.002}}draw();requestAnimationFrame(frame)}
function pause(){clearInput();paused=!paused;$('pause').textContent=paused?'▶ Resume':'Ⅱ Pause';$('status').textContent=paused?'SIMULATION PAUSED':'SIMULATION LIVE'}
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','Space'].includes(e.code))e.preventDefault();if(!e.repeat){if(e.code==='Space')pause();if(e.code==='KeyR')reset();if(e.code==='Equal')setZoom(zoom+.1);if(e.code==='Minus')setZoom(zoom-.1)}keys.add(e.code)});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()});
function setZoom(z){zoom=Math.max(.45,Math.min(2.5,z));$('zoom').textContent=Math.round(zoom*100)+'%'}
$('pause').onclick=pause;$('reset').onclick=reset;$('plus').onclick=()=>setZoom(zoom+.1);$('minus').onclick=()=>setZoom(zoom-.1);$('fit').onclick=()=>setZoom(1);$('help').onclick=()=>{clearInput();$('manual').showModal()};$('close').onclick=()=>$('manual').close();$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.querySelector('.viewport').requestFullscreen?.().catch(()=>notice('FULLSCREEN UNAVAILABLE','Use your browser fullscreen shortcut.'))};
function mode(v){duo=v;$('touchPilot2').disabled=!v;if(!v)$('touchPilot').value='0';$('solo').classList.toggle('active',!v);$('duo').classList.toggle('active',v);$('second').textContent=v?'P2: ↑ thrust · ← / → yaw · Page Up / Down pitch.':'To slow down, turn against your velocity and fire the main engine.';reset()}$('solo').onclick=()=>mode(false);$('duo').onclick=()=>mode(true);reset();requestAnimationFrame(frame);

// Separate captured pointers keep steering, thrust, and camera gestures independent.
canvas.style.touchAction='none';
const cameraPointers=new Map();
canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  cameraPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  const previous=cameraPointers.get(e.pointerId);if(!previous)return;
  if(cameraPointers.size===1){yaw+=(e.clientX-previous.x)*.006;tilt=Math.max(.05,Math.min(3.09,tilt+(e.clientY-previous.y)*.006));}
  else {const other=[...cameraPointers.entries()].find(([id])=>id!==e.pointerId)[1];const oldDistance=Math.hypot(previous.x-other.x,previous.y-other.y),newDistance=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(oldDistance>5&&newDistance>5)setZoom(zoom*newDistance/oldDistance);}
  cameraPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>cameraPointers.delete(e.pointerId));
window.addEventListener('blur',()=>cameraPointers.clear());
canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.001))},{passive:false});

function updateTouchVisibility(){
  clearInput();$('touchControls').hidden=!touchVisible;document.querySelector('.viewport').classList.toggle('touch-enabled',touchVisible);
  $('touchToggle').setAttribute('aria-pressed',String(touchVisible));
}
$('touchToggle').onclick=()=>{touchVisible=!touchVisible;updateTouchVisibility()};
$('touchPilot').onchange=clearInput;
for(const button of document.querySelectorAll('[data-flight]')){
  button.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.preventDefault();
    if(paused||$('manual').open)return;
    const codes=$('touchPilot').value==='1'?{thrust:'ArrowUp',left:'ArrowLeft',right:'ArrowRight',up:'PageUp',down:'PageDown'}:{thrust:'KeyW',left:'KeyA',right:'KeyD',up:'KeyQ',down:'KeyE'};
    touchPointers.set(e.pointerId,{code:codes[button.dataset.flight],button});button.setPointerCapture(e.pointerId);
    button.classList.add('pressed');button.setAttribute('aria-pressed','true');
  });
  const release=e=>{touchPointers.delete(e.pointerId);const held=[...touchPointers.values()].some(p=>p.button===button);button.classList.toggle('pressed',held);button.setAttribute('aria-pressed',String(held))};
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
updateTouchVisibility();
$('systemView').onclick=()=>{follow=false;viewRadius=36;setZoom(1)};$('innerView').onclick=()=>{follow=false;viewRadius=3;setZoom(1)};$('shipView').onclick=()=>{follow=true;viewRadius=.04;setZoom(1)};$('trueScale').onchange=e=>trueScale=e.target.checked;$('timescale').onchange=e=>daysPerSecond=Number(e.target.value);
