// swift-tools-version: 6.2
// Package manifest for the PropAi Sync macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "PropAi Sync",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "PropAiSyncIPC", targets: ["PropAiSyncIPC"]),
        .library(name: "PropAiSyncDiscovery", targets: ["PropAiSyncDiscovery"]),
        .executable(name: "PropAi Sync", targets: ["PropAi Sync"]),
        .executable(name: "propai-mac", targets: ["PropAiSyncMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/PropAiSyncKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "PropAiSyncIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "PropAiSyncDiscovery",
            dependencies: [
                .product(name: "PropAiSyncKit", package: "PropAiSyncKit"),
            ],
            path: "Sources/PropAiSyncDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "PropAi Sync",
            dependencies: [
                "PropAiSyncIPC",
                "PropAiSyncDiscovery",
                .product(name: "PropAiSyncKit", package: "PropAiSyncKit"),
                .product(name: "PropAiSyncChatUI", package: "PropAiSyncKit"),
                .product(name: "PropAiSyncProtocol", package: "PropAiSyncKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/PropAiSync.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "PropAiSyncMacCLI",
            dependencies: [
                "PropAiSyncDiscovery",
                .product(name: "PropAiSyncKit", package: "PropAiSyncKit"),
                .product(name: "PropAiSyncProtocol", package: "PropAiSyncKit"),
            ],
            path: "Sources/PropAiSyncMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "PropAiSyncIPCTests",
            dependencies: [
                "PropAiSyncIPC",
                "PropAi Sync",
                "PropAiSyncDiscovery",
                .product(name: "PropAiSyncProtocol", package: "PropAiSyncKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])




