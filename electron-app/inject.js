// RiuViewer inject script - runs inside webview
(function(){
if(window.__rvInit) return;
window.__rvInit=true;
window.__autoScroll=true;
window.__scrolling=false;
window.__vol=0;
window.__lastScrollTime=0;
window.__playbackRate=1.0;
window.__videosWatched=0;
window.__watchStartTime=Date.now();
window.__longPressSpeed=null;

// Fake visibility
Object.defineProperty(document,"hidden",{get:()=>false,configurable:true});
Object.defineProperty(document,"visibilityState",{get:()=>"visible",configurable:true});
document.addEventListener("visibilitychange",e=>e.stopImmediatePropagation(),true);
window.addEventListener("blur",e=>{
  e.stopImmediatePropagation();
  setTimeout(()=>document.querySelectorAll("video").forEach(v=>{if(v.paused)v.play()}),200);
},true);

// Prevent pause on visible video
const _origPause=HTMLMediaElement.prototype.pause;
HTMLMediaElement.prototype.pause=function(){
  try{
    if(this.tagName==="VIDEO"){
      const r=this.getBoundingClientRect();
      const visH=Math.min(window.innerHeight,r.bottom)-Math.max(0,r.top);
      if(visH>r.height*0.5&&!window.__userPause)return;
    }
  }catch(e){}
  return _origPause.apply(this,arguments);
};

// Scroll target cache
let _cachedTarget=null,_cacheTime=0;
function getScrollTarget(){
  const now=Date.now();
  if(_cachedTarget&&(now-_cacheTime)<15000&&document.contains(_cachedTarget)
     &&_cachedTarget.scrollHeight>_cachedTarget.clientHeight)return _cachedTarget;
  let best=null;
  const host=location.hostname;
  const selectors = host.includes('instagram.com')
    ? ['section main > div [style*="overflow"]','div._aagw','div[style*="overflow-y: auto"]','div[style*="overflow-y:auto"]']
    : host.includes('facebook.com')
    ? ['[role="main"]','div[style*="overflow-y: scroll"]','div[style*="overflow-y:scroll"]','div[style*="overflow-y: auto"]','div[style*="overflow-y:auto"]','div[style*="overflow: auto"]','div[style*="overflow:auto"]']
    : ['div[style*="overflow-y: auto"]','div[style*="overflow-y:auto"]'];
  for(const sel of selectors){
    for(const el of document.querySelectorAll(sel)){
      if(el.scrollHeight>el.clientHeight*1.2&&el.clientHeight>200){if(!best||el.scrollHeight>best.scrollHeight)best=el;}
    }
    if(best)break;
  }
  if(!best){
    const divs=document.querySelectorAll('div');
    for(let i=0;i<Math.min(divs.length,300);i++){
      try{const s=getComputedStyle(divs[i]);
      if((s.overflowY==='auto'||s.overflowY==='scroll')&&divs[i].scrollHeight>divs[i].clientHeight*1.3&&divs[i].clientHeight>300){
        if(!best||divs[i].clientHeight>best.clientHeight)best=divs[i];
      }}catch(e){}
    }
  }
  _cachedTarget=best||document.documentElement;_cacheTime=now;return _cachedTarget;
}

function doScrollNext(){
  const host = location.hostname;
  if (host.includes('instagram.com')) {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40,
      bubbles: true, cancelable: true
    }));
    return;
  }
  const vscroller = document.querySelector('.vscroller') || document.querySelector('[class*="vscroller"]');
  if (vscroller) {
    _scrollViaWheel(vscroller, false);
    return;
  }
  const scrollables = _findAllScrollables();
  for (const sc of scrollables) {
    sc.scrollBy({ top: sc.clientHeight || window.innerHeight, behavior: 'smooth' });
  }
  window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
}

// #18: Single wheel event instead of triple, with longer fallback wait
function _scrollViaWheel(target, up) {
  const delta = up ? -600 : 600;
  target.dispatchEvent(new WheelEvent('wheel', {
    deltaY: delta, deltaX: 0, deltaMode: 0,
    bubbles: true, cancelable: true, view: window
  }));
  const before = target.scrollTop;
  // #8: Longer wait (700ms) to let smooth scroll animate before fallback
  setTimeout(() => {
    if (Math.abs(target.scrollTop - before) < 10) {
      const snapH = target.clientHeight;
      const dest = up ? Math.max(0, before - snapH) : before + snapH;
      target.style.scrollBehavior = 'auto';
      target.style.scrollSnapType = 'none';
      target.scrollTop = dest;
      setTimeout(() => {
        target.style.scrollBehavior = '';
        target.style.scrollSnapType = '';
      }, 150);
    }
  }, 700);
}

