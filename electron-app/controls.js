// Controls logic - injected into the page
(function(){
if(window.__rvControls) return;
window.__rvControls=true;

var svgPlay='<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
var svgPause='<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
var svgVolOff='<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
var svgVolOn='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
var svgPin='<svg viewBox="0 0 24 24"><path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>';
var svgPinOn='<svg viewBox="0 0 24 24"><path d="M17 2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>';

var speeds=[0.25,0.5,0.75,1.0,1.25,1.5,2.0,3.0,4.0];
var platKeys=['fb','tt','yt'];
var platNames={fb:'FB',tt:'TT',yt:'YT'};
var st={plat:'fb',auto:true,vol:0,spd:1.0,pin:false,clean:false,opa:1.0};
var longPress=false,lastL=0,lastR=0;

function $(id){return document.getElementById(id);}

setInterval(function(){
  try{
    var p=window.__getProgress&&window.__getProgress();
    if(p&&p.progress!==undefined) $('rv-prog-fill').style.width=(p.progress*100)+'%';
  }catch(e){}
},300);
setInterval(function(){
  try{
    var t=window.__getTimeDisplay&&window.__getTimeDisplay();
    if(t) $('rv-time').textContent=t;
  }catch(e){}
},500);

function nav(k){st.plat=k;$('rv-plat-l').textContent=platNames[k];window.rvAPI.navigate(k);}
function scroll(up){if(typeof window.__doManualScroll==='function')window.__doManualScroll(up);}
function togAuto(){
  st.auto=!st.auto;
  $('rv-auto').innerHTML=(st.auto?svgPlay:svgPause)+'<span class="rv-l" id="rv-auto-l">'+(st.auto?'Auto':'Off')+'</span>';
  window.__autoScroll=st.auto;
}
// #22: toggle mute or show volume slider on click, right-click for slider
function togMute(){st.vol=st.vol>0?0:1;applyVol();}
function applyVol(){
  var m=st.vol===0;
  var ico=m?svgVolOff:svgVolOn;
  var volBtn=$('rv-vol');
  if(volBtn){
    var icoSpan=volBtn.querySelector('.rv-ico');
    if(!icoSpan){
      icoSpan=document.createElement('span');
      icoSpan.className='rv-ico';
      volBtn.insertBefore(icoSpan,volBtn.firstChild);
    }
    icoSpan.innerHTML=ico;
    var lbl=volBtn.querySelector('.rv-l');
    if(!lbl){
      lbl=document.createElement('span');
      lbl.className='rv-l';
      lbl.id='rv-vol-l';
      volBtn.appendChild(lbl);
    }
    lbl.textContent=m?'Off':'On';
  }
  window.__vol=st.vol;
  document.querySelectorAll('video').forEach(function(v){v.muted=m;v.volume=st.vol;});
}
function chgSpd(f){
  var i=speeds.indexOf(st.spd);
  if(i<0)st.spd=1;
  else st.spd=speeds[f?Math.min(i+1,speeds.length-1):Math.max(i-1,0)];
  applySpd();
}
function applySpd(){
  var el=$('rv-spd-l');
  if(el)el.textContent=st.spd+'x';
  window.__playbackRate=st.spd;
  document.querySelectorAll('video').forEach(function(v){v.playbackRate=st.spd;});
  // #24: Flash speed indicator for 1.5s instead of 800ms
  var ind=$('rv-spd-ind');
  if(ind){ind.textContent=st.spd+'x';ind.style.display='block';setTimeout(function(){ind.style.display='none';},1500);}
}
function togPin(){
  window.rvAPI.togglePin().then(function(v){
    st.pin=v;
    $('rv-pin').innerHTML=(st.pin?svgPinOn:svgPin)+'<span class="rv-l" id="rv-pin-l">'+(st.pin?'On':'Pin')+'</span>';
  });
}
function togClean(){
  st.clean=!st.clean;
  if(st.clean){
    $('rv-panel').style.setProperty('display','none','important');
    $('rv-prog').style.setProperty('display','none','important');
    $('rv-time').style.setProperty('display','none','important');
    $('rv-clean-toggle').style.setProperty('display','flex','important');
    // Hide ALL platform native UI (like, comment, share, caption, username, etc.)
    var cs=document.getElementById('__rvClean');
    if(!cs){cs=document.createElement('style');cs.id='__rvClean';document.head.appendChild(cs);}
    cs.textContent=[
      'header,nav,[role="banner"],[role="navigation"],[data-pagelet]{opacity:0!important}',
      'a,p,h1,h2,h3,h4,img:not([class*="video"]),svg,button,[role="button"],[aria-label]{opacity:0!important}',
      'span{opacity:0!important;pointer-events:none!important}',
      '*:not(video):not(#__rv_controls):not(#__rv_controls *):not(#rv-clean-toggle):not(#rv-clean-toggle *){background:transparent!important;background-color:transparent!important;background-image:none!important;border-color:transparent!important;box-shadow:none!important}',
      'video{opacity:1!important;object-fit:cover!important}',
      '#__rv_controls,#__rv_controls *,#rv-clean-toggle,#rv-clean-toggle *{opacity:1!important;background:initial!important}',
      '#rv-clean-toggle{background:rgba(0,0,0,0.4)!important}',
      '::-webkit-scrollbar{display:none!important}',
      '*{scrollbar-width:none!important}',
      '*::before,*::after{opacity:0!important}',
    ].join('');
  }else{
    $('rv-panel').style.setProperty('display','flex','important');
    $('rv-prog').style.setProperty('display','','important');
    $('rv-time').style.setProperty('display','','important');
    $('rv-clean-toggle').style.setProperty('display','none','important');
    // Restore platform native UI
    var cs=document.getElementById('__rvClean');
    if(cs)cs.remove();
  }
}
function snap(){try{var d=window.__screenshot&&window.__screenshot();if(d)window.rvAPI.screenshot(d);}catch(e){}}
function cycleOpa(){st.opa=st.opa<=0.3?1.0:+(st.opa-0.1).toFixed(1);window.rvAPI.setOpacity(st.opa);}
function togHelp(){$('rv-help-ov').classList.toggle('on');}

$('rv-plat').onclick=function(){var i=(platKeys.indexOf(st.plat)+1)%platKeys.length;nav(platKeys[i]);};
$('rv-up').onclick=function(){scroll(true);};
$('rv-dn').onclick=function(){scroll(false);};
$('rv-rel').onclick=function(){window.rvAPI.reload();};
$('rv-spd').onclick=function(){chgSpd(true);};
$('rv-spd').oncontextmenu=function(e){e.preventDefault();chgSpd(false);};
$('rv-spd').ondblclick=function(){st.spd=1;applySpd();};
$('rv-vol').onclick=togMute;
$('rv-auto').onclick=togAuto;
$('rv-pin').onclick=togPin;
$('rv-hide').onclick=togClean;
$('rv-snap').onclick=snap;
$('rv-help').onclick=togHelp;
$('rv-help-ov').onclick=function(){$('rv-help-ov').classList.remove('on');};
if($('rv-clean-toggle'))$('rv-clean-toggle').onclick=togClean;

// #23: Double-click to toggle clean mode — but NOT on video elements
document.addEventListener('dblclick',function(e){
  if(e.target.closest&&e.target.closest('#__rv_controls'))return;
  // Don't trigger on video elements (platforms use dblclick for like)
  if(e.target.tagName==='VIDEO')return;
  if(e.target.closest&&e.target.closest('video'))return;
  togClean();
});

$('rv-prog').addEventListener('click',function(e){
  var r=e.currentTarget.getBoundingClientRect();
  var pct=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
  window.__seekTo&&window.__seekTo(pct);
});

document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){$('rv-help-ov').classList.remove('on');return;}
  if(e.key===' '&&e.repeat){if(!longPress){longPress=true;$('rv-spd-ind').style.display='block';window.__longPressSpeed=3;}e.preventDefault();return;}
  switch(e.key){
    case ' ':e.preventDefault();togAuto();break;
    case 'm':case 'M':togMute();break;
    case 'p':case 'P':togPin();break;
    case 'f':case 'F':togClean();break;
    case 'r':case 'R':window.rvAPI.reload();break;
    case 'h':case 'H':togHelp();break;
    case 'c':case 'C':snap();break;
    case 'o':case 'O':cycleOpa();break;
    case '+':case '=':chgSpd(true);break;
    case '-':case '_':chgSpd(false);break;
    case '0':st.spd=1;applySpd();break;
    case '1':nav('fb');break;case '2':nav('tt');break;case '3':nav('yt');break;
    case 'ArrowUp':e.preventDefault();scroll(true);break;
    case 'ArrowDown':e.preventDefault();scroll(false);break;
    case 'ArrowLeft':if(Date.now()-lastL<400)window.__seekRelative&&window.__seekRelative(-5);lastL=Date.now();break;
    case 'ArrowRight':if(Date.now()-lastR<400)window.__seekRelative&&window.__seekRelative(5);lastR=Date.now();break;
  }
});
document.addEventListener('keyup',function(e){
  if(e.key===' '&&longPress){longPress=false;$('rv-spd-ind').style.display='none';window.__longPressSpeed=null;}
});
})();
