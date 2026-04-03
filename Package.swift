// swift-tools-version:6.0
import PackageDescription

let package = Package(
    name: "RiuViewer",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "RiuViewer",
            path: "Sources",
            exclude: ["Info.plist"],
            resources: [
                .copy("RiuViewer.js")
            ],
            swiftSettings: [
                .unsafeFlags(["-parse-as-library"])
            ]
        )
    ]
)
