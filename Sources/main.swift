import SwiftUI
import WebKit
import AppKit
import CoreGraphics

// MARK: - App State
@Observable
class AppState {
    var autoScrollEnabled = true
    var alwaysOnTop = false
    var volume: Double = 0
    var volumeBoost: Double = 1.0 // 1.0 = normal, up to 3.0
    var playbackRate: Double = 1.0
    var cleanMode = false
    var webView: WKWebView?
    var videosWatched = 0
    var watchMinutes = 0
    var showStats = false
    var breakReminderMinutes = 30
    var showBreakReminder = false
    var currentPlatform: Platform = .facebookReels
    // New features
    var showTimeDisplay = true
    var timeDisplayText = "0:00 / 0:00"
    var flipH = false
    var flipV = false
    var filterBrightness: Double = 100
    var filterContrast: Double = 100
    var filterSaturate: Double = 100
    var showFilters = false
    var skipIntroSeconds: Double = 0
    var longPressActive = false
    var showShortcutHelp = false
    var opacity: Double = 1.0 // window opacity
    var showMiniProgress = true // always show mini progress indicator

    enum Platform: String, CaseIterable {
        case facebookReels = "Facebook Reels"
        case instagramReels = "Instagram Reels"
        case tiktok = "TikTok"
        case youtubeShorts = "YouTube Shorts"

        var url: String {
            switch self {
            case .facebookReels: return "https://touch.facebook.com/reel/?locale=vi_VN"
            case .instagramReels: return "https://www.instagram.com/reels/"
            case .tiktok: return "https://www.tiktok.com/foryou"
            case .youtubeShorts: return "https://m.youtube.com/shorts"
            }
        }
        var userAgent: String {
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        }
    }

    static let playbackRates: [Double] = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0]
}

// MARK: - App Entry
@main
struct RiuViewerApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @State private var state = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView(state: state)
        }
        .windowStyle(.titleBar)
        .defaultSize(width: 420, height: 780)
        .windowResizability(.contentMinSize)
        .commands {
            CommandGroup(replacing: .newItem) {}
        }
    }
}

// MARK: - AppDelegate
class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ n: Notification) {
        NSApp.activate(ignoringOtherApps: true)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            if let window = NSApp.windows.first {
                window.backgroundColor = .black
                window.titlebarAppearsTransparent = true
                window.title = ""
                window.styleMask.insert(.fullSizeContentView)
                let titlebarH = window.frame.height - window.contentLayoutRect.height
                window.contentView?.additionalSafeAreaInsets = NSEdgeInsets(top: -titlebarH, left: 0, bottom: 0, right: 0)
                window.styleMask.remove(.resizable)
                window.collectionBehavior.remove(.fullScreenPrimary)
                if let cv = window.contentView {
                    cv.wantsLayer = true
                    cv.layer?.backgroundColor = NSColor.black.cgColor
                }
            }
        }
    }
    func applicationWillTerminate(_ n: Notification) {
        for window in NSApp.windows {
            if let wv = findWV(in: window.contentView) { wv.loadHTMLString("", baseURL: nil) }
        }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    @MainActor private func findWV(in view: NSView?) -> WKWebView? {
        guard let view else { return nil }
        if let wv = view as? WKWebView { return wv }
        for sub in view.subviews { if let wv = findWV(in: sub) { return wv } }
        return nil
    }
}

// MARK: - JS Loader
enum JSLoader {
    static let code: String = {
        if let url = Bundle.main.url(forResource: "RiuViewer", withExtension: "js"),
           let js = try? String(contentsOf: url) { return js }
        let devPath = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("RiuViewer.js")
        if let js = try? String(contentsOf: devPath) { return js }
        return "console.log('[RV] JS not found');"
    }()
}

// MARK: - ContentView
struct ContentView: View {
    @Bindable var state: AppState

