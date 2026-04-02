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
  if(_cachedTarget&&(now-_cacheTime)<15000&&document.contains(_cachedTarget)&&_cachedTarget.scrollHeight>_cachedTarget.clientHeight)return _cachedTarget;
  let best=null;
  const host=location.hostname;
  // Platform-specific selectors first
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
  
  // Instagram: use ArrowDown keyboard event
  if (host.includes('instagram.com')) {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40,
      bubbles: true, cancelable: true
    }));
    return;
  }
  
  // Touch FB: use wheel event on vscroller (FB listens to wheel for snap scroll)
  const vscroller = document.querySelector('.vscroller') || document.querySelector('[class*="vscroller"]');
  if (vscroller) {
    _scrollViaWheel(vscroller, false);
    return;
  }
  
  // Generic fallback
  const scrollables = _findAllScrollables();
  for (const sc of scrollables) {
    sc.scrollBy({ top: sc.clientHeight || window.innerHeight, behavior: 'smooth' });
  }
  window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
}

function _scrollViaWheel(target, up) {
  // Dispatch wheel events to trigger FB's snap scroll
  const delta = up ? -300 : 300;
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      target.dispatchEvent(new WheelEvent('wheel', {
        deltaY: delta, deltaX: 0, deltaMode: 0,
        bubbles: true, cancelable: true, view: window
      }));
    }, i * 50);
  }
  // Check after 400ms if wheel worked
  const before = target.scrollTop;
  setTimeout(() => {
    if (Math.abs(target.scrollTop - before) < 10) {
      // Wheel didn't work, force scrollTop once
      const snapH = target.clientHeight;
      const dest = up ? Math.max(0, before - snapH) : before + snapH;
      target.style.scrollBehavior = 'auto';
      target.style.scrollSnapType = 'none';
      target.scrollTop = dest;
      setTimeout(() => {
        target.style.scrollBehavior = '';
        target.style.scrollSnapType = '';
      }, 100);
      console.log('[RV] forced scrollTop from', before, 'to', dest);
    } else {
      console.log('[RV] wheel scroll worked, scrollTop:', target.scrollTop);
    }
  }, 400);
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
  // Also check if body/html is scrollable
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
  // Touch FB: use wheel + force scroll
  const vscroller = document.querySelector('.vscroller') || document.querySelector('[class*="vscroller"]');
  if (vscroller) {
    _scrollViaWheel(vscroller, up);
    return;
  }
  // Fallback
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

// Bind videos
function bind(){document.querySelectorAll("video").forEach(v=>{
  if(v.__rv){
    // Check if src changed (FB reuses video elements)
    const curSrc = v.currentSrc || v.src || '';
    if (v.__rvSrc && v.__rvSrc !== curSrc && curSrc) {
      // Reset for new video
      v.__done = false;
      v.__totalPlayed = 0;
      v.__lastCheckTime = -1;
      v.__loopCount = 0;
      v.__bindTime = Date.now();
      v.__rvSrc = curSrc;
    }
    return;
  }
  v.__rv=true;v.__done=false;v.__totalPlayed=0;v.__lastCheckTime=-1;v.__loopCount=0;v.__bindTime=Date.now();
  v.__rvSrc = v.currentSrc || v.src || '';
  v.volume=window.__vol;v.muted=(window.__vol===0);
  v.playbackRate=window.__playbackRate;
  v.removeAttribute("loop");v.loop=false;

  v.addEventListener("ended",()=>{
    console.log('[RV] video ended, visPrimary:', visPrimary(v));
    if(visPrimary(v)){window.__videosWatched++;triggerScroll(v);}
  });
  v.addEventListener("timeupdate",()=>{
    if(!window.__autoScroll||window.__scrolling||v.__done||!visPrimary(v))return;
    if(Date.now()-window.__lastScrollTime<6000||Date.now()-v.__bindTime<3000)return;
    const t=v.currentTime,d=v.duration;
    if(v.__lastCheckTime>=0&&t>v.__lastCheckTime&&t-v.__lastCheckTime<1)v.__totalPlayed+=t-v.__lastCheckTime;
    // Detect loop restart (currentTime jumps back to near 0)
    if(v.__lastCheckTime>2&&t<0.5){
      if(d&&d>0&&d!==Infinity){if(v.__totalPlayed>=d*0.9){v.__loopCount++;if(v.__loopCount>=1){window.__videosWatched++;triggerScroll(v);}}}
      else{if(v.__totalPlayed>=8){v.__loopCount++;if(v.__loopCount>=1){window.__videosWatched++;triggerScroll(v);}}}
    }
    // Near end of video
    if(d&&d>1&&d!==Infinity&&t>=d-0.3&&v.__totalPlayed>=d*0.85&&!v.__done){window.__videosWatched++;triggerScroll(v);}
    v.__lastCheckTime=t;
  });
  // Re-remove loop periodically
  const lk=setInterval(()=>{if(!document.contains(v)){clearInterval(lk);return;}if(v.loop){v.loop=false;v.removeAttribute("loop");}},2000);
});}

