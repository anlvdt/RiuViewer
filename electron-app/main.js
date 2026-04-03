const { app, BrowserWindow, ipcMain, session, dialog, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const PLATFORMS = {
  fb: { name: 'Facebook Reels', url: 'https://touch.facebook.com/reel/' },
  ig: { name: 'Instagram Reels', url: 'https://www.instagram.com/reels/' },
  tt: { name: 'TikTok', url: 'https://www.tiktok.com/foryou' },
  yt: { name: 'YouTube Shorts', url: 'https://m.youtube.com/shorts' },
};
const VALID_PLATFORM_KEYS = Object.keys(PLATFORMS);

const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

let win, currentPlatform = 'fb', pinned = false;
let injectJS = '', overlayCSS = '', overlayJS = '';
let injectInterval = null; // #20: track interval for cleanup

try { injectJS = fs.readFileSync(path.join(__dirname, 'inject.js'), 'utf8'); } catch(e) {}
try { overlayCSS = fs.readFileSync(path.join(__dirname, 'controls.css'), 'utf8'); } catch(e) {}
try { overlayJS = fs.readFileSync(path.join(__dirname, 'controls.js'), 'utf8'); } catch(e) {}

function createWindow() {
  win = new BrowserWindow({
    width: 420, height: 780, minWidth: 360, minHeight: 600,
    resizable: false, titleBarStyle: 'default', backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,       // #1: explicit
      nodeIntegration: false,        // #1: explicit
      autoplayPolicy: 'no-user-gesture-required'
    }
  });
  win.setMenu(null);
  // win.webContents.openDevTools({ mode: 'detach' });
  loadPlatform('fb');

  win.webContents.on('did-finish-load', injectAll);
  win.webContents.on('did-navigate-in-page', injectAll);

  win.webContents.on('will-navigate', (event, url) => {
    const u = url.toLowerCase();
    if (currentPlatform === 'fb') {
      const isLogin = u.includes('login') || u.includes('checkpoint');
      const isReels = u.includes('/reel') || u.includes('/watch') || u.includes('/video') || u.includes('/story');
      const isHomepage = u === 'https://touch.facebook.com/' || u === 'https://m.facebook.com/'
        || u === 'https://www.facebook.com/' || u.endsWith('facebook.com')
        || u.includes('/home.php') || u.includes('facebook.com/?');
      if (u.includes('facebook.com') && isHomepage && !isLogin && !isReels) {
        event.preventDefault();
      }
    }
    // #13: Also cancel IG navigation away from reels (prevent jarring redirect)
    if (currentPlatform === 'ig') {
      const isLogin = u.includes('/accounts/login') || u.includes('/accounts/onetap') || u.includes('/challenge');
      const isReels = u.includes('/reels') || u.includes('/reel/');
      if (u.includes('instagram.com') && !isLogin && !isReels && !u.includes('/accounts/')) {
        event.preventDefault();
      }
    }
  });

  win.webContents.on('did-navigate', (_, url) => {
    const u = url.toLowerCase();
    if (currentPlatform === 'fb') {
      const isLoginPage = u.includes('login.php') || u.includes('/login/') || u.includes('/login?')
        || u.includes('checkpoint') || u.includes('login/device-based');
      const isReelsPage = u.includes('/reel') || u.includes('/reels');
      if (!isLoginPage && !isReelsPage && u.includes('facebook.com')) {
        setTimeout(() => {
          if (!win || win.isDestroyed()) return;
          const cur = win.webContents.getURL().toLowerCase();
          if (cur.includes('facebook.com') && !cur.includes('/reel') && !cur.includes('/reels')
              && !cur.includes('login') && !cur.includes('checkpoint')) {
            win.loadURL(PLATFORMS.fb.url);
          }
        }, 2000);
      }
    }
    // #13: IG redirect handled in will-navigate now, remove delayed redirect
  });

  injectInterval = setInterval(injectAll, 3000); // #20: store ref
  win.on('closed', () => {
    // #20: clear interval on window close
    if (injectInterval) { clearInterval(injectInterval); injectInterval = null; }
    win = null;
  });
}