    var body: some View {
        ZStack(alignment: .trailing) {
            ReelsWebView(state: state)
                .ignoresSafeArea(.all, edges: .top)

            if state.cleanMode {
                CleanModeOverlay(state: state)
            } else {
                ControlPanel(state: state)
            }

            // Time display overlay (top-left)
            if state.showTimeDisplay && !state.cleanMode {
                VStack {
                    HStack {
                        Text(state.timeDisplayText)
                            .font(.system(size: 11, weight: .medium, design: .monospaced))
                            .foregroundColor(.white.opacity(0.7))
                            .shadow(color: .black.opacity(0.8), radius: 2)
                            .padding(.leading, 12)
                            .padding(.top, 8)
                        Spacer()
                    }
                    Spacer()
                }
                .allowsHitTesting(false)
            }

            // Bottom progress bar
            if !state.cleanMode {
                VStack(spacing: 0) {
                    Spacer()
                    SeekableProgressBar(state: state)
                        .frame(height: 14)
                }
            }

            // Long-press speed indicator
            if state.longPressActive {
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Text("⏩ 3x")
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Capsule().fill(Color.white.opacity(0.25)))
                        Spacer()
                    }
                    .padding(.bottom, 60)
                }
                .allowsHitTesting(false)
            }

            if state.showStats { StatsOverlay(state: state) }
            if state.showBreakReminder { BreakReminderOverlay(state: state) }
            if state.showFilters { FiltersOverlay(state: state) }
            if state.showShortcutHelp { ShortcutHelpOverlay(state: state) }
        }
        .frame(minWidth: 420, minHeight: 780)
        .background(Color.black)
        .opacity(state.opacity)
        .onAppear { startTimers() }
        .background(KeyboardHandler(state: state))
    }

    private func startTimers() {
        // Break reminder timer
        Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { _ in
            Task { @MainActor in
                state.webView?.evaluateJavaScript("window.__getStats&&window.__getStats()") { result, _ in
                    if let dict = result as? [String: Any] {
                        Task { @MainActor in
                            state.videosWatched = dict["watched"] as? Int ?? 0
                            state.watchMinutes = dict["minutes"] as? Int ?? 0
                            if state.watchMinutes > 0 && state.breakReminderMinutes < 9999
                                && state.watchMinutes % state.breakReminderMinutes == 0 {
                                state.showBreakReminder = true
                            }
                        }
                    }
                }
            }
        }
        // Time display timer
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
            Task { @MainActor in
                state.webView?.evaluateJavaScript("window.__getTimeDisplay&&window.__getTimeDisplay()") { result, _ in
                    if let s = result as? String {
                        Task { @MainActor in state.timeDisplayText = s }
                    }
                }
            }
        }
    }
}

// MARK: - Keyboard Handler (with long-press, double-tap seek, screenshot)
struct KeyboardHandler: NSViewRepresentable {
    let state: AppState
    func makeNSView(context: Context) -> KeyCatcherView {
        let v = KeyCatcherView(); v.state = state; return v
    }
    func updateNSView(_ v: KeyCatcherView, context: Context) { v.state = state }

    class KeyCatcherView: NSView {
        var state: AppState?
        private var longPressTimer: Timer?
        private var lastLeftArrow: Date = .distantPast
        private var lastRightArrow: Date = .distantPast

        override var acceptsFirstResponder: Bool { true }

