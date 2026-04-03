(function(){
if(!window.__rvInit){
window.__rvInit=true;
window.__autoScroll=true;
window.__scrolling=false;
window.__vol=0;
window.__lastScrollTime=0;
window.__playbackRate=1.0;
window.__videosWatched=0;
window.__watchStartTime=Date.now();
window.__volumeBoost=1.0;
window.__abLoop=null;
window.__skipIntro=0;
window.__longPressSpeed=null;
window.__filterBrightness=100;
window.__filterContrast=100;
window.__filterSaturate=100;
window.__doubleTapSeek=5;
window.__userPause=false;

// === SCROLL TARGET CACHE (from "This is Fine" bookmarklet) ===
// Instead of scanning all divs every scroll, cache the scroll container
var _cachedScrollTarget=null;
var _cacheTimestamp=0;
var CACHE_TTL=15000; // 15s cache

// Fake visibility to prevent pause
Object.defineProperty(document,"hidden",{get:function(){return false},configurable:true});
Object.defineProperty(document,"visibilityState",{get:function(){return"visible"},configurable:true});
document.addEventListener("visibilitychange",function(e){e.stopImmediatePropagation()},true);
window.addEventListener("blur",function(e){
    e.stopImmediatePropagation();
    setTimeout(function(){document.querySelectorAll("video").forEach(function(v){if(v.paused)v.play()})},200);
},true);

// Override pause to prevent FB from pausing reels (from Facebook Reels Enhancer)
var _origPause=HTMLMediaElement.prototype.pause;
HTMLMediaElement.prototype.pause=function(){
    try{
        if(this.tagName==="VIDEO"&&this.getBoundingClientRect&&!window.__userPause){
            var r=this.getBoundingClientRect();
            var visH=Math.min(window.innerHeight,r.bottom)-Math.max(0,r.top);
            if(visH>r.height*0.5)return; // block pause on visible video
        }
    }catch(e){}
    return _origPause.apply(this,arguments);
};

// Wait for document.body before setting up observers
function setupObservers(){
    if(!document.body){setTimeout(setupObservers,100);return;}
    new MutationObserver(function(){bind();dismissAll()}).observe(document.body,{childList:true,subtree:true});
}
setupObservers();
setInterval(dismissAll,2000);
setInterval(handleGrid,2500);
setInterval(skipAds,2500);
setInterval(manageAudio,300);
setInterval(applyPlaybackRate,500);
setInterval(applyVideoFilters,1000);
setInterval(enforceABLoop,200);
setInterval(function(){
    document.querySelectorAll("video").forEach(function(v){
        if(v.paused&&vis(v))v.play();
    });
},1000);

// === INTERSECTION OBSERVER (from Instagram Auto-Scroller) ===
// Use IntersectionObserver to track which video is primary - much more
// efficient than polling getBoundingClientRect every timeupdate
window.__rvVisibleVideos=new Set();
try{
window.__rvObserver=new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
        if(entry.isIntersecting&&entry.intersectionRatio>0.5){
            window.__rvVisibleVideos.add(entry.target);
        }else{
            window.__rvVisibleVideos.delete(entry.target);
        }
    });
},{threshold:[0,0.5,0.8]});
}catch(e){window.__rvObserver=null;}
}
try{bind();}catch(e){}

function applyVideoFilters(){
    var f="brightness("+window.__filterBrightness+"%) contrast("+window.__filterContrast+"%) saturate("+window.__filterSaturate+"%)";
    document.querySelectorAll("video").forEach(function(v){
        if(v.style.filter!==f) v.style.filter=f;
    });
}

function enforceABLoop(){
    if(!window.__abLoop)return;
    var v=getPrimaryVideo();
    if(!v||!v.duration)return;
    if(v.currentTime>=window.__abLoop.end) v.currentTime=window.__abLoop.start;
}

function boostVolume(v){
    if(v.__rvGain||!window.AudioContext)return;
    try{
        var ctx=new AudioContext();
        var src=ctx.createMediaElementSource(v);
        var gain=ctx.createGain();
        src.connect(gain);gain.connect(ctx.destination);
        v.__rvGain=gain;v.__rvCtx=ctx;
        gain.gain.value=window.__volumeBoost;
    }catch(e){}
}
window.__setVolumeBoost=function(val){
    window.__volumeBoost=val;
    document.querySelectorAll("video").forEach(function(v){
        if(v.__rvGain)v.__rvGain.gain.value=val;
    });
};