function _findAllScrollables() {
  const results = [];
  const all = document.querySelectorAll('div');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (el.closest && el.closest('#__rv_controls')) continue;
    if (el.scrollHeight > el.clientHeight + 10 && el.clientHeight > 200) {
      try {
        const cs = getComputedStyle(el);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflow === 'auto' || cs.overflow === 'scroll') {
          results.push(el);
        }
      } catch(e) {}
    }
  }
  if (document.documentElement.scrollHeight > document.documentElement.clientHeight + 10) {
    results.push(document.documentElement);
  }
  return results;
}

window.__doManualScroll=function(up){
  const host = location.hostname;
  if (host.includes('instagram.com')) {
    const key = up ? 'ArrowUp' : 'ArrowDown';
    const code = up ? 38 : 40;
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: key, code: key, keyCode: code, which: code,
      bubbles: true, cancelable: true
    }));
    return;
  }
  const vscroller = document.querySelector('.vscroller') || document.querySelector('[class*="vscroller"]');
  if (vscroller) {
    _scrollViaWheel(vscroller, up);
    return;
  }
  const dist = (up ? -1 : 1) * window.innerHeight;
  window.scrollBy({ top: dist, behavior: 'smooth' });
};

function getPrimaryVideo(){
  let primary=null;
  document.querySelectorAll("video").forEach(v=>{if(visPrimary(v)&&!v.paused)primary=v;});
  return primary||document.querySelector("video");
}
function visPrimary(v){const r=v.getBoundingClientRect();return(Math.min(window.innerHeight,r.bottom)-Math.max(0,r.top))>r.height*0.6;}
function vis(v){const r=v.getBoundingClientRect();return(Math.min(window.innerHeight,r.bottom)-Math.max(0,r.top))>r.height*0.4;}

// #10: Bind videos — re-remove loop on src change
function bind(){document.querySelectorAll("video").forEach(v=>{
  if(v.__rv){
    const curSrc = v.currentSrc || v.src || '';
    if (v.__rvSrc && v.__rvSrc !== curSrc && curSrc) {
      v.__done = false;
      v.__totalPlayed = 0;
      v.__lastCheckTime = -1;
      v.__loopCount = 0;
      v.__bindTime = Date.now();
      v.__rvSrc = curSrc;
      // #10: re-remove loop on src change
      v.removeAttribute("loop"); v.loop = false;
    }
    return;
  }
  v.__rv=true;v.__done=false;v.__totalPlayed=0;v.__lastCheckTime=-1;v.__loopCount=0;v.__bindTime=Date.now();
  v.__rvSrc = v.currentSrc || v.src || '';
  v.volume=window.__vol;v.muted=(window.__vol===0);
  v.playbackRate=window.__playbackRate;
  v.removeAttribute("loop");v.loop=false;

  v.addEventListener("ended",()=>{
    if(visPrimary(v)&&!v.__done){window.__videosWatched++;triggerScroll(v);}
  });
  v.addEventListener("timeupdate",()=>{
    if(!window.__autoScroll||window.__scrolling||v.__done||!visPrimary(v))return;
    if(Date.now()-window.__lastScrollTime<6000||Date.now()-v.__bindTime<3000)return;
    const t=v.currentTime,d=v.duration;
    if(v.__lastCheckTime>=0&&t>v.__lastCheckTime&&t-v.__lastCheckTime<1)v.__totalPlayed+=t-v.__lastCheckTime;
    if(v.__lastCheckTime>2&&t<0.5){
      if(d&&d>0&&d!==Infinity){if(v.__totalPlayed>=d*0.9){v.__loopCount++;if(v.__loopCount>=1){window.__videosWatched++;triggerScroll(v);}}}
      else{if(v.__totalPlayed>=8){v.__loopCount++;if(v.__loopCount>=1){window.__videosWatched++;triggerScroll(v);}}}
    }
    // #11: near-end detection — only trigger if not already done (triggerScroll checks __done)
    if(d&&d>1&&d!==Infinity&&t>=d-0.3&&v.__totalPlayed>=d*0.85&&!v.__done){window.__videosWatched++;triggerScroll(v);}
    v.__lastCheckTime=t;
  });
  const lk=setInterval(()=>{if(!document.contains(v)){clearInterval(lk);return;}if(v.loop){v.loop=false;v.removeAttribute("loop");}},2000);
});}

