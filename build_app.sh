#!/bin/bash
set -e

APP_NAME="RiuViewer"
APP_DIR="$APP_NAME.app/Contents"

# Build
swift build

# Create .app bundle
rm -rf "$APP_NAME.app"
mkdir -p "$APP_DIR/MacOS"
mkdir -p "$APP_DIR/Resources"

# Copy binary
cp .build/debug/$APP_NAME "$APP_DIR/MacOS/$APP_NAME"

# Copy JS resource bundle
if [ -d ".build/debug/RiuViewer_RiuViewer.bundle" ]; then
    cp -r ".build/debug/RiuViewer_RiuViewer.bundle" "$APP_DIR/Resources/"
fi

# Also copy JS directly as fallback
cp Sources/RiuViewer.js "$APP_DIR/Resources/RiuViewer.js"

# Create Info.plist
cat > "$APP_DIR/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>RiuViewer</string>
    <key>CFBundleIdentifier</key>
    <string>com.local.RiuViewer</string>
    <key>CFBundleName</key>
    <string>RiuViewer</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleVersion</key>
    <string>3.0</string>
    <key>CFBundleShortVersionString</key>
    <string>3.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <true/>
    </dict>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
</dict>
</plist>
EOF

# Remove macOS resource fork files that break codesign
find "$APP_NAME.app" -name '._*' -delete 2>/dev/null || true
dot_clean "$APP_NAME.app" 2>/dev/null || true

# Sign with entitlements for network access
codesign --force --sign - --entitlements RiuViewer.entitlements "$APP_NAME.app"

echo "Built $APP_NAME.app v3.0 successfully"
echo ""
echo "Press H in-app for full keyboard shortcuts"
echo "Run: open $APP_NAME.app"