// Timer-based auto scroll fallback: checks every 2 seconds
setInterval(function(){
  if(!window.__autoScroll||window.__scrolling)return;
  if(Date.now()-window.__lastScrollTime<6000)return;
  const v=getPrimaryVideo();
  if(!v||v.paused||v.__done)return;
  const d=v.duration;
  // If duration is known and finite
  if(d&&d>0&&d!==Infinity){
    if(v.currentTime>=d*0.95){
      console.log('[RV] timer: video near end, scrolling. ct='+v.currentTime+' d='+d);
      window.__videosWatched++;
      triggerScroll(v);
      return;
    }
  }
  // If duration unknown/infinite but video has been bound for >20s
  if(Date.now()-v.__bindTime>20000&&v.__totalPlayed>12){
    console.log('[RV] timer: long play fallback, scrolling. totalPlayed='+v.__totalPlayed);
    window.__videosWatched++;
    triggerScroll(v);
  }
},2000);
function triggerScroll(v, isAdSkip){
  const cooldown = isAdSkip ? 2000 : 6000;
  if(window.__scrolling||v.__done||!window.__autoScroll||Date.now()-window.__lastScrollTime<cooldown)return;
  console.log('[RV] triggerScroll called');
  v.__done=true;window.__scrolling=true;window.__lastScrollTime=Date.now();
  v.volume=0;v.muted=true;
  setTimeout(()=>{
    console.log('[RV] calling doScrollNext');
    doScrollNext();
  },400);
  // After scroll completes, reset states for next video
  setTimeout(()=>{
    window.__scrolling=false;
    // Reset all videos so next one can trigger
    document.querySelectorAll('video').forEach(vid => {
      vid.__done = false;
      vid.__totalPlayed = 0;
      vid.__lastCheckTime = -1;
      vid.__loopCount = 0;
      vid.__bindTime = Date.now(); // Reset bind time so cooldown applies
    });
    // Update lastScrollTime to now so cooldown starts fresh
    window.__lastScrollTime = Date.now();
    console.log('[RV] scrolling unlocked, reset video states');
  },4000);
}

function manageAudio(){
  let primary=null;
  document.querySelectorAll("video").forEach(v=>{if(visPrimary(v)&&!v.paused)primary=v;});
  document.querySelectorAll("video").forEach(v=>{
    if(v===primary){v.volume=window.__vol;v.muted=(window.__vol===0);}
    else{v.volume=0;v.muted=true;}
  });
}

function applyPlaybackRate(){
  const rate=window.__longPressSpeed||window.__playbackRate;
  document.querySelectorAll("video").forEach(v=>{if(v.playbackRate!==rate)v.playbackRate=rate;});
}

  // Ad detection
