package com.local.riuviewer

import android.annotation.SuppressLint
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.webkit.*
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var platformSelector: LinearLayout
    private lateinit var statusText: TextView
    private val handler = Handler(Looper.getMainLooper())

    private var currentPlatform = "tt"
    private var autoScroll = true
    private var muted = false
    private var playbackRate = 1.0
    private var selectorVisible = false
    private var injectJS = ""
    private var isSwiping = false

    private val speeds = listOf(0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0)

    companion object {
        private const val MOBILE_UA =
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

        private const val DESKTOP_UA =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

        private val PLATFORMS = mapOf(
            "tt" to Platform("TikTok", "https://www.tiktok.com/foryou?lang=vi-VN", desktop = true),
            "yt" to Platform("YouTube Shorts", "https://www.youtube.com/shorts", desktop = true),
        )
    }

    data class Platform(val name: String, val url: String, val desktop: Boolean = false)

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        injectJS = assets.open("inject.js").bufferedReader().readText()

        webView = findViewById(R.id.webview)
        platformSelector = findViewById(R.id.platformSelector)
        statusText = findViewById(R.id.statusText)

        setupWebView()
        setupPlatformButtons()
        loadPlatform("tt")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            userAgentString = DESKTOP_UA
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(false)
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            databaseEnabled = true
            allowFileAccess = false
            cacheMode = WebSettings.LOAD_DEFAULT
        }

        // Force 1920px desktop viewport — TV renders exactly like a 1080p monitor
        webView.setInitialScale(100)
        webView.settings.useWideViewPort = true
        webView.settings.loadWithOverviewMode = false

        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        // Add JS bridge so inject.js can request native swipe
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun swipe(up: Boolean) {
                handler.post { simulateSwipe(up) }
            }
        }, "NativeScroll")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectScript()
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString()?.lowercase() ?: return false
                if (currentPlatform == "fb" && url.contains("facebook.com")) {
                    val isLogin = url.contains("login") || url.contains("checkpoint")
                    val isReels = url.contains("/reel") || url.contains("/watch") || url.contains("/video")
                    val isHome = url == "https://touch.facebook.com/" || url == "https://m.facebook.com/"
                        || url.contains("/home.php") || url.contains("facebook.com/?")
                    if (isHome && !isLogin && !isReels) return true
                }
                return false
            }
        }

        webView.webChromeClient = WebChromeClient()

        handler.post(object : Runnable {
            override fun run() {
                injectScript()
                handler.postDelayed(this, 3000)
            }
        })
    }

    /**
     * Simulate a real touch swipe on the WebView using MotionEvent.
     * Uses aggressive velocity (80% screen in 120ms) to trigger TikTok's snap-scroll.
     */
    private fun simulateSwipe(up: Boolean) {
        if (isSwiping) return
        isSwiping = true

        val h = webView.height.toFloat()
        val centerX = webView.width / 2f
        // Swipe 80% of screen height for maximum distance
        val startY = if (up) h * 0.1f else h * 0.9f
        val endY = if (up) h * 0.9f else h * 0.1f

        val downTime = SystemClock.uptimeMillis()
        val steps = 5
        val totalDuration = 120L // fast flick

        // ACTION_DOWN
        val downEvent = MotionEvent.obtain(downTime, downTime, MotionEvent.ACTION_DOWN, centerX, startY, 0)
        downEvent.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
        webView.dispatchTouchEvent(downEvent)
        downEvent.recycle()

        // ACTION_MOVE - rapid steps
        for (i in 1..steps) {
            val fraction = i.toFloat() / steps
            val currentY = startY + (endY - startY) * fraction
            val stepDelay = (totalDuration * fraction).toLong()
            handler.postDelayed({
                if (!webView.isAttachedToWindow) { isSwiping = false; return@postDelayed }
                val moveTime = downTime + stepDelay
                val moveEvent = MotionEvent.obtain(downTime, moveTime, MotionEvent.ACTION_MOVE, centerX, currentY, 0)
                moveEvent.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
                webView.dispatchTouchEvent(moveEvent)
                moveEvent.recycle()
            }, stepDelay)
        }

        // ACTION_UP
        handler.postDelayed({
            if (!webView.isAttachedToWindow) { isSwiping = false; return@postDelayed }
            val upTime = SystemClock.uptimeMillis()
            val upEvent = MotionEvent.obtain(downTime, upTime, MotionEvent.ACTION_UP, centerX, endY, 0)
            upEvent.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
            webView.dispatchTouchEvent(upEvent)
            upEvent.recycle()
            isSwiping = false
        }, totalDuration + 20)
    }

    /**
     * Desktop platforms (TikTok/YT): forward ArrowDown/ArrowUp — they handle scroll natively.
     * Mobile platforms (FB): use MotionEvent swipe.
     */
    private fun scrollVideo(up: Boolean) {
        val platform = PLATFORMS[currentPlatform]
        if (platform?.desktop == true) {
            val key = if (up) "ArrowUp" else "ArrowDown"
            webView.evaluateJavascript(
                "document.dispatchEvent(new KeyboardEvent('keydown',{key:'$key',code:'$key',bubbles:true}))", null
            )
        } else {
            simulateSwipe(up)
        }
    }

    private fun setupPlatformButtons() {
        findViewById<Button>(R.id.btnTT).setOnClickListener { loadPlatform("tt"); hidePlatformSelector() }
        findViewById<Button>(R.id.btnYT).setOnClickListener { loadPlatform("yt"); hidePlatformSelector() }
    }

    private fun loadPlatform(key: String) {
        val platform = PLATFORMS[key] ?: return
        currentPlatform = key
        // Switch UA: desktop for TikTok/YT (unlimited viewing), mobile for FB
        webView.settings.userAgentString = if (platform.desktop) DESKTOP_UA else MOBILE_UA
        webView.loadUrl(platform.url)
        showStatus(platform.name)
    }

    private fun injectScript() {
        val url = webView.url?.lowercase() ?: return
        if (url.contains("login") || url.contains("checkpoint")) return
        webView.evaluateJavascript(injectJS, null)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            val keyCode = event.keyCode

            if (selectorVisible) {
                if (keyCode == KeyEvent.KEYCODE_BACK) {
                    hidePlatformSelector()
                    return true
                }
                return super.dispatchKeyEvent(event)
            }

            val isDesktop = PLATFORMS[currentPlatform]?.desktop == true

            when (keyCode) {
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                    autoScroll = !autoScroll
                    webView.evaluateJavascript("window.__autoScroll=$autoScroll", null)
                    showStatus(if (autoScroll) "Auto-scroll ON" else "Auto-scroll OFF")
                    return true
                }
                KeyEvent.KEYCODE_DPAD_DOWN, KeyEvent.KEYCODE_DPAD_UP -> {
                    // Immediately mute all videos before scroll
                    webView.evaluateJavascript(
                        "document.querySelectorAll('video').forEach(function(v){v.volume=0;v.muted=true})", null
                    )
                    if (isDesktop) {
                        webView.requestFocus()
                        return super.dispatchKeyEvent(event)
                    } else {
                        simulateSwipe(up = keyCode == KeyEvent.KEYCODE_DPAD_UP)
                        return true
                    }
                }
                KeyEvent.KEYCODE_DPAD_RIGHT -> {
                    changeSpeed(faster = true)
                    return true
                }
                KeyEvent.KEYCODE_DPAD_LEFT -> {
                    changeSpeed(faster = false)
                    return true
                }
                KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_GUIDE,
                KeyEvent.KEYCODE_BOOKMARK, KeyEvent.KEYCODE_INFO,
                KeyEvent.KEYCODE_TV_INPUT, KeyEvent.KEYCODE_SETTINGS -> {
                    togglePlatformSelector()
                    return true
                }
                // Channel Up/Down: cycle platforms
                KeyEvent.KEYCODE_CHANNEL_UP, KeyEvent.KEYCODE_PAGE_UP -> {
                    cyclePlatform(forward = true)
                    return true
                }
                KeyEvent.KEYCODE_CHANNEL_DOWN, KeyEvent.KEYCODE_PAGE_DOWN -> {
                    cyclePlatform(forward = false)
                    return true
                }
                // Number keys: direct platform select
                KeyEvent.KEYCODE_1 -> { loadPlatform("tt"); return true }
                KeyEvent.KEYCODE_2 -> { loadPlatform("yt"); return true }
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, KeyEvent.KEYCODE_HEADSETHOOK -> {
                    toggleMute()
                    return true
                }
                KeyEvent.KEYCODE_VOLUME_UP -> {
                    if (muted) toggleMute()
                    return super.dispatchKeyEvent(event)
                }
                KeyEvent.KEYCODE_VOLUME_DOWN -> {
                    if (!muted) toggleMute()
                    return super.dispatchKeyEvent(event)
                }
                KeyEvent.KEYCODE_BACK -> {
                    if (webView.canGoBack()) {
                        webView.goBack()
                        return true
                    }
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun toggleMute() {
        muted = !muted
        val vol = if (muted) 0 else 1
        webView.evaluateJavascript(
            "window.__vol=$vol;document.querySelectorAll('video').forEach(function(v){v.muted=${muted};v.volume=$vol;})", null
        )
        showStatus(if (muted) "Muted" else "Unmuted")
    }

    private fun changeSpeed(faster: Boolean) {
        val idx = speeds.indexOf(playbackRate)
        val newIdx = if (faster) minOf(idx + 1, speeds.size - 1) else maxOf(idx - 1, 0)
        playbackRate = speeds[if (idx < 0) 3 else newIdx]
        webView.evaluateJavascript(
            "window.__playbackRate=$playbackRate;document.querySelectorAll('video').forEach(function(v){v.playbackRate=$playbackRate;})", null
        )
        showStatus("Speed: ${playbackRate}x")
    }

    private val platformKeys = listOf("tt", "yt")

    private fun cyclePlatform(forward: Boolean) {
        val idx = platformKeys.indexOf(currentPlatform)
        val next = if (forward) (idx + 1) % platformKeys.size else (idx - 1 + platformKeys.size) % platformKeys.size
        loadPlatform(platformKeys[next])
    }

    private fun togglePlatformSelector() {
        selectorVisible = !selectorVisible
        platformSelector.visibility = if (selectorVisible) View.VISIBLE else View.GONE
        if (selectorVisible) {
            findViewById<Button>(R.id.btnTT).requestFocus()
        }
    }

    private fun hidePlatformSelector() {
        selectorVisible = false
        platformSelector.visibility = View.GONE
        webView.requestFocus()
    }

    private fun showStatus(text: String) {
        statusText.text = text
        statusText.visibility = View.VISIBLE
        handler.removeCallbacksAndMessages("hideStatus")
        handler.postDelayed({ statusText.visibility = View.GONE }, 2000)
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        webView.pauseTimers()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.resumeTimers()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        webView.destroy()
        super.onDestroy()
    }
}