        override func keyDown(with event: NSEvent) {
            guard let state = state else { return }
            // Long-press detection: hold any key
            if event.isARepeat {
                // If holding space, activate 3x speed
                if event.charactersIgnoringModifiers == " " && !state.longPressActive {
                    state.longPressActive = true
                    state.webView?.evaluateJavaScript("window.__longPressSpeed=3;")
                }
                return
            }
            switch event.charactersIgnoringModifiers {
            case " ":
                state.autoScrollEnabled.toggle()
            case "m", "M":
                state.volume = state.volume > 0 ? 0 : 1; applyVolume(state)
            case "p", "P":
                state.alwaysOnTop.toggle()
                NSApp.windows.first?.level = state.alwaysOnTop ? .floating : .normal
            case "f", "F":
                toggleClean(state)
            case "r", "R":
                reloadPlatform(state)
            case "s", "S":
                state.showStats.toggle()
            case "h", "H":
                state.showShortcutHelp.toggle()
            case "t", "T":
                state.showTimeDisplay.toggle()
            case "c", "C":
                // Screenshot
                takeScreenshot(state)
            case "v", "V":
                // Toggle video filters panel
                state.showFilters.toggle()
            case "o", "O":
                // Cycle window opacity
                state.opacity = state.opacity <= 0.3 ? 1.0 : state.opacity - 0.1
                NSApp.windows.first?.alphaValue = state.opacity
            case "l", "L":
                // Toggle loop current video
                state.webView?.evaluateJavaScript("(function(){var v=document.querySelector('video');if(v)v.loop=!v.loop;return v?v.loop:false})()")
            case "+", "=":
                changeSpeed(state, faster: true)
            case "-", "_":
                changeSpeed(state, faster: false)
            case "0":
                // Reset speed to 1x
                state.playbackRate = 1.0; applyPlaybackRate(state)
            case "[":
                // Volume boost down
                state.volumeBoost = max(1.0, state.volumeBoost - 0.5)
                state.webView?.evaluateJavaScript("window.__setVolumeBoost&&window.__setVolumeBoost(\(state.volumeBoost))")
            case "]":
                // Volume boost up (up to 3x)
                state.volumeBoost = min(3.0, state.volumeBoost + 0.5)
                state.webView?.evaluateJavaScript("window.__setVolumeBoost&&window.__setVolumeBoost(\(state.volumeBoost))")
            default:
                if event.keyCode == 126 { // Up arrow
                    scrollWebView(state, up: true)
                } else if event.keyCode == 125 { // Down arrow
                    scrollWebView(state, up: false)
                } else if event.keyCode == 123 { // Left arrow - double tap = seek back
                    let now = Date()
                    if now.timeIntervalSince(lastLeftArrow) < 0.4 {
                        state.webView?.evaluateJavaScript("window.__seekRelative&&window.__seekRelative(-5)")
                    }
                    lastLeftArrow = now
                } else if event.keyCode == 124 { // Right arrow - double tap = seek forward
                    let now = Date()
                    if now.timeIntervalSince(lastRightArrow) < 0.4 {
                        state.webView?.evaluateJavaScript("window.__seekRelative&&window.__seekRelative(5)")
                    }
                    lastRightArrow = now
                } else {
                    super.keyDown(with: event)
                }
            }
        }

        override func keyUp(with event: NSEvent) {
            guard let state = state else { return }
            if event.charactersIgnoringModifiers == " " && state.longPressActive {
                state.longPressActive = false
                state.webView?.evaluateJavaScript("window.__longPressSpeed=null;")
            }
        }
    }
}

// MARK: - Control Panel
struct ControlPanel: View {
    @Bindable var state: AppState

    var body: some View {
        HStack {
            Spacer() // push everything to the right
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 16) {
                    menuBtn("globe", shortName(state.currentPlatform)) {
                        ForEach(AppState.Platform.allCases, id: \.self) { p in
                            Button(p.rawValue) { state.currentPlatform = p; reloadPlatform(state) }
                        }
                    }
                    fbBtn("chevron.up") { scrollWebView(state, up: true) }
                    fbBtn("chevron.down") { scrollWebView(state, up: false) }
                    fbBtn("arrow.counterclockwise") { reloadPlatform(state) }
                    menuBtn("gauge.with.dots.needle.33percent", String(format: "%.2gx", state.playbackRate)) {
                        ForEach(AppState.playbackRates, id: \.self) { rate in
                            Button("\(rate, specifier: "%.2g")x") {
                                state.playbackRate = rate; applyPlaybackRate(state)
                            }
                        }
                    }
                    VolumeControl(state: state)
                    fbBtn(state.autoScrollEnabled ? "play.circle" : "pause.circle",
                          label: state.autoScrollEnabled ? "Auto" : "Off") {
                        state.autoScrollEnabled.toggle()
                    }
                    fbBtn(state.alwaysOnTop ? "pin.fill" : "pin",
                          label: state.alwaysOnTop ? "On" : "Pin") {
                        state.alwaysOnTop.toggle()
                        NSApp.windows.first?.level = state.alwaysOnTop ? .floating : .normal
                    }
                    fbBtn("eye.slash", label: "Hide") { toggleClean(state) }
                    fbBtn("camera", label: "Snap") { takeScreenshot(state) }
                    fbBtn("camera.filters", label: "Filter") { state.showFilters.toggle() }
                    fbBtn("questionmark.circle", label: "Keys") { state.showShortcutHelp.toggle() }
                }
                .padding(.vertical, 6)
            }
            .frame(width: 48).frame(maxHeight: 520)
        }
        .padding(.trailing, 4)
        .padding(.bottom, 24)
    }

    private func shortName(_ p: AppState.Platform) -> String {
        switch p {
        case .facebookReels: return "FB"
        case .instagramReels: return "IG"
        case .tiktok: return "TT"
        case .youtubeShorts: return "YT"
        }
    }

    private func menuBtn<Content: View>(_ icon: String, _ text: String, @ViewBuilder content: @escaping () -> Content) -> some View {
        Menu { content() } label: {
            VStack(spacing: 2) {
                Image(systemName: icon).font(.system(size: 22, weight: .regular))
                Text(text).font(.system(size: 9, weight: .semibold))
            }
            .foregroundColor(.white)
            .shadow(color: .black.opacity(0.6), radius: 2, x: 0, y: 1)
            .frame(width: 44)
        }
        .menuStyle(.borderlessButton).menuIndicator(.hidden)
    }
}