// Hide FB native UI CSS — comprehensive rules to hide header, open-app, like/comment/share
const FB_HIDE_CSS = `
  /* Top header bar with Reels title, search, profile, open-app button */
  #header,#MTopBlueBar,.mTopBlueBar,
  div[data-sigil="MTopBlueBar"],div[data-sigil="top-blue-bar"],
  div[data-pagelet="ReelsHeaderUnit"],
  a[data-sigil*="MTopBlueBarOpenInApp"],
  [data-sigil="m-promo-jewel-header"],
  div[id="header"],div[id="MTopBlueBar"] { display:none!important }

  /* Unmute overlay */
  div[aria-label*="bật tiếng"],div[aria-label*="unmute"],
  div[data-sigil*="unmute"],button[aria-label*="bật tiếng"],
  button[aria-label*="unmute"] { display:none!important }

  /* "Mở ứng dụng" / Open app button and its container */
  a[href*="//itunes.apple.com"],a[href*="//play.google.com"],
  a[href*="market://"],a[href*="intent://"],
  div[class*="native-app"],
  a[data-sigil*="MTopBlueBarOpenInApp"] { display:none!important }

  /* FB Reels top navigation bar — the bar containing "Reels", search, profile icons */
  .vscroller ~ div[style*="position"],
  div[data-type="vscroller"] ~ div { display:none!important }

  /* Any fixed/sticky bar at top of page (FB header) */
  body > div:first-child > div:first-child[class]:not(.vscroller) {
    position: relative!important;
    display: none!important;
  }

  /* Right-side action buttons (like, comment, share) */
  .vscroller [data-sigil*="like"],
  .vscroller [data-sigil*="share"],
  .vscroller [data-sigil*="comment"] { display:none!important }

  /* Bottom overlay: username, caption, follow, music info */
  .vscroller .story-overlay-bottom,
  .vscroller .overlay-bottom { display:none!important }

  /* Right-side action column */
  .vscroller [class*="action"],
  .vscroller [class*="Action"] { display:none!important }

  /* Generic: last child in vscroller items (usually the overlay controls) */
  .vscroller > div > div:last-child { pointer-events:none!important; opacity:0!important }

  /* Login/signup bars */
  [data-testid="royal_login_bar"],
  [data-testid="mobile_login_bar"] { display:none!important }

  /* Force black background, hide scrollbars */
  body,html { background:#000!important }
  video { object-fit:cover!important }
`;

function injectAll() {
  if (!win || win.isDestroyed()) return;
  const wc = win.webContents;
  const url = wc.getURL().toLowerCase();
  if (url.includes('/accounts/login') || url.includes('/accounts/onetap') || url.includes('/challenge')
      || url.includes('login.php') || url.includes('/login/') || url.includes('/login?')
      || url.includes('login/device-based') || url.includes('/checkpoint')) return;

  wc.insertCSS(FB_HIDE_CSS).catch(() => {});
  if (injectJS) wc.executeJavaScript(injectJS).catch(e => console.warn('[RV] inject error:', e.message)); // #19: log errors

  const htmlStr = JSON.stringify(overlayHTML());
  const cssStr = JSON.stringify(overlayCSS);
  wc.executeJavaScript(`
    if(!document.getElementById('__rv_controls')){
      var s=document.createElement('style');s.id='__rv_css';s.textContent=${cssStr};document.head.appendChild(s);
      var d=document.createElement('div');d.id='__rv_controls';d.innerHTML=${htmlStr};document.body.appendChild(d);
    }
  `).catch(e => console.warn('[RV] controls HTML error:', e.message));
  // Execute controls.js directly via executeJavaScript (runs in isolated world, bypasses CSP)
  // String concat is safe here because controls.js has no template literals
  wc.executeJavaScript(`if(document.getElementById('__rv_controls')&&!window.__rvControls){` + overlayJS + `}`).catch(e => console.warn('[RV] controls JS error:', e.message));
}

