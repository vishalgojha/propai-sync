import { LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { i18n, I18nController, isSupportedLocale } from "../i18n/index.ts";
import {
  handleChannelConfigReload as handleChannelConfigReloadInternal,
  handleChannelConfigSave as handleChannelConfigSaveInternal,
  handleNostrProfileCancel as handleNostrProfileCancelInternal,
  handleNostrProfileEdit as handleNostrProfileEditInternal,
  handleNostrProfileFieldChange as handleNostrProfileFieldChangeInternal,
  handleNostrProfileImport as handleNostrProfileImportInternal,
  handleNostrProfileSave as handleNostrProfileSaveInternal,
  handleNostrProfileToggleAdvanced as handleNostrProfileToggleAdvancedInternal,
  handleWhatsAppLogout as handleWhatsAppLogoutInternal,
  handleWhatsAppStart as handleWhatsAppStartInternal,
  handleWhatsAppWait as handleWhatsAppWaitInternal,
} from "./app-channels.ts";
import {
  handleAbortChat as handleAbortChatInternal,
  handleSendChat as handleSendChatInternal,
  removeQueuedMessage as removeQueuedMessageInternal,
} from "./app-chat.ts";
import { DEFAULT_CRON_FORM, DEFAULT_LOG_LEVEL_FILTERS } from "./app-defaults.ts";
import type { EventLogEntry } from "./app-events.ts";
import { connectGateway as connectGatewayInternal } from "./app-gateway.ts";
import {
  handleConnected,
  handleDisconnected,
  handleFirstUpdated,
  handleUpdated,
} from "./app-lifecycle.ts";
import { renderApp } from "./app-render.ts";
import {
  exportLogs as exportLogsInternal,
  handleChatScroll as handleChatScrollInternal,
  handleLogsScroll as handleLogsScrollInternal,
  resetChatScroll as resetChatScrollInternal,
  scheduleChatScroll as scheduleChatScrollInternal,
} from "./app-scroll.ts";
import {
  applySettings as applySettingsInternal,
  loadCron as loadCronInternal,
  loadOverview as loadOverviewInternal,
  setTab as setTabInternal,
  setTheme as setThemeInternal,
  setThemeMode as setThemeModeInternal,
  onPopState as onPopStateInternal,
  applyResolvedTheme as applyResolvedThemeInternal,
  syncThemeWithSettings as syncThemeWithSettingsInternal,
} from "./app-settings.ts";
import {
  resetToolStream as resetToolStreamInternal,
  type ToolStreamEntry,
  type CompactionStatus,
  type FallbackStatus,
} from "./app-tool-stream.ts";
import type { AppViewState } from "./app-view-state.ts";
import { normalizeAssistantIdentity } from "./assistant-identity.ts";
import { loadAssistantIdentity as loadAssistantIdentityInternal } from "./controllers/assistant-identity.ts";
import type { CronFieldErrors } from "./controllers/cron.ts";
import type { DevicePairingList } from "./controllers/devices.ts";
import type { ExecApprovalRequest } from "./controllers/exec-approval.ts";
import type { ExecApprovalsFile, ExecApprovalsSnapshot } from "./controllers/exec-approvals.ts";
import type { SkillMessage } from "./controllers/skills.ts";
import type { GatewayBrowserClient, GatewayHelloOk } from "./gateway.ts";
import type { WizardNextResult, WizardStartResult, WizardStep } from "../../../src/gateway/protocol/index.js";
import {
  resolveOnboardingWizardPreset,
  resolveOnboardingWizardPresetId,
  type OnboardingWizardPresetId,
} from "./onboarding-presets.ts";
import type { Tab } from "./navigation.ts";
import { loadSettings, type UiSettings } from "./storage.ts";
import { resolveTheme } from "./theme.ts";
import type { ResolvedTheme, ThemeMode, ThemeName } from "./theme.ts";
import type {
  AgentsListResult,
  AgentsFilesListResult,
  AgentIdentityResult,
  ConfigSnapshot,
  ConfigUiHints,
  CronJob,
  CronRunLogEntry,
  CronStatus,
  HealthSnapshot,
  LogEntry,
  LogLevel,
  PresenceEntry,
  ChannelsStatusSnapshot,
  SessionsListResult,
  SkillStatusReport,
  ToolsCatalogResult,
  StatusSummary,
  NostrProfile,
} from "./types.ts";
import { type ChatAttachment, type ChatQueueItem, type CronFormState } from "./ui-types.ts";
import { generateUUID } from "./uuid.ts";
import { restartDesktopGateway } from "./desktop/gateway.ts";
import { isTauriRuntime } from "./desktop/tauri.ts";
import type { NostrProfileFormState } from "./views/channels.nostr-profile-form.ts";
import {
  getOrCreateLicenseDeviceId,
  isEntitlementValid,
  loadLicenseApiUrl,
  loadLicenseCache,
  loadLicenseToken,
  saveLicenseApiUrl,
  saveLicenseCache,
  saveLicenseToken,
  verifyLicenseToken,
  type LicenseEntitlement,
  type LicenseStatus,
} from "./license.ts";

declare global {
  interface Window {
    __PROPAI_CONTROL_UI_BASE_PATH__?: string;
  }
}

const bootAssistantIdentity = normalizeAssistantIdentity({});
const DESKTOP_ONBOARDING_DONE_KEY = "PropAiSync.desktop.onboarding.done";
const TAURI_ONBOARDING_OPEN_EVENT = "PropAi Sync:onboarding-open";
const TAURI_GATEWAY_RESTART_EVENT = "PropAi Sync:gateway-restart";
const BRAND_NAME = "propai";

function applyBrandTheme() {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.brand = BRAND_NAME;
}

function readDesktopOnboardingDoneFlag(): boolean {
  try {
    if (typeof window === "undefined") {
      return false;
    }
    const value = window.localStorage?.getItem(DESKTOP_ONBOARDING_DONE_KEY);
    return value === "1" || value === "true";
  } catch {
    return false;
  }
}

function writeDesktopOnboardingDoneFlag() {
  try {
    window.localStorage?.setItem(DESKTOP_ONBOARDING_DONE_KEY, "1");
  } catch {
    // ignore
  }
}

function resolveDesktopOnboardingMode(): boolean {
  if (!isTauriRuntime()) {
    return false;
  }
  // If explicitly requested via URL, always honor it.
  if (resolveOnboardingMode()) {
    return true;
  }
  // Otherwise, show onboarding on first run until completed.
  return !readDesktopOnboardingDoneFlag();
}


function resolveOnboardingPresetId(): OnboardingWizardPresetId {
  if (!window.location.search) {
    return resolveOnboardingWizardPresetId("none");
  }
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("preset") ?? params.get("onboardingPreset") ?? "";
  return resolveOnboardingWizardPresetId(raw);
}

function resolveOnboardingAutoAdvance(): boolean {
  if (!window.location.search) {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("auto") ?? params.get("autoAdvance") ?? "";
  if (!raw) {
    return true;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
function resolveOnboardingMode(): boolean {
  if (!window.location.search) {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("onboarding");
  if (!raw) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

@customElement("propai-app")
export class PropAiSyncApp extends LitElement {
  private i18nController = new I18nController(this);
  clientInstanceId = generateUUID();
  connectGeneration = 0;
  @state() settings: UiSettings = loadSettings();
  constructor() {
    super();
    if (isSupportedLocale(this.settings.locale)) {
      void i18n.setLocale(this.settings.locale);
    }
  }
  @state() password = "";
  @state() tab: Tab = "chat";
  @state() onboarding = resolveOnboardingMode() || resolveDesktopOnboardingMode();
  @state() onboardingWizardBusy = false;
  @state() onboardingWizardError: string | null = null;
  @state() onboardingWizardSessionId: string | null = null;
  @state() onboardingWizardStatus: string | null = null;
  @state() onboardingWizardStep: WizardStep | null = null;
  @state() onboardingWizardDraft: unknown = null;
  @state() onboardingWizardDraftTouched = false;
  @state() onboardingWizardPresetId: OnboardingWizardPresetId = resolveOnboardingPresetId();
  @state() onboardingWizardAutoAdvance = resolveOnboardingAutoAdvance();
  @state() licenseToken = loadLicenseToken();
  @state() licenseApiUrl = loadLicenseApiUrl();
  @state() licenseStatus: LicenseStatus = "unknown";
  @state() licenseError: string | null = null;
  @state() licenseEntitlement: LicenseEntitlement | null = loadLicenseCache();
  @state() licenseBusy = false;
  @state() licenseGateActive = !isEntitlementValid(this.licenseEntitlement);
  @state() connected = false;
  @state() theme: ThemeName = this.settings.theme;
  @state() themeMode: ThemeMode = this.settings.themeMode;
  @state() themeResolved: ResolvedTheme = "dark";
  @state() hello: GatewayHelloOk | null = null;
  @state() lastError: string | null = null;
  @state() lastErrorCode: string | null = null;
  @state() eventLog: EventLogEntry[] = [];
  private eventLogBuffer: EventLogEntry[] = [];
  private toolStreamSyncTimer: number | null = null;
  private sidebarCloseTimer: number | null = null;

  @state() assistantName = bootAssistantIdentity.name;
  @state() assistantAvatar = bootAssistantIdentity.avatar;
  @state() assistantAgentId = bootAssistantIdentity.agentId ?? null;
  @state() serverVersion: string | null = null;

  @state() sessionKey = this.settings.sessionKey;
  @state() chatLoading = false;
  @state() chatSending = false;
  @state() chatMessage = "";
  @state() chatMessages: unknown[] = [];
  @state() chatToolMessages: unknown[] = [];
  @state() chatStreamSegments: Array<{ text: string; ts: number }> = [];
  @state() chatStream: string | null = null;
  @state() chatStreamStartedAt: number | null = null;
  @state() chatRunId: string | null = null;
  @state() compactionStatus: CompactionStatus | null = null;
  @state() fallbackStatus: FallbackStatus | null = null;
  @state() chatAvatarUrl: string | null = null;
  @state() chatThinkingLevel: string | null = null;
  @state() chatQueue: ChatQueueItem[] = [];
  @state() chatAttachments: ChatAttachment[] = [];
  @state() chatManualRefreshInFlight = false;
  // Sidebar state for tool output viewing
  @state() sidebarOpen = false;
  @state() sidebarContent: string | null = null;
  @state() sidebarError: string | null = null;
  @state() splitRatio = this.settings.splitRatio;

  @state() nodesLoading = false;
  @state() nodes: Array<Record<string, unknown>> = [];
  @state() devicesLoading = false;
  @state() devicesError: string | null = null;
  @state() devicesList: DevicePairingList | null = null;
  @state() execApprovalsLoading = false;
  @state() execApprovalsSaving = false;
  @state() execApprovalsDirty = false;
  @state() execApprovalsSnapshot: ExecApprovalsSnapshot | null = null;
  @state() execApprovalsForm: ExecApprovalsFile | null = null;
  @state() execApprovalsSelectedAgent: string | null = null;
  @state() execApprovalsTarget: "gateway" | "node" = "gateway";
  @state() execApprovalsTargetNodeId: string | null = null;
  @state() execApprovalQueue: ExecApprovalRequest[] = [];
  @state() execApprovalBusy = false;
  @state() execApprovalError: string | null = null;
  @state() pendingGatewayUrl: string | null = null;
  pendingGatewayToken: string | null = null;

  @state() configLoading = false;
  @state() configRaw = "{\\n}\\n";
  @state() configRawOriginal = "";
  @state() configValid: boolean | null = null;
  @state() configIssues: unknown[] = [];
  @state() configSaving = false;
  @state() configApplying = false;
  @state() updateRunning = false;
  @state() applySessionKey = this.settings.lastActiveSessionKey;
  @state() configSnapshot: ConfigSnapshot | null = null;
  @state() configSchema: unknown = null;
  @state() configSchemaVersion: string | null = null;
  @state() configSchemaLoading = false;
  @state() configUiHints: ConfigUiHints = {};
  @state() configForm: Record<string, unknown> | null = null;
  @state() configFormOriginal: Record<string, unknown> | null = null;
  @state() configFormDirty = false;
  @state() configFormMode: "form" | "raw" = "form";
  @state() configSearchQuery = "";
  @state() configActiveSection: string | null = null;
  @state() configActiveSubsection: string | null = null;

  @state() channelsLoading = false;
  @state() channelsSnapshot: ChannelsStatusSnapshot | null = null;
  @state() channelsError: string | null = null;
  @state() channelsLastSuccess: number | null = null;
  @state() whatsappLoginMessage: string | null = null;
  @state() whatsappLoginQrDataUrl: string | null = null;
  @state() whatsappLoginConnected: boolean | null = null;
  @state() whatsappBusy = false;
  @state() nostrProfileFormState: NostrProfileFormState | null = null;
  @state() nostrProfileAccountId: string | null = null;

  @state() presenceLoading = false;
  @state() presenceEntries: PresenceEntry[] = [];
  @state() presenceError: string | null = null;
  @state() presenceStatus: string | null = null;

  @state() agentsLoading = false;
  @state() agentsList: AgentsListResult | null = null;
  @state() agentsError: string | null = null;
  @state() agentsSelectedId: string | null = null;
  @state() toolsCatalogLoading = false;
  @state() toolsCatalogError: string | null = null;
  @state() toolsCatalogResult: ToolsCatalogResult | null = null;
  @state() agentsPanel: "overview" | "files" | "tools" | "skills" | "channels" | "cron" =
    "overview";
  @state() agentFilesLoading = false;
  @state() agentFilesError: string | null = null;
  @state() agentFilesList: AgentsFilesListResult | null = null;
  @state() agentFileContents: Record<string, string> = {};
  @state() agentFileDrafts: Record<string, string> = {};
  @state() agentFileActive: string | null = null;
  @state() agentFileSaving = false;
  @state() agentIdentityLoading = false;
  @state() agentIdentityError: string | null = null;
  @state() agentIdentityById: Record<string, AgentIdentityResult> = {};
  @state() agentSkillsLoading = false;
  @state() agentSkillsError: string | null = null;
  @state() agentSkillsReport: SkillStatusReport | null = null;
  @state() agentSkillsAgentId: string | null = null;

  @state() sessionsLoading = false;
  @state() sessionsResult: SessionsListResult | null = null;
  @state() sessionsError: string | null = null;
  @state() sessionsFilterActive = "";
  @state() sessionsFilterLimit = "120";
  @state() sessionsIncludeGlobal = true;
  @state() sessionsIncludeUnknown = false;
  @state() sessionsHideCron = true;

  @state() usageLoading = false;
  @state() usageResult: import("./types.js").SessionsUsageResult | null = null;
  @state() usageCostSummary: import("./types.js").CostUsageSummary | null = null;
  @state() usageError: string | null = null;
  @state() usageStartDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  @state() usageEndDate = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  @state() usageSelectedSessions: string[] = [];
  @state() usageSelectedDays: string[] = [];
  @state() usageSelectedHours: number[] = [];
  @state() usageChartMode: "tokens" | "cost" = "tokens";
  @state() usageDailyChartMode: "total" | "by-type" = "by-type";
  @state() usageTimeSeriesMode: "cumulative" | "per-turn" = "per-turn";
  @state() usageTimeSeriesBreakdownMode: "total" | "by-type" = "by-type";
  @state() usageTimeSeries: import("./types.js").SessionUsageTimeSeries | null = null;
  @state() usageTimeSeriesLoading = false;
  @state() usageTimeSeriesCursorStart: number | null = null;
  @state() usageTimeSeriesCursorEnd: number | null = null;
  @state() usageSessionLogs: import("./views/usage.js").SessionLogEntry[] | null = null;
  @state() usageSessionLogsLoading = false;
  @state() usageSessionLogsExpanded = false;
  // Applied query (used to filter the already-loaded sessions list client-side).
  @state() usageQuery = "";
  // Draft query text (updates immediately as the user types; applied via debounce or "Search").
  @state() usageQueryDraft = "";
  @state() usageSessionSort: "tokens" | "cost" | "recent" | "messages" | "errors" = "recent";
  @state() usageSessionSortDir: "desc" | "asc" = "desc";
  @state() usageRecentSessions: string[] = [];
  @state() usageTimeZone: "local" | "utc" = "local";
  @state() usageContextExpanded = false;
  @state() usageHeaderPinned = false;
  @state() usageSessionsTab: "all" | "recent" = "all";
  @state() usageVisibleColumns: string[] = [
    "channel",
    "agent",
    "provider",
    "model",
    "messages",
    "tools",
    "errors",
    "duration",
  ];
  @state() usageLogFilterRoles: import("./views/usage.js").SessionLogRole[] = [];
  @state() usageLogFilterTools: string[] = [];
  @state() usageLogFilterHasTools = false;
  @state() usageLogFilterQuery = "";

  // Non-reactive (don’t trigger renders just for timer bookkeeping).
  usageQueryDebounceTimer: number | null = null;

  @state() cronLoading = false;
  @state() cronJobsLoadingMore = false;
  @state() cronJobs: CronJob[] = [];
  @state() cronJobsTotal = 0;
  @state() cronJobsHasMore = false;
  @state() cronJobsNextOffset: number | null = null;
  @state() cronJobsLimit = 50;
  @state() cronJobsQuery = "";
  @state() cronJobsEnabledFilter: import("./types.js").CronJobsEnabledFilter = "all";
  @state() cronJobsScheduleKindFilter: import("./controllers/cron.js").CronJobsScheduleKindFilter =
    "all";
  @state() cronJobsLastStatusFilter: import("./controllers/cron.js").CronJobsLastStatusFilter =
    "all";
  @state() cronJobsSortBy: import("./types.js").CronJobsSortBy = "nextRunAtMs";
  @state() cronJobsSortDir: import("./types.js").CronSortDir = "asc";
  @state() cronStatus: CronStatus | null = null;
  @state() cronError: string | null = null;
  @state() cronForm: CronFormState = { ...DEFAULT_CRON_FORM };
  @state() cronFieldErrors: CronFieldErrors = {};
  @state() cronEditingJobId: string | null = null;
  @state() cronRunsJobId: string | null = null;
  @state() cronRunsLoadingMore = false;
  @state() cronRuns: CronRunLogEntry[] = [];
  @state() cronRunsTotal = 0;
  @state() cronRunsHasMore = false;
  @state() cronRunsNextOffset: number | null = null;
  @state() cronRunsLimit = 50;
  @state() cronRunsScope: import("./types.js").CronRunScope = "all";
  @state() cronRunsStatuses: import("./types.js").CronRunsStatusValue[] = [];
  @state() cronRunsDeliveryStatuses: import("./types.js").CronDeliveryStatus[] = [];
  @state() cronRunsStatusFilter: import("./types.js").CronRunsStatusFilter = "all";
  @state() cronRunsQuery = "";
  @state() cronRunsSortDir: import("./types.js").CronSortDir = "desc";
  @state() cronModelSuggestions: string[] = [];
  @state() cronBusy = false;

  @state() updateAvailable: import("./types.js").UpdateAvailable | null = null;

  @state() skillsLoading = false;
  @state() skillsReport: SkillStatusReport | null = null;
  @state() skillsError: string | null = null;
  @state() skillsFilter = "";
  @state() skillEdits: Record<string, string> = {};
  @state() skillsBusyKey: string | null = null;
  @state() skillMessages: Record<string, SkillMessage> = {};

  @state() debugLoading = false;
  @state() debugStatus: StatusSummary | null = null;
  @state() debugHealth: HealthSnapshot | null = null;
  @state() debugModels: unknown[] = [];
  @state() debugHeartbeat: unknown = null;
  @state() debugCallMethod = "";
  @state() debugCallParams = "{}";
  @state() debugCallResult: string | null = null;
  @state() debugCallError: string | null = null;

  @state() logsLoading = false;
  @state() logsError: string | null = null;
  @state() logsFile: string | null = null;
  @state() logsEntries: LogEntry[] = [];
  @state() logsFilterText = "";
  @state() logsLevelFilters: Record<LogLevel, boolean> = {
    ...DEFAULT_LOG_LEVEL_FILTERS,
  };
  @state() logsAutoFollow = true;
  @state() logsTruncated = false;
  @state() logsCursor: number | null = null;
  @state() logsLastFetchAt: number | null = null;
  @state() logsLimit = 500;
  @state() logsMaxBytes = 250_000;
  @state() logsAtBottom = true;

  client: GatewayBrowserClient | null = null;
  private chatScrollFrame: number | null = null;
  private chatScrollTimeout: number | null = null;
  private chatHasAutoScrolled = false;
  private chatUserNearBottom = true;
  @state() chatNewMessagesBelow = false;
  private nodesPollInterval: number | null = null;
  private logsPollInterval: number | null = null;
  private debugPollInterval: number | null = null;
  private logsScrollFrame: number | null = null;
  private toolStreamById = new Map<string, ToolStreamEntry>();
  private toolStreamOrder: string[] = [];
  refreshSessionsAfterChat = new Set<string>();
  basePath = "";
  private popStateHandler = () =>
    onPopStateInternal(this as unknown as Parameters<typeof onPopStateInternal>[0]);
  private themeMedia: MediaQueryList | null = null;
  private themeMediaHandler: ((event: MediaQueryListEvent) => void) | null = null;
  private topbarObserver: ResizeObserver | null = null;
  private tauriUnlistenOnboardingOpen: (() => void) | null = null;
  private tauriUnlistenGatewayRestart: (() => void) | null = null;
  private licenseDeviceId = getOrCreateLicenseDeviceId();
  private appStarted = false;

  createRenderRoot() {
    return this;
  }
  private async ensureTauriMenuListeners() {
    if (!isTauriRuntime()) {
      return;
    }
    try {
      const mod = (await import("@tauri-apps/api/event")) as {
        listen: (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>;
      };
      if (!this.tauriUnlistenOnboardingOpen) {
        this.tauriUnlistenOnboardingOpen = await mod.listen(TAURI_ONBOARDING_OPEN_EVENT, () => {
          this.enterOnboardingMode();
        });
      }
      if (!this.tauriUnlistenGatewayRestart) {
        this.tauriUnlistenGatewayRestart = await mod.listen(TAURI_GATEWAY_RESTART_EVENT, () => {
          void this.restartDesktopGateway();
        });
      }
    } catch {
      // ignore
    }
  }

  private startAppIfLicensed() {
    if (this.appStarted) {
      return;
    }
    if (this.licenseGateActive) {
      return;
    }
    this.appStarted = true;
    handleConnected(this as unknown as Parameters<typeof handleConnected>[0]);
  }

  private updateLicenseGate() {
    const valid = isEntitlementValid(this.licenseEntitlement);
    this.licenseGateActive = !valid;
    if (valid) {
      this.licenseStatus = this.licenseEntitlement?.status ?? "active";
    }
    this.startAppIfLicensed();
  }

  private async bootstrapLicense() {
    this.licenseApiUrl = loadLicenseApiUrl();
    if (this.licenseEntitlement && isEntitlementValid(this.licenseEntitlement)) {
      this.licenseStatus = this.licenseEntitlement.status;
      this.updateLicenseGate();
    }
    if (!this.licenseToken.trim()) {
      return;
    }
    await this.submitLicenseToken({ silent: true });
  }

  async submitLicenseToken(opts: { silent?: boolean } = {}) {
    const token = this.licenseToken.trim();
    if (!token) {
      if (!opts.silent) {
        this.licenseError = "Enter a license token to continue.";
      }
      return;
    }
    this.licenseBusy = true;
    this.licenseError = null;
    this.licenseStatus = "checking";
    try {
      const result = await verifyLicenseToken({
        apiUrl: this.licenseApiUrl,
        token,
        deviceId: this.licenseDeviceId,
        appVersion: this.hello?.server?.version ?? null,
      });
      if (!result.ok) {
        this.licenseStatus = result.status === "expired" ? "expired" : "invalid";
        if (!opts.silent) {
          this.licenseError = result.message ?? "License verification failed.";
        }
        return;
      }
      const entitlement: LicenseEntitlement = {
        status: result.status,
        plan: result.plan ?? null,
        trialEndsAt: result.trialEndsAt ?? null,
        expiresAt: result.expiresAt ?? null,
        graceEndsAt: result.graceEndsAt ?? null,
        features: result.features ?? [],
        issuedAt: result.issuedAt ?? null,
      };
      this.licenseEntitlement = entitlement;
      this.licenseStatus = entitlement.status;
      saveLicenseToken(token);
      saveLicenseCache(entitlement);
      this.licenseError = null;
      this.updateLicenseGate();
    } catch (err) {
      this.licenseStatus = "invalid";
      if (!opts.silent) {
        const message = err instanceof Error ? err.message : String(err);
        this.licenseError = message || "License verification failed.";
      }
    } finally {
      this.licenseBusy = false;
    }
  }

  handleLicenseTokenInput(value: string) {
    this.licenseToken = value;
    if (this.licenseError) {
      this.licenseError = null;
    }
  }

  handleLicenseApiInput(value: string) {
    this.licenseApiUrl = value;
    saveLicenseApiUrl(value);
  }

  connectedCallback() {
    super.connectedCallback();
    applyBrandTheme();
    if (this.licenseGateActive) {
      applyResolvedThemeInternal(this, resolveTheme("knot", "dark"));
    } else {
      this.startAppIfLicensed();
    }
    if (this.onboarding) {
      applyResolvedThemeInternal(this, resolveTheme(this.theme, "dark"));
    }
    void this.ensureTauriMenuListeners();
  }

  protected firstUpdated() {
    handleFirstUpdated(this as unknown as Parameters<typeof handleFirstUpdated>[0]);
    void this.bootstrapLicense();
  }

  disconnectedCallback() {
    this.tauriUnlistenOnboardingOpen?.();
    this.tauriUnlistenOnboardingOpen = null;
    this.tauriUnlistenGatewayRestart?.();
    this.tauriUnlistenGatewayRestart = null;
    handleDisconnected(this as unknown as Parameters<typeof handleDisconnected>[0]);
    super.disconnectedCallback();
  }

  protected updated(changed: Map<PropertyKey, unknown>) {
    handleUpdated(this as unknown as Parameters<typeof handleUpdated>[0], changed);
    if (changed.has("licenseGateActive")) {
      if (this.licenseGateActive) {
        applyResolvedThemeInternal(this, resolveTheme("knot", "dark"));
      } else if (!this.onboarding) {
        syncThemeWithSettingsInternal(this);
      }
    }
    if (changed.has("onboarding")) {
      if (this.onboarding) {
        applyResolvedThemeInternal(this, resolveTheme(this.theme, "dark"));
      } else {
        syncThemeWithSettingsInternal(this);
      }
    }
  }

  connect() {
    connectGatewayInternal(this as unknown as Parameters<typeof connectGatewayInternal>[0]);
  }

  async restartDesktopGateway() {
    await restartDesktopGateway(this);
    this.connect();
  }
  handleOnboardingPresetChange(value: OnboardingWizardPresetId) {
    this.onboardingWizardPresetId = value;
  }

  handleOnboardingAutoAdvanceChange(value: boolean) {
    this.onboardingWizardAutoAdvance = value;
  }

  private findWizardOptionValue(step: WizardStep, desired: string): unknown | undefined {
    const options = Array.isArray(step.options) ? step.options : [];
    for (const opt of options) {
      if (opt.value === desired) {
        return opt.value;
      }
      if (String(opt.value) === desired) {
        return opt.value;
      }
    }
    return undefined;
  }

  private resolvePresetValueForStep(step: WizardStep): unknown | undefined {
    const preset = resolveOnboardingWizardPreset(this.onboardingWizardPresetId);
    if (preset.id === "none") {
      return undefined;
    }

    const message = typeof step.message === "string" ? step.message.trim() : "";
    if (step.type !== "select" || !message) {
      return undefined;
    }

    if (message === "Model/auth provider" && preset.providerGroup) {
      return this.findWizardOptionValue(step, preset.providerGroup);
    }

    if (message.endsWith(" auth method") && preset.authChoice) {
      return this.findWizardOptionValue(step, preset.authChoice);
    }

    if (message === "Filter models by provider" && preset.model) {
      const provider = preset.model.split("/")[0] ?? "";
      return provider ? this.findWizardOptionValue(step, provider) : undefined;
    }

    if (message.startsWith("Default model") && preset.model) {
      return this.findWizardOptionValue(step, preset.model);
    }

    return undefined;
  }

  private applyOnboardingWizardPresetToStep() {
    const step = this.onboardingWizardStep;
    if (!step) {
      return;
    }
    if (this.onboardingWizardDraftTouched) {
      return;
    }
    const desired = this.resolvePresetValueForStep(step);
    if (desired === undefined) {
      return;
    }
    this.onboardingWizardDraft = desired;
  }

  private async driveOnboardingWizardPresetSteps() {
    if (!this.onboardingWizardAutoAdvance) {
      return;
    }
    const preset = resolveOnboardingWizardPreset(this.onboardingWizardPresetId);
    if (preset.id === "none") {
      return;
    }

    let guard = 0;
    while (guard++ < 15) {
      const sessionId = this.onboardingWizardSessionId;
      const step = this.onboardingWizardStep;
      if (!sessionId || !step || !this.client) {
        return;
      }

      const desired = this.resolvePresetValueForStep(step);
      if (desired === undefined) {
        return;
      }

      this.onboardingWizardDraft = desired;

      const result = await this.client.request<WizardNextResult>("wizard.next", {
        sessionId,
        answer: {
          stepId: step.id,
          value: desired,
        },
      });

      this.onboardingWizardStatus = result.status ?? null;
      this.onboardingWizardStep = (result.step as WizardStep | undefined) ?? null;
      this.onboardingWizardDraft = this.onboardingWizardStep?.initialValue ?? null;
      this.onboardingWizardDraftTouched = false;

      if (result.done) {
        this.onboardingWizardSessionId = null;
        this.onboardingWizardStep = null;
        this.onboardingWizardDraft = null;
      this.onboardingWizardDraftTouched = false;
        return;
      }

      this.applyOnboardingWizardPresetToStep();
    }
  }

  async startOnboardingWizard() {
    if (this.onboardingWizardBusy) {
      return;
    }
    this.onboardingWizardError = null;
    if (!this.connected || !this.client) {
      this.onboardingWizardError = "Gateway not connected.";
      this.connect();
      return;
    }
    this.onboardingWizardBusy = true;
    try {
      const result = await this.client.request<WizardStartResult>("wizard.start", {
        mode: "local",
      });
      this.onboardingWizardSessionId = result.sessionId;
      this.onboardingWizardStatus = result.status ?? null;
      this.onboardingWizardStep = (result.step as WizardStep | undefined) ?? null;
      this.onboardingWizardDraft = this.onboardingWizardStep?.initialValue ?? null;
      this.onboardingWizardDraftTouched = false;
      this.applyOnboardingWizardPresetToStep();
      await this.driveOnboardingWizardPresetSteps();
      if (result.done) {
        this.onboardingWizardSessionId = null;
        this.onboardingWizardStep = null;
        if (result.status === "done") {
          this.finishOnboardingWizard();
        }
      }
    } catch (err) {
      this.onboardingWizardError = `Wizard start failed: ${String(err)}`;
    } finally {
      this.onboardingWizardBusy = false;
    }
  }

  async cancelOnboardingWizard() {
    if (this.onboardingWizardBusy) {
      return;
    }
    this.onboardingWizardError = null;
    const sessionId = this.onboardingWizardSessionId;
    if (!sessionId || !this.client) {
      this.onboardingWizardSessionId = null;
      this.onboardingWizardStep = null;
      return;
    }
    this.onboardingWizardBusy = true;
    try {
      const result = await this.client.request<{ status?: string; error?: string }>(
        "wizard.cancel",
        {
          sessionId,
        },
      );
      this.onboardingWizardStatus = result.status ?? null;
      this.onboardingWizardSessionId = null;
      this.onboardingWizardStep = null;
      this.onboardingWizardDraft = null;
      this.onboardingWizardDraftTouched = false;
    } catch (err) {
      this.onboardingWizardError = `Wizard cancel failed: ${String(err)}`;
    } finally {
      this.onboardingWizardBusy = false;
    }
  }

  handleOnboardingDraftChange(value: unknown) {
    this.onboardingWizardDraftTouched = true;
    this.onboardingWizardDraft = value;
  }


  private exitOnboardingMode(params?: { completed?: boolean }) {
    if (params?.completed) {
      writeDesktopOnboardingDoneFlag();
    }
    this.onboarding = false;
    this.tab = "chat";
    syncThemeWithSettingsInternal(this);
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      params.delete("onboarding");
      params.delete("onboardingPreset");
      params.delete("preset");
      params.delete("auto");
      params.delete("autoAdvance");
      url.search = params.toString();
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
  }

  finishOnboardingWizard() {
    this.exitOnboardingMode({ completed: true });
  }

  skipOnboardingWizard() {
    if (isTauriRuntime()) {
      writeDesktopOnboardingDoneFlag();
    }
    this.exitOnboardingMode({ completed: false });
  }
  async submitOnboardingWizardStep() {
    if (this.onboardingWizardBusy) {
      return;
    }
    this.onboardingWizardError = null;
    const sessionId = this.onboardingWizardSessionId;
    const step = this.onboardingWizardStep;
    if (!sessionId || !step || !this.client) {
      return;
    }
    this.onboardingWizardBusy = true;
    try {
      const result = await this.client.request<WizardNextResult>("wizard.next", {
        sessionId,
        answer: {
          stepId: step.id,
          value: this.onboardingWizardDraft,
        },
      });
      this.onboardingWizardStatus = result.status ?? null;
      this.onboardingWizardStep = (result.step as WizardStep | undefined) ?? null;
      this.onboardingWizardDraft = this.onboardingWizardStep?.initialValue ?? null;
      this.onboardingWizardDraftTouched = false;
      this.applyOnboardingWizardPresetToStep();
      await this.driveOnboardingWizardPresetSteps();
      if (result.done) {
        this.onboardingWizardSessionId = null;
        this.onboardingWizardStep = null;
        if (result.status === "done") {
          this.finishOnboardingWizard();
        }
      }
    } catch (err) {
      this.onboardingWizardError = `Wizard step failed: ${String(err)}`;
    } finally {
      this.onboardingWizardBusy = false;
    }
  }

  handleChatScroll(event: Event) {
    handleChatScrollInternal(
      this as unknown as Parameters<typeof handleChatScrollInternal>[0],
      event,
    );
  }

  handleLogsScroll(event: Event) {
    handleLogsScrollInternal(
      this as unknown as Parameters<typeof handleLogsScrollInternal>[0],
      event,
    );
  }

  exportLogs(lines: string[], label: string) {
    exportLogsInternal(lines, label);
  }

  resetToolStream() {
    resetToolStreamInternal(this as unknown as Parameters<typeof resetToolStreamInternal>[0]);
  }

  resetChatScroll() {
    resetChatScrollInternal(this as unknown as Parameters<typeof resetChatScrollInternal>[0]);
  }

  scrollToBottom(opts?: { smooth?: boolean }) {
    resetChatScrollInternal(this as unknown as Parameters<typeof resetChatScrollInternal>[0]);
    scheduleChatScrollInternal(
      this as unknown as Parameters<typeof scheduleChatScrollInternal>[0],
      true,
      Boolean(opts?.smooth),
    );
  }

  async loadAssistantIdentity() {
    await loadAssistantIdentityInternal(this);
  }

  applySettings(next: UiSettings) {
    applySettingsInternal(this as unknown as Parameters<typeof applySettingsInternal>[0], next);
  }

  setTab(next: Tab) {
    setTabInternal(this as unknown as Parameters<typeof setTabInternal>[0], next);
  }

  setTheme(next: ThemeName, context?: Parameters<typeof setThemeInternal>[2]) {
    setThemeInternal(this as unknown as Parameters<typeof setThemeInternal>[0], next, context);
  }

  setThemeMode(next: ThemeMode, context?: Parameters<typeof setThemeModeInternal>[2]) {
    setThemeModeInternal(
      this as unknown as Parameters<typeof setThemeModeInternal>[0],
      next,
      context,
    );
  }

  async loadOverview() {
    await loadOverviewInternal(this as unknown as Parameters<typeof loadOverviewInternal>[0]);
  }

  async loadCron() {
    await loadCronInternal(this as unknown as Parameters<typeof loadCronInternal>[0]);
  }

  async handleAbortChat() {
    await handleAbortChatInternal(this as unknown as Parameters<typeof handleAbortChatInternal>[0]);
  }

  removeQueuedMessage(id: string) {
    removeQueuedMessageInternal(
      this as unknown as Parameters<typeof removeQueuedMessageInternal>[0],
      id,
    );
  }

  async handleSendChat(
    messageOverride?: string,
    opts?: Parameters<typeof handleSendChatInternal>[2],
  ) {
    await handleSendChatInternal(
      this as unknown as Parameters<typeof handleSendChatInternal>[0],
      messageOverride,
      opts,
    );
  }

  async handleWhatsAppStart(force: boolean) {
    await handleWhatsAppStartInternal(this, force);
  }

  async handleWhatsAppWait() {
    await handleWhatsAppWaitInternal(this);
  }

  async handleWhatsAppLogout() {
    await handleWhatsAppLogoutInternal(this);
  }

  async handleChannelConfigSave() {
    await handleChannelConfigSaveInternal(this);
  }

  async handleChannelConfigReload() {
    await handleChannelConfigReloadInternal(this);
  }

  handleNostrProfileEdit(accountId: string, profile: NostrProfile | null) {
    handleNostrProfileEditInternal(this, accountId, profile);
  }

  handleNostrProfileCancel() {
    handleNostrProfileCancelInternal(this);
  }

  handleNostrProfileFieldChange(field: keyof NostrProfile, value: string) {
    handleNostrProfileFieldChangeInternal(this, field, value);
  }

  async handleNostrProfileSave() {
    await handleNostrProfileSaveInternal(this);
  }

  async handleNostrProfileImport() {
    await handleNostrProfileImportInternal(this);
  }

  handleNostrProfileToggleAdvanced() {
    handleNostrProfileToggleAdvancedInternal(this);
  }

  async handleExecApprovalDecision(decision: "allow-once" | "allow-always" | "deny") {
    const active = this.execApprovalQueue[0];
    if (!active || !this.client || this.execApprovalBusy) {
      return;
    }
    this.execApprovalBusy = true;
    this.execApprovalError = null;
    try {
      await this.client.request("exec.approval.resolve", {
        id: active.id,
        decision,
      });
      this.execApprovalQueue = this.execApprovalQueue.filter((entry) => entry.id !== active.id);
    } catch (err) {
      this.execApprovalError = `Exec approval failed: ${String(err)}`;
    } finally {
      this.execApprovalBusy = false;
    }
  }

  handleGatewayUrlConfirm() {
    const nextGatewayUrl = this.pendingGatewayUrl;
    if (!nextGatewayUrl) {
      return;
    }
    const nextToken = this.pendingGatewayToken?.trim() || "";
    this.pendingGatewayUrl = null;
    this.pendingGatewayToken = null;
    applySettingsInternal(this as unknown as Parameters<typeof applySettingsInternal>[0], {
      ...this.settings,
      gatewayUrl: nextGatewayUrl,
      token: nextToken,
    });
    this.connect();
  }

  handleGatewayUrlCancel() {
    this.pendingGatewayUrl = null;
    this.pendingGatewayToken = null;
  }

  // Sidebar handlers for tool output viewing
  handleOpenSidebar(content: string) {
    if (this.sidebarCloseTimer != null) {
      window.clearTimeout(this.sidebarCloseTimer);
      this.sidebarCloseTimer = null;
    }
    this.sidebarContent = content;
    this.sidebarError = null;
    this.sidebarOpen = true;
  }

  handleCloseSidebar() {
    this.sidebarOpen = false;
    // Clear content after transition
    if (this.sidebarCloseTimer != null) {
      window.clearTimeout(this.sidebarCloseTimer);
    }
    this.sidebarCloseTimer = window.setTimeout(() => {
      if (this.sidebarOpen) {
        return;
      }
      this.sidebarContent = null;
      this.sidebarError = null;
      this.sidebarCloseTimer = null;
    }, 200);
  }

  handleSplitRatioChange(ratio: number) {
    const newRatio = Math.max(0.4, Math.min(0.7, ratio));
    this.splitRatio = newRatio;
    this.applySettings({ ...this.settings, splitRatio: newRatio });
  }

  render() {
    return renderApp(this as unknown as AppViewState);
  }
}





















