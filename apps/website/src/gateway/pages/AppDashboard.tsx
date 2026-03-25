import { 
  MessageSquare, 
  LayoutDashboard, 
  Smartphone, 
  BarChart3, 
  Zap, 
  Settings, 
  LifeBuoy, 
  ClipboardList, 
  FolderOpen, 
  FileText,
  Plus,
  Send,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  UserCog,
  Cpu,
  Package,
  Monitor,
  AlertCircle,
  Menu,
  X,
  Download
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { ADMIN_UI_ENABLED, ANDROID_APK_URL, LICENSING_DISABLED, WHATSAPP_JOIN_URL } from '../../lib/links';
import { apiGet, apiPost, apiDeleteAuth, apiGetAuth, apiPatchAuth, apiPostAuth, apiPutAuth } from '../../lib/api';
import { type DashboardTabId, getPathForTab, getTabForPath } from '../tabRoutes';
import QRCode from 'qrcode';

const APP_VERSION = 'web-2026.3.11';
const DEVICE_ID_KEY = 'propai_device_id';
const ACTIVATION_KEY_STORAGE = 'propai_activation_key';
const ACTIVATION_TOKEN_STORAGE = 'propai_activation_token';
const CONTROL_TOKEN_STORAGE = 'propai_control_token';
const CONTROL_TENANT_STORAGE = 'propai_control_tenant';
const LICENSING_DISABLED_STORAGE = 'propai_licensing_disabled';

type LicenseResponse = {
  valid: boolean;
  status?: string;
  message?: string;
  code?: string;
  activationToken?: string;
  expiresAt?: string | null;
  plan?: string | null;
  deviceLimit?: number | null;
  devicesUsed?: number | null;
  licenseId?: string;
};

type GatewayHealthResponse = {
  ok?: boolean;
  status?: string;
  message?: string;
};

type FullHealthResponse = {
  ok?: boolean;
  ui?: { ok?: boolean; indexPath?: string };
  control?: { ok?: boolean; status?: number; payload?: unknown };
  gateway?: { ok?: boolean; status?: number; payload?: unknown };
};

type SetupCheckResponse = {
  ok?: boolean;
  gateway?: {
    authTokenConfigured?: boolean;
    providerKeys?: {
      openai?: boolean;
      anthropic?: boolean;
      xai?: boolean;
      elevenlabs?: boolean;
    };
    anyProvider?: boolean;
    licensingUrl?: string;
  };
  control?: {
    ok?: boolean;
    gatewayUrlConfigured?: boolean;
    gatewayTokenConfigured?: boolean;
  };
};

type SetupWizardStep = 'account' | 'whatsapp' | 'ai' | 'automation' | 'launch';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
};

type ControlUser = {
  id: string;
  email: string;
  primaryWhatsapp?: string | null;
};

type ControlTenant = {
  id: string;
  name: string;
  role: string;
};

type ControlUserRow = {
  id: string;
  email: string;
  role: string;
};

type AdminTenantRow = {
  id: string;
  name: string;
  createdAt: string;
  members: number;
  owners: number;
};

type AdminTenantUser = {
  id: string;
  email: string;
  role: string;
  joinedAt: string;
};

type TenantSettings = {
  onboardingComplete?: boolean;
  workspaceProfile?: {
    ownerName?: string;
    businessName?: string;
    city?: string;
    email?: string;
    businessType?: string;
    phone?: string;
  };
  whatsappOnboarding?: {
    status?: 'active' | 'complete';
    step?: string;
    completedAt?: string;
  };
  whatsapp?: {
    phone?: string;
    businessId?: string;
    phoneNumberId?: string;
  };
  providers?: {
    groq?: { apiKey?: string };
    openrouter?: { apiKey?: string };
    openai?: { apiKey?: string };
    anthropic?: { apiKey?: string };
    xai?: { apiKey?: string };
    eleven?: { apiKey?: string };
  };
  chat?: {
    provider?: string;
    model?: string;
  };
  tts?: {
    provider?: string;
    voice?: string;
  };
  skills?: string[];
};

type AndroidSetupResponse = {
  ok: boolean;
  setupCode: string;
  payload: {
    url: string;
    token?: string;
    password?: string;
  };
  authLabel?: string;
  urlSource?: string;
};

type AndroidPairingPending = {
  requestId: string;
  deviceId: string;
  displayName?: string;
  platform?: string;
  deviceFamily?: string;
  role?: string;
  ts: number;
};

type AndroidPairedDevice = {
  deviceId: string;
  displayName?: string;
  platform?: string;
  deviceFamily?: string;
  role?: string;
  approvedAtMs: number;
};

type AndroidPairingList = {
  ok?: boolean;
  pending: AndroidPairingPending[];
  paired: AndroidPairedDevice[];
};

type UsageSummary = {
  llm: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    totalTokens: number;
    avgLatencyMs: number;
  };
  tts: {
    requests: number;
    characters: number;
    avgLatencyMs: number;
  };
};

type UsageBreakdownRow = {
  provider: string;
  model: string;
  requests: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens?: number;
  characters?: number;
};

type UsageResponse = {
  range: '24h' | '7d' | '30d';
  from: string;
  to: string;
  summary: UsageSummary;
  breakdown: {
    llm: UsageBreakdownRow[];
    tts: UsageBreakdownRow[];
  };
};

const SKILL_OPTIONS = [
  { id: 'lead_intake', label: 'Lead intake & qualification' },
  { id: 'followups', label: 'WhatsApp follow-ups' },
  { id: 'site_visits', label: 'Site visit scheduling' },
  { id: 'inventory', label: 'Inventory matching' },
  { id: 'owner_pitch', label: 'Owner pitch & listings' },
  { id: 'team_handoff', label: 'Team handoff notes' },
];

const CHAT_PROVIDER_OPTIONS = [
  { id: 'openai', label: 'OpenAI', defaultModel: 'gpt-4.1-mini' },
  { id: 'anthropic', label: 'Anthropic', defaultModel: 'claude-3-5-haiku-20241022' },
  { id: 'xai', label: 'xAI', defaultModel: 'grok-2-latest' },
  { id: 'openrouter', label: 'OpenRouter', defaultModel: 'anthropic/claude-3.5-sonnet' },
  { id: 'groq', label: 'Groq', defaultModel: 'llama-3.1-8b-instant' },
];

const TTS_PROVIDER_OPTIONS = [
  { id: 'elevenlabs', label: 'ElevenLabs' },
];

const ALLOWED_USAGE_PROVIDERS = new Set(['openai', 'anthropic', 'xai', 'elevenlabs']);

const USAGE_PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  xai: 'xAI',
  elevenlabs: 'ElevenLabs',
};

function resolveDefaultChatProvider(settings: TenantSettings) {
  if (settings.chat?.provider) {
    return settings.chat.provider;
  }
  if (settings.providers?.openai?.apiKey) return 'openai';
  if (settings.providers?.anthropic?.apiKey) return 'anthropic';
  if (settings.providers?.xai?.apiKey) return 'xai';
  if (settings.providers?.openrouter?.apiKey) return 'openrouter';
  if (settings.providers?.groq?.apiKey) return 'groq';
  return 'openrouter';
}

function resolveDefaultChatModel(provider: string) {
  const match = CHAT_PROVIDER_OPTIONS.find((opt) => opt.id === provider);
  return match?.defaultModel ?? 'gpt-4.1-mini';
}

function buildModelRef(provider: string, model: string) {
  const trimmed = model.trim();
  if (!trimmed) {
    return `${provider}/${resolveDefaultChatModel(provider)}`;
  }
  if (provider === 'openrouter') {
    return trimmed.startsWith('openrouter/') ? trimmed : `openrouter/${trimmed}`;
  }
  if (trimmed.startsWith(`${provider}/`)) {
    return trimmed;
  }
  return `${provider}/${trimmed}`;
}