// #11: Timer-based fallback — check __done to prevent double-count
setInterval(function(){
  if(!window.__autoScroll||window.__scrolling)return;
  if(Date.now()-window.__lastScrollTime<6000)return;
  const v=getPrimaryVideo();
  if(!v||v.paused||v.__done)return;
  const d=v.duration;
  if(d&&d>0&&d!==Infinity){
    if(v.currentTime>=d*0.95&&!v.__done){
      window.__videosWatched++;
      triggerScroll(v);
      return;
    }
  }
  if(Date.now()-v.__bindTime>20000&&v.__totalPlayed>12&&!v.__done){
    window.__videosWatched++;
    triggerScroll(v);
  }
},2000);

// #7: Only reset the scrolled video, not ALL videos
function triggerScroll(v, isAdSkip){
  const cooldown = isAdSkip ? 2000 : 6000;
  if(window.__scrolling||v.__done||!window.__autoScroll||Date.now()-window.__lastScrollTime<cooldown)return;
  v.__done=true;window.__scrolling=true;window.__lastScrollTime=Date.now();
  v.volume=0;v.muted=true;
  setTimeout(()=>{
    doScrollNext();
  },400);
  setTimeout(()=>{
    window.__scrolling=false;
    window.__lastScrollTime=Date.now();
  },4000);
}

// #15: Event-driven audio management instead of 300ms polling
let _lastPrimaryVideo = null;
function manageAudio(){
  const videos = document.querySelectorAll("video");
  let primary=null;
  videos.forEach(v=>{if(visPrimary(v)&&!v.paused)primary=v;});
  // Only update if primary changed or on periodic check
  videos.forEach(v=>{
    if(v===primary){v.volume=window.__vol;v.muted=(window.__vol===0);}
    else{v.volume=0;v.muted=true;}
  });
  _lastPrimaryVideo = primary;
}

// #16: Only apply playback rate when it actually differs
function applyPlaybackRate(){
  const rate=window.__longPressSpeed||window.__playbackRate;
  document.querySelectorAll("video").forEach(v=>{if(v.playbackRate!==rate)v.playbackRate=rate;});
}

// Ad detection
function isAd(){
  const adWords=["Được tài trợ","Sponsored","Publicidad","Gesponsert","Sponsorisé","Patrocinado","Quảng cáo","Ad"];
  const host=location.hostname;
  if(host.includes('instagram.com'))adWords.push("Được tài trợ","Sponsored");
  for(const sp of document.querySelectorAll("span,a,div")){
    const t=(sp.textContent||"").trim();
    if(t.length>30||t.length<2)continue;
    if(adWords.includes(t)){const r=sp.getBoundingClientRect();if(r.top>=-50&&r.bottom<=window.innerHeight+50&&r.width>0)return true;}
  }
  if(host.includes('facebook.com')){
    const adSelectors=['[data-sigil*="ad"]','[data-ad]','[data-ft*="ad"]','a[href*="/ads/"]','[data-store*="sponsor"]'];
    for(const sel of adSelectors){
      const el=document.querySelector(sel);
      if(el){const r=el.getBoundingClientRect();if(r.top>=-50&&r.bottom<=window.innerHeight+50&&r.width>0)return true;}
    }
  }
  return false;
}
function skipAds(){
  if(!window.__autoScroll||window.__scrolling)return;
  if(Date.now()-window.__lastScrollTime<2000)return;
  if(isAd()){
    document.querySelectorAll("video").forEach(v=>{if(!v.paused&&visPrimary(v)&&!v.__done)triggerScroll(v, true);});
  }
}

// #9 #14: Debounced dismissAll — split into lightweight (CSS-based) and heavyweight (DOM scan)
let _dismissDebounceTimer = null;
let _lastHeavyDismiss = 0;

function dismissAllDebounced(){
  if(_dismissDebounceTimer) return; // already scheduled
  _dismissDebounceTimer = setTimeout(()=>{
    _dismissDebounceTimer = null;
    dismissLight();
    // Heavy scan at most every 3 seconds
    const now = Date.now();
    if(now - _lastHeavyDismiss > 3000){
      _lastHeavyDismiss = now;
      dismissHeavy();
    }
  }, 300);
}