// MARK: - Volume Control
struct VolumeControl: View {
    @Bindable var state: AppState
    @State private var showSlider = false

    var body: some View {
        VStack(spacing: 4) {
            if showSlider {
                VolumeSlider(volume: Binding(
                    get: { state.volume },
                    set: { state.volume = $0; applyVolume(state) }
                ))
                .frame(width: 36, height: 100)
                .transition(.opacity)
            }
            Button(action: {
                if showSlider { showSlider = false }
                else {
                    withAnimation(.easeInOut(duration: 0.2)) { showSlider = true }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                        withAnimation { showSlider = false }
                    }
                }
            }) {
                VStack(spacing: 3) {
                    Image(systemName: state.volume == 0 ? "speaker.slash" : volIcon)
                        .font(.system(size: 28, weight: .regular))
                    Text(state.volumeBoost > 1 ? "\(Int(state.volume * 100))%↑" : "\(Int(state.volume * 100))%")
                        .font(.system(size: 9, weight: .semibold))
                }
                .foregroundColor(.white)
                .shadow(color: .black.opacity(0.6), radius: 2, x: 0, y: 1)
                .frame(width: 44)
            }.buttonStyle(.plain)
        }
    }
    private var volIcon: String {
        if state.volume > 0.6 { return "speaker.wave.3" }
        if state.volume > 0.3 { return "speaker.wave.2" }
        return "speaker.wave.1"
    }
}

struct VolumeSlider: View {
    @Binding var volume: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                RoundedRectangle(cornerRadius: 4).fill(Color.white.opacity(0.2))
                RoundedRectangle(cornerRadius: 4).fill(Color.white.opacity(0.8))
                    .frame(height: geo.size.height * volume)
            }
            .gesture(DragGesture(minimumDistance: 0).onChanged { val in
                volume = max(0, min(1, 1.0 - val.location.y / geo.size.height))
            })
        }
    }
}

// MARK: - Clean Mode
struct CleanModeOverlay: View {
    @Bindable var state: AppState
    var body: some View {
        VStack {
            HStack {
                Spacer()
                Button(action: { toggleClean(state) }) {
                    Image(systemName: "eye")
                        .font(.system(size: 24, weight: .medium))
                        .foregroundColor(.white.opacity(0.8))
                        .shadow(color: .black.opacity(0.8), radius: 4, x: 0, y: 2)
                        .frame(width: 44, height: 44)
                }.buttonStyle(.plain)
                .padding(.trailing, 12).padding(.top, 12)
            }
            Spacer()
        }
    }
}

// MARK: - Seekable Progress Bar
struct SeekableProgressBar: View {
    @Bindable var state: AppState
    @State private var progress: Double = 0
    @State private var isDragging = false
    @State private var hovered = false

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Rectangle().fill(Color.white.opacity(0.15))
                Rectangle().fill(Color.white.opacity(hovered || isDragging ? 1.0 : 0.6))
                    .frame(width: geo.size.width * progress)
                // Thumb indicator when hovered
                if hovered || isDragging {
                    Circle()
                        .fill(Color.white)
                        .frame(width: 10, height: 10)
                        .offset(x: geo.size.width * progress - 5)
                }
            }
            .frame(height: hovered || isDragging ? 8 : 3)
            .frame(maxHeight: .infinity, alignment: .bottom)
            .contentShape(Rectangle())
            .onHover { h in withAnimation(.easeInOut(duration: 0.15)) { hovered = h } }
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { val in
                        isDragging = true
                        let pct = max(0, min(1, val.location.x / geo.size.width))
                        progress = pct
                        state.webView?.evaluateJavaScript("window.__seekTo&&window.__seekTo(\(pct))")
                    }
                    .onEnded { _ in isDragging = false }
            )
        }
        .onAppear { startPolling() }
    }

    private func startPolling() {
        Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { _ in
            Task { @MainActor in
                if isDragging { return }
                state.webView?.evaluateJavaScript(
                    "(function(){var v=document.querySelector('video');if(v&&v.duration&&v.duration!==Infinity)return v.currentTime/v.duration;return 0})()"
                ) { result, _ in
                    if let val = result as? Double {
                        Task { @MainActor in progress = val }
                    }
                }
            }
        }
    }
}

