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
  Cpu,
  Package,
  Monitor,
  AlertCircle,
  Menu,
  X,
  Download
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { ANDROID_APK_URL } from '../../lib/links';
import { apiGet, apiPost, apiDeleteAuth, apiGetAuth, apiPatchAuth, apiPostAuth, apiPutAuth } from '../../lib/api';
import QRCode from 'qrcode';

const APP_VERSION = 'web-2026.3.11';
const DEVICE_ID_KEY = 'propai_device_id';
const ACTIVATION_KEY_STORAGE = 'propai_activation_key';
const ACTIVATION_TOKEN_STORAGE = 'propai_activation_token';
const CONTROL_TOKEN_STORAGE = 'propai_control_token';
const CONTROL_TENANT_STORAGE = 'propai_control_tenant';

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

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
};

type ControlUser = {
  id: string;
  email: string;
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

type TenantSettings = {
  onboardingComplete?: boolean;
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
  const [activeTab, setActiveTab] = useState('Assistant');
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
  const [controlUser, setControlUser] = useState<ControlUser | null>(null);
  const [controlTenants, setControlTenants] = useState<ControlTenant[]>([]);
  const [teamMembers, setTeamMembers] = useState<ControlUserRow[]>([]);
  const [controlError, setControlError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerTenant, setRegisterTenant] = useState('');
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
    if (typeof document === 'undefined') {
      return;
    }
    document.title = 'PropAi Sync Control';
  }, []);

  useEffect(() => {
    void loadSetupCheck();
  }, []);

  useEffect(() => {
    if (activeTab !== 'Setup') {
      return;
    }
    void loadSetupCheck();
  }, [activeTab]);

  useEffect(() => {
    if (!setupCheck) {
      return;
    }
    if (setupReady) {
      setSetupAutoOpened(false);
      return;
    }
    if (!setupAutoOpened) {
      setActiveTab('Setup');
      setSetupAutoOpened(true);
    }
  }, [setupCheck, setupReady, setupAutoOpened]);

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
    if (!registerEmail.trim() || !registerPassword.trim() || !registerTenant.trim()) {
      setControlError('Email, password, and workspace name are required.');
      return;
    }
    setAuthLoading(true);
    setControlError(null);
    try {
      const response = await apiPostAuth<{
        token: string;
        user: ControlUser;
        tenant: ControlTenant;
      }>('/control/v1/auth/register', {
        email: registerEmail.trim(),
        password: registerPassword,
        tenantName: registerTenant.trim(),
      });
      setControlToken(response.token);
      setControlUser(response.user);
      setControlTenants([response.tenant]);
      setSelectedTenantId(response.tenant.id);
    } catch (error) {
      setControlError(normalizeError(error, 'Account setup failed.'));
    } finally {
      setAuthLoading(false);
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

  useEffect(() => {
    loadGatewayHealth();
    loadFullHealth();
  }, []);

  useEffect(() => {
    if (activationToken || activationKey) {
      handleRefreshStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!controlToken) {
      return;
    }
    loadControlProfile(controlToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlToken]);

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
      setActiveTab('Setup');
    }
  }, [tenantSettings.onboardingComplete, controlToken, activeTab]);

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

  const licenseActive = trialStatus === 'active';
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
      label: 'Gateway auth token',
      ok: setupGatewayAuthReady,
      detail: 'Set PROPAI_GATEWAY_TOKEN on the gateway service.',
    },
    {
      id: 'provider-key',
      label: 'AI provider key',
      ok: setupAnyProviderReady,
      detail: 'Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or XAI_API_KEY on the gateway.',
    },
    {
      id: 'control-link',
      label: 'Control API link',
      ok: setupControlLinkReady,
      detail: 'Set CONTROL_GATEWAY_URL and CONTROL_GATEWAY_TOKEN on control-api.',
    },
  ];
  const setupChecklistAllOk = setupChecklist.every((item) => item.ok);
  const setupMissingLabels = setupChecklist.filter((item) => !item.ok).map((item) => item.label);
  const setupMissingSummary = setupMissingLabels.length > 0 ? setupMissingLabels.join(' · ') : '';
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
      items: [
        { id: 'Settings', label: 'Settings', icon: Settings },
        { id: 'Support', label: 'Support', icon: LifeBuoy },
        { id: 'Activity Log', label: 'Activity Log', icon: ClipboardList },
        { id: 'Resources', label: 'Resources', icon: FolderOpen },
        { id: 'Docs', label: 'Docs', icon: FileText },
      ]
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
                {licenseActive ? (
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
                      {!licenseActive ? (
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
        case 'Setup':
          return (
            <div className="space-y-6">
              <section className="bg-card border border-border rounded-2xl p-6 space-y-2">
                <h2 className="text-lg font-bold">Setup your workspace</h2>
                <p className="text-sm text-muted-foreground">
                  Add your AI keys, WhatsApp details, and choose what PropAi should handle automatically.
                </p>
                {settingsMessage && (
                  <div className="text-xs text-emerald-600 font-semibold">{settingsMessage}</div>
                )}
                {settingsError && (
                  <div className="text-xs text-destructive font-semibold">{settingsError}</div>
                )}
              </section>

              <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">Setup checklist</h3>
                    <p className="text-sm text-muted-foreground">
                      These must be ready before onboarding and device pairing.
                    </p>
                  </div>
                  <button
                    onClick={loadSetupCheck}
                    disabled={setupCheckLoading}
                    className="text-xs font-semibold underline"
                  >
                    {setupCheckLoading ? 'Checking…' : 'Recheck'}
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Need help setting env vars? Copy the starter block below.
                    </p>
                    <button
                      onClick={copySetupEnvSnippet}
                      className="text-xs font-semibold underline"
                    >
                      Copy env snippet
                    </button>
                  </div>
                  <pre className="text-[11px] leading-relaxed bg-muted/40 border border-border rounded-xl p-3 overflow-x-auto">
                    {setupEnvSnippet}
                  </pre>
                </div>
                {setupCheckError && (
                  <p className="text-xs text-destructive">{setupCheckError}</p>
                )}
                <div className="space-y-3">
                  {setupChecklist.map((item) => (
                    <div key={item.id} className="flex gap-3 items-start bg-muted/40 border border-border rounded-xl px-4 py-3">
                      {item.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.detail}</p>
                        {item.id === 'provider-key' && setupCheck && (
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            OpenAI: {setupProviderKeys.openai ? 'On' : 'Off'} · Anthropic:{' '}
                            {setupProviderKeys.anthropic ? 'On' : 'Off'} · xAI:{' '}
                            {setupProviderKeys.xai ? 'On' : 'Off'} · ElevenLabs:{' '}
                            {setupProviderKeys.elevenlabs ? 'On' : 'Off'}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {setupCheck && (
                  <div className="text-xs font-semibold">
                    {setupChecklistAllOk ? (
                      <span className="text-emerald-600">All setup checks passed.</span>
                    ) : (
                      <span className="text-destructive">Complete the missing items above to continue.</span>
                    )}
                  </div>
                )}
              </section>

              {!controlToken ? (
                <section className="bg-card border border-border rounded-2xl p-6 space-y-3">
                  <h3 className="text-base font-semibold">Sign in to continue</h3>
                  <p className="text-sm text-muted-foreground">
                    Use your email to sign in and connect this workspace.
                  </p>
                  <button
                    onClick={() => setActiveTab('Settings')}
                    className="px-5 py-3 rounded-xl border border-border text-sm font-semibold hover:bg-accent"
                  >
                    Go to sign in
                  </button>
                </section>
              ) : (
                <>
                  <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <h3 className="text-base font-semibold">WhatsApp details</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">WhatsApp number</label>
                        <input
                          value={settingsDraft.whatsappPhone}
                          onChange={(event) =>
                            setSettingsDraft((prev) => ({ ...prev, whatsappPhone: event.target.value }))
                          }
                          placeholder="+91 98765 43210"
                          className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
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
                  </section>

                  <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <h3 className="text-base font-semibold">AI provider keys</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">OpenAI API key</label>
                        <input
                          type="password"
                          value={settingsDraft.openaiKey}
                          onChange={(event) =>
                            setSettingsDraft((prev) => ({ ...prev, openaiKey: event.target.value }))
                          }
                          placeholder={hasOpenAiKey ? 'Saved — enter to replace' : 'sk-...'}
                          className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Anthropic API key</label>
                        <input
                          type="password"
                          value={settingsDraft.anthropicKey}
                          onChange={(event) =>
                            setSettingsDraft((prev) => ({ ...prev, anthropicKey: event.target.value }))
                          }
                          placeholder={hasAnthropicKey ? 'Saved — enter to replace' : 'sk-ant-...'}
                          className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">xAI API key</label>
                        <input
                          type="password"
                          value={settingsDraft.xaiKey}
                          onChange={(event) =>
                            setSettingsDraft((prev) => ({ ...prev, xaiKey: event.target.value }))
                          }
                          placeholder={hasXaiKey ? 'Saved — enter to replace' : 'xai-...'}
                          className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Groq API key</label>
                        <input
                          type="password"
                          value={settingsDraft.groqKey}
                          onChange={(event) =>
                            setSettingsDraft((prev) => ({ ...prev, groqKey: event.target.value }))
                          }
                          placeholder={hasGroqKey ? 'Saved — enter to replace' : 'gsk_...'}
                          className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">OpenRouter API key</label>
                        <input
                          type="password"
                          value={settingsDraft.openrouterKey}
                          onChange={(event) =>
                            setSettingsDraft((prev) => ({ ...prev, openrouterKey: event.target.value }))
                          }
                          placeholder={hasOpenRouterKey ? 'Saved — enter to replace' : 'sk-or-...'}
                          className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">ElevenLabs API key</label>
                        <input
                          type="password"
                          value={settingsDraft.elevenKey}
                          onChange={(event) =>
                            setSettingsDraft((prev) => ({ ...prev, elevenKey: event.target.value }))
                          }
                          placeholder={hasElevenKey ? 'Saved — enter to replace' : 'eleven_...'}
                          className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <h3 className="text-base font-semibold">AI chat routing</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Chat provider</label>
                        <select
                          value={settingsDraft.chatProvider}
                          onChange={(event) => {
                            const provider = event.target.value;
                            setSettingsDraft((prev) => ({
                              ...prev,
                              chatProvider: provider,
                              chatModel: resolveDefaultChatModel(provider),
                            }));
                          }}
                          className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        >
                          {CHAT_PROVIDER_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Default model</label>
                        <input
                          value={settingsDraft.chatModel}
                          onChange={(event) =>
                            setSettingsDraft((prev) => ({ ...prev, chatModel: event.target.value }))
                          }
                          placeholder={resolveDefaultChatModel(settingsDraft.chatProvider)}
                          className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      We’ll route chat to the provider you pick. Use model IDs like `gpt-4.1-mini`, `claude-3-5-haiku-20241022`,
                      `anthropic/claude-3.5-sonnet`, or `llama-3.1-8b-instant`.
                    </p>
                  </section>

                  <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <h3 className="text-base font-semibold">Voice (ElevenLabs)</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">TTS provider</label>
                        <select
                          value={settingsDraft.ttsProvider}
                          onChange={(event) =>
                            setSettingsDraft((prev) => ({ ...prev, ttsProvider: event.target.value }))
                          }
                          className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        >
                          {TTS_PROVIDER_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Voice name</label>
                        <input
                          value={settingsDraft.ttsVoice}
                          onChange={(event) =>
                            setSettingsDraft((prev) => ({ ...prev, ttsVoice: event.target.value }))
                          }
                          placeholder="Rachel"
                          className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Voice output will use ElevenLabs when available.
                    </p>
                  </section>

                  <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <h3 className="text-base font-semibold">Choose your skills</h3>
                    <p className="text-sm text-muted-foreground">
                      Pick the workflows PropAi should focus on first.
                    </p>
                    <div className="grid md:grid-cols-2 gap-3">
                      {SKILL_OPTIONS.map((skill) => {
                        const checked = settingsDraft.skills.includes(skill.id);
                        return (
                          <label key={skill.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                setSettingsDraft((prev) => {
                                  const next = new Set(prev.skills);
                                  if (event.target.checked) {
                                    next.add(skill.id);
                                  } else {
                                    next.delete(skill.id);
                                  }
                                  return { ...prev, skills: Array.from(next) };
                                });
                              }}
                            />
                            {skill.label}
                          </label>
                        );
                      })}
                    </div>
                  </section>

                  <section className="bg-card border border-border rounded-2xl p-6 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold">Finish setup</h3>
                        <p className="text-sm text-muted-foreground">Save your setup and mark onboarding complete.</p>
                      </div>
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={settingsDraft.onboardingComplete}
                          disabled={!setupReady}
                          onChange={(event) =>
                            setSettingsDraft((prev) => ({ ...prev, onboardingComplete: event.target.checked }))
                          }
                        />
                        Mark setup as complete
                      </label>
                      {!setupReady && (
                        <p className="text-xs text-destructive">
                          Complete the setup checklist before marking onboarding complete.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={saveTenantSettings}
                      disabled={settingsSaving}
                      className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-60"
                    >
                      {settingsSaving ? 'Saving…' : 'Save setup'}
                    </button>
                  </section>
                </>
              )}
            </div>
          );
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
                    onClick={() => setActiveTab('Setup')}
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
                      onClick={() => setActiveTab('Android Agent')}
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
                  onClick={() => setActiveTab('Webhooks')}
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
              <h2 className="text-lg font-bold">Account & Team Access</h2>
              {controlUser ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Signed in as</p>
                  <p className="text-sm font-semibold">{controlUser.email}</p>
                  <button onClick={handleSignOut} className="text-xs font-semibold text-destructive underline">
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Sign in</p>
                    <input value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="Email" className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2 text-sm" />
                    <input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="Password" className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2 text-sm" />
                    <button onClick={handleLogin} disabled={authLoading} className="bg-primary text-primary-foreground px-5 py-3 rounded-xl text-sm font-bold">
                      {authLoading ? 'Signing in…' : 'Sign in'}
                    </button>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Create workspace</p>
                    <input value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} placeholder="Owner email" className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2 text-sm" />
                    <input type="password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} placeholder="Password" className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2 text-sm" />
                    <input value={registerTenant} onChange={(event) => setRegisterTenant(event.target.value)} placeholder="Workspace name" className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2 text-sm" />
                    <button onClick={handleRegister} disabled={authLoading} className="bg-secondary text-secondary-foreground px-5 py-3 rounded-xl text-sm font-bold">
                      {authLoading ? 'Creating…' : 'Create workspace'}
                    </button>
                  </div>
                </div>
              )}
              {controlError && <p className="text-sm text-destructive">{controlError}</p>}
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
                <Link to="/" className="flex items-center gap-2">
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
                          setActiveTab(item.id);
                          setIsSidebarOpen(false);
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
          <Link to="/" className="flex items-center gap-2">
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
                  onClick={() => setActiveTab(item.id)}
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
          {(setupCheckError || (setupCheck && !setupReady)) && (
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
                    onClick={() => setActiveTab('Setup')}
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
