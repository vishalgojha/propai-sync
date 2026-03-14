import Foundation

public enum PropAiSyncNodeStorage {
    public static func appSupportDir() throws -> URL {
        let base = FileManager().urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        guard let base else {
            throw NSError(domain: "PropAiSyncNodeStorage", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "Application Support directory unavailable",
            ])
        }
        return base.appendingPathComponent("PropAi Sync", isDirectory: true)
    }

    public static func canvasRoot(sessionKey: String) throws -> URL {
        let root = try appSupportDir().appendingPathComponent("canvas", isDirectory: true)
        let safe = sessionKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let session = safe.isEmpty ? "main" : safe
        return root.appendingPathComponent(session, isDirectory: true)
    }

    public static func cachesDir() throws -> URL {
        let base = FileManager().urls(for: .cachesDirectory, in: .userDomainMask).first
        guard let base else {
            throw NSError(domain: "PropAiSyncNodeStorage", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "Caches directory unavailable",
            ])
        }
        return base.appendingPathComponent("PropAi Sync", isDirectory: true)
    }

    public static func canvasSnapshotsRoot(sessionKey: String) throws -> URL {
        let root = try cachesDir().appendingPathComponent("canvas-snapshots", isDirectory: true)
        let safe = sessionKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let session = safe.isEmpty ? "main" : safe
        return root.appendingPathComponent(session, isDirectory: true)
    }
}


