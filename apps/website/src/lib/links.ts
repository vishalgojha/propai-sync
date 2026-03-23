export const APP_URL =
  import.meta.env.VITE_APP_URL ?? 'https://app.propai.live';

export const ANDROID_APK_URL =
  import.meta.env.VITE_ANDROID_APK_URL ??
  'https://www.propai.live/downloads/propai-sync-android-latest.apk';

export const WHATSAPP_JOIN_URL =
  import.meta.env.VITE_WHATSAPP_JOIN_URL ?? '';

export const LICENSING_DISABLED =
  (import.meta.env.VITE_DISABLE_LICENSING ?? '').toString().toLowerCase() === 'true';

export const ADMIN_UI_ENABLED =
  (import.meta.env.VITE_ADMIN_UI ?? '').toString().toLowerCase() === 'true';
