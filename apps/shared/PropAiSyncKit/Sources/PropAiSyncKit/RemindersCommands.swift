import Foundation

public enum PropAiSyncRemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum PropAiSyncReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct PropAiSyncRemindersListParams: Codable, Sendable, Equatable {
    public var status: PropAiSyncReminderStatusFilter?
    public var limit: Int?

    public init(status: PropAiSyncReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct PropAiSyncRemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct PropAiSyncReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(
        identifier: String,
        title: String,
        dueISO: String? = nil,
        completed: Bool,
        listName: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct PropAiSyncRemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [PropAiSyncReminderPayload]

    public init(reminders: [PropAiSyncReminderPayload]) {
        self.reminders = reminders
    }
}

public struct PropAiSyncRemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: PropAiSyncReminderPayload

    public init(reminder: PropAiSyncReminderPayload) {
        self.reminder = reminder
    }
}