function isAd(){
  const adWords=["Được tài trợ","Sponsored","Publicidad","Gesponsert","Sponsorisé","Patrocinado","Quảng cáo","Ad"];
  const host=location.hostname;
  if(host.includes('instagram.com'))adWords.push("Được tài trợ","Sponsored");
  // Check spans
  for(const sp of document.querySelectorAll("span,a,div")){
    const t=(sp.textContent||"").trim();
    if(t.length>30||t.length<2)continue;
    if(adWords.includes(t)){const r=sp.getBoundingClientRect();if(r.top>=-50&&r.bottom<=window.innerHeight+50&&r.width>0)return true;}
  }
  // Touch FB: check for "Sponsored" data attributes or ad markers
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
  // Shorter cooldown for ads (2s instead of 5s)
  if(Date.now()-window.__lastScrollTime<2000)return;
  if(isAd()){
    console.log('[RV] ad detected, skipping');
    document.querySelectorAll("video").forEach(v=>{if(!v.paused&&visPrimary(v)&&!v.__done)triggerScroll(v, true);});
  }
}

// Dismiss popups/overlays
function dismissAll(){
  const host = location.hostname;
  const isLoginPage = location.pathname.includes('/login') || location.href.includes('login.php') || location.href.includes('/checkpoint') || location.href.includes('/accounts/login');
  
  // Don't dismiss anything on login pages - let user login
  if (isLoginPage) return;

  // Facebook touch: remove top header bar and "Mở ứng dụng" button
  if (host.includes('facebook.com')) {
    // Remove top header/nav bar
    document.querySelectorAll('#header,#MTopBlueBar,.mTopBlueBar,[data-sigil="MTopBlueBar"],[data-sigil="top-blue-bar"]').forEach(e=>e.remove());
    // Remove any fixed top bar that is FB header (40-90px height, not our controls)
    document.querySelectorAll('div').forEach(el=>{
      if(el.id&&el.id.startsWith('rv-'))return;
      if(el.closest&&el.closest('#__rv_controls'))return;
      try{
        const s=getComputedStyle(el);
        if((s.position==='fixed'||s.position==='sticky')&&el.offsetHeight>=40&&el.offsetHeight<90){
          const r=el.getBoundingClientRect();
          if(r.top<10&&r.width>window.innerWidth*0.7){
            el.style.display='none';
          }
        }
      }catch(e){}
    });
    // Remove "Mở ứng dụng" / "Open app" / "Nhấn để bật tiếng" buttons and banners
    document.querySelectorAll('a,button,div,[role="button"],span').forEach(b=>{
      const t=(b.textContent||'').trim();
      if(t==='Mở ứng dụng'||t==='Mở ứng...'||t==='Open app'||t==='Open in app'||t==='Mở ứ...'||t.match(/^Mở ứng/)
        ||t==='Nhấn để bật tiếng'||t==='Tap to unmute'
        ||t==='Theo dõi'||t==='Follow'||t==='Thích'||t==='Like'
        ||t==='Bình luận'||t==='Comment'||t==='Chia sẻ'||t==='Share'){
        if(b.closest&&b.closest('#__rv_controls'))return;
        let p=b;
        for(let i=0;i<3;i++){
          if(p.parentElement&&p.parentElement.offsetHeight<80&&p.parentElement.tagName!=='BODY')p=p.parentElement;
          else break;
        }
        p.style.cssText='display:none!important';
      }
    });
    // Hide FB native overlays (like/share/comment/caption) but NOT video containers
    const vscroller = document.querySelector('.vscroller');
    if(vscroller){
      const allVideos = vscroller.querySelectorAll('video');
      vscroller.querySelectorAll('div,a,span,button,footer,aside').forEach(el=>{
        if(el.closest&&el.closest('#__rv_controls'))return;
        if(el.tagName==='VIDEO')return;
        // Skip if this element contains or is ancestor of any video
        let containsVideo = false;
        allVideos.forEach(v=>{ if(el.contains(v)) containsVideo=true; });
        if(containsVideo)return;
        // Skip if any video is ancestor of this element
        let insideVideo = false;
        allVideos.forEach(v=>{ if(v.parentElement&&v.parentElement.contains(el)) insideVideo=true; });
        try{
          const cs=getComputedStyle(el);
          const r=el.getBoundingClientRect();
          if(r.width<10||r.height<10)return;
          if(cs.position==='absolute'||cs.position==='fixed'){
            // Only hide if it's visually overlapping the viewport (not off-screen)
            if(r.top<window.innerHeight&&r.bottom>0&&r.left<window.innerWidth&&r.right>0){
              el.style.cssText='display:none!important';
            }
          }
        }catch(e){}
      });
    }
  }
  
  document.querySelectorAll("[aria-label='Close'],[aria-label='Đóng'],[aria-label='Dismiss']").forEach(b=>b.click());
  const words=["not now","không phải bây giờ","đóng","để sau","bỏ qua","skip","later","no thanks"];
  document.querySelectorAll("a,button,[role='button']").forEach(b=>{
    const t=(b.textContent||"").toLowerCase().trim();
    if(words.includes(t)){b.click();return;}
  });
  document.querySelectorAll("[role='dialog'],[data-testid='royal_login_bar']").forEach(e=>{
    // Don't remove login dialogs on login pages
    const isLoginPage = location.pathname.includes('/login') || location.href.includes('login.php') || location.href.includes('/checkpoint') || location.href.includes('/accounts/login');
    if (isLoginPage) return;
    // For Instagram login dialogs, remove them
    if (host.includes('instagram.com')) {
      // Check if it's a login/signup dialog
      const txt = (e.textContent || '').toLowerCase();
      if (txt.includes('log in') || txt.includes('sign up') || txt.includes('đăng nhập') || txt.includes('đăng ký')) {
        e.remove();
        // Also re-enable scrolling on body
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        return;
      }
    }
    e.remove();
  });
  // Remove app-open overlays
  document.querySelectorAll("div").forEach(el=>{
    const t=(el.textContent||"").trim();
    if((t.includes("Xem thước phim")||t.includes("trong ứng dụng")||t.includes("Open in app")||t.includes("in the app"))&&el.offsetHeight>200&&el.offsetWidth>200){
      const r=el.getBoundingClientRect();
      if(r.top<window.innerHeight*0.5&&r.height>window.innerHeight*0.3)el.remove();
    }
  });
  // Hide app-open buttons (but not on login pages)
  if (!isLoginPage) {
    document.querySelectorAll("a,button,div,[role='button'],span").forEach(b=>{
      const t=(b.textContent||"").trim();
      if(["Open app","Mở ứng dụng","Get the app","Tải ứng dụng","Dùng ứng dụng","Use app","Mở Instagram","Open Instagram","Mở TikTok","Open TikTok","Đăng ký","Log in","Sign up","Log in to continue","Đăng nhập để tiếp tục"].includes(t)||t.startsWith("Mở ứng")){
        b.style.display="none";if(b.parentElement)b.parentElement.style.display="none";
      }
    });
  }
  // Inject hide style
  if(!document.getElementById("__rvStyle")){
    const s=document.createElement("style");s.id="__rvStyle";
    const isLogin = location.pathname.includes('/login') || location.href.includes('login.php') || location.href.includes('/checkpoint');
    const hideNavRule = isLogin ? '' : 'header,nav,[role="banner"],[role="navigation"],[data-pagelet="header"],[data-pagelet="nav_bar"]{display:none!important}';
    const hideFormRule = isLogin ? '' : 'form:not([action*="accounts"]):not([action*="login"]),input[type="text"]:not([name="username"]):not([name="password"]):not([name="email"]):not([id="email"]):not([id="pass"]),input[placeholder]:not([name="username"]):not([name="password"]):not([name="email"]):not([id="email"]):not([id="pass"]){display:none!important}';
    // Hide FB reels header bar, top navigation, open-app button, and bottom caption overlay
    const fbReelsHeader = host.includes('facebook.com') && !isLogin ? [
      // Top header bar
      'div[data-pagelet="ReelsHeaderUnit"]{display:none!important}',
      'div[data-type="vscroller"]{padding-top:0!important}',
      // Open app buttons
      'a[href*="//itunes.apple.com"],a[href*="//play.google.com"],a[href*="market://"],a[href*="intent://"],div[class*="native-app"],a[data-sigil*="MTopBlueBarOpenInApp"]{display:none!important}',
      // Top header
      '#header,#MTopBlueBar,.mTopBlueBar,div[id="header"],div[data-sigil="MTopBlueBar"],div[id="MTopBlueBar"]{display:none!important}',
      'div[data-sigil="top-blue-bar"],div[data-gt*="top_blue_bar"]{display:none!important}',
      'body>div:first-child>div:first-child[style*="position: fixed"],body>div:first-child>div:first-child[style*="position:fixed"]{display:none!important}',
      'a[href="/"],a[href="/home.php"]{pointer-events:none!important}',
      // Hide FB native reel controls: like, comment, share, follow button, caption, username overlay
      '[data-sigil*="like"]:not(video):not(#__rv_controls):not(#__rv_controls *){display:none!important}',
      '[data-sigil*="share"]:not(#__rv_controls):not(#__rv_controls *){display:none!important}',
      '[data-sigil*="comment"]:not(#__rv_controls):not(#__rv_controls *){display:none!important}',
      // Hide bottom overlay (username, caption, follow, music)
      '.vscroller .story-overlay-bottom,.vscroller .overlay-bottom{display:none!important}',
      // Hide right-side action buttons (like/comment/share column)
      '.vscroller [class*="action"],.vscroller [class*="Action"]{display:none!important}',
      // Generic: hide fixed positioned elements on right side that are FB controls
      '.vscroller>div>div:last-child{pointer-events:none!important;opacity:0!important}',
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
  // Instagram-specific: remove login overlay that blocks scrolling
  if (host.includes('instagram.com')) {
    // Remove the overlay that blocks interaction
    document.querySelectorAll('div[role="presentation"]').forEach(el => {
      const txt = (el.textContent || '').toLowerCase();
      if (txt.includes('log in') || txt.includes('sign up') || txt.includes('đăng nhập')) {
        el.remove();
      }
    });
    // Ensure body is scrollable
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.documentElement.style.overflow = '';
  }
  // Hide fixed bottom bars (but not our own controls)
  document.querySelectorAll("div").forEach(el=>{
    if(el.id&&el.id.startsWith('rv-'))return;
    if(el.closest&&el.closest('#__rv_controls'))return;
    const s=getComputedStyle(el);
    if((s.position==="fixed"||s.position==="sticky")&&el.offsetHeight<100){
      const r=el.getBoundingClientRect();
      if(r.bottom>=window.innerHeight-10)el.style.display="none";
    }
  });
}

function handleGrid(){
  if(!window.__autoScroll)return;
  let playing=false;
  document.querySelectorAll("video").forEach(v=>{if(!v.paused&&vis(v))playing=true;});
  if(playing)return;
  // Try clicking first reel link (FB or IG)
  const links=document.querySelectorAll("a[href*='/reel/'],a[href*='/reels/']");
  if(links.length>0){links[0].click();return;}
  // Instagram: try clicking a video thumbnail to enter reels view
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

// Setup observers
if(document.body){
  new MutationObserver(()=>{bind();dismissAll();}).observe(document.body,{childList:true,subtree:true});
}else{
  document.addEventListener('DOMContentLoaded',()=>{
    new MutationObserver(()=>{bind();dismissAll();}).observe(document.body,{childList:true,subtree:true});
  });
}
setInterval(dismissAll,2000);
setInterval(handleGrid,2500);
setInterval(skipAds,2500);
setInterval(manageAudio,300);
setInterval(applyPlaybackRate,500);
setInterval(()=>document.querySelectorAll("video").forEach(v=>{if(v.paused&&vis(v))v.play();}),1000);
// Safety: reset scrolling lock if stuck
setInterval(()=>{if(window.__scrolling&&Date.now()-window.__lastScrollTime>5000)window.__scrolling=false;},2000);
bind();
})();
