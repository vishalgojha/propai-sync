import CoreLocation
import Foundation
import PropAiSyncKit
import UIKit

typealias PropAiSyncCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias PropAiSyncCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: PropAiSyncCameraSnapParams) async throws -> PropAiSyncCameraSnapResult
    func clip(params: PropAiSyncCameraClipParams) async throws -> PropAiSyncCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: PropAiSyncLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: PropAiSyncLocationGetParams,
        desiredAccuracy: PropAiSyncLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: PropAiSyncLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> PropAiSyncDeviceStatusPayload
    func info() -> PropAiSyncDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: PropAiSyncPhotosLatestParams) async throws -> PropAiSyncPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: PropAiSyncContactsSearchParams) async throws -> PropAiSyncContactsSearchPayload
    func add(params: PropAiSyncContactsAddParams) async throws -> PropAiSyncContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: PropAiSyncCalendarEventsParams) async throws -> PropAiSyncCalendarEventsPayload
    func add(params: PropAiSyncCalendarAddParams) async throws -> PropAiSyncCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: PropAiSyncRemindersListParams) async throws -> PropAiSyncRemindersListPayload
    func add(params: PropAiSyncRemindersAddParams) async throws -> PropAiSyncRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: PropAiSyncMotionActivityParams) async throws -> PropAiSyncMotionActivityPayload
    func pedometer(params: PropAiSyncPedometerParams) async throws -> PropAiSyncPedometerPayload
}

struct WatchMessagingStatus: Sendable, Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Sendable, Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Sendable, Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: PropAiSyncWatchNotifyParams) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}