function applyPlaybackRate(){
    var rate=window.__longPressSpeed||window.__playbackRate;
    document.querySelectorAll("video").forEach(function(v){
        if(v.playbackRate!==rate) v.playbackRate=rate;
    });
}

// === OPTIMIZED SCROLL TARGET FINDER (from "This is Fine" bookmarklet) ===
// Prioritized selectors for FB Reels, then generic fallback, with caching
function getScrollTarget(){
    var now=Date.now();
    if(_cachedScrollTarget&&(now-_cacheTimestamp)<CACHE_TTL
       &&document.contains(_cachedScrollTarget)
       &&_cachedScrollTarget.scrollHeight>_cachedScrollTarget.clientHeight){
        return _cachedScrollTarget;
    }
    var best=null;
    // Priority 1: FB-specific selectors (fast, targeted)
    var fbSels=[
        '[data-pagelet="Reels"] [style*="overflow"]',
        '[data-pagelet] [style*="overflow"]',
        '[role="main"] [style*="overflow"]',
        'div[style*="overflow-y: auto"]',
        'div[style*="overflow-y:auto"]',
        'div[style*="overflow: auto"]'
    ];
    for(var si=0;si<fbSels.length;si++){
        var els=document.querySelectorAll(fbSels[si]);
        for(var ei=0;ei<els.length;ei++){
            var el=els[ei];
            if(el.scrollHeight>el.clientHeight*1.2&&el.clientHeight>200){
                if(!best||el.scrollHeight>best.scrollHeight) best=el;
            }
        }
        if(best)break;
    }
    // Priority 2: Generic scan (limited to 300 elements for performance)
    if(!best){
        var allDivs=document.querySelectorAll('div');
        var lim=Math.min(allDivs.length,300);
        for(var i=0;i<lim;i++){
            try{
                var st=getComputedStyle(allDivs[i]);
                if((st.overflowY==='auto'||st.overflowY==='scroll')
                   &&allDivs[i].scrollHeight>allDivs[i].clientHeight*1.3
                   &&allDivs[i].clientHeight>300){
                    if(!best||allDivs[i].clientHeight>best.clientHeight) best=allDivs[i];
                }
            }catch(e){}
        }
    }
    _cachedScrollTarget=best||document.documentElement;
    _cacheTimestamp=now;
    return _cachedScrollTarget;
}

// === OPTIMIZED SCROLL EXECUTION ===
// Combines best ideas: cached target + random offset for natural feel + scrollIntoView fallback
function doScrollNext(){
    // Method 1: Try native "Next Card" button (most reliable on desktop FB)
    var nextBtn=document.querySelector('[aria-label="Next Card"][role="button"]')
              ||document.querySelector('[aria-label="Next card"][role="button"]');
    if(nextBtn){
        nextBtn.click();
        return;
    }
    // Method 2: Find next video and scrollIntoView (from Instagram Auto-Scroller)
    var current=getPrimaryVideo();
    if(current){
        var allVids=Array.from(document.querySelectorAll('video'));
        var idx=allVids.indexOf(current);
        if(idx>=0&&idx<allVids.length-1){
            var nextVid=allVids[idx+1];
            if(nextVid){
                nextVid.scrollIntoView({behavior:'smooth',block:'center'});
                return;
            }
        }
    }
    // Method 3: Scroll the cached container by viewport height (fallback)
    var target=getScrollTarget();
    var offset=Math.floor(Math.random()*21)-10; // -10 to +10 random for natural feel
    target.scrollBy({top:window.innerHeight+offset,behavior:'smooth'});
}