// MARK: - Filters Overlay (from VideoRoll: brightness, contrast, saturation)
struct FiltersOverlay: View {
    @Bindable var state: AppState

    var body: some View {
        VStack {
            Spacer()
            HStack {
                VStack(alignment: .leading, spacing: 12) {
                    Text("🎨 Video Filters")
                        .font(.system(size: 14, weight: .bold)).foregroundColor(.white)

                    filterRow("Brightness", value: $state.filterBrightness, icon: "sun.max")
                    filterRow("Contrast", value: $state.filterContrast, icon: "circle.lefthalf.filled")
                    filterRow("Saturation", value: $state.filterSaturate, icon: "drop.halffull")

                    Divider().background(Color.white.opacity(0.3))

                    HStack(spacing: 12) {
                        Text("Skip Intro:").font(.system(size: 11)).foregroundColor(.white)
                        Picker("", selection: Binding(
                            get: { state.skipIntroSeconds },
                            set: { state.skipIntroSeconds = $0; applySkipIntro(state) }
                        )) {
                            Text("Off").tag(0.0)
                            Text("3s").tag(3.0)
                            Text("5s").tag(5.0)
                            Text("10s").tag(10.0)
                        }
                        .pickerStyle(.segmented).frame(width: 180)
                    }

                    HStack(spacing: 12) {
                        Text("Vol Boost:").font(.system(size: 11)).foregroundColor(.white)
                        Picker("", selection: Binding(
                            get: { state.volumeBoost },
                            set: { state.volumeBoost = $0
                                state.webView?.evaluateJavaScript("window.__setVolumeBoost&&window.__setVolumeBoost(\($0))")
                            }
                        )) {
                            Text("1x").tag(1.0)
                            Text("1.5x").tag(1.5)
                            Text("2x").tag(2.0)
                            Text("3x").tag(3.0)
                        }
                        .pickerStyle(.segmented).frame(width: 180)
                    }

                    HStack(spacing: 12) {
                        Button("Flip H") {
                            state.flipH.toggle()
                            state.webView?.evaluateJavaScript("window.__flipVideo(\(state.flipH),\(state.flipV))")
                        }.buttonStyle(.bordered).tint(.white.opacity(0.3))
                        Button("Flip V") {
                            state.flipV.toggle()
                            state.webView?.evaluateJavaScript("window.__flipVideo(\(state.flipH),\(state.flipV))")
                        }.buttonStyle(.bordered).tint(.white.opacity(0.3))
                        Button("Reset") {
                            state.filterBrightness = 100; state.filterContrast = 100; state.filterSaturate = 100
                            state.flipH = false; state.flipV = false
                            applyFilters(state)
                            state.webView?.evaluateJavaScript("window.__resetFlip()")
                        }.buttonStyle(.bordered).tint(.white.opacity(0.3))
                    }
                }
                .padding(16)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.black.opacity(0.9)))
                Spacer()
            }
            .padding(.leading, 12).padding(.bottom, 30)
        }
        .onTapGesture { state.showFilters = false }
    }

    private func filterRow(_ label: String, value: Binding<Double>, icon: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).foregroundColor(.white.opacity(0.7)).frame(width: 20)
            Text(label).font(.system(size: 11)).foregroundColor(.white).frame(width: 70, alignment: .leading)
            Slider(value: value, in: 20...200, step: 5)
                .frame(width: 120)
                .onChange(of: value.wrappedValue) { _, _ in applyFilters(state) }
            Text("\(Int(value.wrappedValue))%").font(.system(size: 10, design: .monospaced))
                .foregroundColor(.white.opacity(0.7)).frame(width: 35)
        }
    }
}

