import ActivityKit
import Foundation

/// Shared schema used by iOS app + Live Activity widget extension.
struct PropAiSyncActivityAttributes: ActivityAttributes {
    var agentName: String
    var sessionKey: String

    struct ContentState: Codable, Hashable {
        var statusText: String
        var isIdle: Bool
        var isDisconnected: Bool
        var isConnecting: Bool
        var startedAt: Date
    }
}

#if DEBUG
extension PropAiSyncActivityAttributes {
    static let preview = PropAiSyncActivityAttributes(agentName: "main", sessionKey: "main")
}

extension PropAiSyncActivityAttributes.ContentState {
    static let connecting = PropAiSyncActivityAttributes.ContentState(
        statusText: "Connecting...",
        isIdle: false,
        isDisconnected: false,
        isConnecting: true,
        startedAt: .now)

    static let idle = PropAiSyncActivityAttributes.ContentState(
        statusText: "Idle",
        isIdle: true,
        isDisconnected: false,
        isConnecting: false,
        startedAt: .now)

    static let disconnected = PropAiSyncActivityAttributes.ContentState(
        statusText: "Disconnected",
        isIdle: false,
        isDisconnected: true,
        isConnecting: false,
        startedAt: .now)
}
#endif