// === OPTIMIZED VIDEO BINDING ===
function bind(){document.querySelectorAll("video").forEach(function(v){
if(v.__rv)return;v.__rv=true;v.__done=false;v.__totalPlayed=0;v.__lastCheckTime=-1;v.__loopCount=0;v.__bindTime=Date.now();
v.volume=window.__vol;v.muted=(window.__vol===0);
v.playbackRate=window.__playbackRate;

// KEY OPTIMIZATION: Remove loop attribute so "ended" event fires reliably
// (from Instagram Auto-Scroller - FB sets loop on videos, preventing ended event)
v.removeAttribute("loop");
v.loop=false;

// Register with IntersectionObserver for efficient visibility tracking
if(window.__rvObserver) window.__rvObserver.observe(v);

if(window.__skipIntro>0&&v.currentTime<1) v.currentTime=window.__skipIntro;
if(window.__volumeBoost>1) boostVolume(v);

// "ended" event now fires reliably since we removed loop attribute
v.addEventListener("ended",function(){
    if(visPrimary(v)){window.__videosWatched++;triggerScroll(v,"ended");}
});

v.addEventListener("timeupdate",function(){
    if(!window.__autoScroll||window.__scrolling||v.__done)return;
    if(!visPrimary(v))return;
    if(Date.now()-window.__lastScrollTime<4000)return;
    if(Date.now()-v.__bindTime<3000)return;
    var t=v.currentTime;var d=v.duration;
    // Track total played time
    if(v.__lastCheckTime>=0&&t>v.__lastCheckTime&&t-v.__lastCheckTime<1){
        v.__totalPlayed+=t-v.__lastCheckTime;
    }
    // Loop detection: time jumped back (for videos that loop despite our removal)
    if(v.__lastCheckTime>2&&t<0.5){
        if(d&&d>0&&d!==Infinity){
            if(v.__totalPlayed>=d*0.9){v.__loopCount++;if(v.__loopCount>=1){window.__videosWatched++;triggerScroll(v,"loop")}}
        }else{
            if(v.__totalPlayed>=8){v.__loopCount++;if(v.__loopCount>=1){window.__videosWatched++;triggerScroll(v,"loop-noD")}}
        }
    }
    // Near-end detection (backup for ended event)
    if(d&&d>1&&d!==Infinity&&t>=d-0.3&&v.__totalPlayed>=d*0.85&&!v.__done){
        window.__videosWatched++;triggerScroll(v,"near-end");
    }
    v.__lastCheckTime=t;
});

// Also re-remove loop periodically (FB may re-add it via React)
var loopKiller=setInterval(function(){
    if(!document.contains(v)){clearInterval(loopKiller);return;}
    if(v.loop){v.loop=false;v.removeAttribute("loop");}
},2000);
})}

function manageAudio(){
    var primary=null;
    document.querySelectorAll("video").forEach(function(v){
        if(visPrimary(v)&&!v.paused)primary=v;
    });
    document.querySelectorAll("video").forEach(function(v){
        if(v===primary){v.volume=window.__vol;v.muted=(window.__vol===0)}
        else{v.volume=0;v.muted=true}
    });
}

// Locale-aware ad detection (from Facebook Enhancer v3.32)
function isAd(){
    var adWords=["Được tài trợ","Sponsored","Publicidad","Gesponsert","Sponsorisé","Patrocinado","Sponsorizzato","Gesponsord"];
    var allSpans=document.querySelectorAll("span");
    for(var j=0;j<allSpans.length;j++){
        var sp=allSpans[j];
        var t=(sp.textContent||"").trim();
        if(t.length>20)continue;
        for(var i=0;i<adWords.length;i++){
            if(t===adWords[i]){
                var rect=sp.getBoundingClientRect();
                if(rect.top>=-50&&rect.bottom<=window.innerHeight+50&&rect.width>0&&rect.height>0){return true}
            }
        }
    }
    return false;
}

// === OPTIMIZED TRIGGER SCROLL ===
// Now uses doScrollNext() which tries native button → scrollIntoView → cached container
function triggerScroll(v,reason){
    if(window.__scrolling||v.__done||!window.__autoScroll)return;
    if(Date.now()-window.__lastScrollTime<4000)return;
    v.__done=true;window.__scrolling=true;window.__lastScrollTime=Date.now();
    v.volume=0;v.muted=true;
    // Use optimized scroll with slight delay for smooth transition
    setTimeout(function(){
        doScrollNext();
        // Also notify Swift side for any additional handling
        try{webkit.messageHandlers.scrollNext.postMessage("next")}catch(e){}
    },600);
    setTimeout(function(){window.__scrolling=false},3500);
}

