import Foundation

public enum PropAiSyncDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum PropAiSyncBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum PropAiSyncThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum PropAiSyncNetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum PropAiSyncNetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct PropAiSyncBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: PropAiSyncBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: PropAiSyncBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct PropAiSyncThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: PropAiSyncThermalState

    public init(state: PropAiSyncThermalState) {
        self.state = state
    }
}

public struct PropAiSyncStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct PropAiSyncNetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: PropAiSyncNetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [PropAiSyncNetworkInterfaceType]

    public init(
        status: PropAiSyncNetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [PropAiSyncNetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct PropAiSyncDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: PropAiSyncBatteryStatusPayload
    public var thermal: PropAiSyncThermalStatusPayload
    public var storage: PropAiSyncStorageStatusPayload
    public var network: PropAiSyncNetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: PropAiSyncBatteryStatusPayload,
        thermal: PropAiSyncThermalStatusPayload,
        storage: PropAiSyncStorageStatusPayload,
        network: PropAiSyncNetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct PropAiSyncDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}