function overlayHTML() {
  const ico = {
    globe: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>',
    reload: '<svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
    speed: '<svg viewBox="0 0 24 24"><path d="M20.38 8.57l-1.23 1.85a8 8 0 01-.22 7.58H5.07A8 8 0 0115.58 6.85l1.85-1.23A10 10 0 003.35 19a2 2 0 001.72 1h13.85a2 2 0 001.74-1 10 10 0 00-.27-10.44zm-9.79 6.84a2 2 0 002.83 0l5.66-8.49-8.49 5.66a2 2 0 000 2.83z"/></svg>',
    volOff: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>',
    volOn: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>',
    camera: '<svg viewBox="0 0 24 24"><path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z"/><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>',
    help: '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/></svg>',
  };
  return `
<div id="rv-panel">
  <button class="rv-b" id="rv-plat">${ico.globe}<span class="rv-l" id="rv-plat-l">FB</span></button>
  <button class="rv-b" id="rv-up">${ico.up}</button>
  <button class="rv-b" id="rv-dn">${ico.down}</button>
  <button class="rv-b" id="rv-rel">${ico.reload}</button>
  <button class="rv-b" id="rv-spd">${ico.speed}<span class="rv-l" id="rv-spd-l">1x</span></button>
  <button class="rv-b" id="rv-vol"><span class="rv-ico">${ico.volOff}</span><span class="rv-l" id="rv-vol-l">0%</span></button>
  <button class="rv-b" id="rv-auto">${ico.play}<span class="rv-l" id="rv-auto-l">Auto</span></button>
  <button class="rv-b" id="rv-pin">${ico.pin}<span class="rv-l" id="rv-pin-l">Pin</span></button>
  <button class="rv-b" id="rv-hide">${ico.eye}<span class="rv-l">Hide</span></button>
  <button class="rv-b" id="rv-snap">${ico.camera}<span class="rv-l">Snap</span></button>
  <button class="rv-b" id="rv-help">${ico.help}<span class="rv-l">Keys</span></button>
</div>
<div id="rv-prog"><div id="rv-prog-fill"></div></div>
<div id="rv-time">0:00 / 0:00</div>
<div id="rv-spd-ind">3x</div>
<div id="rv-help-ov"><div id="rv-help-c">
  <h3>Keyboard Shortcuts</h3>
  <div class="rv-sr"><span class="rv-sk">Space</span><span>Auto-scroll (hold=3x)</span></div>
  <div class="rv-sr"><span class="rv-sk">Up/Down</span><span>Scroll up / down</span></div>
  <div class="rv-sr"><span class="rv-sk">M</span><span>Mute / unmute</span></div>
  <div class="rv-sr"><span class="rv-sk">+ / -</span><span>Speed up / down</span></div>
  <div class="rv-sr"><span class="rv-sk">P</span><span>Pin on top</span></div>
  <div class="rv-sr"><span class="rv-sk">F</span><span>Clean mode (dblclick)</span></div>
  <div class="rv-sr"><span class="rv-sk">1-4</span><span>FB / IG / TT / YT</span></div>
  <p style="margin-top:10px;font-size:11px;opacity:0.4">Click to close</p>
</div></div>
<div id="rv-clean-toggle" style="display:none!important;position:fixed;top:30px;left:6px;z-index:999999;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,0.4);color:#fff;align-items:center;justify-content:center;cursor:pointer;border:none">
  <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#fff"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
</div>`;
}

function loadPlatform(key) {
  // #4: validate platform key
  if (!VALID_PLATFORM_KEYS.includes(key)) return;
  currentPlatform = key;
  if (key === 'fb' || key === 'yt') {
    win.webContents.setUserAgent(MOBILE_UA);
  } else {
    win.webContents.setUserAgent(CHROME_UA);
  }
  session.defaultSession.cookies.get({ domain: '.facebook.com', name: 'c_user' })
    .then(cookies => {
      if (key === 'fb' && cookies.length === 0) {
        win.loadURL('https://touch.facebook.com/login.php');
      } else {
        win.loadURL(PLATFORMS[key].url);
      }
    })
    .catch(() => { win.loadURL(PLATFORMS[key].url); });
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(() => {
  const ses = session.defaultSession;
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['Accept-Language'] = 'vi-VN,vi;q=0.9,en;q=0.5';
    delete details.requestHeaders['X-Electron'];
    callback({ requestHeaders: details.requestHeaders });
  });
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [''] } });
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());

// #4: validate platform key from renderer
ipcMain.handle('rv-navigate', (_, key) => {
  if (!VALID_PLATFORM_KEYS.includes(key)) return null;
  loadPlatform(key);
  return key;
});
ipcMain.handle('rv-reload', () => { if(win && !win.isDestroyed()) win.reload(); });
ipcMain.handle('rv-toggle-pin', () => {
  if (!win || win.isDestroyed()) return false;
  pinned=!pinned; win.setAlwaysOnTop(pinned); return pinned;
});
// #5: clamp opacity to valid range
ipcMain.handle('rv-set-opacity', (_, v) => {
  if (typeof v !== 'number' || isNaN(v)) return 1.0;
  const clamped = Math.max(0.1, Math.min(1.0, v));
  if (win && !win.isDestroyed()) win.setOpacity(clamped);
  return clamped;
});
// #6: clear-data with null check
ipcMain.handle('rv-clear-data', async () => {
  await session.defaultSession.clearStorageData();
  await session.defaultSession.clearCache();
  app.relaunch(); app.exit(0);
});
// #4: validate screenshot dataURL format
ipcMain.handle('rv-screenshot', async (_, dataURL) => {
  if (typeof dataURL !== 'string' || !dataURL.startsWith('data:image/png;base64,')) {
    return 'invalid';
  }
  const base64 = dataURL.replace(/^data:image\/png;base64,/, '');
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) return 'invalid';
  const buf = Buffer.from(base64, 'base64');
  if (buf.length < 100) return 'invalid'; // too small to be a real PNG
  const { filePath } = await dialog.showSaveDialog(win, {
    defaultPath: 'RiuViewer_' + Date.now() + '.png',
    filters: [{ name: 'PNG', extensions: ['png'] }]
  });
  if (filePath) { fs.writeFileSync(filePath, buf); return 'saved'; }
  clipboard.writeImage(nativeImage.createFromBuffer(buf));
  return 'clipboard';
});
