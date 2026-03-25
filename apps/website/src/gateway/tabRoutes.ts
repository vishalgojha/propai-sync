export const APP_TAB_ROUTES = [
  { id: 'Assistant', path: '/assistant' },
  { id: 'Dashboard', path: '/dashboard' },
  { id: 'Usage', path: '/usage' },
  { id: 'Setup', path: '/setup' },
  { id: 'WhatsApp', path: '/whatsapp' },
  { id: 'Webhooks', path: '/webhooks' },
  { id: 'Conversations', path: '/conversations' },
  { id: 'Reports', path: '/reports' },
  { id: 'Auto Tasks', path: '/auto-tasks' },
  { id: 'Assistants', path: '/assistants' },
  { id: 'Add-ons', path: '/add-ons' },
  { id: 'Devices', path: '/devices' },
  { id: 'Android Agent', path: '/android-agent' },
  { id: 'Settings', path: '/settings' },
  { id: 'Admin', path: '/admin' },
  { id: 'Support', path: '/support' },
  { id: 'Activity Log', path: '/activity-log' },
  { id: 'Resources', path: '/resources' },
  { id: 'Docs', path: '/docs' },
] as const;

export type DashboardTabId = (typeof APP_TAB_ROUTES)[number]['id'];

const DEFAULT_TAB_ID: DashboardTabId = 'Assistant';

const TAB_PATH_BY_ID = new Map<DashboardTabId, string>(
  APP_TAB_ROUTES.map((route) => [route.id, route.path]),
);

const TAB_ID_BY_PATH = new Map<string, DashboardTabId>(
  APP_TAB_ROUTES.map((route) => [route.path, route.id]),
);

TAB_ID_BY_PATH.set('/', DEFAULT_TAB_ID);
TAB_ID_BY_PATH.set('/app', DEFAULT_TAB_ID);

function normalizePathname(pathname: string) {
  if (!pathname || pathname === '/') {
    return '/';
  }
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function getPathForTab(tabId: DashboardTabId) {
  return TAB_PATH_BY_ID.get(tabId) ?? TAB_PATH_BY_ID.get(DEFAULT_TAB_ID) ?? '/assistant';
}

export function getTabForPath(pathname: string): DashboardTabId | null {
  return TAB_ID_BY_PATH.get(normalizePathname(pathname)) ?? null;
}

export const APP_DASHBOARD_ROUTE_PATHS = ['/', '/app', ...APP_TAB_ROUTES.map((route) => route.path)];