// Lightweight: CSS injection + targeted selectors (fast, safe to run often)
function dismissLight(){
  const host = location.hostname;
  const isLoginPage = location.pathname.includes('/login') || location.href.includes('login.php') || location.href.includes('/checkpoint') || location.href.includes('/accounts/login');
  if (isLoginPage) return;

  // Inject hide style once
  if(!document.getElementById("__rvStyle")){
    const s=document.createElement("style");s.id="__rvStyle";
    const isLogin = location.pathname.includes('/login') || location.href.includes('login.php') || location.href.includes('/checkpoint');
    const hideNavRule = isLogin ? '' : 'header,nav,[role="banner"],[role="navigation"],[data-pagelet="header"],[data-pagelet="nav_bar"]{display:none!important}';
    const hideFormRule = isLogin ? '' : 'form:not([action*="accounts"]):not([action*="login"]),input[type="text"]:not([name="username"]):not([name="password"]):not([name="email"]):not([id="email"]):not([id="pass"]),input[placeholder]:not([name="username"]):not([name="password"]):not([name="email"]):not([id="email"]):not([id="pass"]){display:none!important}';
    const fbReelsHeader = host.includes('facebook.com') && !isLogin ? [
      'div[data-pagelet="ReelsHeaderUnit"]{display:none!important}',
      'div[data-type="vscroller"]{padding-top:0!important}',
      'a[href*="//itunes.apple.com"],a[href*="//play.google.com"],a[href*="market://"],a[href*="intent://"],div[class*="native-app"],a[data-sigil*="MTopBlueBarOpenInApp"]{display:none!important}',
      '#header,#MTopBlueBar,.mTopBlueBar,div[id="header"],div[data-sigil="MTopBlueBar"],div[id="MTopBlueBar"]{display:none!important}',
      'div[data-sigil="top-blue-bar"],div[data-gt*="top_blue_bar"]{display:none!important}',
      'body>div:first-child>div:first-child[style*="position: fixed"],body>div:first-child>div:first-child[style*="position:fixed"]{display:none!important}',
      'a[href="/"],a[href="/home.php"]{pointer-events:none!important}',
      '[data-sigil*="like"]:not(video):not(#__rv_controls):not(#__rv_controls *){display:none!important}',
      '[data-sigil*="share"]:not(#__rv_controls):not(#__rv_controls *){display:none!important}',
      '[data-sigil*="comment"]:not(#__rv_controls):not(#__rv_controls *){display:none!important}',
      '.vscroller .story-overlay-bottom,.vscroller .overlay-bottom{display:none!important}',
      '.vscroller [class*="action"],.vscroller [class*="Action"]{display:none!important}',
      '.vscroller>div>div:last-child{pointer-events:none!important;opacity:0!important}',
      // Hide the top bar containing "Reels" title + search + profile + "Mở ứng dụng"
      '.vscroller~div[style*="position"]{display:none!important}',
      'div[data-type="vscroller"]~div{display:none!important}',
      // Any fixed element at top that is not our controls
      'body>div:first-child>div:first-child:not(.vscroller):not(#__rv_controls){position:relative!important;display:none!important}',
    ].join('') : '';
    s.textContent=[
      '[data-testid="royal_login_bar"],[data-testid="mobile_login_bar"]{display:none!important}',
      'body,html{background:#000!important;overflow:auto!important}',
      hideNavRule,
      'video{object-fit:cover!important}',
      hideFormRule,
      fbReelsHeader,
    ].join('');
    document.head.appendChild(s);
  }

  // Click close/dismiss buttons (lightweight, targeted selectors)
  document.querySelectorAll("[aria-label='Close'],[aria-label='Đóng'],[aria-label='Dismiss']").forEach(b=>b.click());

  // FB: force-hide the Reels header bar by finding it via structure
  if (host.includes('facebook.com')) {
    // The header is typically a fixed div above the vscroller
    var vs = document.querySelector('.vscroller');
    if(vs && vs.previousElementSibling){
      vs.previousElementSibling.style.cssText='display:none!important';
    }
    // Also hide any sibling divs of vscroller that aren't our controls
    if(vs && vs.parentElement){
      Array.from(vs.parentElement.children).forEach(function(ch){
        if(ch===vs)return;
        if(ch.id&&(ch.id.startsWith('rv-')||ch.id==='__rv_controls'||ch.id==='__rv_css'||ch.id==='__rv_ctrl_js'))return;
        if(ch.tagName==='STYLE'||ch.tagName==='SCRIPT')return;
        ch.style.cssText='display:none!important';
      });
    }
  }

  const words=["not now","không phải bây giờ","đóng","để sau","bỏ qua","skip","later","no thanks"];
  document.querySelectorAll("a,button,[role='button']").forEach(b=>{
    const t=(b.textContent||"").toLowerCase().trim();
    if(words.includes(t))b.click();
  });

  // Remove dialogs
  document.querySelectorAll("[role='dialog'],[data-testid='royal_login_bar']").forEach(e=>{
    if (host.includes('instagram.com')) {
      const txt = (e.textContent || '').toLowerCase();
      if (txt.includes('log in') || txt.includes('sign up') || txt.includes('đăng nhập') || txt.includes('đăng ký')) {
        e.remove();
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        return;
      }
    }
    e.remove();
  });

  // Instagram: remove login overlay
  if (host.includes('instagram.com')) {
    document.querySelectorAll('div[role="presentation"]').forEach(el => {
      const txt = (el.textContent || '').toLowerCase();
      if (txt.includes('log in') || txt.includes('sign up') || txt.includes('đăng nhập')) el.remove();
    });
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.documentElement.style.overflow = '';
  }
}