// MARK: - Stats Overlay
struct StatsOverlay: View {
    @Bindable var state: AppState
    var body: some View {
        VStack {
            Spacer()
            HStack {
                VStack(alignment: .leading, spacing: 8) {
                    Text("📊 Session Stats").font(.system(size: 14, weight: .bold))
                    Text("Videos: \(state.videosWatched)").font(.system(size: 12))
                    Text("Time: \(state.watchMinutes) min").font(.system(size: 12))
                    Text("Speed: \(state.playbackRate, specifier: "%.2g")x").font(.system(size: 12))
                    Text("Platform: \(state.currentPlatform.rawValue)").font(.system(size: 12))
                    if state.volumeBoost > 1 {
                        Text("Vol Boost: \(state.volumeBoost, specifier: "%.1f")x").font(.system(size: 12))
                    }
                    Divider().background(Color.white.opacity(0.3))
                    HStack {
                        Text("Break every:").font(.system(size: 11))
                        Picker("", selection: Binding(
                            get: { state.breakReminderMinutes },
                            set: { state.breakReminderMinutes = $0 }
                        )) {
                            Text("15m").tag(15); Text("30m").tag(30)
                            Text("60m").tag(60); Text("Off").tag(9999)
                        }.pickerStyle(.segmented).frame(width: 160)
                    }
                }
                .foregroundColor(.white).padding(16)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.black.opacity(0.85)))
                Spacer()
            }
            .padding(.leading, 12).padding(.bottom, 30)
        }
        .onTapGesture { state.showStats = false }
    }
}

// MARK: - Break Reminder
struct BreakReminderOverlay: View {
    @Bindable var state: AppState
    var body: some View {
        ZStack {
            Color.black.opacity(0.7)
            VStack(spacing: 16) {
                Image(systemName: "cup.and.saucer").font(.system(size: 48)).foregroundColor(.white)
                Text("Time for a break!").font(.system(size: 20, weight: .bold)).foregroundColor(.white)
                Text("You've been watching for \(state.watchMinutes) minutes")
                    .font(.system(size: 14)).foregroundColor(.white.opacity(0.8))
                Text("\(state.videosWatched) videos watched")
                    .font(.system(size: 12)).foregroundColor(.white.opacity(0.6))
                Button("Continue Watching") { state.showBreakReminder = false }
                    .buttonStyle(.borderedProminent).tint(.white.opacity(0.3))
            }.padding(32)
        }.ignoresSafeArea()
    }
}

// MARK: - Shortcut Help Overlay
struct ShortcutHelpOverlay: View {
    @Bindable var state: AppState
    private let shortcuts: [(String, String)] = [
        ("Space", "Auto-scroll on/off (hold = 3x speed)"),
        ("↑ / ↓", "Scroll up / down"),
        ("← ← / → →", "Double-tap: seek ±5s"),
        ("M", "Mute / unmute"),
        ("+ / -", "Speed up / down"),
        ("0", "Reset speed to 1x"),
        ("[ / ]", "Volume boost down / up"),
        ("P", "Pin on top"),
        ("F", "Clean mode"),
        ("R", "Reload"),
        ("S", "Stats"),
        ("T", "Time display"),
        ("C", "Screenshot"),
        ("V", "Video filters"),
        ("L", "Loop current video"),
        ("O", "Window opacity"),
        ("H", "This help"),
    ]

    var body: some View {
        ZStack {
            Color.black.opacity(0.8)
            VStack(alignment: .leading, spacing: 6) {
                Text("⌨️ Keyboard Shortcuts")
                    .font(.system(size: 16, weight: .bold)).foregroundColor(.white)
                    .padding(.bottom, 4)
                ForEach(shortcuts, id: \.0) { key, desc in
                    HStack {
                        Text(key).font(.system(size: 12, weight: .bold, design: .monospaced))
                            .foregroundColor(.yellow).frame(width: 80, alignment: .trailing)
                        Text(desc).font(.system(size: 12)).foregroundColor(.white.opacity(0.85))
                    }
                }
            }
            .padding(24)
            .background(RoundedRectangle(cornerRadius: 16).fill(Color.black.opacity(0.95)))
        }
        .ignoresSafeArea()
        .onTapGesture { state.showShortcutHelp = false }
    }
}

