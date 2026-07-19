// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — Notifications Panel

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import type { NotificationGroup } from '../types.js';

const MAX_ENTRIES_SHOWN_PER_GROUP = 3;

export class NotificationsPanel extends St.BoxLayout {
    static {
        GObject.registerClass({ GTypeName: 'OrmicNotificationsPanel' }, this);
    }

    private _headerCount: St.Label;
    private _scroll: St.ScrollView;
    private _list: St.BoxLayout;

    constructor() {
        super({ style_class: 'ormic-panel', vertical: true, x_expand: true, y_expand: true });

        const header = new St.BoxLayout({ x_expand: true });
        header.add_child(new St.Label({ style_class: 'ormic-eyebrow', text: 'NOTIFICATIONS', x_expand: true, y_align: Clutter.ActorAlign.CENTER }));
        this._headerCount = new St.Label({ style_class: 'ormic-notif-count-pill', text: '0' });
        header.add_child(this._headerCount);
        this.add_child(header);

        this._scroll = new St.ScrollView({ x_expand: true, y_expand: true, overlay_scrollbars: true });
        this._list = new St.BoxLayout({ vertical: true, x_expand: true });
        this._scroll.set_child(this._list);
        this.add_child(this._scroll);

        this._renderEmpty();
    }

    update(groups: NotificationGroup[]): void {
        const total = groups.reduce((sum, g) => sum + g.entries.length, 0);
        this._headerCount.text = String(total);

        this._list.destroy_all_children();
        if (groups.length === 0) { this._renderEmpty(); return; }

        for (const group of groups) {
            this._list.add_child(this._buildGroup(group));
        }
    }

    private _renderEmpty(): void {
        this._list.add_child(new St.Label({
            style_class: 'ormic-muted', text: 'You’re all caught up.',
            x_align: Clutter.ActorAlign.CENTER, x_expand: true,
        }));
    }

    private _buildGroup(group: NotificationGroup): St.Widget {
        const box = new St.BoxLayout({ vertical: true, x_expand: true });

        const headerRow = new St.BoxLayout({ x_expand: true });
        if (group.appIconName) {
            headerRow.add_child(new St.Icon({ style_class: 'ormic-notif-app-icon', icon_name: group.appIconName }));
        }
        headerRow.add_child(new St.Label({
            style_class: 'ormic-notif-group-header', text: group.appName, x_expand: true, y_align: Clutter.ActorAlign.CENTER,
        }));
        const latest = group.entries[0];
        if (latest) {
            headerRow.add_child(new St.Label({
                style_class: 'ormic-notif-timestamp', text: relativeTime(latest.timestamp), y_align: Clutter.ActorAlign.CENTER,
            }));
        }
        box.add_child(headerRow);

        for (const entry of group.entries.slice(0, MAX_ENTRIES_SHOWN_PER_GROUP)) {
            const row = new St.BoxLayout({ vertical: true, x_expand: true });
            if (entry.title) row.add_child(new St.Label({ style_class: 'ormic-notif-entry-title', text: entry.title }));
            if (entry.body) {
                const bodyLabel = new St.Label({ style_class: 'ormic-notif-entry-body', text: entry.body });
                bodyLabel.clutter_text.line_wrap = true;
                bodyLabel.clutter_text.ellipsize = 3;
                row.add_child(bodyLabel);
            }
            box.add_child(row);
        }

        const overflow = group.entries.length - MAX_ENTRIES_SHOWN_PER_GROUP;
        if (overflow > 0) {
            box.add_child(new St.Label({ style_class: 'ormic-notif-timestamp', text: `+${overflow} more` }));
        }

        box.add_child(new St.Widget({ style_class: 'ormic-notif-group-divider', x_expand: true }));
        return box;
    }
}

function relativeTime(unixSeconds: number): string {
    const now = GLib.DateTime.new_now_local().to_unix();
    const deltaMin = Math.max(0, Math.round((now - unixSeconds) / 60));
    if (deltaMin < 1) return 'now';
    if (deltaMin < 60) return `${deltaMin}m`;
    const deltaHr = Math.round(deltaMin / 60);
    if (deltaHr < 24) return `${deltaHr}h`;
    return `${Math.round(deltaHr / 24)}d`;
}