// #14: Heavyweight DOM scan — runs at most every 3s
function dismissHeavy(){
  const host = location.hostname;
  const isLoginPage = location.pathname.includes('/login') || location.href.includes('login.php') || location.href.includes('/checkpoint') || location.href.includes('/accounts/login');
  if (isLoginPage) return;

  if (host.includes('facebook.com')) {
    // Remove known FB header elements
    document.querySelectorAll('#header,#MTopBlueBar,.mTopBlueBar,[data-sigil="MTopBlueBar"],[data-sigil="top-blue-bar"]').forEach(e=>e.remove());

    // Hide fixed top bars (scan computed style for FB headers — limited to top 100px of viewport)
    document.querySelectorAll('div').forEach(el=>{
      if(el.id&&el.id.startsWith('rv-'))return;
      if(el.closest&&el.closest('#__rv_controls'))return;
      try{
        const r=el.getBoundingClientRect();
        // Only check elements near top of viewport to limit scope
        if(r.top>100||r.width<window.innerWidth*0.7)return;
        const s=getComputedStyle(el);
        if((s.position==='fixed'||s.position==='sticky')&&el.offsetHeight>=40&&el.offsetHeight<90){
          if(r.top<10) el.style.display='none';
        }
      }catch(e){}
    });

    // Hide "Mở ứng dụng" / "Open app" buttons — use targeted text matching
    const fbHideTexts = new Set(['Mở ứng dụng','Open app','Open in app','Nhấn để bật tiếng','Tap to unmute',
      'Theo dõi','Follow','Thích','Like','Bình luận','Comment','Chia sẻ','Share']);
    document.querySelectorAll('a,button,[role="button"]').forEach(b=>{
      const t=(b.textContent||'').trim();
      if(fbHideTexts.has(t) || /^Mở ứng/.test(t)){
        if(b.closest&&b.closest('#__rv_controls'))return;
        let p=b;
        for(let i=0;i<3;i++){
          if(p.parentElement&&p.parentElement.offsetHeight<80&&p.parentElement.tagName!=='BODY')p=p.parentElement;
          else break;
        }
        p.style.cssText='display:none!important';
      }
    });

    // Hide FB native overlays in vscroller (but not video containers)
    const vscroller = document.querySelector('.vscroller');
    if(vscroller){
      const allVideos = vscroller.querySelectorAll('video');
      vscroller.querySelectorAll('div,a,span,button,footer,aside').forEach(el=>{
        if(el.closest&&el.closest('#__rv_controls'))return;
        if(el.tagName==='VIDEO')return;
        let containsVideo = false;
        allVideos.forEach(v=>{ if(el.contains(v)) containsVideo=true; });
        if(containsVideo)return;
        try{
          const cs=getComputedStyle(el);
          const r=el.getBoundingClientRect();
          if(r.width<10||r.height<10)return;
          if(cs.position==='absolute'||cs.position==='fixed'){
            if(r.top<window.innerHeight&&r.bottom>0&&r.left<window.innerWidth&&r.right>0){
              el.style.cssText='display:none!important';
            }
          }
        }catch(e){}
      });
    }
  }

  // Remove app-open overlays (targeted, not full div scan)
  document.querySelectorAll("div[style*='position: fixed'],div[style*='position:fixed']").forEach(el=>{
    const t=(el.textContent||"").trim();
    if((t.includes("Xem thước phim")||t.includes("trong ứng dụng")||t.includes("Open in app")||t.includes("in the app"))&&el.offsetHeight>200&&el.offsetWidth>200){
      const r=el.getBoundingClientRect();
      if(r.top<window.innerHeight*0.5&&r.height>window.innerHeight*0.3)el.remove();
    }
  });

  // Hide app-open buttons
  if (!isLoginPage) {
    const hideTexts = new Set(["Open app","Mở ứng dụng","Get the app","Tải ứng dụng","Dùng ứng dụng","Use app",
      "Mở Instagram","Open Instagram","Mở TikTok","Open TikTok","Đăng ký","Log in","Sign up",
      "Log in to continue","Đăng nhập để tiếp tục"]);
    document.querySelectorAll("a,button,[role='button']").forEach(b=>{
      const t=(b.textContent||"").trim();
      if(hideTexts.has(t)||t.startsWith("Mở ứng")){
        b.style.display="none";if(b.parentElement)b.parentElement.style.display="none";
      }
    });
  }

  // Hide fixed bottom bars (scan computed style, not just inline)
  document.querySelectorAll("div").forEach(el=>{
    if(el.id&&el.id.startsWith('rv-'))return;
    if(el.closest&&el.closest('#__rv_controls'))return;
    // Quick filter: only check elements near bottom of viewport
    try{
      const r=el.getBoundingClientRect();
      if(r.bottom<window.innerHeight-50)return;
      if(el.offsetHeight>=100)return;
      const s=getComputedStyle(el);
      if((s.position==="fixed"||s.position==="sticky")&&r.bottom>=window.innerHeight-10){
        el.style.display="none";
      }
    }catch(e){}
  });
}

