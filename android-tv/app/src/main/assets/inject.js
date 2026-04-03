// RiuViewer inject script for Android TV WebView
(function(){
if(window.__rvInit) return;
window.__rvInit=true;
window.__autoScroll=true;
window.__scrolling=false;
window.__vol=1;
window.__lastScrollTime=0;
window.__playbackRate=1.0;
window.__videosWatched=0;
window.__watchStartTime=Date.now();
window.__longPressSpeed=null;

// === TIKTOK DESKTOP: hide chrome only, let native layout handle video ===
if(location.hostname.includes('tiktok.com') && !document.getElementById('__rvTTStyle')){
  var tts=document.createElement('style');tts.id='__rvTTStyle';
  tts.textContent=[
    '[class*="DivSideNavContainer"]{display:none!important}',
    '[class*="DivHeaderContainer"]{display:none!important}',
    '[class*="StyledHeaderWrapper"]{display:none!important}',
    'header{display:none!important}',
    '[class*="DivActionItemContainer"]{display:none!important}',
    '[class*="DivBottomInfoContainer"]{display:none!important}',
    '[class*="DivTextInfoContainer"]{display:none!important}',
    '[class*="DivCommentContainer"]{display:none!important}',
    '[class*="DivLoginContainer"]{display:none!important}',
    '[class*="DivOpenInApp"]{display:none!important}',
    'div[role="dialog"]{display:none!important}',
    '[data-e2e="top-login-button"]{display:none!important}',
    'button[class*="Login"]{display:none!important}',
    'a[href*="/login"]{display:none!important}',
    '[class*="DivProfileContainer"] [class*="login"]{display:none!important}',
    '[class*="DivProfileContainer"] [class*="Login"]{display:none!important}',
    'body,html{background:#000!important}',
  ].join('');
  (document.head||document.documentElement).appendChild(tts);
}

// === YOUTUBE SHORTS: hide all except video + like/share bar ===
if(location.hostname.includes('youtube.com') && !document.getElementById('__rvYTStyle')){
  var yts=document.createElement('style');yts.id='__rvYTStyle';
  yts.textContent=[
    // Hide header & navigation
    'ytd-masthead,#masthead,#guide-button,tp-yt-app-drawer{display:none!important}',
    'ytd-mini-guide-renderer{display:none!important}',
    // Hide channel info, subscribe, title, description
    '#channel-info{display:none!important}',
    '#subscribe-button{display:none!important}',
    'ytd-reel-player-header-renderer{display:none!important}',
    '#shorts-title{display:none!important}',
    '#description{display:none!important}',
    // Hide comments section
    '#comments-button{display:none!important}',
    'ytd-comments-entry-point-header-renderer{display:none!important}',
    '#shorts-inner-container ytd-engagement-panel-section-list-renderer{display:none!important}',
    // Hide music/sound info
    '.ytReelPlayerBottomSheetHeaderRenderer{display:none!important}',
    '[class*="reel-sound"]{display:none!important}',
    // Keep action bar (like, share) visible — do not hide
    'body,html{background:#000!important}',
  ].join('');
  (document.head||document.documentElement).appendChild(yts);
}

// Visibility & pause overrides: ONLY for mobile platforms (FB Reels)
// Desktop TikTok/YT manage their own playback — overriding causes audio desync
if(navigator.userAgent.includes('Mobile')){
  Object.defineProperty(document,"hidden",{get:function(){return false},configurable:true});
  Object.defineProperty(document,"visibilityState",{get:function(){return"visible"},configurable:true});
  document.addEventListener("visibilitychange",function(e){e.stopImmediatePropagation()},true);
  window.addEventListener("blur",function(e){
    e.stopImmediatePropagation();
    setTimeout(function(){document.querySelectorAll("video").forEach(function(v){if(v.paused)v.play()})},200);
  },true);

  var _origPause=HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause=function(){
    try{
      if(this.tagName==="VIDEO"&&!window.__userPause){
        var r=this.getBoundingClientRect();
        var visH=Math.min(window.innerHeight,r.bottom)-Math.max(0,r.top);
        if(visH>r.height*0.5)return;
      }
    }catch(e){}
    return _origPause.apply(this,arguments);
  };
}

// Scroll target cache
var _cachedTarget=null,_cacheTime=0;
function getScrollTarget(){
  var now=Date.now();
  if(_cachedTarget&&(now-_cacheTime)<15000&&document.contains(_cachedTarget)
     &&_cachedTarget.scrollHeight>_cachedTarget.clientHeight)return _cachedTarget;
  var best=null;
  var host=location.hostname;
  var selectors=host.includes('facebook.com')
    ?['[role="main"]','div[style*="overflow-y: scroll"]','div[style*="overflow-y:scroll"]',
      'div[style*="overflow-y: auto"]','div[style*="overflow-y:auto"]',
      'div[style*="overflow: auto"]','div[style*="overflow:auto"]']
    :['div[style*="overflow-y: auto"]','div[style*="overflow-y:auto"]'];
  for(var si=0;si<selectors.length;si++){
    var els=document.querySelectorAll(selectors[si]);
    for(var ei=0;ei<els.length;ei++){
      var el=els[ei];
      if(el.scrollHeight>el.clientHeight*1.2&&el.clientHeight>200){
        if(!best||el.scrollHeight>best.scrollHeight)best=el;
      }
    }
    if(best)break;
  }
  if(!best){
    var divs=document.querySelectorAll('div');
    for(var i=0;i<Math.min(divs.length,300);i++){
      try{var s=getComputedStyle(divs[i]);
      if((s.overflowY==='auto'||s.overflowY==='scroll')
         &&divs[i].scrollHeight>divs[i].clientHeight*1.3&&divs[i].clientHeight>300){
        if(!best||divs[i].clientHeight>best.clientHeight)best=divs[i];
      }}catch(e){}
    }
  }
  _cachedTarget=best||document.documentElement;_cacheTime=now;
  return _cachedTarget;
}

function doScrollNext(){
  // Primary: use native Android MotionEvent swipe (bypasses all TikTok/YT/FB JS blocking)
  if(window.NativeScroll) {
    window.NativeScroll.swipe(false);
    return;
  }
  // Fallback for non-bridge: FB vscroller
  var vscroller=document.querySelector('.vscroller')||document.querySelector('[class*="vscroller"]');
  if(vscroller){
    var snapH=vscroller.clientHeight;
    vscroller.scrollTop+=snapH;
    return;
  }
  window.scrollBy({top:window.innerHeight,behavior:'smooth'});
}

window.__doManualScroll=function(up){
  if(window.NativeScroll) {
    window.NativeScroll.swipe(up);
    return;
  }
  var vscroller=document.querySelector('.vscroller')||document.querySelector('[class*="vscroller"]');
  if(vscroller){
    var snapH=vscroller.clientHeight;
    vscroller.scrollTop+=(up?-snapH:snapH);
    return;
  }
  window.scrollBy({top:(up?-1:1)*window.innerHeight,behavior:'smooth'});
};

function getPrimaryVideo(){
  var primary=null;
  document.querySelectorAll("video").forEach(function(v){if(visPrimary(v)&&!v.paused)primary=v;});
  return primary||document.querySelector("video");
}
function visPrimary(v){var r=v.getBoundingClientRect();return(Math.min(window.innerHeight,r.bottom)-Math.max(0,r.top))>r.height*0.6;}
function vis(v){var r=v.getBoundingClientRect();return(Math.min(window.innerHeight,r.bottom)-Math.max(0,r.top))>r.height*0.4;}

function bind(){document.querySelectorAll("video").forEach(function(v){
  if(v.__rv){
    var curSrc=v.currentSrc||v.src||'';
    if(v.__rvSrc&&v.__rvSrc!==curSrc&&curSrc){
      v.__done=false;v.__totalPlayed=0;v.__lastCheckTime=-1;v.__loopCount=0;v.__bindTime=Date.now();v.__rvSrc=curSrc;
      v.removeAttribute("loop");v.loop=false;
    }
    return;
  }
  v.__rv=true;v.__done=false;v.__totalPlayed=0;v.__lastCheckTime=-1;v.__loopCount=0;v.__bindTime=Date.now();
  v.__rvSrc=v.currentSrc||v.src||'';
  v.volume=window.__vol;v.muted=(window.__vol===0);
  v.playbackRate=window.__playbackRate;
  v.removeAttribute("loop");v.loop=false;

  v.addEventListener("ended",function(){
    if(visPrimary(v)&&!v.__done){window.__videosWatched++;triggerScroll(v);}
  });
  v.addEventListener("timeupdate",function(){
    if(!window.__autoScroll||window.__scrolling||v.__done||!visPrimary(v))return;
    if(Date.now()-window.__lastScrollTime<6000||Date.now()-v.__bindTime<3000)return;
    var t=v.currentTime,d=v.duration;
    if(v.__lastCheckTime>=0&&t>v.__lastCheckTime&&t-v.__lastCheckTime<1)v.__totalPlayed+=t-v.__lastCheckTime;
    if(v.__lastCheckTime>2&&t<0.5){
      if(d&&d>0&&d!==Infinity){if(v.__totalPlayed>=d*0.9){v.__loopCount++;if(v.__loopCount>=1){window.__videosWatched++;triggerScroll(v);}}}
      else{if(v.__totalPlayed>=8){v.__loopCount++;if(v.__loopCount>=1){window.__videosWatched++;triggerScroll(v);}}}
    }
    if(d&&d>1&&d!==Infinity&&t>=d-0.3&&v.__totalPlayed>=d*0.85&&!v.__done){window.__videosWatched++;triggerScroll(v);}
    v.__lastCheckTime=t;
  });
  var lk=setInterval(function(){if(!document.contains(v)){clearInterval(lk);return;}if(v.loop){v.loop=false;v.removeAttribute("loop");}},2000);
});}

// Timer fallback
setInterval(function(){
  if(!window.__autoScroll||window.__scrolling)return;
  if(Date.now()-window.__lastScrollTime<6000)return;
  var v=getPrimaryVideo();
  if(!v||v.paused||v.__done)return;
  var d=v.duration;
  if(d&&d>0&&d!==Infinity){
    if(v.currentTime>=d*0.95&&!v.__done){window.__videosWatched++;triggerScroll(v);return;}
  }
  if(Date.now()-v.__bindTime>20000&&v.__totalPlayed>12&&!v.__done){window.__videosWatched++;triggerScroll(v);}
},2000);

function triggerScroll(v,isAdSkip){
  var cooldown=isAdSkip?2000:6000;
  if(window.__scrolling||v.__done||!window.__autoScroll||Date.now()-window.__lastScrollTime<cooldown)return;
  v.__done=true;window.__scrolling=true;window.__lastScrollTime=Date.now();
  v.volume=0;v.muted=true;
  setTimeout(function(){doScrollNext();},400);
  setTimeout(function(){window.__scrolling=false;window.__lastScrollTime=Date.now();},4000);
}

function manageAudio(){
  var primary=null;
  document.querySelectorAll("video").forEach(function(v){if(visPrimary(v)&&!v.paused)primary=v;});
  document.querySelectorAll("video").forEach(function(v){
    if(v===primary){v.volume=window.__vol;v.muted=(window.__vol===0);}
    else{v.volume=0;v.muted=true;}
  });
}

function applyPlaybackRate(){
  var rate=window.__longPressSpeed||window.__playbackRate;
  document.querySelectorAll("video").forEach(function(v){if(v.playbackRate!==rate)v.playbackRate=rate;});
}

// Ad detection
function isAd(){
  var adWords=["Được tài trợ","Sponsored","Publicidad","Gesponsert","Sponsorisé","Patrocinado","Quảng cáo","Ad"];
  var spans=document.querySelectorAll("span,a,div");
  for(var j=0;j<spans.length;j++){
    var t=(spans[j].textContent||"").trim();
    if(t.length>30||t.length<2)continue;
    if(adWords.indexOf(t)>=0){var r=spans[j].getBoundingClientRect();if(r.top>=-50&&r.bottom<=window.innerHeight+50&&r.width>0)return true;}
  }
  if(location.hostname.includes('facebook.com')){
    var adSels=['[data-sigil*="ad"]','[data-ad]','[data-ft*="ad"]','a[href*="/ads/"]'];
    for(var i=0;i<adSels.length;i++){
      var el=document.querySelector(adSels[i]);
      if(el){var r2=el.getBoundingClientRect();if(r2.top>=-50&&r2.bottom<=window.innerHeight+50&&r2.width>0)return true;}
    }
  }
  return false;
}
function skipAds(){
  if(!window.__autoScroll||window.__scrolling)return;
  if(Date.now()-window.__lastScrollTime<2000)return;
  if(isAd()){
    document.querySelectorAll("video").forEach(function(v){if(!v.paused&&visPrimary(v)&&!v.__done)triggerScroll(v,true);});
  }
}

// Debounced dismiss
var _dismissTimer=null,_lastHeavy=0;
function dismissDebounced(){
  if(_dismissTimer)return;
  _dismissTimer=setTimeout(function(){
    _dismissTimer=null;
    dismissLight();
    if(Date.now()-_lastHeavy>3000){_lastHeavy=Date.now();dismissHeavy();}
  },300);
}

function dismissLight(){
  var host=location.hostname;
  var isLogin=location.pathname.indexOf('/login')>=0||location.href.indexOf('login.php')>=0||location.href.indexOf('/checkpoint')>=0;
  if(isLogin)return;

  if(!document.getElementById("__rvStyle")){
    var s=document.createElement("style");s.id="__rvStyle";
    var hideNav=isLogin?'':'header,nav,[role="banner"],[role="navigation"],[data-pagelet="header"],[data-pagelet="nav_bar"]{display:none!important}';
    var fb=host.includes('facebook.com')&&!isLogin?[
      'div[data-pagelet="ReelsHeaderUnit"]{display:none!important}',
      '#header,#MTopBlueBar,.mTopBlueBar,div[data-sigil="MTopBlueBar"]{display:none!important}',
      'div[data-sigil="top-blue-bar"]{display:none!important}',
      'a[href*="//itunes.apple.com"],a[href*="//play.google.com"],a[href*="market://"],a[href*="intent://"]{display:none!important}',
      '[data-sigil*="like"]:not(video),[data-sigil*="share"],[data-sigil*="comment"]{display:none!important}',
      '.vscroller .story-overlay-bottom,.vscroller .overlay-bottom{display:none!important}',
      '.vscroller [class*="action"],.vscroller [class*="Action"]{display:none!important}',
      '.vscroller>div>div:last-child{pointer-events:none!important;opacity:0!important}',
      '.vscroller~div[style*="position"]{display:none!important}',
      'body>div:first-child>div:first-child:not(.vscroller){display:none!important}',
    ].join(''):'';
    // TikTok-specific: nuke all overlays, login walls, bottom bars, app gates
    var tt=host.includes('tiktok.com')?[
      '[class*="DivLoginContainer"]{display:none!important}',
      '[class*="LoginModal"]{display:none!important}',
      '[class*="login-modal"]{display:none!important}',
      '[class*="DivBottomContainer"]{display:none!important}',
      '[class*="bottom-bar"]{display:none!important}',
      '[class*="DivOpenInApp"]{display:none!important}',
      '[class*="open-in-app"]{display:none!important}',
      '[class*="DivGuideContainer"]{display:none!important}',
      '[class*="DivSignupContainer"]{display:none!important}',
      '[class*="SignupModal"]{display:none!important}',
      '[class*="DivVideoSideActionContainer"]{display:none!important}',
      '[id*="login-modal"]{display:none!important}',
      '[id*="loginModal"]{display:none!important}',
      '[data-e2e="channel-item"]{display:none!important}',
      'div[class*="DivMask"]{display:none!important}',
      'div[class*="Overlay"]{display:none!important}',
      'div[role="dialog"]{display:none!important}',
      'div[class*="modal"]{display:none!important}',
      'div[class*="Modal"]{display:none!important}',
    ].join(''):'';
    s.textContent=[
      '[data-testid="royal_login_bar"],[data-testid="mobile_login_bar"]{display:none!important}',
      'body,html{background:#000!important;overflow:auto!important}',
      hideNav,'video{object-fit:contain!important}',fb,tt,
    ].join('');
    document.head.appendChild(s);
  }

  document.querySelectorAll("[aria-label='Close'],[aria-label='Đóng'],[aria-label='Dismiss'],[aria-label='close']").forEach(function(b){b.click()});
  var words=["not now","không phải bây giờ","đóng","để sau","bỏ qua","skip","later","no thanks","continue as guest","watch more","xem thêm"];
  document.querySelectorAll("a,button,[role='button']").forEach(function(b){
    var t=(b.textContent||"").toLowerCase().trim();
    if(words.indexOf(t)>=0)b.click();
  });
  document.querySelectorAll("[role='dialog'],[data-testid='royal_login_bar']").forEach(function(e){e.remove()});

  // TikTok: aggressively remove any overlay/modal that blocks the feed
  if(host.includes('tiktok.com')){
    // Remove all fixed/absolute positioned overlays covering the screen
    document.querySelectorAll('div').forEach(function(el){
      try{
        var s=getComputedStyle(el);
        if((s.position==='fixed'||s.position==='absolute')&&s.zIndex&&parseInt(s.zIndex)>100){
          var r=el.getBoundingClientRect();
          if(r.width>window.innerWidth*0.5&&r.height>window.innerHeight*0.3){
            // Check if it contains a video - don't remove video containers
            if(!el.querySelector('video')) el.remove();
          }
        }
      }catch(e){}
    });
    // Click any close/dismiss buttons inside modals
    document.querySelectorAll('[class*="close"],[class*="Close"],[class*="dismiss"],[class*="Dismiss"]').forEach(function(b){
      try{b.click();}catch(e){}
    });
  }

  // FB: hide vscroller siblings (header bar)
  if(host.includes('facebook.com')){
    var vs=document.querySelector('.vscroller');
    if(vs&&vs.parentElement){
      Array.from(vs.parentElement.children).forEach(function(ch){
        if(ch===vs||ch.tagName==='STYLE'||ch.tagName==='SCRIPT')return;
        ch.style.cssText='display:none!important';
      });
    }
  }
}

function dismissHeavy(){
  var host=location.hostname;
  var isLogin=location.pathname.indexOf('/login')>=0||location.href.indexOf('login.php')>=0;
  if(isLogin)return;

  if(host.includes('facebook.com')){
    document.querySelectorAll('#header,#MTopBlueBar,.mTopBlueBar,[data-sigil="MTopBlueBar"]').forEach(function(e){e.remove()});
    document.querySelectorAll('div').forEach(function(el){
      try{
        var r=el.getBoundingClientRect();
        if(r.top>100||r.width<window.innerWidth*0.7)return;
        var s=getComputedStyle(el);
        if((s.position==='fixed'||s.position==='sticky')&&el.offsetHeight>=40&&el.offsetHeight<90&&r.top<10)
          el.style.display='none';
      }catch(e){}
    });
    var hideTexts=["Mở ứng dụng","Open app","Open in app","Nhấn để bật tiếng","Tap to unmute",
      "Theo dõi","Follow","Thích","Like","Bình luận","Comment","Chia sẻ","Share"];
    document.querySelectorAll('a,button,[role="button"]').forEach(function(b){
      var t=(b.textContent||'').trim();
      for(var i=0;i<hideTexts.length;i++){if(t===hideTexts[i]||t.indexOf("Mở ứng")===0){b.style.cssText='display:none!important';break;}}
    });
  }

  // Hide app-open buttons on all platforms
  var appTexts=["Open app","Mở ứng dụng","Get the app","Tải ứng dụng","Use app","Đăng ký","Log in","Sign up",
    "Get TikTok App","Tải TikTok","Download"];
  document.querySelectorAll("a,button,[role='button']").forEach(function(b){
    var t=(b.textContent||"").trim();
    if(appTexts.indexOf(t)>=0||t.indexOf("Mở ứng")===0||t.indexOf("Get TikTok")===0||t.indexOf("Tải TikTok")===0){
      b.style.display="none";if(b.parentElement)b.parentElement.style.display="none";
    }
  });

  // Hide fixed bottom bars
  document.querySelectorAll("div").forEach(function(el){
    try{
      var r=el.getBoundingClientRect();
      if(r.bottom<window.innerHeight-50||el.offsetHeight>=100)return;
      var s=getComputedStyle(el);
      if((s.position==="fixed"||s.position==="sticky")&&r.bottom>=window.innerHeight-10)
        el.style.display="none";
    }catch(e){}
  });
}

function handleGrid(){
  if(!window.__autoScroll)return;
  var playing=false;
  document.querySelectorAll("video").forEach(function(v){if(!v.paused&&vis(v))playing=true;});
  if(playing)return;
  var links=document.querySelectorAll("a[href*='/reel/'],a[href*='/reels/']");
  if(links.length>0)links[0].click();
}

// API for Kotlin
window.__seekTo=function(pct){var v=getPrimaryVideo();if(v&&v.duration&&v.duration!==Infinity)v.currentTime=v.duration*pct;};
window.__seekRelative=function(sec){var v=getPrimaryVideo();if(v&&v.duration&&v.duration!==Infinity)v.currentTime=Math.max(0,Math.min(v.duration,v.currentTime+sec));};

// Setup — lightweight for desktop (TT/YT), full for mobile (FB)
var _isDesktop=!navigator.userAgent.includes('Mobile');

function setupObserver(){
  if(!document.body){document.addEventListener('DOMContentLoaded',setupObserver);return;}
  // Debounced MutationObserver — only dismiss UI, no heavy bind on desktop
  var _mutTimer=null;
  new MutationObserver(function(){
    if(_mutTimer)return;
    _mutTimer=setTimeout(function(){
      _mutTimer=null;
      dismissDebounced();
      if(!_isDesktop) bind();
    },500);
  }).observe(document.body,{childList:true,subtree:true});
}
setupObserver();

// Desktop (TikTok/YT): IntersectionObserver for audio (zero-poll)
if(_isDesktop){
  setInterval(dismissDebounced,8000);

  var _currentVideo=null;
  var _vidObserver=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting && e.intersectionRatio>0.5){
        _currentVideo=e.target;
      }
    });
    // Mute all except current
    document.querySelectorAll('video').forEach(function(v){
      if(v===_currentVideo){
        v.volume=window.__vol;v.muted=(window.__vol===0);
      } else {
        v.volume=0;v.muted=true;
      }
    });
  },{threshold:[0.5]});

  // Observe existing + future videos
  function observeVideos(){
    document.querySelectorAll('video').forEach(function(v){
      if(!v.__observed){v.__observed=true;_vidObserver.observe(v);}
    });
  }
  observeVideos();
  new MutationObserver(observeVideos).observe(document.documentElement,{childList:true,subtree:true});

} else {
  // Mobile (FB Reels): full timer suite
  bind();
  setInterval(dismissDebounced,3000);
  setInterval(handleGrid,2500);
  setInterval(skipAds,2500);
  setInterval(manageAudio,500);
  setInterval(applyPlaybackRate,1000);
  setInterval(function(){document.querySelectorAll("video").forEach(function(v){if(v.paused&&vis(v))v.play();});},1000);
  setInterval(function(){if(window.__scrolling&&Date.now()-window.__lastScrollTime>5000)window.__scrolling=false;},2000);
}
})();
