// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — App Indexing Provider

import Shell from 'gi://Shell';
import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import type { AppEntry, AppCategory } from '../types.js';

const CATEGORY_MAP: Record<string, AppCategory> = {
    Development: { id: 'dev', label: 'Development', iconName: 'applications-development-symbolic' },
    Office: { id: 'office', label: 'Office', iconName: 'applications-office-symbolic' },
    Graphics: { id: 'graphics', label: 'Graphics', iconName: 'applications-graphics-symbolic' },
    AudioVideo: { id: 'media', label: 'Media', iconName: 'applications-multimedia-symbolic' },
    Network: { id: 'network', label: 'Internet', iconName: 'applications-internet-symbolic' },
    Game: { id: 'games', label: 'Games', iconName: 'applications-games-symbolic' },
    System: { id: 'system', label: 'System', iconName: 'applications-system-symbolic' },
    Utility: { id: 'utility', label: 'Utilities', iconName: 'applications-utilities-symbolic' },
};
const FALLBACK_CATEGORY: AppCategory = { id: 'other', label: 'Other', iconName: 'applications-other-symbolic' };
export const HOME_CATEGORY: AppCategory = { id: 'home', label: 'Home', iconName: 'go-home-symbolic' };

export class AppProvider {
    private _appSystem = Shell.AppSystem.get_default();
    private _cache: AppEntry[] | null = null;
    private _settings: Gio.Settings;
    private _installedChangedId = 0;
    private _onChangeCallback!: () => void;

    constructor(settings: Gio.Settings) {
        this._settings = settings;
        this._installedChangedId = this._appSystem.connect('installed-changed', () => {
            this._cache = null;
            this._onChangeCallback();
        });
    }

    onChange(cb: () => void): void {
        this._onChangeCallback = cb;
    }

    destroy(): void {
        this._appSystem.disconnect(this._installedChangedId);
    }

    getAllApps(): AppEntry[] {
        if (this._cache) return this._cache;

        const favorites = new Set(this._settings.get_strv('favorite-apps'));
        const apps = this._appSystem.get_installed()
            .filter((app) => app.should_show())
            .map((app): AppEntry => {
                const info = app as unknown as GioUnix.DesktopAppInfo;
                const categories = info.get_categories()?.split(';').filter(Boolean) ?? [];
                const keywords = info.get_keywords() ?? [];
                return {
                    id: app.get_id()!,
                    name: app.get_name(),
                    iconName: app.get_icon()?.to_string() ?? 'application-x-executable-symbolic',
                    categories,
                    keywords: [...keywords],
                    isFavorite: favorites.has(app.get_id()!),
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name));

        this._cache = apps;
        return apps;
    }

    getFavorites(): AppEntry[] {
        return this.getAllApps().filter((a) => a.isFavorite);
    }

    toggleFavorite(appId: string): void {
        const current = new Set(this._settings.get_strv('favorite-apps'));
        if (current.has(appId)) current.delete(appId);
        else current.add(appId);
        this._settings.set_strv('favorite-apps', [...current]);
        this._cache = null;
    }

    getCategories(): AppCategory[] {
        const seen = new Map<string, AppCategory>();
        for (const app of this.getAllApps()) {
            const mapped = app.categories.map((c) => CATEGORY_MAP[c]).find(Boolean) ?? FALLBACK_CATEGORY;
            if (!seen.has(mapped.id)) seen.set(mapped.id, mapped);
        }
        return [HOME_CATEGORY, ...seen.values()];
    }

    getAppsInCategory(categoryId: string): AppEntry[] {
        if (categoryId === HOME_CATEGORY.id) return this.getAllApps();
        return this.getAllApps().filter((app) => {
            const mapped = app.categories.map((c) => CATEGORY_MAP[c]).find(Boolean) ?? FALLBACK_CATEGORY;
            return mapped.id === categoryId;
        });
    }

    search(query: string): AppEntry[] {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return this.getAllApps()
            .map((app) => {
                const name = app.name.toLowerCase();
                let score = -1;
                if (name === q) score = 100;
                else if (name.startsWith(q)) score = 80;
                else if (name.includes(q)) score = 50;
                else if (app.keywords.some((k) => k.toLowerCase().includes(q))) score = 20;
                return { app, score };
            })
            .filter((r) => r.score >= 0)
            .sort((a, b) => b.score - a.score || a.app.name.localeCompare(b.app.name))
            .map((r) => r.app);
    }

    launch(appId: string): void {
        this._appSystem.lookup_app(appId).activate();
    }
}
