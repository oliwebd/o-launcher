// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — Notifications Provider

// Namespace import, not default — see the note in DashboardDialog.ts.
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import type { NotificationEntry, NotificationGroup } from '../types.js';

export type NotificationsCallback = (groups: NotificationGroup[]) => void;

/**
 * Mirrors GNOME Shell's own message tray (the same data source backing the
 * Calendar/Notifications popup) into app-grouped entries, most recent app
 * first -- matching the grouped feed shown in the reference screenshot.
 */
export class NotificationsProvider {
    private _callback: NotificationsCallback | null = null;
    private _sourceAddedId = 0;
    private _perSourceIds = new Map<object, number[]>();

    start(callback: NotificationsCallback): void {
        this._callback = callback;
        const tray = Main.messageTray;

        for (const source of tray.getSources()) this._watchSource(source);
        this._sourceAddedId = tray.connect('source-added', (_tray: unknown, source: object) => {
            this._watchSource(source);
            this._emit();
        });
        this._emit();
    }

    stop(): void {
        if (this._sourceAddedId) Main.messageTray.disconnect(this._sourceAddedId);
        for (const [source, ids] of this._perSourceIds) {
            for (const id of ids) (source as unknown as { disconnect: (i: number) => void }).disconnect(id);
        }
        this._perSourceIds.clear();
    }

    private _watchSource(source: object): void {
        if (this._perSourceIds.has(source)) return;
        const src = source as unknown as {
            connect: (sig: string, cb: () => void) => number;
        };
        const addedId = src.connect('notification-added', () => this._emit());
        const destroyId = src.connect('destroy', () => this._emit());
        this._perSourceIds.set(source, [addedId, destroyId]);
    }

    private _emit(): void {
        if (!this._callback) return;
        const groups: NotificationGroup[] = [];

        for (const source of Main.messageTray.getSources()) {
            const src = source as unknown as {
                title?: string;
                iconName?: string;
                notifications: Array<{ title?: string; body?: string; datetime?: { to_unix(): number } }>;
            };
            if (!src.notifications || src.notifications.length === 0) continue;

            const entries: NotificationEntry[] = src.notifications
                .slice()
                .reverse()
                .map((n, idx): NotificationEntry => ({
                    id: `${src.title ?? 'app'}-${idx}`,
                    appName: src.title ?? 'Unknown',
                    appIconName: src.iconName ?? null,
                    title: n.title ?? '',
                    body: n.body ?? '',
                    timestamp: n.datetime?.to_unix() ?? Math.floor(Date.now() / 1000),
                }));

            groups.push({ appName: src.title ?? 'Unknown', appIconName: src.iconName ?? null, entries });
        }

        groups.sort((a, b) => (b.entries[0]?.timestamp ?? 0) - (a.entries[0]?.timestamp ?? 0));
        this._callback(groups);
    }

    get totalCount(): number {
        return Main.messageTray.getSources()
            .reduce((sum: number, s: unknown) => sum + ((s as { notifications: unknown[] }).notifications?.length ?? 0), 0);
    }
}
