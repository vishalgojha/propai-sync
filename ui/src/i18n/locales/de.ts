import type { TranslationMap } from "../lib/types.ts";

export const de: TranslationMap = {
  common: {
    version: "Version",
    health: "Status",
    ok: "OK",
    offline: "Offline",
    connect: "Verbinden",
    refresh: "Aktualisieren",
    enabled: "Aktiviert",
    disabled: "Deaktiviert",
    na: "k. A.",
    docs: "Dokumentation",
    resources: "Ressourcen",
  },
  nav: {
    chat: "Chat",
    control: "Steuerung",
    agent: "Agent",
    settings: "Einstellungen",
    expand: "Seitenleiste ausklappen",
    collapse: "Seitenleiste einklappen",
  },
  tabs: {
    agents: "Agenten",
    overview: "Übersicht",
    channels: "Kanäle",
    instances: "Instanzen",
    sessions: "Sitzungen",
    usage: "Nutzung",
    cron: "Agent-Aufgaben",
    skills: "Fähigkeiten",
    nodes: "Geräte",
    chat: "Chat",
    config: "Konfiguration",
    debug: "Debug",
    logs: "Protokolle",
  },
  subtitles: {
    agents: "Agent-Arbeitsbereiche, Tools und Identitäten verwalten.",
    overview: "Gateway-Status, Einstiegspunkte und eine schnelle Zustandsprüfung.",
    channels: "Kanäle und Einstellungen verwalten.",
    instances: "Präsenzsignale von verbundenen Clients und Geräten.",
    sessions: "Aktive Sitzungen inspizieren und Standardeinstellungen pro Sitzung anpassen.",
    usage: "API-Nutzung und Kosten überwachen.",
    cron: "Aufweckzeiten und wiederkehrende Agent-Aufgaben planen.",
    skills: "Skill-Verfügbarkeit und API-Schlüsselinjektion verwalten.",
    nodes: "Gekoppelte Geräte, Fähigkeiten und Befehlsfreigabe.",
    chat: "Direkte Gateway-Chat-Sitzung für schnelle Eingriffe.",
    config: "~/.openclaw/openclaw.json sicher bearbeiten.",
    debug: "Gateway-Snapshots, Ereignisse und manuelle RPC-Aufrufe.",
    logs: "Live-Verfolgung der Gateway-Protokolldateien.",
  },
  overview: {
    access: {
      title: "Gateway-Zugang",
      subtitle: "Wo sich das Dashboard verbindet und wie es sich authentifiziert.",
      wsUrl: "WebSocket-URL",
      token: "Gateway-Token",
      password: "Passwort (nicht gespeichert)",
      sessionKey: "Standard-Sitzungsschlüssel",
      language: "Sprache",
      connectHint: "Klicken Sie auf Verbinden, um Verbindungsänderungen anzuwenden.",
      trustedProxy: "Authentifiziert über vertrauenswürdigen Proxy.",
    },
    snapshot: {
      title: "Snapshot",
      subtitle: "Neueste Gateway-Handshake-Informationen.",
      status: "Status",
      uptime: "Betriebszeit",
      tickInterval: "Tick-Intervall",
      lastChannelsRefresh: "Letzte Kanalaktualisierung",
      channelsHint:
        "Verwenden Sie Kanäle, um WhatsApp, Telegram, Discord, Signal oder iMessage zu verknüpfen.",
    },
    stats: {
      instances: "Instanzen",
      instancesHint: "Präsenzsignale in den letzten 5 Minuten.",
      sessions: "Sitzungen",
      sessionsHint: "Letzte vom Gateway verfolgte Sitzungsschlüssel.",
      cron: "Agent-Aufgaben",
      cronNext: "Nächste Ausführung {time}",
    },
    notes: {
      title: "Notizen",
      subtitle: "Kurze Hinweise für Remote-Steuerung.",
      tailscaleTitle: "Tailscale Serve",
      tailscaleText:
        "Bevorzugen Sie den Serve-Modus, um das Gateway auf Loopback mit Tailnet-Auth zu halten.",
      sessionTitle: "Sitzungshygiene",
      sessionText: "Verwenden Sie /new oder sessions.patch, um den Kontext zurückzusetzen.",
      cronTitle: "Agent-Aufgaben-Erinnerungen",
      cronText: "Verwenden Sie isolierte Sitzungen für wiederkehrende Läufe.",
    },
    auth: {
      required:
        "Dieses Gateway erfordert Authentifizierung. Fügen Sie ein Token oder Passwort hinzu und klicken Sie auf Verbinden.",
      failed:
        "Authentifizierung fehlgeschlagen. Kopieren Sie erneut eine URL mit Token über {command}, oder aktualisieren Sie das Token und klicken Sie auf Verbinden.",
    },
    pairing: {
      hint: "Dieses Gerät benötigt eine Pairing-Freigabe vom Gateway-Host.",
      mobileHint:
        "Auf dem Mobilgerät? Kopieren Sie die vollständige URL (einschließlich #token=...) von openclaw dashboard --no-open auf Ihrem Desktop.",
    },
    insecure: {
      hint: "Diese Seite ist HTTP, daher blockiert der Browser die Geräteidentifikation. Verwenden Sie HTTPS (Tailscale Serve) oder öffnen Sie {url} auf dem Gateway-Host.",
      stayHttp: "Wenn Sie bei HTTP bleiben müssen, setzen Sie {config} (nur Token).",
    },
  },
  chat: {
    disconnected: "Verbindung zum Gateway getrennt.",
    refreshTitle: "Chat-Daten aktualisieren",
    thinkingToggle: "Ausgabe des Assistenten ein-/ausblenden",
    focusToggle: "Fokusmodus ein-/ausschalten (Seitenleiste + Kopfzeile ausblenden)",
    hideCronSessions: "Agent-Aufgaben-Sitzungen ausblenden",
    showCronSessions: "Agent-Aufgaben-Sitzungen anzeigen",
    showCronSessionsHidden: "Agent-Aufgaben-Sitzungen anzeigen ({count} ausgeblendet)",
    onboardingDisabled: "Während der Einrichtung deaktiviert",
  },
  languages: {
    en: "English",
    zhCN: "简体中文 (Vereinfachtes Chinesisch)",
    zhTW: "繁體中文 (Traditionelles Chinesisch)",
    ptBR: "Português (Brasilianisches Portugiesisch)",
    de: "Deutsch",
  },
  cron: {
    templates: {
      title: "Schnellvorlagen",
      subtitle: "Wählen Sie eine fertige Aufgabe und passen Sie Details in Sekunden an.",
      apply: "Vorlage verwenden",
      schedule: {
        every15Minutes: "Alle 15 Min.",
        every30Minutes: "Alle 30 Min.",
        every2Hours: "Alle 2 Std.",
        every6Hours: "Alle 6 Std.",
        daily10am: "Täglich 10:00",
        monday8am: "Mo 08:00",
      },
      listingBroadcast: {
        title: "Listing Broadcast",
        subtitle: "Neueste Listings in freigegebenen WhatsApp-Gruppen veröffentlichen.",
        name: "Listing Broadcast",
        description: "Neue Objekte in sauberem, maklerfreundlichem Format teilen.",
        prompt:
          "Sammle die neuesten Listings und erstelle ein kurzes WhatsApp-Update mit Preis, Fläche und wichtigsten Highlights.",
      },
      buyerMatchAlerts: {
        title: "Buyer Match Alerts",
        subtitle: "Passende Käuferanforderungen finden und Makler schnell informieren.",
        name: "Buyer Match Alerts",
        description: "Neue Anforderungen laufend mit aktivem Bestand abgleichen.",
        prompt:
          "Prüfe neue Käuferanforderungen, gleiche sie mit aktiven Listings ab und sende Treffer mit kurzer Begründung.",
      },
      leadFollowup: {
        title: "Lead Follow-up Plan",
        subtitle: "Die heutige Follow-up-Warteschlange aus heißen/warmen Leads aufbauen.",
        name: "Lead Follow-up Plan",
        description: "Rückrufe und WhatsApp-Follow-ups nach Dringlichkeit priorisieren.",
        prompt:
          "Analysiere Lead-Konversationen, priorisiere nach Dringlichkeit und erstelle eine klare Follow-up-Liste für heute.",
      },
      groupEngagement: {
        title: "Group Engagement Pulse",
        subtitle: "Nützliche Gruppeninhalte aus aktiven Listings vorschlagen.",
        name: "Group Engagement Pulse",
        description: "Maklergruppen aktiv halten, ohne zu spammen.",
        prompt:
          "Entwirf ein wertorientiertes Gruppen-Update aus aktivem Bestand mit kurzem Call-to-Action.",
      },
      staleLeadRescue: {
        title: "Stale Lead Rescue",
        subtitle: "Inaktive Leads erkennen und Reaktivierungsnachricht vorschlagen.",
        name: "Stale Lead Rescue",
        description: "Leads zurückholen, die nach Erstinteresse verstummt sind.",
        prompt:
          "Finde Leads ohne aktuelle Antwort, schlage eine personalisierte Reaktivierungsnachricht vor und priorisiere nach Potenzial.",
      },
      weeklyDigest: {
        title: "Weekly Broker Digest",
        subtitle: "Wöchentliche Zusammenfassung von Listings, Leads und Matches senden.",
        name: "Weekly Broker Digest",
        description: "Management-Zusammenfassung für einen oder mehrere Makler.",
        prompt:
          "Fasse die Woche zusammen: neue Listings, Leads mit hoher Absicht, Match-Ergebnisse und empfohlene nächste Schritte.",
      },
    },
  },
};
