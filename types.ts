// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — Common Types

export interface WeatherData {
    cityName: string;
    tempC: number;
    feelsLikeC: number;
    highC: number;
    lowC: number;
    condition: string;      // e.g. "Drizzle", "Clear", "Overcast"
    weatherCode: number;    // raw WMO code from Open-Meteo
    isDay: boolean;
}

export interface CalendarDay {
    date: number;           // day-of-month
    inCurrentMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    isoDate: string;        // yyyy-mm-dd, for click handlers / event lookups
}

export interface MusicTrack {
    title: string;
    artist: string;
    artUrl: string | null;
    playing: boolean;
    canGoNext: boolean;
    canGoPrevious: boolean;
    positionSec: number;
    lengthSec: number;
    busName: string;        // owning MPRIS DBus name, for multi-player disambiguation
}

export interface StatSample {
    id: 'cpu' | 'memory' | 'disk';
    label: string;
    percent: number;        // 0-100
    detail: string;         // e.g. "6.1 GB / 16 GB"
}

export interface NotificationEntry {
    id: string;
    appName: string;
    appIconName: string | null;
    title: string;
    body: string;
    timestamp: number;      // unix seconds
}

export interface NotificationGroup {
    appName: string;
    appIconName: string | null;
    entries: NotificationEntry[];
}

export interface AppEntry {
    id: string;             // desktop file id, e.g. "org.gnome.Nautilus.desktop"
    name: string;
    iconName: string;
    categories: string[];
    keywords: string[];
    isFavorite: boolean;
}

export interface AppCategory {
    id: string;
    label: string;
    iconName: string;
}