function getOrCreateDeviceId() {
  if (typeof window === 'undefined') {
    return 'web-device';
  }
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const fallback = `web-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  const next = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : fallback;
  window.localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

function formatDate(value?: string | null) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTimestamp(value?: number) {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCount(value?: number) {
  if (!value || Number.isNaN(value)) {
    return '0';
  }
  return value.toLocaleString('en-IN');
}

function formatUsageRangeLabel(range: '24h' | '7d' | '30d') {
  if (range === '24h') return 'Last 24 hours';
  if (range === '30d') return 'Last 30 days';
  return 'Last 7 days';
}

function formatUsageProvider(provider: string) {
  return USAGE_PROVIDER_LABELS[provider] ?? provider;
}

function normalizeError(err: unknown, fallback: string) {
  if (!err || typeof err !== 'object') {
    return fallback;
  }
  if ('message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return fallback;
}

export default function AppDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTabState] = useState<DashboardTabId>(() => {
    if (typeof window === 'undefined') {
      return 'Assistant';
    }
    return getTabForPath(window.location.pathname) ?? 'Assistant';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const webhookUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return 'https://www.propai.live/webhooks/whatsapp';
    }
    return `${window.location.origin}/webhooks/whatsapp`;
  }, []);
  const [activationKey, setActivationKey] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.localStorage.getItem(ACTIVATION_KEY_STORAGE) ?? '';
  });
  const [activationToken, setActivationToken] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.localStorage.getItem(ACTIVATION_TOKEN_STORAGE) ?? '';
  });
  const [controlToken, setControlToken] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.localStorage.getItem(CONTROL_TOKEN_STORAGE) ?? '';
  });
  const [selectedTenantId, setSelectedTenantId] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.localStorage.getItem(CONTROL_TENANT_STORAGE) ?? '';
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const url = new URL(window.location.href);
    const tokenParam = url.searchParams.get('control_token');
    const tenantParam = url.searchParams.get('tenant_id');
    if (!tokenParam) {
      return;
    }
    setControlToken(tokenParam);
    if (tenantParam) {
      setSelectedTenantId(tenantParam);
    }
    url.searchParams.delete('control_token');
    url.searchParams.delete('tenant_id');
    window.history.replaceState({}, '', url.toString());
  }, []);
  const [controlUser, setControlUser] = useState<ControlUser | null>(null);
  const [controlTenants, setControlTenants] = useState<ControlTenant[]>([]);
  const [teamMembers, setTeamMembers] = useState<ControlUserRow[]>([]);
  const [controlError, setControlError] = useState<string | null>(null);
  const [adminTenants, setAdminTenants] = useState<AdminTenantRow[]>([]);
  const [adminTenantName, setAdminTenantName] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminCreating, setAdminCreating] = useState(false);
  const [adminUsersByTenant, setAdminUsersByTenant] = useState<Record<string, AdminTenantUser[]>>({});
  const [adminUsersLoading, setAdminUsersLoading] = useState<Record<string, boolean>>({});
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerTenant, setRegisterTenant] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('agent');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [trialStatus, setTrialStatus] = useState<'idle' | 'pending' | 'active' | 'expired' | 'invalid'>('idle');
  const [trialMessage, setTrialMessage] = useState<string | null>(null);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [trialDetails, setTrialDetails] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [propertyDetails, setPropertyDetails] = useState('');
  const [gatewayHealth, setGatewayHealth] = useState<'checking' | 'online' | 'offline'>('checking');
  const [fullHealth, setFullHealth] = useState<FullHealthResponse | null>(null);
  const [fullHealthLoading, setFullHealthLoading] = useState(false);
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const [setupCheck, setSetupCheck] = useState<SetupCheckResponse | null>(null);
  const [setupCheckLoading, setSetupCheckLoading] = useState(false);
  const [setupCheckError, setSetupCheckError] = useState<string | null>(null);
  const [setupAutoOpened, setSetupAutoOpened] = useState(false);
  const [licensingDisabled, setLicensingDisabled] = useState(() => {
    if (typeof window === 'undefined') {
      return LICENSING_DISABLED;
    }
    const stored = window.localStorage.getItem(LICENSING_DISABLED_STORAGE);
    if (stored === null) {
      return LICENSING_DISABLED;
    }
    return stored === 'true';
  });
  const [licenseInfo, setLicenseInfo] = useState<LicenseResponse | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatNotice, setChatNotice] = useState<string | null>(null);
  const [sessions, setSessions] = useState([{ id: 'main', name: 'Main Session' }]);
  const [activeSessionId, setActiveSessionId] = useState('main');
  const [chatMessagesBySession, setChatMessagesBySession] = useState<Record<string, ChatMessage[]>>({ main: [] });
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings>({});
  const [settingsDraft, setSettingsDraft] = useState({
    whatsappPhone: '',
    whatsappBusinessId: '',
    whatsappPhoneNumberId: '',
    groqKey: '',
    openrouterKey: '',
    openaiKey: '',
    anthropicKey: '',
    xaiKey: '',
    elevenKey: '',
    chatProvider: 'openrouter',
    chatModel: resolveDefaultChatModel('openrouter'),
    ttsProvider: 'elevenlabs',
    ttsVoice: 'Rachel',
    skills: [] as string[],
    onboardingComplete: false,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [setupWizardStep, setSetupWizardStep] = useState<SetupWizardStep>('account');
  const [androidSetup, setAndroidSetup] = useState<AndroidSetupResponse | null>(null);
  const [androidQrCode, setAndroidQrCode] = useState<string | null>(null);
  const [androidSetupLoading, setAndroidSetupLoading] = useState(false);
  const [androidSetupError, setAndroidSetupError] = useState<string | null>(null);
  const [androidDevices, setAndroidDevices] = useState<AndroidPairingList>({ pending: [], paired: [] });
  const [androidDevicesLoading, setAndroidDevicesLoading] = useState(false);
  const [usageRange, setUsageRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [usageData, setUsageData] = useState<UsageResponse | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (activationKey) {
      window.localStorage.setItem(ACTIVATION_KEY_STORAGE, activationKey);
    } else {
      window.localStorage.removeItem(ACTIVATION_KEY_STORAGE);
    }
  }, [activationKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (activationToken) {
      window.localStorage.setItem(ACTIVATION_TOKEN_STORAGE, activationToken);
    } else {
      window.localStorage.removeItem(ACTIVATION_TOKEN_STORAGE);
    }
  }, [activationToken]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (controlToken) {
      window.localStorage.setItem(CONTROL_TOKEN_STORAGE, controlToken);
    } else {
      window.localStorage.removeItem(CONTROL_TOKEN_STORAGE);
    }
  }, [controlToken]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (selectedTenantId) {
      window.localStorage.setItem(CONTROL_TENANT_STORAGE, selectedTenantId);
    } else {
      window.localStorage.removeItem(CONTROL_TENANT_STORAGE);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(LICENSING_DISABLED_STORAGE, licensingDisabled ? 'true' : 'false');
  }, [licensingDisabled]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.title = 'PropAi Sync Control';
    let robotsMeta = document.head.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', 'noindex,nofollow,noarchive');
  }, []);

  const activateTab = useCallback(
    (tabId: DashboardTabId, opts?: { closeSidebar?: boolean; replace?: boolean }) => {
      setActiveTabState(tabId);
      const nextPath = getPathForTab(tabId);
      if (location.pathname !== nextPath) {
        navigate(nextPath, { replace: opts?.replace });
      }
      if (opts?.closeSidebar) {
        setIsSidebarOpen(false);
      }
    },
    [location.pathname, navigate],
  );

  useEffect(() => {
    const tabFromPath = getTabForPath(location.pathname);
    if (!tabFromPath) {
      if (location.pathname !== getPathForTab('Assistant')) {
        navigate(getPathForTab('Assistant'), { replace: true });
      }
      if (activeTab !== 'Assistant') {
        setActiveTabState('Assistant');
      }
      return;
    }
    if (tabFromPath !== activeTab) {
      setActiveTabState(tabFromPath);
    }
  }, [activeTab, location.pathname, navigate]);

  useEffect(() => {
    void loadSetupCheck();
  }, []);

  useEffect(() => {
    if (activeTab !== 'Setup') {
      return;
    }
    void loadSetupCheck();
  }, [activeTab]);


  const loadGatewayHealth = async () => {
    setGatewayHealth('checking');
    try {
      const response = await apiGet<GatewayHealthResponse>('/gateway/health');
      setGatewayHealth(response?.ok ? 'online' : 'offline');
    } catch {
      setGatewayHealth('offline');
    }
  };

  const loadFullHealth = async () => {
    setFullHealthLoading(true);
    try {
      const response = await apiGet<FullHealthResponse>('/health/full');
      setFullHealth(response ?? null);
    } catch {
      setFullHealth(null);
    } finally {
      setFullHealthLoading(false);
    }
  };

  const loadSetupCheck = async () => {
    setSetupCheckLoading(true);
    setSetupCheckError(null);
    try {
      const response = await apiGet<SetupCheckResponse>('/health/setup');
      setSetupCheck(response ?? null);
    } catch (error) {
      setSetupCheck(null);
      setSetupCheckError(normalizeError(error, 'Unable to load setup check.'));
    } finally {
      setSetupCheckLoading(false);
    }
  };

  const formatHealthPayload = (payload: unknown) => {
    if (payload === undefined) {
      return '';
    }
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  };

  const loadControlProfile = async (token: string) => {
    setControlError(null);
    try {
      const response = await apiGetAuth<{ user: ControlUser; tenants: ControlTenant[] }>(
        '/control/v1/me',
        token
      );
      setControlUser(response.user);
      setControlTenants(response.tenants ?? []);
      if (!selectedTenantId && response.tenants?.length) {
        setSelectedTenantId(response.tenants[0].id);
      }
    } catch (error) {
      setControlError(normalizeError(error, 'Unable to load account.'));
      setControlToken('');
      setControlUser(null);
      setControlTenants([]);
    }
  };

  const loadTeamMembers = async (token: string, tenantId: string) => {
    if (!tenantId) {
      setTeamMembers([]);
      return;
    }
    try {
      const response = await apiGetAuth<{ users: ControlUserRow[] }>(
        `/control/v1/tenants/${tenantId}/users`,
        token
      );
      setTeamMembers(response.users ?? []);
    } catch (error) {
      setControlError(normalizeError(error, 'Unable to load team members.'));
    }
  };

  const loadTenantSettings = async (token: string, tenantId: string) => {
    if (!tenantId) {
      setTenantSettings({});
      return;
    }
    try {
      const response = await apiGetAuth<{ settings: TenantSettings }>(
        `/control/v1/tenants/${tenantId}/settings`,
        token
      );
      const settings = response.settings ?? {};
      const resolvedProvider = resolveDefaultChatProvider(settings);
      setTenantSettings(settings);
      setSettingsDraft((prev) => ({
        ...prev,
        whatsappPhone: settings.whatsapp?.phone ?? '',
        whatsappBusinessId: settings.whatsapp?.businessId ?? '',
        whatsappPhoneNumberId: settings.whatsapp?.phoneNumberId ?? '',
        groqKey: '',
        openrouterKey: '',
        openaiKey: '',
        anthropicKey: '',
        xaiKey: '',
        elevenKey: '',
        chatProvider: resolvedProvider,
        chatModel: settings.chat?.model ?? resolveDefaultChatModel(resolvedProvider),
        ttsProvider: settings.tts?.provider ?? 'elevenlabs',
        ttsVoice: settings.tts?.voice ?? 'Rachel',
        skills: settings.skills ?? prev.skills ?? [],
        onboardingComplete: settings.onboardingComplete ?? false,
      }));
    } catch (error) {
      setSettingsError(normalizeError(error, 'Unable to load setup settings.'));
    }
  };

  const saveTenantSettings = async () => {
    if (!controlToken || !selectedTenantId) {
      setSettingsError('Sign in to save setup details.');
      return;
    }
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const payload: TenantSettings = {
        onboardingComplete: settingsDraft.onboardingComplete,
        whatsapp: {
          ...(settingsDraft.whatsappPhone.trim() ? { phone: settingsDraft.whatsappPhone.trim() } : {}),
          ...(settingsDraft.whatsappBusinessId.trim()
            ? { businessId: settingsDraft.whatsappBusinessId.trim() }
            : {}),
          ...(settingsDraft.whatsappPhoneNumberId.trim()
            ? { phoneNumberId: settingsDraft.whatsappPhoneNumberId.trim() }
            : {}),
        },
        providers: {
          ...(settingsDraft.groqKey.trim() ? { groq: { apiKey: settingsDraft.groqKey.trim() } } : {}),
          ...(settingsDraft.openrouterKey.trim()
            ? { openrouter: { apiKey: settingsDraft.openrouterKey.trim() } }
            : {}),
          ...(settingsDraft.openaiKey.trim() ? { openai: { apiKey: settingsDraft.openaiKey.trim() } } : {}),
          ...(settingsDraft.anthropicKey.trim()
            ? { anthropic: { apiKey: settingsDraft.anthropicKey.trim() } }
            : {}),
          ...(settingsDraft.xaiKey.trim() ? { xai: { apiKey: settingsDraft.xaiKey.trim() } } : {}),
          ...(settingsDraft.elevenKey.trim() ? { eleven: { apiKey: settingsDraft.elevenKey.trim() } } : {}),
        },
        chat: {
          provider: settingsDraft.chatProvider,
          model: settingsDraft.chatModel.trim(),
        },
        tts: {
          provider: settingsDraft.ttsProvider,
          voice: settingsDraft.ttsVoice.trim(),
        },
        skills: settingsDraft.skills,
      };
      const response = await apiPutAuth<{ settings: TenantSettings }>(
        `/control/v1/tenants/${selectedTenantId}/settings`,
        payload as Record<string, unknown>,
        controlToken
      );
      setTenantSettings(response.settings ?? payload);
      setSettingsMessage('Setup saved.');
      setSettingsDraft((prev) => ({
        ...prev,
        groqKey: '',
        openrouterKey: '',
        openaiKey: '',
        anthropicKey: '',
        xaiKey: '',
        elevenKey: '',
      }));
    } catch (error) {
      setSettingsError(normalizeError(error, 'Unable to save setup details.'));
    } finally {
      setSettingsSaving(false);
    }
  };

  const loadAndroidDevices = async (token: string, tenantId: string) => {
    if (!token || !tenantId) {
      setAndroidDevices({ pending: [], paired: [] });
      return;
    }
    setAndroidDevicesLoading(true);
    try {
      const response = await apiGetAuth<AndroidPairingList>(
        `/control/v1/tenants/${tenantId}/android/devices`,
        token
      );
      setAndroidDevices({
        pending: response.pending ?? [],
        paired: response.paired ?? [],
      });
    } catch (error) {
      setAndroidSetupError(normalizeError(error, 'Unable to load Android devices.'));
    } finally {
      setAndroidDevicesLoading(false);
    }
  };

  const loadUsage = async (token: string, tenantId: string, range: '24h' | '7d' | '30d') => {
    if (!token || !tenantId) {
      setUsageData(null);
      return;
    }
    setUsageLoading(true);
    setUsageError(null);
    try {
      const response = await apiGetAuth<UsageResponse>(
        `/control/v1/tenants/${tenantId}/usage?range=${range}`,
        token
      );
      setUsageData(response ?? null);
    } catch (error) {
      setUsageError(normalizeError(error, 'Unable to load usage data.'));
      setUsageData(null);
    } finally {
      setUsageLoading(false);
    }
  };

  const handleGenerateAndroidSetup = async () => {
    if (!controlToken || !selectedTenantId) {
      setAndroidSetupError('Sign in to generate a setup code.');
      return;
    }
    setAndroidSetupLoading(true);
    setAndroidSetupError(null);
    try {
      const response = await apiPostAuth<AndroidSetupResponse>(
        `/control/v1/tenants/${selectedTenantId}/android/setup`,
        {},
        controlToken
      );
      setAndroidSetup(response);
      const qrPayload: Record<string, string> = {
        setupCode: response.setupCode,
        gatewayUrl: response.payload.url,
      };
      if (response.payload.token) qrPayload.token = response.payload.token;
      if (response.payload.password) qrPayload.password = response.payload.password;
      if (selectedTenantId) qrPayload.tenantId = selectedTenantId;
      const qr = await QRCode.toDataURL(JSON.stringify(qrPayload), { margin: 1, width: 220 });
      setAndroidQrCode(qr);
    } catch (error) {
      setAndroidSetupError(normalizeError(error, 'Unable to generate setup code.'));
    } finally {
      setAndroidSetupLoading(false);
    }
  };

  const handleApproveAndroidDevice = async (requestId: string) => {
    if (!controlToken || !selectedTenantId) {
      return;
    }
    setAndroidDevicesLoading(true);
    try {
      await apiPostAuth(
        `/control/v1/tenants/${selectedTenantId}/android/devices/approve`,
        { requestId },
        controlToken
      );
      await loadAndroidDevices(controlToken, selectedTenantId);
    } catch (error) {
      setAndroidSetupError(normalizeError(error, 'Failed to approve device.'));
    } finally {
      setAndroidDevicesLoading(false);
    }
  };

  const handleRejectAndroidDevice = async (requestId: string) => {
    if (!controlToken || !selectedTenantId) {
      return;
    }
    setAndroidDevicesLoading(true);
    try {
      await apiPostAuth(
        `/control/v1/tenants/${selectedTenantId}/android/devices/reject`,
        { requestId },
        controlToken
      );
      await loadAndroidDevices(controlToken, selectedTenantId);
    } catch (error) {
      setAndroidSetupError(normalizeError(error, 'Failed to reject device.'));
    } finally {
      setAndroidDevicesLoading(false);
    }
  };

  const handleRemoveAndroidDevice = async (deviceId: string) => {
    if (!controlToken || !selectedTenantId) {
      return;
    }
    setAndroidDevicesLoading(true);
    try {
      await apiDeleteAuth(
        `/control/v1/tenants/${selectedTenantId}/android/devices/${deviceId}`,
        controlToken
      );
      await loadAndroidDevices(controlToken, selectedTenantId);
    } catch (error) {
      setAndroidSetupError(normalizeError(error, 'Failed to remove device.'));
    } finally {
      setAndroidDevicesLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setControlError('Email and password are required.');
      return;
    }
    setAuthLoading(true);
    setControlError(null);
    try {
      const response = await apiPostAuth<{
        token: string;
        user: ControlUser;
        tenants: ControlTenant[];
      }>('/control/v1/auth/login', { email: loginEmail.trim(), password: loginPassword }, undefined);
      setControlToken(response.token);
      setControlUser(response.user);
      setControlTenants(response.tenants ?? []);
      if (response.tenants?.length) {
        setSelectedTenantId(response.tenants[0].id);
      }
    } catch (error) {
      setControlError(normalizeError(error, 'Login failed.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerEmail.trim() || !registerTenant.trim()) {
      setControlError('Email and workspace name are required.');
      return;
    }
    setAuthLoading(true);
    setControlError(null);
    try {
      const hasPassword = Boolean(registerPassword.trim());
      const response = await apiPostAuth<{
        token: string;
        user: ControlUser;
        tenant: ControlTenant;
      }>(hasPassword ? '/control/v1/auth/register' : '/control/v1/auth/bootstrap', {
        email: registerEmail.trim(),
        ...(hasPassword ? { password: registerPassword } : {}),
        tenantName: registerTenant.trim(),
      });
      setControlToken(response.token);
      setControlUser(response.user);
      setControlTenants([response.tenant]);
      setSelectedTenantId(response.tenant.id);
      setRegisterPassword('');
    } catch (error) {
      setControlError(normalizeError(error, 'Account setup failed.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (!controlToken) {
      setPasswordError('Sign in first to set a password.');
      return;
    }
    if (!passwordDraft.trim()) {
      setPasswordError('Enter a new password.');
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordMessage(null);
    try {
      await apiPostAuth<{ ok: boolean }>(
        '/control/v1/auth/password',
        { password: passwordDraft },
        controlToken,
      );
      setPasswordMessage('Password updated.');
      setPasswordDraft('');
    } catch (error) {
      setPasswordError(normalizeError(error, 'Could not update password.'));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!controlToken || !selectedTenantId) {
      setControlError('Select a workspace first.');
      return;
    }
    if (!inviteEmail.trim()) {
      setControlError('Invite email is required.');
      return;
    }
    setAuthLoading(true);
    setControlError(null);
    setInviteToken(null);
    try {
      const response = await apiPostAuth<{ inviteToken: string; expiresAt: string }>(
        `/control/v1/tenants/${selectedTenantId}/invites`,
        { email: inviteEmail.trim(), role: inviteRole },
        controlToken
      );
      setInviteToken(response.inviteToken);
      await loadTeamMembers(controlToken, selectedTenantId);
    } catch (error) {
      setControlError(normalizeError(error, 'Invite failed.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    if (!controlToken || !selectedTenantId) {
      return;
    }
    try {
      await apiPatchAuth<{ ok: true }>(
        `/control/v1/tenants/${selectedTenantId}/users/${userId}`,
        { role },
        controlToken
      );
      await loadTeamMembers(controlToken, selectedTenantId);
    } catch (error) {
      setControlError(normalizeError(error, 'Failed to update role.'));
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!controlToken || !selectedTenantId) {
      return;
    }
    try {
      await apiDeleteAuth<{ ok: true }>(
        `/control/v1/tenants/${selectedTenantId}/users/${userId}`,
        controlToken
      );
      await loadTeamMembers(controlToken, selectedTenantId);
    } catch (error) {
      setControlError(normalizeError(error, 'Failed to remove user.'));
    }
  };

  const handleSignOut = () => {
    setControlToken('');
    setControlUser(null);
    setControlTenants([]);
    setTeamMembers([]);
    setSelectedTenantId('');
    setInviteToken(null);
  };

  const loadAdminTenants = async () => {
    setAdminLoading(true);
    setAdminError(null);
    try {
      const response = await apiGet<{
        tenants: Array<{
          id: string;
          name: string;
          created_at: string;
          members: number;
          owners: number;
        }>;
      }>('/admin/tenants');
      const rows = response.tenants ?? [];
      setAdminTenants(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          createdAt: row.created_at,
          members: row.members,
          owners: row.owners,
        })),
      );
    } catch (error) {
      setAdminError(normalizeError(error, 'Unable to load tenants.'));
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminCreateTenant = async () => {
    if (!adminTenantName.trim()) {
      setAdminError('Workspace name is required.');
      return;
    }
    setAdminCreating(true);
    setAdminError(null);
    try {
      await apiPost<{ tenant: { id: string; name: string } }>('/admin/tenants', {
        name: adminTenantName.trim(),
      });
      setAdminTenantName('');
      await loadAdminTenants();
    } catch (error) {
      setAdminError(normalizeError(error, 'Unable to create tenant.'));
    } finally {
      setAdminCreating(false);
    }
  };

  const loadAdminUsers = async (tenantId: string) => {
    setAdminUsersLoading((prev) => ({ ...prev, [tenantId]: true }));
    setAdminError(null);
    try {
      const response = await apiGet<{
        users: Array<{ id: string; email: string; role: string; joined_at: string }>;
      }>(`/admin/tenants/${tenantId}/users`);
      const users = response.users ?? [];
      setAdminUsersByTenant((prev) => ({
        ...prev,
        [tenantId]: users.map((row) => ({
          id: row.id,
          email: row.email,
          role: row.role,
          joinedAt: row.joined_at,
        })),
      }));
    } catch (error) {
      setAdminError(normalizeError(error, 'Unable to load tenant users.'));
    } finally {
      setAdminUsersLoading((prev) => ({ ...prev, [tenantId]: false }));
    }
  };

  useEffect(() => {
    loadGatewayHealth();
    loadFullHealth();
  }, []);

  useEffect(() => {
    if (licensingDisabled) {
      return;
    }
    if (activationToken || activationKey) {
      handleRefreshStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licensingDisabled]);

  useEffect(() => {
    if (!controlToken) {
      return;
    }
    loadControlProfile(controlToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlToken]);

  useEffect(() => {
    if (!ADMIN_UI_ENABLED) {
      return;
    }
    if (activeTab !== 'Admin') {
      return;
    }
    loadAdminTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!controlToken || !selectedTenantId) {
      return;
    }
    loadTeamMembers(controlToken, selectedTenantId);
    loadTenantSettings(controlToken, selectedTenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlToken, selectedTenantId]);

  useEffect(() => {
    if (!controlToken || !selectedTenantId) {
      return;
    }
    if (activeTab !== 'Android Agent') {
      return;
    }
    loadAndroidDevices(controlToken, selectedTenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlToken, selectedTenantId, activeTab]);

  useEffect(() => {
    if (!controlToken || !selectedTenantId) {
      setUsageData(null);
      return;
    }
    if (activeTab !== 'Usage') {
      return;
    }
    loadUsage(controlToken, selectedTenantId, usageRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlToken, selectedTenantId, activeTab, usageRange]);

  useEffect(() => {
    if (!controlToken) {
      return;
    }
    if (!tenantSettings.onboardingComplete && activeTab === 'Assistant') {
      activateTab('Setup', { replace: true });
    }
  }, [tenantSettings.onboardingComplete, controlToken, activeTab, activateTab]);

  const updateTrialState = (payload: LicenseResponse) => {
    const status = payload.status ?? (payload.valid ? 'active' : 'invalid');
    const normalizedStatus = status === 'active' ? 'active' : status === 'pending' ? 'pending' : status === 'expired' ? 'expired' : 'invalid';
    setLicenseInfo(payload);
    setTrialStatus(normalizedStatus);
    if (payload.valid && payload.activationToken) {
      setActivationToken(payload.activationToken);
    }
    if (payload.message) {
      setTrialMessage(payload.message);
    }
    if (payload.valid || normalizedStatus === 'pending') {
      setTrialError(null);
      setTrialDetails(null);
      return;
    }
    if (!payload.valid) {
      setTrialError(payload.message ?? 'Trial activation failed.');
      setTrialDetails(payload.code ? `${payload.code}` : null);
    }
  };

  const handleRequestTrial = async () => {
    if (licensingDisabled) {
      setTrialError(null);
      setTrialDetails(null);
      setTrialMessage('Licensing is disabled for this environment.');
      return;
    }
    if (!email.trim()) {
      setTrialError('Please enter your email address to request access.');
      setShowErrorDetails(false);
      return;
    }
    setIsRequesting(true);
    setTrialError(null);
    setTrialDetails(null);
    setShowErrorDetails(false);
    try {
      const response = await apiPost<LicenseResponse>('/licensing/request', {
        email: email.trim(),
        plan: 'pro',
        maxDevices: 2,
        phone: phone.trim(),
        notes: propertyDetails.trim(),
      });
      if (response?.licenseId || response?.message) {
        if ((response as { token?: string }).token) {
          setActivationKey((response as { token?: string }).token ?? '');
        }
        setTrialStatus('pending');
        setTrialMessage(response.message ?? 'Trial request sent. Waiting for admin approval.');
      }
    } catch (error) {
      setTrialError(normalizeError(error, 'We could not submit your trial request.'));
    } finally {
      setIsRequesting(false);
    }
  };

  const handleActivateTrial = async () => {
    if (licensingDisabled) {
      setTrialError(null);
      setTrialDetails(null);
      setTrialMessage('Licensing is disabled for this environment.');
      return;
    }
    if (!activationKey.trim()) {
      setTrialError('Please enter your activation key.');
      setShowErrorDetails(false);
      return;
    }
    setIsActivating(true);
    setTrialError(null);
    setTrialDetails(null);
    setShowErrorDetails(false);
    try {
      const response = await apiPost<LicenseResponse>('/licensing/activate', {
        token: activationKey.trim(),
        deviceId,
        appVersion: APP_VERSION,
        client: {
          platform: 'web',
          deviceName: typeof navigator !== 'undefined' ? navigator.userAgent : 'web',
        },
      });
      updateTrialState(response);
      if (response.valid) {
        const until = formatDate(response.expiresAt ?? null);
        setTrialMessage(until ? `Trial active until ${until}.` : 'Trial active.');
      } else if ((response.status ?? '') === 'pending') {
        setTrialMessage('Trial request sent. Waiting for admin approval.');
      }
    } catch (error) {
      setTrialError(normalizeError(error, 'We could not activate this key.'));
    } finally {
      setIsActivating(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (licensingDisabled) {
      setTrialError(null);
      setTrialDetails(null);
      setTrialMessage('Licensing is disabled for this environment.');
      return;
    }
    const token = activationToken || activationKey;
    if (!token.trim()) {
      setTrialError('Please enter your activation key first.');
      setShowErrorDetails(false);
      return;
    }
    setIsRefreshing(true);
    setTrialError(null);
    setTrialDetails(null);
    setShowErrorDetails(false);
    try {
      const response = await apiPost<LicenseResponse>('/licensing/verify', {
        token: token.trim(),
        deviceId,
        appVersion: APP_VERSION,
        client: {
          platform: 'web',
          deviceName: typeof navigator !== 'undefined' ? navigator.userAgent : 'web',
        },
      });
      updateTrialState(response);
      if (response.valid) {
        const until = formatDate(response.expiresAt ?? null);
        setTrialMessage(until ? `Trial active until ${until}.` : 'Trial active.');
      } else if ((response.status ?? '') === 'pending') {
        setTrialMessage('Trial request sent. Waiting for admin approval.');
      }
    } catch (error) {
      setTrialError(normalizeError(error, 'We could not refresh this trial status.'));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleClearLicense = () => {
    setActivationKey('');
    setActivationToken('');
    setTrialStatus('idle');
    setTrialMessage(null);
    setTrialError(null);
    setTrialDetails(null);
    setShowErrorDetails(false);
    setLicenseInfo(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ACTIVATION_KEY_STORAGE);
      window.localStorage.removeItem(ACTIVATION_TOKEN_STORAGE);
    }
  };

  const handleNewSession = () => {
    const nextIndex = sessions.length + 1;
    const next = { id: `session-${Date.now()}`, name: `Session ${nextIndex}` };
    setSessions((prev) => [...prev, next]);
    setActiveSessionId(next.id);
    setChatInput('');
    setChatNotice(null);
    setChatMessagesBySession((prev) => ({ ...prev, [next.id]: [] }));
  };

  const handleSendMessage = async () => {
    if (gatewayHealth !== 'online') {
      setChatNotice('Gateway offline. Please try again in a minute.');
      return;
    }
    if (!licenseActive) {
      setChatNotice('License required to send messages.');
      return;
    }
      const provider = activeChatProvider;
      const providerHasKey =
        (provider === 'openai' && hasOpenAiKey) ||
        (provider === 'anthropic' && hasAnthropicKey) ||
        (provider === 'xai' && hasXaiKey) ||
        (provider === 'openrouter' && hasOpenRouterKey) ||
        (provider === 'groq' && hasGroqKey);
    if (!providerHasKey) {
      setChatNotice(`Add a ${provider} API key in Setup to send messages.`);
      return;
    }
    const trimmed = chatInput.trim();
    if (!trimmed) {
      return;
    }
    if (isSending) {
      return;
    }
    const sessionId = activeSessionId || 'main';
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const existingMessages = chatMessagesBySession[sessionId] ?? [];
    setChatMessagesBySession((prev) => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] ?? []), userMessage],
    }));
    setChatInput('');
    setChatNotice(null);
    setIsSending(true);
    try {
      const payloadMessages = [
        ...existingMessages.map((message) => ({ role: message.role, content: message.content })),
        { role: 'user', content: trimmed },
      ];
      const modelRef = buildModelRef(provider, tenantSettings.chat?.model ?? activeChatModel);
      const response = await apiPost<{
        choices?: Array<{ message?: { content?: string }; text?: string }>;
        error?: { message?: string };
        message?: { content?: string };
      }>('/gateway/chat', {
        model: modelRef,
        stream: false,
        user: sessionId,
        messages: payloadMessages,
      });
      if (response?.error?.message) {
        throw new Error(response.error.message);
      }
      const assistantText =
        response?.choices?.[0]?.message?.content ??
        response?.choices?.[0]?.text ??
        response?.message?.content ??
        null;
      if (!assistantText) {
        throw new Error('No assistant response received.');
      }
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: assistantText,
        createdAt: new Date().toISOString(),
      };
      setChatMessagesBySession((prev) => ({
        ...prev,
        [sessionId]: [...(prev[sessionId] ?? []), assistantMessage],
      }));
    } catch (error) {
      setChatNotice(normalizeError(error, 'Unable to send message.'));
    } finally {
      setIsSending(false);
    }
  };

  const licensingEnabled = !licensingDisabled;
  const licenseActive = licensingDisabled || trialStatus === 'active';
  const hasGroqKey = Boolean(tenantSettings.providers?.groq?.apiKey);
  const hasOpenRouterKey = Boolean(tenantSettings.providers?.openrouter?.apiKey);
  const hasOpenAiKey = Boolean(tenantSettings.providers?.openai?.apiKey);
  const hasAnthropicKey = Boolean(tenantSettings.providers?.anthropic?.apiKey);
  const hasXaiKey = Boolean(tenantSettings.providers?.xai?.apiKey);
  const hasElevenKey = Boolean(tenantSettings.providers?.eleven?.apiKey);
  const activeChatProvider = tenantSettings.chat?.provider ?? resolveDefaultChatProvider(tenantSettings);
  const activeChatModel =
    tenantSettings.chat?.model ?? resolveDefaultChatModel(activeChatProvider);
  const activeMessages = chatMessagesBySession[activeSessionId] ?? [];
  const usageSummary = usageData?.summary;
  const llmTotalTokens = usageSummary
    ? usageSummary.llm.totalTokens || usageSummary.llm.inputTokens + usageSummary.llm.outputTokens
    : 0;
  const llmRequests = usageSummary?.llm.requests ?? 0;
  const ttsCharacters = usageSummary?.tts.characters ?? 0;
  const ttsRequests = usageSummary?.tts.requests ?? 0;
  const usageLlmRows = (usageData?.breakdown.llm ?? [])
    .filter((row) => ALLOWED_USAGE_PROVIDERS.has(row.provider))
    .sort((a, b) => (b.requests ?? 0) - (a.requests ?? 0));
  const usageTtsRows = (usageData?.breakdown.tts ?? [])
    .filter((row) => ALLOWED_USAGE_PROVIDERS.has(row.provider))
    .sort((a, b) => (b.requests ?? 0) - (a.requests ?? 0));
  const setupProviderKeys = setupCheck?.gateway?.providerKeys ?? {};
  const setupGatewayAuthReady = Boolean(setupCheck?.gateway?.authTokenConfigured);
  const setupAnyProviderReady = Boolean(setupCheck?.gateway?.anyProvider);
  const setupControlLinkReady = Boolean(
    setupCheck?.control?.gatewayUrlConfigured && setupCheck?.control?.gatewayTokenConfigured,
  );
  const setupPairingReady = setupGatewayAuthReady && setupControlLinkReady;
  const setupReady = setupGatewayAuthReady && setupAnyProviderReady && setupControlLinkReady;
  const setupChecklist = [
    {
      id: 'gateway-auth',
      step: '01',
      label: 'Secure app access',
      ok: setupGatewayAuthReady,
      detail: 'Add one shared gateway token so only your team and apps can connect.',
      action: 'Set PROPAI_GATEWAY_TOKEN on the gateway service.',
    },
    {
      id: 'provider-key',
      step: '02',
      label: 'Connect an AI brain',
      ok: setupAnyProviderReady,
      detail: 'You only need one provider key to get started with assistant replies and automation.',
      action: 'Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or XAI_API_KEY on the gateway.',
    },
    {
      id: 'control-link',
      step: '03',
      label: 'Link the app to control',
      ok: setupControlLinkReady,
      detail: 'This lets the setup page, reports, and device pairing talk to the gateway correctly.',
      action: 'Set CONTROL_GATEWAY_URL and CONTROL_GATEWAY_TOKEN on control-api.',
    },
  ];
  useEffect(() => {
    if (!setupCheck) {
      return;
    }
    if (setupReady) {
      setSetupAutoOpened(false);
      return;
    }
    if (!setupAutoOpened) {
      activateTab('Setup', { replace: true });
      setSetupAutoOpened(true);
    }
  }, [activateTab, setupCheck, setupReady, setupAutoOpened]);
  const setupChecklistAllOk = setupChecklist.every((item) => item.ok);
  const setupProgressCount = setupChecklist.filter((item) => item.ok).length;
  const setupRemainingCount = setupChecklist.length - setupProgressCount;
  const setupMissingLabels = setupChecklist.filter((item) => !item.ok).map((item) => item.label);
  const setupMissingSummary = setupMissingLabels.length > 0 ? setupMissingLabels.join(' · ') : '';
  const setupProgressPercent = Math.round((setupProgressCount / setupChecklist.length) * 100);
  const setupStatusSummary = !setupCheck
    ? 'Checking what is already connected…'
    : setupChecklistAllOk
      ? 'Everything essential is ready. You can finish the last form fields and go live.'
      : `${setupRemainingCount} ${setupRemainingCount === 1 ? 'item still needs' : 'items still need'} attention.`;
  const hasAnyDraftProviderKey = Boolean(
    settingsDraft.openaiKey.trim() ||
      settingsDraft.anthropicKey.trim() ||
      settingsDraft.xaiKey.trim() ||
      settingsDraft.groqKey.trim() ||
      settingsDraft.openrouterKey.trim() ||
      settingsDraft.elevenKey.trim(),
  );
  const suggestedSetupStep: SetupWizardStep = !controlToken
    ? 'account'
    : !settingsDraft.whatsappPhone.trim()
      ? 'whatsapp'
      : !(setupAnyProviderReady || hasAnyDraftProviderKey)
        ? 'ai'
        : !settingsDraft.onboardingComplete
          ? 'automation'
          : 'launch';
  const setupWizardSteps: Array<{
    id: SetupWizardStep;
    step: string;
    title: string;
    description: string;
  }> = [
    {
      id: 'account',
      step: '01',
      title: 'Identity',
      description: 'Start on WhatsApp first, then fall back to email only if needed.',
    },
    {
      id: 'whatsapp',
      step: '02',
      title: 'WhatsApp',
      description: 'Add the number and business details you want to use.',
    },
    {
      id: 'ai',
      step: '03',
      title: 'AI',
      description: 'Connect one provider and choose the default model.',
    },
    {
      id: 'automation',
      step: '04',
      title: 'Behavior',
      description: 'Pick voice and the first workflows PropAi should handle.',
    },
    {
      id: 'launch',
      step: '05',
      title: 'Launch',
      description: 'Review, save, and test your live workspace.',
    },
  ];
  const setupEnvSnippet = [
    '# Gateway service',
    'PROPAI_GATEWAY_TOKEN=',
    'ANTHROPIC_API_KEY=',
    'OPENAI_API_KEY=',
    'XAI_API_KEY=',
    '',
    '# Control API service',
    'CONTROL_GATEWAY_URL=http://gateway.railway.internal:8080',
    'CONTROL_GATEWAY_TOKEN=',
  ].join('\n');

  useEffect(() => {
    if (!controlToken && setupWizardStep !== 'account') {
      setSetupWizardStep('account');
    }
  }, [controlToken, setupWizardStep]);

  const copySetupEnvSnippet = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(setupEnvSnippet);
        setSettingsMessage('Env snippet copied.');
        return;
      }
      throw new Error('Clipboard unavailable');
    } catch {
      setSettingsMessage('Copy failed. Please copy manually.');
    }
  };

  useEffect(() => {
    if (!chatEndRef.current) {
      return;
    }
    chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeSessionId, activeMessages.length]);

  const settingsItems = [
    { id: 'Settings', label: 'Settings', icon: Settings },
    { id: 'Support', label: 'Support', icon: LifeBuoy },
    { id: 'Activity Log', label: 'Activity Log', icon: ClipboardList },
    { id: 'Resources', label: 'Resources', icon: FolderOpen },
    { id: 'Docs', label: 'Docs', icon: FileText },
  ];

  if (ADMIN_UI_ENABLED) {
    settingsItems.unshift({ id: 'Admin', label: 'Admin', icon: UserCog });
  }

  const sidebarGroups = [
    {
      label: 'Chat',
      items: [
        { id: 'Assistant', label: 'Assistant', icon: MessageSquare },
      ]
    },
    {
      label: 'Control',
      items: [
        { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'Usage', label: 'Usage', icon: BarChart3 },
        { id: 'Setup', label: 'Setup', icon: Settings },
        { id: 'WhatsApp', label: 'WhatsApp', icon: Smartphone },
        { id: 'Webhooks', label: 'Webhooks', icon: Send },
        { id: 'Conversations', label: 'Conversations', icon: MessageSquare },
        { id: 'Reports', label: 'Reports', icon: BarChart3 },
        { id: 'Auto Tasks', label: 'Auto Tasks', icon: Zap },
      ]
    },
    {
      label: 'Agent',
      items: [
        { id: 'Assistants', label: 'Assistants', icon: Cpu },
        { id: 'Add-ons', label: 'Add-ons', icon: Package },
        { id: 'Devices', label: 'Devices', icon: Monitor },
        { id: 'Android Agent', label: 'Android Agent', icon: Download },
      ]
    },
    {
      label: 'Settings',
      items: settingsItems,
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'Assistant':
        return (
          <div className="space-y-8">
            <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col h-[600px]">
              <div className="p-6 border-b border-border bg-muted/30 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold">Assistant</h2>
                  <p className="text-sm text-muted-foreground">Chat with your AI assistant to see how it handles leads.</p>
                </div>
                  {licensingDisabled ? (
                    <div className="bg-amber-500/10 text-amber-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-amber-500/20">
                      <ShieldCheck className="w-3 h-3" /> Licensing bypassed
                    </div>
                  ) : licenseActive ? (
                    <div className="bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3" /> License active
                    </div>
                  ) : (
                    <div className="bg-destructive/10 text-destructive px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-destructive/20">
                      <ShieldCheck className="w-3 h-3" /> License required
                    </div>
                  )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {activeMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                      <MessageSquare className="text-primary w-8 h-8" />
                    </div>
                    <h3 className="font-bold text-xl">
                      {sessions.find((session) => session.id === activeSessionId)?.name ?? 'Main Session'}
                    </h3>
                    <div className="w-px h-12 bg-border"></div>
                      <div className="space-y-2 max-w-xs">
                        {licensingEnabled && !licenseActive ? (
                          <p className="text-sm font-medium text-destructive flex items-center justify-center gap-2">
                            <AlertCircle className="w-4 h-4" /> License required to send messages.
                          </p>
                        ) : gatewayHealth !== 'online' ? (
                        <p className="text-sm font-medium text-amber-500 flex items-center justify-center gap-2">
                          <AlertCircle className="w-4 h-4" /> Gateway not connected. Please try again.
                        </p>
                      ) : (
                        <p className="text-sm font-medium text-emerald-600 flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Ready to chat.
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Connect to the gateway to start chatting with your AI assistant.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeMessages.map((message) => {
                      const isUser = message.role === 'user';
                      return (
                        <div key={message.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                          <div
                            className={cn(
                              'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed border',
                              isUser
                                ? 'bg-primary text-primary-foreground border-primary/20'
                                : 'bg-accent/40 border-border text-foreground'
                            )}
                          >
                            <p>{message.content}</p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              <div className="p-4 md:p-6 border-t border-border bg-card">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button
                    onClick={handleNewSession}
                    className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-bold hover:bg-accent transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3 h-3" /> <span className="sm:inline">New session</span>
                  </button>
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={isSending}
                      placeholder={gatewayHealth === 'online' ? 'Type a message…' : 'Gateway offline…'} 
                      className="w-full bg-accent/30 border border-border rounded-full px-4 py-2 text-sm outline-none" 
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={isSending || !licenseActive || gatewayHealth !== 'online' || !chatInput.trim()}
                    className="px-4 py-2 bg-primary/90 text-primary-foreground rounded-full text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSending ? 'Sending...' : 'Send'} <Send className="w-3 h-3" />
                  </button>
                </div>
                {chatNotice && (
                  <p className="mt-3 text-xs font-semibold text-muted-foreground">{chatNotice}</p>
                )}
              </div>
              </section>

            {/* Trial Access Section (Visible on Assistant page as per user flow) */}
            {licensingEnabled && (
              <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border bg-muted/30">
                <h2 className="text-lg font-bold">Trial access</h2>
                <p className="text-sm text-muted-foreground">
                  Request access first. We will review it by email, then you can come back and activate this desktop.
                </p>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Activation key</label>
                  <input
                    type="text"
                    value={activationKey}
                    onChange={(event) => setActivationKey(event.target.value)}
                    placeholder="Enter your activation key"
                    className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Work email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@agency.com"
                      className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">WhatsApp number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Property details (optional)</label>
                  <textarea
                    value={propertyDetails}
                    onChange={(event) => setPropertyDetails(event.target.value)}
                    placeholder="e.g., 3BHK apartment in Bandra, ₹2.5 Cr, site visits on weekends"
                    className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary min-h-[110px]"
                  />
                </div>

                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                  <button
                    onClick={handleRequestTrial}
                    disabled={isRequesting}
                    className="bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isRequesting ? 'Requesting…' : 'Request trial'}
                  </button>
                  <button
                    onClick={handleRefreshStatus}
                    disabled={isRefreshing}
                    className="px-6 py-3 rounded-xl text-sm font-bold border border-border bg-background hover:bg-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isRefreshing ? 'Refreshing…' : 'Refresh status'}
                  </button>
                  <button
                    onClick={handleActivateTrial}
                    disabled={isActivating}
                    className="bg-emerald-500 text-emerald-950 px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isActivating ? 'Activating…' : 'Activate trial'}
                  </button>
                  <button
                    onClick={handleClearLicense}
                    className="px-6 py-3 rounded-xl text-sm font-bold border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    Clear saved key
                  </button>
                </div>

                {trialMessage && (
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-sm">
                    {trialMessage}
                  </div>
                )}

                {trialError && (
                  <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{trialError}</p>
                      <button
                        onClick={() => setShowErrorDetails((prev) => !prev)}
                        className="text-xs font-semibold underline"
                      >
                        {showErrorDetails ? 'Hide details' : 'Show details'}
                      </button>
                    </div>
                    {showErrorDetails && (
                      <p className="mt-2 text-xs font-mono text-destructive/80">
                        {trialDetails ?? trialError}
                      </p>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Approval happens by email. This screen can refresh your trial after approval.
                </p>
                <Link to="/contact" className="text-xs font-medium text-primary hover:underline">Need help? Contact support</Link>
              </div>
            </section>
            )}
          </div>
        );
      case 'Dashboard':
        return (
          <div className="space-y-8">
            <section className="grid gap-4 md:grid-cols-3">
              <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Gateway</p>
                <p className="text-lg font-bold">{gatewayHealth === 'online' ? 'Online' : gatewayHealth === 'checking' ? 'Checking' : 'Offline'}</p>
                <p className="text-xs text-muted-foreground">Realtime connection status for PropAi Live.</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Trial</p>
                <p className="text-lg font-bold">{trialStatus === 'active' ? 'Active' : trialStatus === 'pending' ? 'Pending' : 'Not active'}</p>
                <p className="text-xs text-muted-foreground">
                  {licenseInfo?.expiresAt ? `Ends ${formatDate(licenseInfo.expiresAt)}` : 'Activation required to start chatting.'}
                </p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Workspace</p>
                <p className="text-lg font-bold">{controlTenants.find((t) => t.id === selectedTenantId)?.name ?? 'Not connected'}</p>
                <p className="text-xs text-muted-foreground">{controlUser?.email ?? 'Sign in to manage your team.'}</p>
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Service health</h2>
                  <p className="text-sm text-muted-foreground">Website, control API, and gateway status.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowHealthDetails((prev) => !prev)}
                    className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-accent"
                  >
                    {showHealthDetails ? 'Hide details' : 'Show details'}
                  </button>
                  <button
                    onClick={loadFullHealth}
                    className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-accent"
                  >
                    {fullHealthLoading ? 'Checking…' : 'Refresh status'}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'UI', ok: fullHealth?.ui?.ok },
                  { label: 'Control API', ok: fullHealth?.control?.ok },
                  { label: 'Gateway', ok: fullHealth?.gateway?.ok },
                ].map((item) => (
                  <div key={item.label} className="border border-border rounded-xl p-4 flex items-center justify-between">
                    <span className="text-sm font-semibold">{item.label}</span>
                    <span
                      className={cn(
                        "text-xs font-semibold px-2.5 py-1 rounded-full",
                        item.ok === true && "bg-emerald-500/10 text-emerald-600",
                        item.ok === false && "bg-destructive/10 text-destructive",
                        item.ok === undefined && "bg-amber-500/10 text-amber-600",
                      )}
                    >
                      {item.ok === true ? 'Online' : item.ok === false ? 'Offline' : 'Unknown'}
                    </span>
                  </div>
                ))}
              </div>
              {showHealthDetails && (
                <div className="space-y-3">
                  {fullHealth ? (
                    [
                      {
                        label: 'UI',
                        status: fullHealth.ui?.ok === true ? 'Online' : fullHealth.ui?.ok === false ? 'Offline' : 'Unknown',
                        payload: fullHealth.ui,
                      },
                      {
                        label: 'Control API',
                        status:
                          fullHealth.control?.ok === true
                            ? `Online (${fullHealth.control?.status ?? 200})`
                            : `Offline (${fullHealth.control?.status ?? 503})`,
                        payload: fullHealth.control?.payload,
                      },
                      {
                        label: 'Gateway',
                        status:
                          fullHealth.gateway?.ok === true
                            ? `Online (${fullHealth.gateway?.status ?? 200})`
                            : `Offline (${fullHealth.gateway?.status ?? 503})`,
                        payload: fullHealth.gateway?.payload,
                      },
                    ].map((item) => (
                      <div key={item.label} className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.status}</p>
                        </div>
                        {item.payload ? (
                          <pre className="text-xs bg-background/60 border border-border rounded-lg p-3 overflow-x-auto">
                            {formatHealthPayload(item.payload)}
                          </pre>
                        ) : (
                          <p className="text-xs text-muted-foreground">No payload returned.</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="bg-muted/30 border border-border rounded-xl p-4 text-xs text-muted-foreground">
                      No health data yet. Click refresh status.
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold">Quick actions</h2>
              <div className="flex flex-col md:flex-row gap-3">
                <button onClick={handleRefreshStatus} className="px-5 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-accent">
                  Refresh license status
                </button>
                <button onClick={loadGatewayHealth} className="px-5 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-accent">
                  Check gateway health
                </button>
                <button onClick={loadFullHealth} className="px-5 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-accent">
                  Check service health
                </button>
                <Link to="/contact" className="px-5 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-accent text-center">
                  Contact support
                </Link>
              </div>
            </section>
            </div>
          );
        case 'Usage':
          return (
            <div className="space-y-6">
              <section className="bg-card border border-border rounded-2xl p-6 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold">AI Usage</h2>
                    <p className="text-sm text-muted-foreground">
                      Track model usage across OpenAI, Anthropic, xAI, and ElevenLabs.
                    </p>
                    {usageData && (
                      <p className="text-xs text-muted-foreground">
                        {formatUsageRangeLabel(usageRange)} · Updated {new Date(usageData.to).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(['24h', '7d', '30d'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setUsageRange(range)}
                        className={cn(
                          'px-3 py-2 rounded-lg text-xs font-semibold border',
                          usageRange === range
                            ? 'bg-primary text-primary-foreground border-primary/20'
                            : 'border-border hover:bg-accent'
                        )}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>
                {usageError && <div className="text-xs text-destructive font-semibold">{usageError}</div>}
                {usageLoading && <div className="text-xs text-muted-foreground">Loading usage…</div>}
              </section>
              <section className="grid gap-4 md:grid-cols-3">
                <div className="bg-card border border-border rounded-2xl p-6 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">LLM tokens</p>
                  <p className="text-lg font-bold">{formatCount(llmTotalTokens)}</p>
                  <p className="text-xs text-muted-foreground">
                    Input {formatCount(usageSummary?.llm.inputTokens)} · Output {formatCount(usageSummary?.llm.outputTokens)}
                  </p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">LLM requests</p>
                  <p className="text-lg font-bold">{formatCount(llmRequests)}</p>
                  <p className="text-xs text-muted-foreground">Avg latency {formatCount(usageSummary?.llm.avgLatencyMs)} ms</p>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">TTS characters</p>
                  <p className="text-lg font-bold">{formatCount(ttsCharacters)}</p>
                  <p className="text-xs text-muted-foreground">{formatCount(ttsRequests)} voice requests</p>
                </div>
              </section>
              <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <h3 className="text-base font-semibold">LLM usage by model</h3>
                  <p className="text-xs text-muted-foreground">{formatUsageRangeLabel(usageRange)}</p>
                </div>
                {usageLlmRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No LLM usage recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                          <th className="py-2">Provider</th>
                          <th className="py-2">Model</th>
                          <th className="py-2">Requests</th>
                          <th className="py-2">Input</th>
                          <th className="py-2">Output</th>
                          <th className="py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {usageLlmRows.map((row) => (
                          <tr key={`${row.provider}-${row.model}`} className="text-sm">
                            <td className="py-2 font-medium">{formatUsageProvider(row.provider)}</td>
                            <td className="py-2 text-muted-foreground">{row.model}</td>
                            <td className="py-2">{formatCount(row.requests)}</td>
                            <td className="py-2">{formatCount(row.inputTokens)}</td>
                            <td className="py-2">{formatCount(row.outputTokens)}</td>
                            <td className="py-2">{formatCount(row.totalTokens)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <h3 className="text-base font-semibold">Voice (TTS) usage</h3>
                  <p className="text-xs text-muted-foreground">{formatUsageRangeLabel(usageRange)}</p>
                </div>
                {usageTtsRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No TTS usage recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                          <th className="py-2">Provider</th>
                          <th className="py-2">Model</th>
                          <th className="py-2">Requests</th>
                          <th className="py-2">Characters</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {usageTtsRows.map((row) => (
                          <tr key={`${row.provider}-${row.model}`} className="text-sm">
                            <td className="py-2 font-medium">{formatUsageProvider(row.provider)}</td>
                            <td className="py-2 text-muted-foreground">{row.model}</td>
                            <td className="py-2">{formatCount(row.requests)}</td>
                            <td className="py-2">{formatCount(row.characters)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          );
        case 'Setup': {
          const setupCurrentStep = setupWizardSteps.find((step) => step.id === setupWizardStep) ?? setupWizardSteps[0];
          const suggestedStepMeta = setupWizardSteps.find((step) => step.id === suggestedSetupStep) ?? setupWizardSteps[0];
          const setupCurrentIndex = setupWizardSteps.findIndex((step) => step.id === setupCurrentStep.id);
          const setupPreviousStep = setupCurrentIndex > 0 ? setupWizardSteps[setupCurrentIndex - 1] : null;
          const setupNextStep = setupCurrentIndex < setupWizardSteps.length - 1 ? setupWizardSteps[setupCurrentIndex + 1] : null;
          const setupStepStatus: Record<SetupWizardStep, boolean> = {
            account: Boolean(controlToken),
            whatsapp: Boolean(settingsDraft.whatsappPhone.trim()),
            ai: Boolean(setupAnyProviderReady || hasAnyDraftProviderKey),
            automation: Boolean(settingsDraft.chatProvider && settingsDraft.chatModel.trim()),
            launch: Boolean(settingsDraft.onboardingComplete),
          };
          return (
            <div className="space-y-6">
              <section className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5 shadow-sm">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-3xl space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">First-time setup</p>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Set up PropAi in one guided flow</h2>
                    <p className="text-sm md:text-base text-muted-foreground leading-7">
                      We will get your workspace ready in five simple steps: sign in, connect WhatsApp, add one AI key,
                      choose how PropAi should help, and then test before you go live. Technical details stay tucked away
                      unless you need them.
                    </p>
                  </div>
                  <div className="min-w-[280px] rounded-2xl border border-border bg-muted/30 p-5 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Setup progress</p>
                        <p className="text-3xl font-bold">{setupProgressCount}/{setupChecklist.length}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{setupProgressPercent}%</p>
                        <p className="text-xs text-muted-foreground">platform ready</p>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-border overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${setupProgressPercent}%` }} />
                    </div>
                    <p className={cn('text-sm font-medium', setupChecklistAllOk ? 'text-emerald-600' : 'text-muted-foreground')}>
                      {setupStatusSummary}
                    </p>
                    {!setupChecklistAllOk && (
                      <button
                        onClick={() => setSetupWizardStep(suggestedSetupStep)}
                        className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
                      >
                        Continue with {suggestedStepMeta.title}
                      </button>
                    )}
                  </div>
                </div>
                {settingsMessage && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700">
                    {settingsMessage}
                  </div>
                )}
                {settingsError && (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
                    {settingsError}
                  </div>
                )}
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
                <div className="space-y-6">
                  <section className="bg-card border border-border rounded-3xl p-4 md:p-5 space-y-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold">Guided setup flow</p>
                        <p className="text-xs text-muted-foreground">Move step by step. You can always come back later.</p>
                      </div>
                      {suggestedSetupStep !== setupWizardStep && (
                        <button
                          onClick={() => setSetupWizardStep(suggestedSetupStep)}
                          className="text-xs font-semibold underline underline-offset-4"
                        >
                          Jump to suggested next step
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-5">
                      {setupWizardSteps.map((step) => {
                        const selected = step.id === setupWizardStep;
                        const completed = setupStepStatus[step.id];
                        return (
                          <button
                            key={step.id}
                            onClick={() => setSetupWizardStep(step.id)}
                            className={cn(
                              'rounded-2xl border px-4 py-4 text-left transition-all',
                              selected
                                ? 'border-primary bg-primary/10 shadow-sm'
                                : 'border-border bg-muted/20 hover:bg-accent',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground">Step {step.step}</p>
                                <p className="mt-2 text-sm font-semibold">{step.title}</p>
                              </div>
                              {completed ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                              ) : (
                                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
                              )}
                            </div>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">{step.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Step {setupCurrentStep.step}</p>
                        <h3 className="text-2xl font-bold tracking-tight">{setupCurrentStep.title}</h3>
                        <p className="text-sm text-muted-foreground leading-7">{setupCurrentStep.description}</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground max-w-sm">
                        First-time tip: keep this simple on day one. One WhatsApp number, one AI provider, one default model,
                        then test in Assistant before expanding anything else.
                      </div>
                    </div>

                    {setupWizardStep === 'account' && (
                      <div className="space-y-5">
                        {!controlToken ? (
                          <>
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 space-y-2 text-sm text-amber-900">
                              <p className="font-semibold">Start here on WhatsApp so PropAi can verify your number and create your workspace.</p>
                              <p>
                                WhatsApp is the main identity for day-to-day use. Email stays as your backup for recovery, billing, and admin access.
                              </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                                <p className="text-sm font-semibold">Start with your real WhatsApp number</p>
                                <p className="text-sm text-muted-foreground">
                                  This becomes your primary identity inside PropAi.
                                </p>
                              </div>
                              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                                <p className="text-sm font-semibold">Email becomes a backup contact</p>
                                <p className="text-sm text-muted-foreground">
                                  We still capture it, but only for recovery, billing, and admin tasks.
                                </p>
                              </div>
                              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                                <p className="text-sm font-semibold">Your team can be added later</p>
                                <p className="text-sm text-muted-foreground">
                                  Finish the basics first, then invite brokers or assistants from Settings.
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                              {WHATSAPP_JOIN_URL ? (
                                <a
                                  href={WHATSAPP_JOIN_URL}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 text-center"
                                >
                                  Continue on WhatsApp
                                </a>
                              ) : (
                                <button
                                  onClick={() => setSetupWizardStep('whatsapp')}
                                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90"
                                >
                                  Continue to WhatsApp setup
                                </button>
                              )}
                              <button
                                onClick={() => activateTab('Settings')}
                                className="px-6 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-accent"
                              >
                                Use email admin access instead
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 space-y-2 text-sm text-emerald-800">
                              <p className="font-semibold">You are connected and ready to keep going.</p>
                              <p>Great — this workspace can now save your setup, team access, and onboarding progress.</p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Primary identity</p>
                                <p className="text-sm font-semibold break-all">{controlUser?.primaryWhatsapp ?? controlUser?.email ?? 'Connected account'}</p>
                              </div>
                              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Workspace</p>
                                <p className="text-sm font-semibold">{controlTenants.find((tenant) => tenant.id === selectedTenantId)?.name ?? 'Current workspace'}</p>
                              </div>
                              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Team members</p>
                                <p className="text-sm font-semibold">{teamMembers.length > 0 ? teamMembers.length : 1} connected</p>
                              </div>
                            </div>
                            {tenantSettings.workspaceProfile && (
                              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 space-y-2 text-sm">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Captured from WhatsApp</p>
                                <p className="font-semibold">
                                  {[tenantSettings.workspaceProfile.ownerName, tenantSettings.workspaceProfile.businessName].filter(Boolean).join(' � ') || 'Profile captured'}
                                </p>
                                <p className="text-muted-foreground">
                                  {[tenantSettings.workspaceProfile.city, tenantSettings.workspaceProfile.businessType, tenantSettings.workspaceProfile.email].filter(Boolean).join(' � ')}
                                </p>
                              </div>
                            )}
                            <div className="flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={() => setSetupWizardStep('whatsapp')}
                                className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90"
                              >
                                Continue to WhatsApp
                              </button>
                              <button
                                onClick={() => activateTab('Settings')}
                                className="px-6 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-accent"
                              >
                                Manage account
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {setupWizardStep === 'whatsapp' && (
                      <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                            <p className="text-sm font-semibold">Use your primary business number</p>
                            <p className="text-sm text-muted-foreground">This is the number leads should message first.</p>
                          </div>
                          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                            <p className="text-sm font-semibold">Start with the phone number</p>
                            <p className="text-sm text-muted-foreground">Business ID and Phone Number ID can be filled now or later.</p>
                          </div>
                          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                            <p className="text-sm font-semibold">You can refine later</p>
                            <p className="text-sm text-muted-foreground">The dedicated WhatsApp tab will still be there after launch.</p>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">WhatsApp number</label>
                            <input
                              value={settingsDraft.whatsappPhone}
                              onChange={(event) =>
                                setSettingsDraft((prev) => ({ ...prev, whatsappPhone: event.target.value }))
                              }
                              placeholder="+91 98765 43210"
                              className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                            />
                            <p className="text-xs text-muted-foreground">Use the same format you plan to publish to clients.</p>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Business ID (optional)</label>
                            <input
                              value={settingsDraft.whatsappBusinessId}
                              onChange={(event) =>
                                setSettingsDraft((prev) => ({ ...prev, whatsappBusinessId: event.target.value }))
                              }
                              placeholder="Meta business ID"
                              className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Phone number ID (optional)</label>
                            <input
                              value={settingsDraft.whatsappPhoneNumberId}
                              onChange={(event) =>
                                setSettingsDraft((prev) => ({ ...prev, whatsappPhoneNumberId: event.target.value }))
                              }
                              placeholder="Meta phone number ID"
                              className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {setupWizardStep === 'ai' && (
                      <div className="space-y-5">
                        <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground leading-7">
                          Start with one provider only. OpenAI or Anthropic is enough for your first live test. You can add backup
                          providers later without changing the rest of the setup.
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">OpenAI API key</label>
                            <input type="password" value={settingsDraft.openaiKey} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, openaiKey: event.target.value }))} placeholder={hasOpenAiKey ? 'Saved — enter to replace' : 'sk-...'} className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Anthropic API key</label>
                            <input type="password" value={settingsDraft.anthropicKey} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, anthropicKey: event.target.value }))} placeholder={hasAnthropicKey ? 'Saved — enter to replace' : 'sk-ant-...'} className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">xAI API key (optional)</label>
                            <input type="password" value={settingsDraft.xaiKey} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, xaiKey: event.target.value }))} placeholder={hasXaiKey ? 'Saved — enter to replace' : 'xai-...'} className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Groq API key (optional)</label>
                            <input type="password" value={settingsDraft.groqKey} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, groqKey: event.target.value }))} placeholder={hasGroqKey ? 'Saved — enter to replace' : 'gsk_...'} className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">OpenRouter API key (optional)</label>
                            <input type="password" value={settingsDraft.openrouterKey} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, openrouterKey: event.target.value }))} placeholder={hasOpenRouterKey ? 'Saved — enter to replace' : 'sk-or-...'} className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">ElevenLabs API key (optional)</label>
                            <input type="password" value={settingsDraft.elevenKey} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, elevenKey: event.target.value }))} placeholder={hasElevenKey ? 'Saved — enter to replace' : 'eleven_...'} className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Default provider</label>
                            <select value={settingsDraft.chatProvider} onChange={(event) => { const provider = event.target.value; setSettingsDraft((prev) => ({ ...prev, chatProvider: provider, chatModel: resolveDefaultChatModel(provider) })); }} className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary">
                              {CHAT_PROVIDER_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Default model</label>
                            <input value={settingsDraft.chatModel} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, chatModel: event.target.value }))} placeholder={resolveDefaultChatModel(settingsDraft.chatProvider)} className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                        </div>
                      </div>
                    )}

                    {setupWizardStep === 'automation' && (
                      <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                            <p className="text-sm font-semibold">What PropAi should do first</p>
                            <p className="text-sm text-muted-foreground">
                              Focus on the basics first: answer quickly, qualify leads, and hand off anything sensitive.
                            </p>
                          </div>
                          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                            <p className="text-sm font-semibold">Keep your first live version narrow</p>
                            <p className="text-sm text-muted-foreground">
                              It is better to go live with two useful automations than ten half-configured ones.
                            </p>
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Voice provider</label>
                            <select value={settingsDraft.ttsProvider} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, ttsProvider: event.target.value }))} className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary">
                              {TTS_PROVIDER_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Voice name</label>
                            <input value={settingsDraft.ttsVoice} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, ttsVoice: event.target.value }))} placeholder="Rachel" className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary" />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm font-semibold">Choose the first workflows PropAi should handle</p>
                          <p className="text-sm text-muted-foreground">These are your day-one defaults. You can expand after the first week.</p>
                          <div className="grid md:grid-cols-2 gap-3">
                            {SKILL_OPTIONS.map((skill) => {
                              const checked = settingsDraft.skills.includes(skill.id);
                              return (
                                <label key={skill.id} className="flex items-center gap-2 text-sm rounded-xl border border-border bg-muted/20 px-3 py-3">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) => {
                                      setSettingsDraft((prev) => {
                                        const next = new Set(prev.skills);
                                        if (event.target.checked) next.add(skill.id);
                                        else next.delete(skill.id);
                                        return { ...prev, skills: Array.from(next) };
                                      });
                                    }}
                                  />
                                  {skill.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {setupWizardStep === 'launch' && (
                      <div className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Account</p>
                            <p className="text-sm font-semibold">{controlToken ? 'Connected' : 'Needs sign-in'}</p>
                          </div>
                          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">WhatsApp</p>
                            <p className="text-sm font-semibold">{settingsDraft.whatsappPhone.trim() || 'Add your number'}</p>
                          </div>
                          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">AI</p>
                            <p className="text-sm font-semibold">{setupAnyProviderReady || hasAnyDraftProviderKey ? settingsDraft.chatProvider : 'Connect one provider'}</p>
                          </div>
                          <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Gateway checks</p>
                            <p className="text-sm font-semibold">{setupReady ? 'Ready to launch' : 'Still needs attention'}</p>
                          </div>
                        </div>

                        {setupCheckError && (
                          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            <p className="font-semibold">We could not verify the technical checks just now.</p>
                            <p className="text-xs mt-1 opacity-90">{setupCheckError}</p>
                          </div>
                        )}

                        <div className="space-y-3">
                          {setupChecklist.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-border bg-muted/20 px-4 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  {item.ok ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  ) : (
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                  )}
                                  <p className="text-sm font-semibold">{item.label}</p>
                                </div>
                                <p className="text-sm text-muted-foreground">{item.detail}</p>
                              </div>
                              <div className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground md:max-w-xs">
                                {item.action}
                              </div>
                            </div>
                          ))}
                        </div>

                        {!setupReady && (
                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                            You can still save your workspace details now, but one or more technical launch checks are unfinished.
                          </div>
                        )}

                        <label className="flex items-center gap-2 text-sm font-semibold rounded-xl border border-border px-4 py-3 bg-muted/20">
                          <input type="checkbox" checked={settingsDraft.onboardingComplete} disabled={!setupReady} onChange={(event) => setSettingsDraft((prev) => ({ ...prev, onboardingComplete: event.target.checked }))} />
                          Mark setup as complete
                        </label>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-col sm:flex-row gap-3">
                        {setupPreviousStep ? (
                          <button
                            onClick={() => setSetupWizardStep(setupPreviousStep.id)}
                            className="px-5 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-accent"
                          >
                            Back
                          </button>
                        ) : (
                          <button
                            onClick={() => activateTab('Dashboard')}
                            className="px-5 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-accent"
                          >
                            Back to dashboard
                          </button>
                        )}
                        {setupNextStep && (
                          <button
                            onClick={() => setSetupWizardStep(setupNextStep.id)}
                            className="px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90"
                          >
                            Continue to {setupNextStep.title}
                          </button>
                        )}
                      </div>
                      {setupWizardStep === 'launch' && (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={saveTenantSettings}
                            disabled={settingsSaving}
                            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-60"
                          >
                            {settingsSaving ? 'Saving…' : 'Save setup'}
                          </button>
                          <button
                            onClick={() => activateTab('Assistant')}
                            className="px-6 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-accent"
                          >
                            Test in Assistant
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                <div className="space-y-4">
                  <section className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
                    <h3 className="text-base font-bold">What happens on first run</h3>
                    <ol className="space-y-3 text-sm text-muted-foreground">
                      <li>1. Start on WhatsApp so PropAi can verify your number and create your workspace.</li>
                      <li>2. Add the WhatsApp number you want leads to message.</li>
                      <li>3. Paste one AI key and keep one default model.</li>
                      <li>4. Pick the first tasks PropAi should help with.</li>
                      <li>5. Save, then test from Assistant before inviting your full team.</li>
                    </ol>
                  </section>

                  <section className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
                    <div className="space-y-2">
                      <h3 className="text-base font-bold">Recommended next action</h3>
                      <p className="text-sm text-muted-foreground">
                        Right now, the best next move is <span className="font-semibold text-foreground">{suggestedStepMeta.title}</span>.
                      </p>
                    </div>
                    <button
                      onClick={() => setSetupWizardStep(suggestedSetupStep)}
                      className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
                      Open {suggestedStepMeta.title}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      We keep the flow simple on purpose so the first live version goes out quickly.
                    </p>
                  </section>

                  <details className="bg-card border border-border rounded-3xl p-6 shadow-sm">
                    <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                      <div>
                        <p className="text-base font-bold">Technical setup details</p>
                        <p className="text-xs text-muted-foreground mt-1">Only needed if you or a teammate are wiring Railway.</p>
                      </div>
                      <span className="text-xs font-semibold underline underline-offset-4">Open</span>
                    </summary>
                    <div className="mt-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-sm text-muted-foreground">Use this only when you need to finish service-level checks.</p>
                        <button
                          onClick={loadSetupCheck}
                          disabled={setupCheckLoading}
                          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-60"
                        >
                          <RefreshCw className={cn('w-3.5 h-3.5', setupCheckLoading && 'animate-spin')} />
                          {setupCheckLoading ? 'Checking…' : 'Recheck'}
                        </button>
                      </div>
                      <div className="space-y-3">
                        {setupChecklist.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-border bg-muted/20 px-4 py-3 space-y-1.5">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold">{item.label}</p>
                              <span className={cn('text-[10px] font-bold uppercase tracking-widest', item.ok ? 'text-emerald-600' : 'text-amber-700')}>
                                {item.ok ? 'Ready' : 'Needs setup'}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.action}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-xs text-muted-foreground">Copy once and paste into Railway if you are wiring services manually.</p>
                        <button onClick={copySetupEnvSnippet} className="text-xs font-semibold underline underline-offset-4">
                          Copy env snippet
                        </button>
                      </div>
                      <pre className="text-[11px] leading-relaxed bg-background border border-border rounded-xl p-3 overflow-x-auto">
                        {setupEnvSnippet}
                      </pre>
                    </div>
                  </details>
                </div>
              </section>
            </div>
          );
        }
        case 'WhatsApp':
          return (
            <div className="space-y-6">
              <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">WhatsApp API (WABA)</h2>
                    <p className="text-sm text-muted-foreground">
                      Connect your official WhatsApp Business API credentials for scalable, compliant messaging.
                    </p>
                  </div>
                  <button
                    onClick={() => activateTab('Setup')}
                    className="text-xs font-semibold underline"
                  >
                    Edit in setup
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Business ID</p>
                    <p className="text-sm font-mono break-all">
                      {tenantSettings.whatsapp?.businessId || 'Not set'}
                    </p>
                  </div>
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone Number ID</p>
                    <p className="text-sm font-mono break-all">
                      {tenantSettings.whatsapp?.phoneNumberId || 'Not set'}
                    </p>
                  </div>
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Display Phone</p>
                    <p className="text-sm font-mono break-all">
                      {tenantSettings.whatsapp?.phone || 'Not set'}
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-semibold">Relay & Sync Modes</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
                    <p className="text-sm font-semibold">Official Cloud API</p>
                    <p className="text-xs text-muted-foreground">
                      Best for scale, verified templates, and compliance. Connect WABA and use webhooks.
                    </p>
                  </div>
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
                    <p className="text-sm font-semibold">Android Agent Relay</p>
                    <p className="text-xs text-muted-foreground">
                      Sync via an Android phone when you need app-level automation or local device workflows.
                    </p>
                    <button
                      onClick={() => activateTab('Android Agent')}
                      className="text-xs font-semibold underline"
                    >
                      Open Android Agent
                    </button>
                  </div>
                </div>
              </section>

              <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-semibold">Webhooks</h3>
                <p className="text-sm text-muted-foreground">
                  Use this endpoint in Meta’s app dashboard to receive inbound WhatsApp events.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Webhook URL</p>
                    <p className="text-sm font-mono break-all">{webhookUrl}</p>
                  </div>
                  <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Gateway status</p>
                    <p className="text-sm">{gatewayHealth === 'online' ? 'Online' : 'Offline'}</p>
                  </div>
                </div>
                <button
                  onClick={() => activateTab('Webhooks')}
                  className="text-xs font-semibold underline"
                >
                  Open webhook checklist
                </button>
              </section>
            </div>
          );
      case 'Webhooks':
        return (
          <div className="space-y-6">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold">Webhook Checklist</h2>
              <p className="text-sm text-muted-foreground">
                Configure your Meta app to send WhatsApp events to PropAi Sync.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Webhook URL</p>
                  <p className="text-sm font-mono break-all">{webhookUrl}</p>
                </div>
                <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Gateway status</p>
                  <p className="text-sm">{gatewayHealth === 'online' ? 'Online' : 'Offline'}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>1. Add the webhook URL in your Meta developer console.</p>
                <p>2. Subscribe to the WhatsApp message events you need.</p>
                <p>3. Use your verify token from the Control team (or ask support).</p>
              </div>
            </section>
          </div>
        );
      case 'Conversations':
        return (
          <div className="space-y-6">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold">Conversations</h2>
              <p className="text-sm text-muted-foreground">Live conversation list will appear once the gateway is online.</p>
              <div className="p-4 rounded-xl bg-muted/30 border border-border">
                <p className="text-sm">{gatewayHealth === 'online' ? 'Gateway is live. Conversation sync will appear here.' : 'Gateway offline. Connect to see chats.'}</p>
              </div>
            </section>
          </div>
        );
      case 'Reports':
        return (
          <div className="space-y-6">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold">Reports</h2>
              <p className="text-sm text-muted-foreground">Lead and follow-up reports will generate once conversations are flowing.</p>
            </section>
          </div>
        );
      case 'Auto Tasks':
        return (
          <div className="space-y-6">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold">Auto Tasks</h2>
              <p className="text-sm text-muted-foreground">Schedule WhatsApp follow-ups and reminders once the gateway is online.</p>
            </section>
          </div>
        );
      case 'Assistants':
        return (
          <div className="space-y-6">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold">Team & Roles</h2>
              {!controlToken ? (
                <p className="text-sm text-muted-foreground">Sign in under Settings to manage your team.</p>
              ) : (
                <>
                  <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                    <select
                      value={selectedTenantId}
                      onChange={(event) => setSelectedTenantId(event.target.value)}
                      className="bg-accent/50 border border-border rounded-lg px-3 py-2 text-sm"
                    >
                      {controlTenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                      ))}
                    </select>
                    <button onClick={() => controlToken && selectedTenantId && loadTeamMembers(controlToken, selectedTenantId)} className="text-xs font-semibold underline">
                      Refresh list
                    </button>
                  </div>
                  <div className="space-y-3">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex flex-col md:flex-row md:items-center gap-3 justify-between border border-border rounded-xl p-4">
                        <div>
                          <p className="font-medium">{member.email}</p>
                          <p className="text-xs text-muted-foreground">Role: {member.role}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <select
                            value={member.role}
                            onChange={(event) => handleRoleChange(member.id, event.target.value)}
                            className="bg-accent/50 border border-border rounded-lg px-3 py-2 text-xs"
                          >
                            {['owner', 'manager', 'agent', 'viewer'].map((role) => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                          <button onClick={() => handleRemoveUser(member.id)} className="text-xs text-destructive font-semibold">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        );
      case 'Add-ons':
        return (
          <div className="space-y-6">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold">Add-ons</h2>
              <p className="text-sm text-muted-foreground">Upcoming integrations: CRM sync, marketing automation, analytics exports.</p>
            </section>
          </div>
        );
      case 'Devices':
        return (
          <div className="space-y-6">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-bold">Devices</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-muted/30 border border-border rounded-xl p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Device ID</p>
                  <p className="text-sm font-mono break-all">{deviceId}</p>
                </div>
                <div className="bg-muted/30 border border-border rounded-xl p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Devices used</p>
                  <p className="text-lg font-bold">{licenseInfo?.devicesUsed ?? 0}</p>
                </div>
                <div className="bg-muted/30 border border-border rounded-xl p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Device limit</p>
                  <p className="text-lg font-bold">{licenseInfo?.deviceLimit ?? 2}</p>
                </div>
              </div>
            </section>
          </div>
        );
      case 'Settings':
        return (
          <div className="space-y-6">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-6">
              <h2 className="text-lg font-bold">Identity, Recovery & Team Access</h2>
              {controlUser ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Signed in as</p>
                  <p className="text-sm font-semibold">{controlUser.primaryWhatsapp ?? controlUser.email}</p>
                  <p className="text-xs text-muted-foreground">Backup email: {controlUser.email}</p>
                  <button onClick={handleSignOut} className="text-xs font-semibold text-destructive underline">
                    Sign out
                  </button>
                  <div className="pt-4 space-y-2">
                    <p className="text-sm font-semibold">Set password</p>
                    <input
                      type="password"
                      value={passwordDraft}
                      onChange={(event) => setPasswordDraft(event.target.value)}
                      placeholder="New password"
                      className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2 text-sm"
                    />
                    <button
                      onClick={handleSetPassword}
                      disabled={passwordSaving}
                      className="bg-secondary text-secondary-foreground px-5 py-2 rounded-xl text-sm font-bold"
                    >
                      {passwordSaving ? 'Saving…' : 'Save password'}
                    </button>
                    {passwordMessage && <p className="text-xs text-emerald-500">{passwordMessage}</p>}
                    {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
                    <p className="text-sm font-semibold">Preferred path: continue with WhatsApp</p>
                    <p className="text-sm text-muted-foreground">Use your WhatsApp number as the main identity. We will capture email later as a backup for recovery, billing, and admin tasks.</p>
                    {WHATSAPP_JOIN_URL ? (
                      <a href={WHATSAPP_JOIN_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground hover:opacity-90">
                        Continue with WhatsApp
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">WhatsApp onboarding link not configured yet.</p>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Email sign in (admin or recovery)</p>
                    <input value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="Email" className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2 text-sm" />
                    <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="Password" className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2 text-sm" />
                    <button onClick={handleLogin} disabled={authLoading} className="bg-primary text-primary-foreground px-5 py-3 rounded-xl text-sm font-bold">
                      {authLoading ? 'Signing in…' : 'Sign in'}
                    </button>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Create workspace manually</p>
                    <input value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} placeholder="Backup owner email" className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2 text-sm" />
                    <input type="password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} placeholder="Password (optional admin fallback)" className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2 text-sm" />
                    <p className="text-xs text-muted-foreground">Only use this if you need manual admin access. The normal path is WhatsApp-first.</p>
                    <input value={registerTenant} onChange={(event) => setRegisterTenant(event.target.value)} placeholder="Workspace name" className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2 text-sm" />
                    <button onClick={handleRegister} disabled={authLoading} className="bg-secondary text-secondary-foreground px-5 py-3 rounded-xl text-sm font-bold">
                      {authLoading ? 'Creating…' : 'Create workspace'}
                    </button>
                  </div>
                </div>
                </div>
              )}
              {controlError && <p className="text-sm text-destructive">{controlError}</p>}
              </section>

              <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold">Licensing</h2>
                <p className="text-sm text-muted-foreground">
                  Temporarily bypass licensing checks in the UI while the licensing service is offline.
                </p>
                <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Disable licensing checks</p>
                    <p className="text-xs text-muted-foreground">
                      Chat and setup will stay unblocked until licensing is back online.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={licensingDisabled}
                    onChange={(event) => setLicensingDisabled(event.target.checked)}
                    className="h-5 w-5 accent-primary"
                  />
                </label>
              </section>

              <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-bold">Invite team members</h2>
              {!controlToken ? (
                <p className="text-sm text-muted-foreground">Sign in to invite your team.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col md:flex-row gap-3">
                    <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@agency.com" className="flex-1 bg-accent/50 border border-border rounded-lg px-4 py-2 text-sm" />
                    <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} className="bg-accent/50 border border-border rounded-lg px-3 py-2 text-sm">
                      {['owner', 'manager', 'agent', 'viewer'].map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <button onClick={handleInvite} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold">
                      Invite
                    </button>
                  </div>
                  {inviteToken && (
                    <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs font-mono break-all">
                      Invite token: {inviteToken}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        );
      case 'Admin':
        return (
          <div className="space-y-6">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="space-y-2">
                <h2 className="text-lg font-bold">Platform Admin</h2>
                <p className="text-sm text-muted-foreground">
                  Owner-only workspace management. This tab appears when <span className="font-mono">VITE_ADMIN_UI=true</span>.
                </p>
              </div>
              {!ADMIN_UI_ENABLED && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg p-3">
                  Admin UI is disabled. Set <span className="font-mono">VITE_ADMIN_UI=true</span> and configure
                  <span className="font-mono"> CONTROL_ADMIN_KEY</span> on the web service to enable this view.
                </div>
              )}
              <div className="bg-muted/30 border border-border rounded-xl p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Admin access</p>
                <p className="text-sm text-muted-foreground">
                  Requests are signed server-side with <span className="font-mono">CONTROL_ADMIN_KEY</span>.
                </p>
              </div>
              <div className="flex flex-col md:flex-row gap-3 items-stretch">
                <input
                  value={adminTenantName}
                  onChange={(event) => setAdminTenantName(event.target.value)}
                  placeholder="New workspace name"
                  className="flex-1 bg-accent/50 border border-border rounded-lg px-4 py-2 text-sm"
                />
                <button
                  onClick={handleAdminCreateTenant}
                  disabled={adminCreating}
                  className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold"
                >
                  {adminCreating ? 'Creating…' : 'Create workspace'}
                </button>
              </div>
              {adminError && <p className="text-sm text-destructive">{adminError}</p>}
            </section>

            <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Workspaces</h3>
                  <p className="text-xs text-muted-foreground">Manage broker accounts and owners.</p>
                </div>
                <button
                  onClick={loadAdminTenants}
                  disabled={adminLoading}
                  className="text-xs font-semibold underline"
                >
                  {adminLoading ? 'Refreshing…' : 'Refresh list'}
                </button>
              </div>

              {adminLoading && adminTenants.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading tenants…</p>
              ) : adminTenants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workspaces yet. Create the first one above.</p>
              ) : (
                <div className="space-y-4">
                  {adminTenants.map((tenant) => (
                    <div key={tenant.id} className="border border-border rounded-xl p-4 space-y-3">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ID {tenant.id} · Created {formatDate(tenant.createdAt) ?? '—'}
                          </p>
                        </div>
                        <button
                          onClick={() => loadAdminUsers(tenant.id)}
                          className="text-xs font-semibold underline"
                        >
                          {adminUsersLoading[tenant.id] ? 'Loading…' : 'View users'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="bg-muted/50 border border-border rounded-full px-3 py-1">
                          Members {tenant.members}
                        </span>
                        <span className="bg-muted/50 border border-border rounded-full px-3 py-1">
                          Owners {tenant.owners}
                        </span>
                      </div>
                      {adminUsersByTenant[tenant.id] && (
                        <div className="border-t border-border pt-3 space-y-2">
                          {adminUsersByTenant[tenant.id].length === 0 ? (
                            <p className="text-xs text-muted-foreground">No users attached yet.</p>
                          ) : (
                            adminUsersByTenant[tenant.id].map((user) => (
                              <div key={user.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs">
                                <span className="font-medium">{user.email}</span>
                                <span className="text-muted-foreground">Role: {user.role}</span>
                                <span className="text-muted-foreground">Joined {formatDate(user.joinedAt) ?? '—'}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        );
      case 'Support':
      case 'Activity Log':
      case 'Resources':
      case 'Docs':
        return (
          <div className="space-y-6">
            <section className="bg-card border border-border rounded-2xl p-6 space-y-3">
              <h2 className="text-lg font-bold">{activeTab}</h2>
              <p className="text-sm text-muted-foreground">This section will sync with the gateway and control APIs shortly.</p>
              <Link to="/contact" className="text-sm text-primary hover:underline">Contact support</Link>
            </section>
          </div>
        );
      case 'Android Agent':
        return (
          <div className="space-y-8">
            <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border bg-muted/30">
                <h2 className="text-lg font-bold">Android Agent</h2>
                <p className="text-sm text-muted-foreground">Download and install the PropAi Sync Android Agent to connect your phone and automate your real estate workflow.</p>
              </div>
              <div className="p-8">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold">Get the Android App</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        The Android Agent allows PropAi Sync to securely interact with your WhatsApp and other messaging apps directly from your device.
                      </p>
                    </div>

                    <ul className="space-y-3">
                      {[
                        'Automate lead responses on WhatsApp',
                        'Sync conversations in real-time',
                        'Handle calls and messages automatically',
                        'Secure end-to-end encryption'
                      ].map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-medium">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Zap className="w-3 h-3 text-primary" />
                          </div>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="pt-4 flex flex-col sm:flex-row gap-4">
                      <a 
                        href={ANDROID_APK_URL}
                        className="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-opacity"
                      >
                        <Download className="w-5 h-5" />
                        Download APK
                      </a>
                      <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg border border-border">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Latest Version: 1.2.4</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center space-y-6 p-8 bg-accent/30 rounded-3xl border border-border">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-border">
                      {androidQrCode ? (
                        <img
                          src={androidQrCode}
                          alt="Android setup code"
                          className="w-48 h-48 rounded-lg"
                        />
                      ) : (
                        <div className="w-48 h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden rounded-lg">
                          <div className="absolute inset-0 opacity-10">
                            <div className="grid grid-cols-8 grid-rows-8 h-full w-full">
                              {Array.from({ length: 64 }).map((_, i) => (
                                <div key={i} className={i % 3 === 0 ? 'bg-black' : ''}></div>
                              ))}
                            </div>
                          </div>
                          <Smartphone className="w-12 h-12 text-slate-400 relative z-10" />
                        </div>
                      )}
                    </div>
                    <div className="text-center space-y-2">
                      <p className="font-bold">Scan to Connect</p>
                      <p className="text-xs text-muted-foreground">
                        Generate a setup code, then scan it inside the Android Agent.
                      </p>
                    </div>
                    {androidSetup?.setupCode && (
                      <div className="w-full bg-muted/60 border border-border rounded-xl px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Setup code</p>
                        <p className="text-xs font-mono break-all">{androidSetup.setupCode}</p>
                      </div>
                    )}
                    <button
                      onClick={handleGenerateAndroidSetup}
                      disabled={androidSetupLoading || !setupPairingReady}
                      className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-bold"
                    >
                      {androidSetupLoading ? 'Generating…' : 'Generate setup code + QR'}
                    </button>
                    {!setupPairingReady && (
                      <p className="text-xs text-destructive text-center">
                        Finish the setup checklist before generating a pairing code.
                      </p>
                    )}
                    {androidSetupError && (
                      <p className="text-xs text-destructive text-center">{androidSetupError}</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border bg-muted/30">
                <h2 className="text-lg font-bold">Installation Guide</h2>
              </div>
              <div className="p-8">
                <div className="grid sm:grid-cols-3 gap-8">
                  {[
                    { step: '01', title: 'Download', desc: 'Download the APK file to your Android device.' },
                    { step: '02', title: 'Allow Install', desc: 'Enable "Install from Unknown Sources" in your device settings.' },
                    { step: '03', title: 'Connect', desc: 'Open the app and scan the pairing code from your dashboard.' }
                  ].map((item) => (
                    <div key={item.step} className="space-y-3">
                      <div className="text-3xl font-display font-black text-primary/20">{item.step}</div>
                      <h4 className="font-bold">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border bg-muted/30 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-bold">Device Approval</h2>
                  <p className="text-sm text-muted-foreground">Approve or remove Android devices linked to this workspace.</p>
                </div>
                <button
                  onClick={() => controlToken && selectedTenantId && loadAndroidDevices(controlToken, selectedTenantId)}
                  className="text-xs font-semibold underline"
                  disabled={androidDevicesLoading}
                >
                  {androidDevicesLoading ? 'Refreshing…' : 'Refresh list'}
                </button>
              </div>
              <div className="p-8 space-y-6">
                {!controlToken ? (
                  <p className="text-sm text-muted-foreground">Sign in under Settings to manage device approvals.</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">Pending approvals</h3>
                      {androidDevices.pending.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No pending devices.</p>
                      ) : (
                        <div className="space-y-3">
                          {androidDevices.pending.map((device) => (
                            <div key={device.requestId} className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/40 border border-border rounded-xl px-4 py-3">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold">{device.displayName || device.deviceId}</p>
                                <p className="text-xs text-muted-foreground">
                                  {device.platform || 'Android'} · {device.deviceFamily || 'phone'} · {formatTimestamp(device.ts)}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveAndroidDevice(device.requestId)}
                                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-semibold"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectAndroidDevice(device.requestId)}
                                  className="bg-muted text-foreground px-4 py-2 rounded-lg text-xs font-semibold border border-border"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">Paired devices</h3>
                      {androidDevices.paired.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No paired devices yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {androidDevices.paired.map((device) => (
                            <div key={device.deviceId} className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/40 border border-border rounded-xl px-4 py-3">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold">{device.displayName || device.deviceId}</p>
                                <p className="text-xs text-muted-foreground">
                                  {device.platform || 'Android'} · {device.deviceFamily || 'phone'} · Approved {formatTimestamp(device.approvedAtMs)}
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemoveAndroidDevice(device.deviceId)}
                                className="bg-muted text-foreground px-4 py-2 rounded-lg text-xs font-semibold border border-border"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[600px] text-center space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <Settings className="text-muted-foreground w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold">{activeTab}</h2>
            <p className="text-muted-foreground max-w-sm">This section is currently under development. Please check back soon.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-[60] md:hidden backdrop-blur-sm"
            />
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-card border-r border-border flex flex-col z-[70] md:hidden overflow-y-auto"
            >
              <div className="p-6 flex items-center justify-between">
                <Link to={getPathForTab('Assistant')} className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
                    <ZapIcon className="text-primary-foreground w-5 h-5" />
                  </div>
                  <span className="font-display font-bold text-xl tracking-tight">PropAi Sync</span>
                </Link>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 hover:bg-accent rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 px-4 space-y-6 pb-8">
                {sidebarGroups.map((group) => (
                  <div key={group.label} className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2 flex items-center justify-between">
                      {group.label}
                      <span className="opacity-50">−</span>
                    </p>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          activateTab(item.id, { closeSidebar: true });
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium",
                          activeTab === item.id 
                            ? "bg-primary/10 text-primary" 
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="w-56 lg:w-64 bg-card border-r border-border hidden md:flex flex-col z-50 overflow-y-auto">
        <div className="p-6">
          <Link to={getPathForTab('Assistant')} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <ZapIcon className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">PropAi Sync</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-6 pb-8">
          {sidebarGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2 flex items-center justify-between">
                {group.label}
                <span className="opacity-50">−</span>
              </p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => activateTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium",
                    activeTab === item.id 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 md:h-20 border-b border-border bg-card flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-3 md:gap-8">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-accent rounded-lg transition-colors md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="space-y-0.5">
              <h1 className="text-xs md:text-sm font-bold leading-none text-primary">PropAi Sync</h1>
              <p className="hidden sm:block text-[10px] text-primary font-bold uppercase tracking-wider">Real Estate Assistant</p>
            </div>

            <div className="hidden md:block h-8 w-px bg-border mx-2"></div>

            <div className="hidden md:block space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Version</p>
              <p className="text-xs font-medium">{APP_VERSION}</p>
            </div>

            <div className="hidden md:block h-8 w-px bg-border mx-2"></div>

            <div className="hidden sm:block space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Health</p>
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full animate-pulse",
                    gatewayHealth === 'online' && 'bg-emerald-500',
                    gatewayHealth === 'checking' && 'bg-amber-400',
                    gatewayHealth === 'offline' && 'bg-destructive'
                  )}
                ></div>
                <p className="text-xs font-medium">
                  {gatewayHealth === 'online' ? 'Online' : gatewayHealth === 'checking' ? 'Checking' : 'Offline'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold border border-border">
              JD
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10">
          {activeTab !== 'Setup' && (setupCheckError || (setupCheck && !setupReady)) && (
            <div className="sticky top-0 z-20 mb-4">
              <div className="bg-destructive/10 border border-destructive/40 rounded-2xl px-4 py-3 md:px-6 md:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-destructive">Setup incomplete</p>
                  {setupCheckError ? (
                    <p className="text-xs text-destructive">
                      {setupCheckError}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Finish setup to unlock onboarding and device pairing.
                      {setupMissingSummary ? ` Missing: ${setupMissingSummary}.` : ''}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadSetupCheck}
                    disabled={setupCheckLoading}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-border bg-card hover:bg-accent"
                  >
                    {setupCheckLoading ? 'Checking…' : 'Recheck'}
                  </button>
                  <button
                    onClick={() => activateTab('Setup')}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-destructive text-destructive-foreground"
                  >
                    Go to setup
                  </button>
                </div>
              </div>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
    >
      <path d="M14 2L4 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}


