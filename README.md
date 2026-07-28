# O-Launcher — GNOME Shell Extension

A floating dashboard for GNOME Shell **48–50**, built with TypeScript/GJS and a
provider-per-data-source architecture. Wraps a fast app launcher in a full
dashboard — weather, calendar, music, live system stats, and notifications
around it, all in a single modal dialog.

## Layout

```
┌──────────────┬──────────────────────────────┬──────────────────┐
│  Weather      │  Search apps…                │  ⏺CPU ⏺RAM ⏺Disk │
│  Calendar     │  ┌──────┬───────────────────┐│  Notifications   │
│  Music        │  │ Home │  app  app  app     ││  (grouped by app)│
│  (glass,      │  │ Dev  │  app  app  app     ││  (glass,         │
│   blurred)    │  │ ...  │  app  app  app     ││   blurred)       │
│               │  └──────┴───────────────────┘│                  │
│               │  (sharp, opaque — no blur)    │                  │
└──────────────┴──────────────────────────────┴──────────────────┘
```

The middle launcher panel is intentionally **not** translucent — it's the
densest, most text-heavy surface, so it stays sharp while everything around it
is glassmorphic. Toggle with `Super+D` (configurable in prefs).

## Features

| Area | Behaviour |
|---|---|
| **Weather** | Live conditions from [Open-Meteo](https://open-meteo.com) (no API key), city label + lat/lon configurable, refreshes on a user-set interval |
| **Calendar** | Month grid, `‹`/`›` navigation, click any day to select it |
| **Music** | MPRIS via DBus — auto-detects whatever's playing (Spotify, browsers, VLC, …), play/pause/skip, album art for `file://` URIs |
| **System stats** | CPU/RAM/Disk rings read from `/proc` and the VFS — no GTop dependency |
| **Notifications** | Mirrors GNOME Shell's own message tray, grouped by app, most recent first |
| **App launcher** | Search-as-you-type, category sidebar (hover-to-switch), favorites-first empty state, right-click to pin a favorite |

## Prerequisites

- GNOME Shell 46–50
- `pnpm`, `glib-compile-schemas`, `zip`
- No extra native packages — stats read `/proc` directly, weather has no API
  key requirement, MPRIS uses standard DBus

## Install & Development

```bash
# Build (TypeScript → JS, copy schema + assets, compile GSettings schema)
make build

# Install into ~/.local/share/gnome-shell/extensions/
make install

# Restart GNOME Shell, then enable:
# Wayland: log out/in  |  X11: Alt+F2 → r → Enter
gnome-extensions enable o-launcher@oliwebd.github.com
```

Live-reload with shell logs tailed:

```bash
make dev-install
```

Open preferences (shortcut, background style, weather location/units, refresh
intervals):

```bash
gnome-extensions prefs o-launcher@oliwebd.github.com
```

Package a release zip:

```bash
make pack
```

Additional targets: `make lint`, `make lint-fix`, `make format`,
`make format-check`, `make clean`.

## Project structure

```
ormic-dashboard/
  ├── extension.ts                # Entry point: keybinding, owns DashboardDialog
  ├── DashboardDialog.ts          # Floating container: modal grab, 3-column layout, wiring
  ├── prefs.ts                    # Libadwaita preferences window
  ├── utils.ts                    # timeoutOnce / idleOnce / easeActor shims (46→50 compat)
  ├── types.ts                    # Shared data shapes for providers ↔ widgets
  ├── stylesheet.css              # Material 3 glass theme
  ├── providers/
  │   ├── AppProvider.ts          # GMenu app indexing, categories, search, favorites
  │   ├── WeatherProvider.ts      # Open-Meteo fetch over Soup3
  │   ├── MusicProvider.ts        # MPRIS DBus watcher + transport controls
  │   ├── StatsProvider.ts        # /proc + VFS reads for CPU/RAM/Disk
  │   └── NotificationsProvider.ts# Wraps Main.messageTray, grouped by app
  ├── components/
  │   ├── AppLauncherPanel.ts     # Search + category sidebar + app grid
  │   ├── CalendarCard.ts
  │   ├── MusicCard.ts
  │   ├── NotificationsPanel.ts
  │   ├── StatRing.ts             # Cairo-drawn circular progress rings
  │   └── WeatherCard.ts
  └── schemas/
      └── org.gnome.shell.extensions.ormic-dashboard.gschema.xml
```

## Notes

- **Weather** uses Open-Meteo because it needs no API key. Swap the URL in
  `WeatherProvider.ts` if you prefer a keyed service.
- **Album art** loads for `file://` URIs (the common case for local players).
  Remote `http(s)://` art is a deliberate extension point — add an async
  Soup3 fetch + decode step on top if needed.