// MARK: - Shared Actions
@MainActor
func fbBtn(_ icon: String, label: String? = nil, _ act: @escaping () -> Void) -> some View {
    Button(action: act) {
        VStack(spacing: 2) {
            Image(systemName: icon)
                .font(.system(size: 24, weight: .regular))
                .foregroundColor(.white)
                .shadow(color: .black.opacity(0.6), radius: 2, x: 0, y: 1)
            if let label {
                Text(label).font(.system(size: 10, weight: .semibold))
                    .foregroundColor(.white)
                    .shadow(color: .black.opacity(0.6), radius: 2, x: 0, y: 1)
            }
        }.frame(width: 44)
    }.buttonStyle(.plain)
}

@MainActor func toggleClean(_ state: AppState) {
    state.cleanMode.toggle()
    let js = state.cleanMode
        ? "var s=document.getElementById('__rvClean');if(!s){s=document.createElement('style');s.id='__rvClean';document.head.appendChild(s)}s.textContent='header,nav,[role=banner],[role=navigation],[data-pagelet]{opacity:0!important}a,p,h1,h2,h3,h4,img,svg,button,[role=button],[aria-label]{opacity:0!important}span{opacity:0!important}span{pointer-events:none!important}*:not(video):not(span){background:transparent!important;background-color:transparent!important;background-image:none!important;border-color:transparent!important;box-shadow:none!important}video{opacity:1!important;object-fit:cover!important}::-webkit-scrollbar{display:none!important}*{scrollbar-width:none!important}*::before,*::after{opacity:0!important}';"
        : "var s=document.getElementById('__rvClean');if(s)s.remove();"
    state.webView?.evaluateJavaScript(js)
}

@MainActor func scrollWebView(_ state: AppState, up: Bool) {
    state.webView?.evaluateJavaScript("window.__doManualScroll&&window.__doManualScroll(\(up))")
}

@MainActor func reloadPlatform(_ state: AppState) {
    guard let url = URL(string: state.currentPlatform.url) else { return }
    var req = URLRequest(url: url)
    req.setValue("vi-VN,vi;q=0.9,en;q=0.5", forHTTPHeaderField: "Accept-Language")
    state.webView?.customUserAgent = state.currentPlatform.userAgent
    state.webView?.load(req)
}

@MainActor func applyVolume(_ state: AppState) {
    let m = state.volume == 0
    state.webView?.evaluateJavaScript(
        "window.__vol=\(state.volume);document.querySelectorAll('video').forEach(function(v){v.muted=\(m);v.volume=\(state.volume);});"
    )
}

@MainActor func applyPlaybackRate(_ state: AppState) {
    state.webView?.evaluateJavaScript(
        "window.__playbackRate=\(state.playbackRate);document.querySelectorAll('video').forEach(function(v){v.playbackRate=\(state.playbackRate);});"
    )
}

@MainActor func changeSpeed(_ state: AppState, faster: Bool) {
    let rates = AppState.playbackRates
    if let idx = rates.firstIndex(of: state.playbackRate) {
        let newIdx = faster ? min(idx + 1, rates.count - 1) : max(idx - 1, 0)
        state.playbackRate = rates[newIdx]
    } else { state.playbackRate = 1.0 }
    applyPlaybackRate(state)
}

@MainActor func applyFilters(_ state: AppState) {
    state.webView?.evaluateJavaScript(
        "window.__filterBrightness=\(state.filterBrightness);window.__filterContrast=\(state.filterContrast);window.__filterSaturate=\(state.filterSaturate);"
    )
}

@MainActor func applySkipIntro(_ state: AppState) {
    state.webView?.evaluateJavaScript("window.__skipIntro=\(state.skipIntroSeconds);")
}

@MainActor func takeScreenshot(_ state: AppState) {
    state.webView?.evaluateJavaScript("window.__screenshot&&window.__screenshot()") { result, _ in
        guard let dataURL = result as? String,
              let commaIdx = dataURL.firstIndex(of: ",") else { return }
        let base64 = String(dataURL[dataURL.index(after: commaIdx)...])
        guard let data = Data(base64Encoded: base64),
              let image = NSImage(data: data) else { return }
        Task { @MainActor in
            let panel = NSSavePanel()
            panel.allowedContentTypes = [.png]
            panel.nameFieldStringValue = "RiuViewer_\(Int(Date().timeIntervalSince1970)).png"
            if panel.runModal() == .OK, let url = panel.url {
                try? data.write(to: url)
            } else {
                // Fallback: copy to clipboard
                NSPasteboard.general.clearContents()
                NSPasteboard.general.writeObjects([image])
            }
        }
    }
}

