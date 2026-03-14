import Foundation

public enum PropAiSyncChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(PropAiSyncChatEventPayload)
    case agent(PropAiSyncAgentEventPayload)
    case seqGap
}

public protocol PropAiSyncChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> PropAiSyncChatHistoryPayload
    func listModels() async throws -> [PropAiSyncChatModelChoice]
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [PropAiSyncChatAttachmentPayload]) async throws -> PropAiSyncChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> PropAiSyncChatSessionsListResponse
    func setSessionModel(sessionKey: String, model: String?) async throws
    func setSessionThinking(sessionKey: String, thinkingLevel: String) async throws

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<PropAiSyncChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
}

extension PropAiSyncChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "PropAiSyncChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> PropAiSyncChatSessionsListResponse {
        throw NSError(
            domain: "PropAiSyncChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }

    public func listModels() async throws -> [PropAiSyncChatModelChoice] {
        throw NSError(
            domain: "PropAiSyncChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "models.list not supported by this transport"])
    }

    public func setSessionModel(sessionKey _: String, model _: String?) async throws {
        throw NSError(
            domain: "PropAiSyncChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.patch(model) not supported by this transport"])
    }

    public func setSessionThinking(sessionKey _: String, thinkingLevel _: String) async throws {
        throw NSError(
            domain: "PropAiSyncChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.patch(thinkingLevel) not supported by this transport"])
    }
}