function getPrimaryVideo(){
    // Fast path: use IntersectionObserver tracked set
    if(window.__rvVisibleVideos&&window.__rvVisibleVideos.size>0){
        var vids=window.__rvVisibleVideos;
        for(var v of vids){
            if(!v.paused&&document.contains(v))return v;
        }
        // If all paused, return first visible
        for(var v2 of vids){
            if(document.contains(v2))return v2;
        }
    }
    // Fallback: manual check
    var primary=null;
    document.querySelectorAll("video").forEach(function(v){
        if(visPrimary(v)&&!v.paused)primary=v;
    });
    return primary||document.querySelector("video");
}

function visPrimary(v){
    // Fast path: check IntersectionObserver set
    if(window.__rvVisibleVideos&&window.__rvVisibleVideos.has(v))return true;
    var r=v.getBoundingClientRect();
    var visH=Math.min(window.innerHeight,r.bottom)-Math.max(0,r.top);
    return visH>r.height*0.6;
}

function vis(v){
    if(window.__rvVisibleVideos&&window.__rvVisibleVideos.has(v))return true;
    var r=v.getBoundingClientRect();
    return(Math.min(window.innerHeight,r.bottom)-Math.max(0,r.top))>r.height*0.4;
}

function skipAds(){
    if(!window.__autoScroll||window.__scrolling)return;
    if(Date.now()-window.__lastScrollTime<4000)return;
    if(isAd()){
        document.querySelectorAll("video").forEach(function(v){
            if(!v.paused&&visPrimary(v)&&!v.__done){
                triggerScroll(v,"ad-skip");
            }
        });
    }
}

function dismissAll(){
document.querySelectorAll("[aria-label='Close'],[aria-label='Đóng'],[aria-label='Dismiss']").forEach(function(b){b.click()});
var w=["not now","không phải bây giờ","đóng","để sau","bỏ qua","skip","later","no thanks","not now","đăng ký","log in","sign up"];
document.querySelectorAll("a,button,[role='button']").forEach(function(b){var t=(b.textContent||"").toLowerCase().trim();for(var i=0;i<w.length;i++){if(t===w[i]){b.click();return}}});
document.querySelectorAll("[role='dialog'],[data-testid='royal_login_bar']").forEach(function(e){e.remove()});
// Remove Instagram/TikTok app-open overlays
document.querySelectorAll("div").forEach(function(el){
var t=(el.textContent||"").trim();
if((t.indexOf("Xem thước phim")>=0||t.indexOf("trong ứng dụng")>=0||t.indexOf("Open in app")>=0||t.indexOf("in the app")>=0)&&el.offsetHeight>200&&el.offsetWidth>200){
var r=el.getBoundingClientRect();
if(r.top<window.innerHeight*0.5&&r.height>window.innerHeight*0.3){el.remove();}
}
});
if(!document.getElementById("__rvStyle")){var s=document.createElement("style");s.id="__rvStyle";s.textContent='[data-testid="royal_login_bar"],[data-testid="mobile_login_bar"]{display:none!important}a[href*="//itunes.apple.com"],a[href*="//play.google.com"],a[href*="market://"],a[href*="intent://"]{display:none!important}body,html{background:#000!important;margin:0!important;padding:0!important;overflow:hidden!important}header,nav,[role="banner"],[role="navigation"],[data-pagelet="header"],[data-pagelet="nav_bar"]{display:none!important}video{object-fit:cover!important;width:100vw!important;height:100vh!important}form,input[type="text"],input[placeholder]{display:none!important}';document.head.appendChild(s)}
document.querySelectorAll("a,button,div,[role='button'],span").forEach(function(b){var t=(b.textContent||"").trim();if(t==="Open app"||t==="Mở ứng dụng"||t.indexOf("Mở ứng")===0||t==="Get the app"||t==="Tải ứng dụng"||t==="Dùng ứng dụng"||t==="Use app"||t==="Use the app"||t==="Mở Instagram"||t==="Open Instagram"||t==="Mở TikTok"||t==="Open TikTok"||t==="Get app"||t==="Tải app"||t==="Đăng ký"||t==="Log in"||t==="Sign up"){b.style.display="none";if(b.parentElement)b.parentElement.style.display="none"}});
document.querySelectorAll("div,span,a,header").forEach(function(el){
var t=(el.textContent||"").trim();
if(t==="Gửi tin nhắn"||t==="Send message"){
var p=el;for(var i=0;i<5;i++){if(p.parentElement){p=p.parentElement;if(p.offsetHeight>20&&p.offsetHeight<100&&p.offsetWidth>200){p.style.display="none";break}}}
}
});
document.querySelectorAll("div").forEach(function(el){
if(el.offsetHeight>30&&el.offsetHeight<60&&el.offsetWidth>300){
var r=el.getBoundingClientRect();
if(r.top>=0&&r.top<80){
var txt=(el.textContent||"").trim();
if(txt.indexOf("Reels")===0&&txt.length<30){el.style.display="none"}
}
}
});
document.querySelectorAll("div").forEach(function(el){
var s=getComputedStyle(el);
if((s.position==="fixed"||s.position==="sticky")&&el.offsetHeight<100){
var r=el.getBoundingClientRect();
if(r.bottom>=window.innerHeight-10){el.style.display="none"}
}
});
document.querySelectorAll("div").forEach(function(el){
var s=getComputedStyle(el);
if(s.pointerEvents!=="none"&&s.position==="absolute"&&el.childElementCount===0){
var r=el.getBoundingClientRect();
var v=getPrimaryVideo();
if(v){
var vr=v.getBoundingClientRect();
if(Math.abs(r.width-vr.width)<10&&Math.abs(r.height-vr.height)<10){
el.style.pointerEvents="none";
}
}
}
});
}