// MARK: - WebView
struct ReelsWebView: NSViewRepresentable {
    @Bindable var state: AppState

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default()
        config.userContentController.add(context.coordinator, name: "scrollNext")
        let script = WKUserScript(source: JSLoader.code, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        config.userContentController.addUserScript(script)

        let wv = WKWebView(frame: .zero, configuration: config)
        wv.navigationDelegate = context.coordinator
        wv.uiDelegate = context.coordinator
        wv.customUserAgent = state.currentPlatform.userAgent

        if let url = URL(string: state.currentPlatform.url) {
            var req = URLRequest(url: url)
            req.setValue("vi-VN,vi;q=0.9,en;q=0.5", forHTTPHeaderField: "Accept-Language")
            wv.load(req)
        }

        context.coordinator.webView = wv
        context.coordinator.state = state
        context.coordinator.jsTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { _ in
            Task { @MainActor in wv.evaluateJavaScript(JSLoader.code) }
        }
        DispatchQueue.main.async { state.webView = wv }
        return wv
    }

    func updateNSView(_ wv: WKWebView, context: Context) {
        wv.evaluateJavaScript("window.__autoScroll=\(state.autoScrollEnabled);")
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var webView: WKWebView?
        var state: AppState?
        var jsTimer: Timer?
        private var redirectCount = 0
        private var lastRedirectTime: Date = .distantPast

        func userContentController(_ uc: WKUserContentController, didReceive msg: WKScriptMessage) {
            // scrollNext is now handled in JS via doScrollNext()
            // This handler is kept as a no-op for backward compatibility
        }

        private func isFBHome(_ url: String) -> Bool {
            let u = url.lowercased()
            return u == "https://m.facebook.com/" || u == "https://m.facebook.com"
                || u == "https://touch.facebook.com/" || u == "https://touch.facebook.com"
                || u.contains("home.php") || u == "https://www.facebook.com/"
                || u == "https://www.facebook.com"
        }
        private func isFBRedirect(_ url: String) -> Bool {
            let u = url.lowercased()
            return u.contains("?_rdr") || (u.contains("facebook.com/?") && !u.contains("/reel"))
        }

        func webView(_ wv: WKWebView, didFinish nav: WKNavigation!) {
            wv.evaluateJavaScript(JSLoader.code)
            guard let u = wv.url?.absoluteString, let state = state else { return }
            print("[RV] didFinish: \(u)")
            guard state.currentPlatform == .facebookReels else { return }
            if Date().timeIntervalSince(lastRedirectTime) > 10 { redirectCount = 0 }
            if (isFBHome(u) || isFBRedirect(u)) && redirectCount < 3 {
                redirectCount += 1; lastRedirectTime = Date()
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak wv] in
                    guard let wv else { return }
                    var req = URLRequest(url: URL(string: state.currentPlatform.url)!)
                    req.setValue("vi-VN,vi;q=0.9,en;q=0.5", forHTTPHeaderField: "Accept-Language")
                    wv.load(req)
                }
            }
        }

        func webView(_ wv: WKWebView, decidePolicyFor nav: WKNavigationAction,
                      decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
            if let url = nav.request.url?.absoluteString {
                print("[RV] decidePolicyFor: \(url)")
                if (isFBHome(url) || isFBRedirect(url)) && nav.navigationType == .linkActivated {
                    decisionHandler(.cancel); return
                }
            }
            decisionHandler(.allow)
        }

        func webView(_ wv: WKWebView, createWebViewWith c: WKWebViewConfiguration,
                      for nav: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = nav.request.url { NSWorkspace.shared.open(url) }
            return nil
        }

        func webView(_ wv: WKWebView, didFail nav: WKNavigation!, withError error: Error) {
            print("[RV] didFail: \(error.localizedDescription)")
        }

        func webView(_ wv: WKWebView, didFailProvisionalNavigation nav: WKNavigation!, withError error: Error) {
            print("[RV] didFailProvisional: \(error.localizedDescription)")
        }
    }
}
