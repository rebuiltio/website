import{n as e,r as t}from"./signal-C4cOnlpb.js";var n=`
precision highp float;

// wave point: (u, v, seed, 0) with u along the ribbon, v across it, both in [-1, 1]
// stray point: (x, y, seed, 1) in [0, 1] screen space
attribute vec4 a_point;

uniform float u_time;
uniform vec2 u_projScale;
uniform vec2 u_offset;
uniform vec3 u_rot;
uniform vec2 u_maskDir;
uniform vec2 u_maskRange;
uniform float u_pointScale;
uniform float u_intensity;
uniform float u_intro;
uniform vec2 u_drop;
// response ripple: origin in NDC, progress 0 → 1 (1 = idle), strength
uniform vec4 u_pulse;
uniform vec3 u_colorLow;
uniform vec3 u_colorHigh;

varying vec3 v_color;
varying float v_alpha;

const float LENGTH = 7.0;
const float WIDTH = 3.2;
const float CAMERA_DIST = 9.0;

float height(vec2 p, float t) {
  // long ridges running along the ribbon, meandering slowly
  float h = 0.55 * sin(p.y * 1.7 + p.x * 0.3 - t * 0.8 + sin(p.x * 0.45 + t * 0.3) * 0.9);
  // broad swell travelling along the length
  h += 0.35 * sin(p.x * 0.55 - t * 0.5) * cos(p.y * 0.7 + t * 0.2);
  h += 0.07 * sin(p.x * 2.1 + p.y * 1.7 - t * 1.2);
  // ends lift slightly so the ribbon reads as one sweeping arc
  return h + 0.03 * p.x * p.x;
}

// world → NDC; depth > 1 is nearer than the focal plane
vec2 project(vec3 w, out float depth) {
  // pitch tilts the sheet toward the camera, yaw swings one end into depth
  float cp = cos(u_rot.x), sp = sin(u_rot.x);
  w = vec3(w.x, w.y * cp - w.z * sp, w.y * sp + w.z * cp);
  float cy = cos(u_rot.y), sy = sin(u_rot.y);
  w = vec3(w.x * cy + w.z * sy, w.y, -w.x * sy + w.z * cy);

  depth = CAMERA_DIST / max(w.z + CAMERA_DIST, 0.5);
  vec2 proj = w.xy * depth;

  // roll is applied in screen space so it only affects composition
  float cr = cos(u_rot.z), sr = sin(u_rot.z);
  proj = vec2(proj.x * cr - proj.y * sr, proj.x * sr + proj.y * cr);
  return proj * u_projScale + u_offset;
}

void main() {
  float seed = a_point.z;
  float t = u_time;
  vec2 ndc;
  float size;
  float alpha;
  vec3 color;

  if (a_point.w < 0.5) {
    vec2 p = vec2(a_point.x * LENGTH, a_point.y * WIDTH);
    float h = height(p, t);

    // entrance: a drop lands on the still sheet and its ripple front raises the waves behind it
    float reveal = 1.0;
    float ring = 0.0;
    float drop = 0.0;
    if (u_intro < 1.0) {
      float d = distance(p, u_drop);
      float front = 14.0 * pow(clamp((u_intro - 0.1) / 0.9, 0.0, 1.0), 1.7);
      float behind = front - d;
      reveal = smoothstep(0.0, 1.8, behind);
      // the ripple loses energy as it spreads; a fainter second ring trails the first
      float energy = (1.0 - smoothstep(0.6, 1.0, u_intro)) / (1.0 + front * 0.35);
      float trail = behind - 0.7;
      ring = (exp(-behind * behind * 16.0) + 0.4 * exp(-trail * trail * 16.0)) * energy;
      h = h * reveal + 0.3 * ring;
    }
    float depth;
    ndc = project(vec3(p.x, h, p.y), depth);
    if (u_intro < 1.0) {
      // the drop itself: a round point of light, measured on screen so perspective can't
      // stretch it, fading as the ripple leaves
      float dropDepth;
      vec2 onScreen = (ndc - project(vec3(u_drop.x, 0.0, u_drop.y), dropDepth)) / u_projScale;
      drop = (1.0 - smoothstep(0.0, 0.12, length(onScreen))) * smoothstep(0.0, 0.05, u_intro) *
        (1.0 - smoothstep(0.12, 0.3, u_intro));
    }

    float crest = smoothstep(-0.3, 0.85, h);
    float edge = 1.0 - smoothstep(0.3, 1.0, abs(a_point.y));
    float ends = 1.0 - smoothstep(0.75, 1.0, abs(a_point.x));
    float shimmer = 0.85 + 0.15 * sin(t * 2.3 + seed * 40.0);
    alpha = (0.25 + 0.95 * crest) * mix(0.3, 1.0, edge) * ends * shimmer * clamp(depth, 0.45, 1.25);
    alpha *= min(reveal + 1.6 * ring + 2.0 * drop, 1.6);
    // a soft bright band expanding across the wave from a point on screen
    if (u_pulse.z < 1.0) {
      float band = length((ndc - u_pulse.xy) / u_projScale) - u_pulse.z * 10.0;
      alpha *= 1.0 + u_pulse.w * (1.0 - u_pulse.z) * exp(-band * band * 1.5);
    }
    size = (0.7 + 0.9 * crest) * depth * (1.0 + 1.5 * drop);
    color = mix(u_colorLow, u_colorHigh, crest * crest);
  } else {
    vec2 q = fract(a_point.xy + vec2(-0.0025, 0.004) * t * (0.5 + seed));
    ndc = q * 2.0 - 1.0;
    alpha = 0.4 * (0.4 + 0.6 * sin(t * 0.9 + seed * 30.0)) * smoothstep(0.5, 1.0, u_intro);
    size = 1.0 + 1.2 * seed;
    color = mix(u_colorLow, u_colorHigh, 0.6);
  }

  alpha *= u_intensity * smoothstep(u_maskRange.x, u_maskRange.y, dot(ndc, u_maskDir));

  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = max(size * u_pointScale, 1.0);
  v_color = color;
  v_alpha = max(alpha, 0.0);
}
`,r=`
precision mediump float;

varying vec3 v_color;
varying float v_alpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  if (d2 > 0.25) discard;
  gl_FragColor = vec4(v_color, exp(-d2 * 12.0) * v_alpha);
}
`;function i(e,t){return e/t>=1.15?{offset:[.5,.05],rot:[-.7,.6,.85],unit:Math.min(t,e*.7)*.12,maskDir:[1,.15],maskRange:[-.45,.25],intensity:1,drop:[3.4,-.3]}:{offset:[.7,1-e/t],rot:[-.7,.6,1],unit:e*.12,maskDir:[1,0],maskRange:[-.2,.7],intensity:.8,drop:[1.9,-.2]}}var a=1700,o=2400,s=!1;function c(e){return()=>{e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function ee(e){let t=c(7),n=Math.round(420*Math.sqrt(e)),r=Math.round(170*Math.sqrt(e)),i=Math.round(60*e),a=[];for(let e=0;e<n;e++)for(let i=0;i<r;i++){let o=(e+t())/n*2-1,s=(i+t())/r*2-1;t()<.08+.92*Math.exp(-s*s*3.2)&&a.push(o,s,t(),0)}for(let e=0;e<i;e++)a.push(t(),t(),t(),1);return new Float32Array(a)}function l(e,t,n){let r=e.createShader(t);return r?(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(e.deleteShader(r),null)):null}function u(c,u){let d=c.getContext(`webgl`,{alpha:!0,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!0,powerPreference:`low-power`,failIfMajorPerformanceCaveat:!0});if(!d)return null;let f=l(d,d.VERTEX_SHADER,n),p=l(d,d.FRAGMENT_SHADER,r),m=d.createProgram();if(!f||!p||!m||(d.attachShader(m,f),d.attachShader(m,p),d.linkProgram(m),!d.getProgramParameter(m,d.LINK_STATUS)))return null;d.useProgram(m);let te=window.innerWidth<768,h=navigator,ne=(h.hardwareConcurrency??8)<=4||(h.deviceMemory??8)<=4,g=ee(u.density*(te?.45:ne?.65:1)),re=g.length/4,_=d.createBuffer();d.bindBuffer(d.ARRAY_BUFFER,_),d.bufferData(d.ARRAY_BUFFER,g,d.STATIC_DRAW);let v=d.getAttribLocation(m,`a_point`);d.enableVertexAttribArray(v),d.vertexAttribPointer(v,4,d.FLOAT,!1,0,0);let y=e=>d.getUniformLocation(m,e),b=y(`u_time`),x=y(`u_projScale`),S=y(`u_offset`),C=y(`u_rot`),w=y(`u_maskDir`),ie=y(`u_maskRange`),T=y(`u_pointScale`),E=y(`u_intensity`),D=y(`u_intro`),O=y(`u_drop`),k=y(`u_pulse`);d.uniform3fv(y(`u_colorLow`),u.colorLow),d.uniform3fv(y(`u_colorHigh`),u.colorHigh),d.enable(d.BLEND),d.blendFuncSeparate(d.SRC_ALPHA,d.ONE,d.ONE,d.ONE),d.clearColor(0,0,0,0);let A=i(1,1),j=0,M=0,N=1,P=()=>{j=c.clientWidth,M=c.clientHeight,!(!j||!M)&&(N=Math.min(window.devicePixelRatio||1,2),c.width=Math.round(j*N),c.height=Math.round(M*N),d.viewport(0,0,c.width,c.height),A=i(j,M))},F={x:0,y:0,tx:0,ty:0},I=window.matchMedia(`(pointer: fine)`).matches,L=e=>{F.tx=e.clientX/window.innerWidth-.5,F.ty=e.clientY/window.innerHeight-.5},R=e=>{!j||!M||(F.x+=(F.tx-F.x)*.03,F.y+=(F.ty-F.y)*.03,d.clear(d.COLOR_BUFFER_BIT),d.uniform1f(b,e),d.uniform2f(x,A.unit/(j/2),A.unit/(M/2)),d.uniform2f(S,A.offset[0],A.offset[1]),d.uniform3f(C,A.rot[0]+F.y*.04,A.rot[1]+F.x*.06,A.rot[2]),d.uniform2f(w,A.maskDir[0],A.maskDir[1]*M/j),d.uniform2fv(ie,A.maskRange),d.uniform1f(T,1.15*N),d.uniform1f(E,A.intensity),d.uniform1f(D,K),d.uniform2fv(O,A.drop),d.uniform4f(k,q.x,q.y,q.progress,q.strength),d.drawArrays(d.POINTS,0,re))},z=window.matchMedia(`(prefers-reduced-motion: reduce)`),B=z.matches,V=!0,H=0,U=0,W=6,G=!1,K=B||s?1:0;s=!0;let q={x:0,y:0,progress:1,strength:0},J=t=>{let n=Math.max(0,Math.min(t-U,100));U=t,W+=n/1e3*.14*u.speed,K<1&&(K=Math.min(K+n/a,1)),K>=.8&&e(),q.progress<1&&(q.progress=Math.min(q.progress+n/o,1)),R(W),H=requestAnimationFrame(J)},Y=()=>{let t=!B&&V&&!document.hidden;t&&!H?(U=performance.now(),H=requestAnimationFrame(J)):!t&&H&&(cancelAnimationFrame(H),H=0),H||R(B?6:W),G||(G=!0,u.onReady(K<1),K>=1&&e())},X=()=>{B=z.matches,B&&(K=1),F.tx=F.ty=0,Y()},Z=new ResizeObserver(()=>{P(),H||R(B?6:W)}),Q=new IntersectionObserver(([e])=>{V=e.isIntersecting,Y()}),ae=t(({x:e,y:t,strength:n})=>{if(!H)return;let r=c.getBoundingClientRect();q.x=(e-r.left)/r.width*2-1,q.y=1-(t-r.top)/r.height*2,q.strength=n,q.progress=0}),$=e=>{e.preventDefault(),cancelAnimationFrame(H),H=0,u.onError()};return P(),Z.observe(c),Q.observe(c),document.addEventListener(`visibilitychange`,Y),z.addEventListener(`change`,X),c.addEventListener(`webglcontextlost`,$),I&&window.addEventListener(`pointermove`,L,{passive:!0}),Y(),{dispose(){cancelAnimationFrame(H),H=0,Z.disconnect(),Q.disconnect(),document.removeEventListener(`visibilitychange`,Y),z.removeEventListener(`change`,X),c.removeEventListener(`webglcontextlost`,$),window.removeEventListener(`pointermove`,L),ae(),d.deleteBuffer(_),d.deleteProgram(m),d.deleteShader(f),d.deleteShader(p)}}}export{u as createHeroWaveRenderer};