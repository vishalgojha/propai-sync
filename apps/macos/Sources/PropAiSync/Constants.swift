import Foundation

// Stable identifier used for both the macOS LaunchAgent label and Nix-managed defaults suite.
// nix-PropAi Sync writes app defaults into this suite to survive app bundle identifier churn.
let launchdLabel = "ai.propai.mac"
let gatewayLaunchdLabel = "ai.propai.gateway"
let onboardingVersionKey = "PropAiSync.onboardingVersion"
let onboardingSeenKey = "PropAiSync.onboardingSeen"
let currentOnboardingVersion = 7
let pauseDefaultsKey = "PropAiSync.pauseEnabled"
let iconAnimationsEnabledKey = "PropAiSync.iconAnimationsEnabled"
let swabbleEnabledKey = "PropAiSync.swabbleEnabled"
let swabbleTriggersKey = "PropAiSync.swabbleTriggers"
let voiceWakeTriggerChimeKey = "PropAiSync.voiceWakeTriggerChime"
let voiceWakeSendChimeKey = "PropAiSync.voiceWakeSendChime"
let showDockIconKey = "PropAiSync.showDockIcon"
let defaultVoiceWakeTriggers = ["PropAi Sync"]
let voiceWakeMaxWords = 32
let voiceWakeMaxWordLength = 64
let voiceWakeMicKey = "PropAiSync.voiceWakeMicID"
let voiceWakeMicNameKey = "PropAiSync.voiceWakeMicName"
let voiceWakeLocaleKey = "PropAiSync.voiceWakeLocaleID"
let voiceWakeAdditionalLocalesKey = "PropAiSync.voiceWakeAdditionalLocaleIDs"
let voicePushToTalkEnabledKey = "PropAiSync.voicePushToTalkEnabled"
let talkEnabledKey = "PropAiSync.talkEnabled"
let iconOverrideKey = "PropAiSync.iconOverride"
let connectionModeKey = "PropAiSync.connectionMode"
let remoteTargetKey = "PropAiSync.remoteTarget"
let remoteIdentityKey = "PropAiSync.remoteIdentity"
let remoteProjectRootKey = "PropAiSync.remoteProjectRoot"
let remoteCliPathKey = "PropAiSync.remoteCliPath"
let canvasEnabledKey = "PropAiSync.canvasEnabled"
let cameraEnabledKey = "PropAiSync.cameraEnabled"
let systemRunPolicyKey = "PropAiSync.systemRunPolicy"
let systemRunAllowlistKey = "PropAiSync.systemRunAllowlist"
let systemRunEnabledKey = "PropAiSync.systemRunEnabled"
let locationModeKey = "PropAiSync.locationMode"
let locationPreciseKey = "PropAiSync.locationPreciseEnabled"
let peekabooBridgeEnabledKey = "PropAiSync.peekabooBridgeEnabled"
let deepLinkKeyKey = "PropAiSync.deepLinkKey"
let modelCatalogPathKey = "PropAiSync.modelCatalogPath"
let modelCatalogReloadKey = "PropAiSync.modelCatalogReload"
let cliInstallPromptedVersionKey = "PropAiSync.cliInstallPromptedVersion"
let heartbeatsEnabledKey = "PropAiSync.heartbeatsEnabled"
let debugPaneEnabledKey = "PropAiSync.debugPaneEnabled"
let debugFileLogEnabledKey = "PropAiSync.debug.fileLogEnabled"
let appLogLevelKey = "PropAiSync.debug.appLogLevel"
let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26



