import Foundation

public enum PropAiSyncCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum PropAiSyncCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum PropAiSyncCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum PropAiSyncCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct PropAiSyncCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: PropAiSyncCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: PropAiSyncCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: PropAiSyncCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: PropAiSyncCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct PropAiSyncCameraClipParams: Codable, Sendable, Equatable {
    public var facing: PropAiSyncCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: PropAiSyncCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: PropAiSyncCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: PropAiSyncCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}


