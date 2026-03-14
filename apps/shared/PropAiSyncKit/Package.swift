// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "PropAiSyncKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "PropAiSyncProtocol", targets: ["PropAiSyncProtocol"]),
        .library(name: "PropAiSyncKit", targets: ["PropAiSyncKit"]),
        .library(name: "PropAiSyncChatUI", targets: ["PropAiSyncChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "PropAiSyncProtocol",
            path: "Sources/PropAiSyncProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "PropAiSyncKit",
            dependencies: [
                "PropAiSyncProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/PropAiSyncKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "PropAiSyncChatUI",
            dependencies: [
                "PropAiSyncKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/PropAiSyncChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "PropAiSyncKitTests",
            dependencies: ["PropAiSyncKit", "PropAiSyncChatUI"],
            path: "Tests/PropAiSyncKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])


