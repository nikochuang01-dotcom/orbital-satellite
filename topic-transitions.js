(()=>{'use strict';
  const paths={space:'transition-satellite.mp4',network:'transition-network.mp4',carrier:'transition-ca.mp4'};
  const labels={space:'衛星通訊',network:'5G NSA／SA',carrier:'5G CA 載波聚合'};
  const overlay=document.createElement('div');overlay.className='referenceTransition';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','主題轉場影片');
  overlay.innerHTML='<div class="referenceBackdrop" aria-hidden="true"></div><video class="referenceVideo" playsinline muted preload="none" disablepictureinpicture aria-hidden="true"></video><div class="referenceTop"><div><small>ORBITAL / DESTINATION FILM</small><strong class="referenceTitle"></strong></div><button type="button" class="referenceSkip">略過動畫，進入專題</button></div><div class="referenceBottom"><span class="referenceStatus" role="status">正在準備轉場</span><div class="referenceTrack" aria-hidden="true"><i></i></div></div>';
  document.body.append(overlay);
  const video=overlay.querySelector('video'),skip=overlay.querySelector('button'),status=overlay.querySelector('.referenceStatus'),bar=overlay.querySelector('.referenceTrack i'),universe=document.querySelector('.universe');
  video.muted=true;video.playsInline=true;
  let active=null,bufferTimer=0,deadline=0,arrivalTimer=0,raf=0;
  function clean(){clearTimeout(bufferTimer);clearTimeout(deadline);clearTimeout(arrivalTimer);cancelAnimationFrame(raf);video.pause();video.removeAttribute('src');video.load();overlay.hidden=true;overlay.classList.remove('mediaReady','mediaArrived');document.body.classList.remove('mediaTravel');if(universe)universe.inert=false;active=null;document.dispatchEvent(new Event('orbital-media-end'));}
  function finish(){if(!active||active.finishing)return;active.finishing=true;clearTimeout(bufferTimer);cancelAnimationFrame(raf);bar.style.width='100%';status.textContent='轉場完成，正在進入專題';overlay.classList.add('mediaArrived');const url=active.url;arrivalTimer=setTimeout(()=>location.assign(url),350);}
  function buffer(){clearTimeout(bufferTimer);bufferTimer=setTimeout(finish,10000);}
  function update(){if(!active||active.finishing)return;if(Number.isFinite(video.duration)&&video.duration>0)bar.style.width=Math.min(video.currentTime/video.duration*100,100)+'%';raf=requestAnimationFrame(update);}
  video.addEventListener('playing',()=>{if(!active)return;clearTimeout(bufferTimer);overlay.classList.add('mediaReady');status.textContent='正在前往 '+labels[active.kind];});
  video.addEventListener('waiting',buffer);video.addEventListener('stalled',buffer);video.addEventListener('error',()=>{if(active)finish();});video.addEventListener('ended',finish);skip.addEventListener('click',finish);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){const old=active.trigger;clean();old?.focus();}});
  document.addEventListener('click',e=>{
    const link=e.target.closest('a[data-flight]');if(!link||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||link.target==='_blank')return;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const planet=link.matches('.planetLink')?link:document.querySelector('.planetLink[href="'+link.getAttribute('href')+'"]');
    if(!planet||!paths[planet.dataset.kind])return;
    e.preventDefault();e.stopImmediatePropagation();if(active)return;
    const kind=planet.dataset.kind;active={kind,url:link.href,trigger:link,finishing:false};
    overlay.querySelector('.referenceTitle').textContent=labels[kind];overlay.style.setProperty('--mediaAccent',planet.dataset.color);overlay.querySelector('.referenceBackdrop').style.backgroundImage='url("./'+paths[kind].replace('.mp4','.jpg')+'")';bar.style.width='0%';status.textContent='正在準備 '+labels[kind]+' 轉場';overlay.hidden=false;document.body.classList.add('mediaTravel');if(universe)universe.inert=true;
    video.src=new URL('./'+paths[kind],document.baseURI).href;video.load();const playing=video.play();if(playing)playing.catch(finish);skip.focus({preventScroll:true});buffer();deadline=setTimeout(finish,45000);raf=requestAnimationFrame(update);
  },true);
  addEventListener('pageshow',e=>{if(e.persisted)clean();});
})();
