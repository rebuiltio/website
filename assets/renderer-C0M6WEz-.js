import{d as e,l as t,u as n}from"./Chrome-D5YazWe2.js";var r=`
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
// touch ripples: origin in NDC, age in seconds (< 0 = idle), strength
uniform vec4 u_touch[2];
// canvas size in CSS pixels, so a touch ripple travels as a circle on screen
uniform vec2 u_viewport;
uniform vec3 u_colorLow;
uniform vec3 u_colorHigh;

varying vec3 v_color;
varying float v_alpha;

const float LENGTH = 7.0;
const float WIDTH = 3.2;
const float CAMERA_DIST = 9.0;
// touch ripple: front speed and width in CSS px, how far its energy reaches, its lifetime
const float TOUCH_SPEED = 820.0;
const float TOUCH_WIDTH = 80.0;
const float TOUCH_REACH = 900.0;
const float TOUCH_LIFE = 2.6;

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
  // how strongly a passing touch surfaces the sheet where the mask would hide it
  float surfaced = 0.0;

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

    // a touch: a single soft swell travels out from the point, lifting the sheet as its
    // front passes and settling behind it; it loses energy with distance and time
    float lift = 0.0;
    float glint = 0.0;
    for (int i = 0; i < 2; i++) {
      vec4 touch = u_touch[i];
      if (touch.z >= 0.0 && touch.z < TOUCH_LIFE) {
        float d = length((ndc - touch.xy) * u_viewport * 0.5);
        float x = (d - TOUCH_SPEED * touch.z) / TOUCH_WIDTH;
        float energy = touch.w * exp(-d / TOUCH_REACH) * (1.0 - smoothstep(0.0, TOUCH_LIFE, touch.z))
          * smoothstep(0.0, 0.12, touch.z);
        // a crest at the front with a shallower trough trailing it, like a ring on water
        float trough = x + 1.4;
        lift += energy * (exp(-x * x) - 0.45 * exp(-trough * trough));
        glint += energy * exp(-x * x);
      }
    }
    if (lift != 0.0) {
      h += 0.34 * lift;
      ndc = project(vec3(p.x, h, p.y), depth);
    }
    surfaced = min(0.5 * glint, 0.4);

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
    alpha *= 1.0 + 0.8 * glint;
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

  float mask = smoothstep(u_maskRange.x, u_maskRange.y, dot(ndc, u_maskDir));
  alpha *= u_intensity * max(mask, surfaced);

  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = max(size * u_pointScale, 1.0);
  v_color = color;
  v_alpha = max(alpha, 0.0);
}
`,i=`
precision mediump float;

varying vec3 v_color;
varying float v_alpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d2 = dot(c, c);
  if (d2 > 0.25) discard;
  gl_FragColor = vec4(v_color, exp(-d2 * 12.0) * v_alpha);
}
`;function a(e,t){return e/t>=1.15?{offset:[.5,.05],rot:[-.7,.6,.85],unit:Math.min(t,e*.7)*.12,maskDir:[1,.15],maskRange:[-.45,.25],intensity:1,drop:[3.4,-.3]}:{offset:[.7,1-e/t],rot:[-.7,.6,1],unit:e*.12,maskDir:[1,0],maskRange:[-.2,.7],intensity:.8,drop:[1.9,-.2]}}var o=1700,s=2400,ee=.9,te=2.6,c=!1;function l(e){return()=>{e=e+1831565813|0;let t=Math.imul(e^e>>>15,1|e);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}function ne(e){let t=l(7),n=Math.round(420*Math.sqrt(e)),r=Math.round(170*Math.sqrt(e)),i=Math.round(60*e),a=[];for(let e=0;e<n;e++)for(let i=0;i<r;i++){let o=(e+t())/n*2-1,s=(i+t())/r*2-1;t()<.08+.92*Math.exp(-s*s*3.2)&&a.push(o,s,t(),0)}for(let e=0;e<i;e++)a.push(t(),t(),t(),1);return new Float32Array(a)}function u(e,t,n){let r=e.createShader(t);return r?(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS)?r:(e.deleteShader(r),null)):null}function d(l,d){let f=l.getContext(`webgl`,{alpha:!0,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!0,powerPreference:`low-power`,failIfMajorPerformanceCaveat:!0});if(!f)return null;let p=u(f,f.VERTEX_SHADER,r),m=u(f,f.FRAGMENT_SHADER,i),h=f.createProgram();if(!p||!m||!h||(f.attachShader(h,p),f.attachShader(h,m),f.linkProgram(h),!f.getProgramParameter(h,f.LINK_STATUS)))return null;f.useProgram(h);let g=window.innerWidth<768,_=navigator,v=(_.hardwareConcurrency??8)<=4||(_.deviceMemory??8)<=4,y=ne(d.density*(g?.45:v?.65:1)),b=y.length/4,x=f.createBuffer();f.bindBuffer(f.ARRAY_BUFFER,x),f.bufferData(f.ARRAY_BUFFER,y,f.STATIC_DRAW);let S=f.getAttribLocation(h,`a_point`);f.enableVertexAttribArray(S),f.vertexAttribPointer(S,4,f.FLOAT,!1,0,0);let C=e=>f.getUniformLocation(h,e),re=C(`u_time`),w=C(`u_projScale`),ie=C(`u_offset`),ae=C(`u_rot`),oe=C(`u_maskDir`),T=C(`u_maskRange`),se=C(`u_pointScale`),ce=C(`u_intensity`),le=C(`u_intro`),ue=C(`u_drop`),E=C(`u_pulse`),D=C(`u_touch`),O=C(`u_viewport`);f.uniform3fv(C(`u_colorLow`),d.colorLow),f.uniform3fv(C(`u_colorHigh`),d.colorHigh),f.enable(f.BLEND),f.blendFuncSeparate(f.SRC_ALPHA,f.ONE,f.ONE,f.ONE),f.clearColor(0,0,0,0);let k=a(1,1),A=0,j=0,M=1,N=()=>{A=l.clientWidth,j=l.clientHeight,!(!A||!j)&&(M=Math.min(window.devicePixelRatio||1,2),l.width=Math.round(A*M),l.height=Math.round(j*M),f.viewport(0,0,l.width,l.height),k=a(A,j))},P={x:0,y:0,tx:0,ty:0},de=window.matchMedia(`(pointer: fine)`).matches,F=e=>{P.tx=e.clientX/window.innerWidth-.5,P.ty=e.clientY/window.innerHeight-.5},I=e=>{!A||!j||(P.x+=(P.tx-P.x)*.03,P.y+=(P.ty-P.y)*.03,f.clear(f.COLOR_BUFFER_BIT),f.uniform1f(re,e),f.uniform2f(w,k.unit/(A/2),k.unit/(j/2)),f.uniform2f(ie,k.offset[0],k.offset[1]),f.uniform3f(ae,k.rot[0]+P.y*.04,k.rot[1]+P.x*.06,k.rot[2]),f.uniform2f(oe,k.maskDir[0],k.maskDir[1]*j/A),f.uniform2fv(T,k.maskRange),f.uniform1f(se,1.15*M),f.uniform1f(ce,k.intensity),f.uniform1f(le,W),f.uniform2fv(ue,k.drop),f.uniform4f(E,G.x,G.y,G.progress,G.strength),f.uniform2f(O,A,j),f.uniform4fv(D,K),f.drawArrays(f.POINTS,0,b))},L=window.matchMedia(`(prefers-reduced-motion: reduce)`),R=L.matches,z=!0,B=0,V=0,H=6,U=!1,W=R||c?1:0;c=!0;let G={x:0,y:0,progress:1,strength:0},K=new Float32Array([0,0,-1,0,0,0,-1,0]),q=0,J=e=>{let t=Math.max(0,Math.min(e-V,100));V=e,H+=t/1e3*.14*d.speed,W<1&&(W=Math.min(W+t/o,1)),G.progress<1&&(G.progress=Math.min(G.progress+t/s,1));for(let e=2;e<8;e+=4){if(K[e]<0)continue;let n=K[e]+t/1e3;K[e]=n>te?-1:n}I(H),B=requestAnimationFrame(J)},Y=()=>{let e=!R&&z&&!document.hidden;e&&!B?(V=performance.now(),B=requestAnimationFrame(J)):!e&&B&&(cancelAnimationFrame(B),B=0),B||I(R?6:H),U||(U=!0,d.onReady(W<1),t())},X=()=>{R=L.matches,R&&(W=1),P.tx=P.ty=0,Y()},Z=new ResizeObserver(()=>{N(),B||I(R?6:H)}),Q=new IntersectionObserver(([e])=>{z=e.isIntersecting,Y()}),fe=n(({x:e,y:t,strength:n})=>{if(!B)return;let r=l.getBoundingClientRect();G.x=(e-r.left)/r.width*2-1,G.y=1-(t-r.top)/r.height*2,G.strength=n,G.progress=0}),pe=e(({x:e,y:t})=>{if(!B||R)return;let n=K[(q+1)%2*4+2];if(n>=0&&n<ee)return;let r=l.getBoundingClientRect(),i=q*4;K[i]=(e-r.left)/r.width*2-1,K[i+1]=1-(t-r.top)/r.height*2,K[i+2]=0,K[i+3]=1,q=(q+1)%2}),$=e=>{e.preventDefault(),cancelAnimationFrame(B),B=0,d.onError()};return N(),Z.observe(l),Q.observe(l),document.addEventListener(`visibilitychange`,Y),L.addEventListener(`change`,X),l.addEventListener(`webglcontextlost`,$),de&&window.addEventListener(`pointermove`,F,{passive:!0}),Y(),{dispose(){cancelAnimationFrame(B),B=0,Z.disconnect(),Q.disconnect(),document.removeEventListener(`visibilitychange`,Y),L.removeEventListener(`change`,X),l.removeEventListener(`webglcontextlost`,$),window.removeEventListener(`pointermove`,F),fe(),pe(),f.deleteBuffer(x),f.deleteProgram(h),f.deleteShader(p),f.deleteShader(m)}}}export{d as createHeroWaveRenderer};