import * as THREE from './three.module.min.js';

// Curved particle-wall spacetime tunnel with GPU lens and motion effects.
export function createWarp(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
  renderer.setClearColor(0x02030e,1);
  renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  let lost=false,needsReset=true,previousTime=0,frames=0,width=0,height=0;
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;canvas.style.opacity='0';canvas.dataset.engine='canvas-fallback';});
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(86,1,.1,420);
  const theme=new THREE.Color();
  const common={uTime:{value:0},uTravel:{value:0},uSpeed:{value:0},uTheme:{value:theme}};
  // A curved wall of discrete GPU particles; no continuous surface mesh.
  const wallCount=innerWidth<700?12000:30000;
  const wallPositions=new Float32Array(wallCount*3),wallSeeds=new Float32Array(wallCount*3);
  for(let i=0;i<wallCount;i++){
    const j=i*3;
    wallPositions[j]=Math.random()*Math.PI*2;
    wallPositions[j+1]=(i+Math.random())/wallCount;
    wallPositions[j+2]=Math.random()*2-1;
    wallSeeds[j]=Math.random();wallSeeds[j+1]=Math.random();wallSeeds[j+2]=Math.random();
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(wallPositions,3));
  geometry.setAttribute('aSeed',new THREE.BufferAttribute(wallSeeds,3));
  common.uPixelRatio={value:1};
  const surface=new THREE.ShaderMaterial({
    uniforms:common,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec3 aSeed;varying float vAlpha;varying float vTint;
      uniform float uTime,uTravel,uSpeed,uPixelRatio;
      void main(){
        float t=fract(position.y-uTravel*.0017);
        float theta=position.x+t*4.0+uTime*.23;
        float filament=.5+.5*sin(theta*11.0+t*40.0+aSeed.x*2.0);
        float radius=12.0-4.0*exp(-pow((t-.43)*5.0,2.0))+3.0*t;
        radius+=position.z*(.8+aSeed.y*1.3)+.7*sin(t*34.0-uTime*2.0+theta*3.0);
        vec2 bend=vec2(sin(t*7.2-uTime*.27),cos(t*5.4+uTime*.21))*pow(t,1.45)*20.0;
        vec3 p=vec3(cos(theta)*radius+bend.x,sin(theta)*radius+bend.y,7.0-t*280.0);
        vec4 view=modelViewMatrix*vec4(p,1.0);
        float fade=smoothstep(.012,.06,t)*(1.0-smoothstep(.8,1.0,t));
        vAlpha=fade*(.28+filament*.62)*(.7+.3*sin(uTime*2.0+aSeed.x*30.0));
        vTint=aSeed.z;
        gl_PointSize=clamp((1.1+aSeed.z*2.4)*uPixelRatio*145.0/max(1.0,-view.z),1.0,9.0*uPixelRatio);
        gl_Position=projectionMatrix*view;
      }`,
    fragmentShader:`varying float vAlpha;varying float vTint;uniform vec3 uTheme;
      void main(){
        float d=length(gl_PointCoord-vec2(.5))*2.0;
        if(d>1.0)discard;
        float glow=exp(-d*d*14.0)+.24*exp(-d*d*3.5);
        vec3 color=mix(vec3(.22,.48,1.0),uTheme,.25+vTint*.6);
        color=mix(color,vec3(.78,.88,1.0),pow(vTint,7.0)*.75);
        gl_FragColor=vec4(color*1.1,glow*vAlpha);
      }`
  });
  const wallParticles=new THREE.Points(geometry,surface);wallParticles.frustumCulled=false;scene.add(wallParticles);
  // Camera-facing strips stretch each 3D star along the viewing axis.
  const count=innerWidth<700?180:330,positions=[],uvs=[],seeds=[];
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2,r=2+Math.random()*8,z=Math.random()*270,seed=Math.random();
    for(const [x,y] of [[-1,0],[1,0],[-1,1],[1,0],[1,1],[-1,1]]){positions.push(Math.cos(a)*r,Math.sin(a)*r,z);uvs.push(x,y);seeds.push(seed);}
  }
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));starGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));starGeo.setAttribute('seed',new THREE.Float32BufferAttribute(seeds,1));
  const starMat=new THREE.ShaderMaterial({uniforms:common,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,
    vertexShader:`attribute float seed;varying vec2 vUv;varying float vSeed;uniform float uTravel,uSpeed;void main(){vUv=uv;vSeed=seed;vec3 p=position;p.z=-mod(position.z-uTravel*(.55+seed*.4)+540.,270.);p.z-=uv.y*(1.+uSpeed*9.);p.x+=uv.x*(.012+seed*.022);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vUv;varying float vSeed;uniform vec3 uTheme;void main(){float a=(1.-abs(vUv.x))*sin(vUv.y*3.14159);gl_FragColor=vec4(mix(vec3(.55,.72,1.),uTheme,.2)+.3,a*.85);}`});
  const starMesh=new THREE.Mesh(starGeo,starMat);starMesh.frustumCulled=false;scene.add(starMesh);
  const targetOptions={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true};
  const sceneTarget=new THREE.WebGLRenderTarget(1,1,targetOptions);
  const lensTarget=new THREE.WebGLRenderTarget(1,1,{...targetOptions,depthBuffer:false});
  let historyA=new THREE.WebGLRenderTarget(1,1,{...targetOptions,depthBuffer:false}),historyB=historyA.clone();
  const quadScene=new THREE.Scene(),quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));quadScene.add(quad);
  const fullVertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const lens=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,uniforms:{tScene:{value:sceneTarget.texture},uTime:{value:0},uSpeed:{value:0},uAspect:{value:1}},vertexShader:fullVertex,
    fragmentShader:`varying vec2 vUv;uniform sampler2D tScene;uniform float uTime,uSpeed,uAspect;
      vec2 lensUV(vec2 uv){vec2 q=uv-.5;vec2 p=q*vec2(uAspect,1.);float r=length(p);float gravity=.022*uSpeed/(r*r+.11);float a=gravity*.35+sin(r*17.-uTime*2.)*.006*uSpeed;mat2 spin=mat2(cos(a),-sin(a),sin(a),cos(a));q=spin*q;return .5+q*(1.-gravity*.32);}
      vec3 dispersed(vec2 uv){vec2 q=uv-.5;float split=(.0035+.009*dot(q,q))*uSpeed;vec2 r=lensUV(uv+q*split),g=lensUV(uv),b=lensUV(uv-q*split);return vec3(texture2D(tScene,clamp(r,.001,.999)).r,texture2D(tScene,clamp(g,.001,.999)).g,texture2D(tScene,clamp(b,.001,.999)).b);}
      void main(){vec2 ray=vUv-.5;vec3 color=vec3(0.);for(int i=0;i<5;i++){float f=float(i)/4.;vec2 sampleUV=vUv-ray*f*.035*uSpeed;color+=dispersed(sampleUV)*(1.-f*.3);}color/=4.25;float vignette=1.-smoothstep(.28,.82,length(ray));color*=.65+.35*vignette;color=1.-exp(-color*1.65);gl_FragColor=vec4(color,1.);}`});
  const trail=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tNow:{value:lensTarget.texture},tPrevious:{value:historyA.texture},uHistory:{value:0},uZoom:{value:.006}},vertexShader:fullVertex,
    fragmentShader:`varying vec2 vUv;uniform sampler2D tNow,tPrevious;uniform float uHistory,uZoom;void main(){vec3 now=texture2D(tNow,vUv).rgb;vec2 uv=.5+(vUv-.5)*(1.-uZoom);vec3 old=texture2D(tPrevious,uv).rgb;gl_FragColor=vec4(mix(now,old,uHistory),1.);}`});
  const output=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tFrame:{value:historyB.texture},uFade:{value:1}},vertexShader:fullVertex,
    fragmentShader:`varying vec2 vUv;uniform sampler2D tFrame;uniform float uFade;void main(){vec3 c=texture2D(tFrame,vUv).rgb;gl_FragColor=vec4(pow(c,vec3(.8))*uFade,1.);}`});
  function resize(){const nw=innerWidth,nh=innerHeight;if(nw===width&&nh===height)return;width=nw;height=nh;const pixelRatio=Math.min(devicePixelRatio||1,innerWidth<700?1.25:1.4,1440/Math.max(nw,nh));renderer.setPixelRatio(pixelRatio);common.uPixelRatio.value=pixelRatio;renderer.setSize(nw,nh,false);camera.aspect=nw/nh;camera.updateProjectionMatrix();lens.uniforms.uAspect.value=nw/nh;for(const t of [sceneTarget,lensTarget,historyA,historyB])t.setSize(Math.round(nw*pixelRatio),Math.round(nh*pixelRatio));needsReset=true;}
  function render(ms,p,hue){if(lost)return false;try{resize();const time=ms*.001,speed=Math.sin(Math.min(p/.83,1)*Math.PI)*1.1+.25;if(ms<previousTime)needsReset=true;previousTime=ms;
    theme.setHSL(hue/360,.72,.62);common.uTime.value=time;common.uTravel.value=time*48+time*time*7;common.uSpeed.value=speed;
    camera.position.set(Math.sin(time*.65)*.65,Math.cos(time*.55)*.45,3);camera.lookAt(Math.sin(time*.25)*1.6,Math.cos(time*.32)*1.1,-60);camera.rotation.z=Math.sin(time*.8)*.045;camera.fov=84+speed*9;camera.updateProjectionMatrix();
    renderer.setRenderTarget(sceneTarget);renderer.render(scene,camera);
    lens.uniforms.uTime.value=time;lens.uniforms.uSpeed.value=speed;quad.material=lens;renderer.setRenderTarget(lensTarget);renderer.render(quadScene,quadCam);
    trail.uniforms.tPrevious.value=historyA.texture;trail.uniforms.uHistory.value=needsReset?0:.32;trail.uniforms.uZoom.value=.005+speed*.006;quad.material=trail;renderer.setRenderTarget(historyB);renderer.render(quadScene,quadCam);
    output.uniforms.tFrame.value=historyB.texture;output.uniforms.uFade.value=1-THREE.MathUtils.smoothstep(p,.72,.91);quad.material=output;renderer.setRenderTarget(null);renderer.render(quadScene,quadCam);[historyA,historyB]=[historyB,historyA];needsReset=false;canvas.dataset.engine='three-webgl';canvas.dataset.frames=String(++frames);return true;
  }catch(e){lost=true;canvas.style.opacity='0';canvas.dataset.engine='canvas-fallback';return false;}}
  resize();renderer.compile(scene,camera);
  return {render,reset(){needsReset=true;previousTime=0;},dispose(){renderer.dispose();geometry.dispose();starGeo.dispose();surface.dispose();starMat.dispose();lens.dispose();trail.dispose();output.dispose();quad.geometry.dispose();for(const t of [sceneTarget,lensTarget,historyA,historyB])t.dispose();}};
}