function handleGrid(){
  if(!window.__autoScroll)return;
  let playing=false;
  document.querySelectorAll("video").forEach(v=>{if(!v.paused&&vis(v))playing=true;});
  if(playing)return;
  const links=document.querySelectorAll("a[href*='/reel/'],a[href*='/reels/']");
  if(links.length>0){links[0].click();return;}
  if(location.hostname.includes('instagram.com')){
    const vids=document.querySelectorAll('video');
    if(vids.length>0&&vids[0].paused){vids[0].click();}
  }
}

// API
window.__seekTo=pct=>{const v=getPrimaryVideo();if(v&&v.duration&&v.duration!==Infinity)v.currentTime=v.duration*pct;};
window.__seekRelative=sec=>{const v=getPrimaryVideo();if(v&&v.duration&&v.duration!==Infinity)v.currentTime=Math.max(0,Math.min(v.duration,v.currentTime+sec));};
window.__getProgress=()=>{const v=getPrimaryVideo();if(v&&v.duration&&v.duration!==Infinity)return{current:v.currentTime,duration:v.duration,progress:v.currentTime/v.duration};return{current:0,duration:0,progress:0};};
window.__getStats=()=>({watched:window.__videosWatched,minutes:Math.floor((Date.now()-window.__watchStartTime)/60000)});
window.__getTimeDisplay=()=>{
  const v=getPrimaryVideo();if(!v||!v.duration||v.duration===Infinity)return"0:00 / 0:00";
  const fmt=s=>{const m=Math.floor(s/60);s=Math.floor(s%60);return m+":"+(s<10?"0":"")+s;};
  return fmt(v.currentTime)+" / "+fmt(v.duration);
};
window.__screenshot=()=>{
  const v=getPrimaryVideo();if(!v)return null;
  const c=document.createElement("canvas");c.width=v.videoWidth;c.height=v.videoHeight;
  c.getContext("2d").drawImage(v,0,0);return c.toDataURL("image/png");
};

// #9: Debounced MutationObserver — bind is lightweight, dismissAll is debounced
function setupObserver(){
  const target = document.body;
  if(!target){document.addEventListener('DOMContentLoaded',setupObserver);return;}
  new MutationObserver(()=>{
    bind();
    dismissAllDebounced();
  }).observe(target,{childList:true,subtree:true});
}
setupObserver();

// #14: Reduced interval frequency — heavy dismiss handled by debounce
setInterval(dismissAllDebounced, 3000); // was 2000, now debounced
setInterval(handleGrid,2500);
setInterval(skipAds,2500);
setInterval(manageAudio, 500); // #15: 500ms instead of 300ms
setInterval(applyPlaybackRate, 1000); // #16: 1s instead of 500ms
setInterval(()=>document.querySelectorAll("video").forEach(v=>{if(v.paused&&vis(v))v.play();}),1000);
setInterval(()=>{if(window.__scrolling&&Date.now()-window.__lastScrollTime>5000)window.__scrolling=false;},2000);
bind();
})();