function handleGrid(){if(!window.__autoScroll)return;var p=false;document.querySelectorAll("video").forEach(function(v){if(!v.paused&&vis(v))p=true});if(p)return;var l=document.querySelectorAll("a[href*='/reel/']");if(l.length>0){l[0].click()}}

// === MANUAL SCROLL (called from Swift for up/down buttons) ===
window.__doManualScroll=function(up){
    var target=getScrollTarget();
    var dir=up?-1:1;
    target.scrollBy({top:dir*window.innerHeight,behavior:'smooth'});
};

window.__seekTo=function(pct){
var v=getPrimaryVideo();
if(v&&v.duration&&v.duration!==Infinity){v.currentTime=v.duration*pct;}
};
window.__seekRelative=function(sec){
var v=getPrimaryVideo();
if(v&&v.duration&&v.duration!==Infinity){v.currentTime=Math.max(0,Math.min(v.duration,v.currentTime+sec));}
};
window.__getProgress=function(){
var v=getPrimaryVideo();
if(v&&v.duration&&v.duration!==Infinity)return{current:v.currentTime,duration:v.duration,progress:v.currentTime/v.duration};
return{current:0,duration:0,progress:0};
};
window.__getStats=function(){
return{watched:window.__videosWatched,minutes:Math.floor((Date.now()-window.__watchStartTime)/60000)};
};
window.__setABLoop=function(startPct,endPct){
var v=getPrimaryVideo();if(!v||!v.duration)return;
window.__abLoop={start:v.duration*startPct,end:v.duration*endPct};
};
window.__clearABLoop=function(){window.__abLoop=null;};
window.__screenshot=function(){
var v=getPrimaryVideo();if(!v)return null;
var c=document.createElement("canvas");c.width=v.videoWidth;c.height=v.videoHeight;
c.getContext("2d").drawImage(v,0,0);return c.toDataURL("image/png");
};
window.__getVideoSrc=function(){
var v=getPrimaryVideo();if(!v)return null;return v.src||v.currentSrc||null;
};
window.__flipVideo=function(h,vert){
var v=getPrimaryVideo();if(!v)return;
v.style.transform="scale("+(h?-1:1)+","+(vert?-1:1)+")";
};
window.__resetFlip=function(){var v=getPrimaryVideo();if(v)v.style.transform="";};
window.__getTimeDisplay=function(){
var v=getPrimaryVideo();
if(!v||!v.duration||v.duration===Infinity)return"0:00 / 0:00";
function fmt(s){var m=Math.floor(s/60);s=Math.floor(s%60);return m+":"+(s<10?"0":"")+s;}
return fmt(v.currentTime)+" / "+fmt(v.duration);
};

})();
