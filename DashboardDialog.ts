// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — Floating Dialog Container

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Graphene from 'gi://Graphene';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { AppProvider } from './providers/AppProvider.js';
import { WeatherProvider } from './providers/WeatherProvider.js';
import { MusicProvider } from './providers/MusicProvider.js';
import { StatsProvider } from './providers/StatsProvider.js';
import { NotificationsProvider } from './providers/NotificationsProvider.js';

import { WeatherCard } from './components/WeatherCard.js';
import { CalendarCard } from './components/CalendarCard.js';
import { MusicCard } from './components/MusicCard.js';
import { StatsRow } from './components/StatRing.js';
import { NotificationsPanel } from './components/NotificationsPanel.js';
import { AppLauncherPanel } from './components/AppLauncherPanel.js';

import { easeActor } from './utils.js';

const DIALOG_WIDTH = 1180;
const DIALOG_HEIGHT = 640;

export class DashboardDialog extends St.Widget {
    static {
        GObject.registerClass({ GTypeName: 'OrmicDashboardDialog' }, this);
    }

    private _modalGrab: { dismiss?: () => void } | null = null;
    private _root!: St.BoxLayout;
    private _launcherPanel!: AppLauncherPanel;

    private _appProvider: AppProvider;
    private _weatherProvider: WeatherProvider;
    private _musicProvider: MusicProvider;
    private _statsProvider: StatsProvider;
    private _notificationsProvider: NotificationsProvider;

    constructor(settings: Gio.Settings) {
        super({
            style_class: 'ol-dashboard-root',
            layout_manager: new Clutter.BinLayout(),
            reactive: true,
            visible: false,
            opacity: 0,
        });

        this._appProvider = new AppProvider(settings);
        this._weatherProvider = new WeatherProvider(settings);
        this._musicProvider = new MusicProvider();
        this._statsProvider = new StatsProvider(settings);
        this._notificationsProvider = new NotificationsProvider();

        this._buildLayout(settings);
        this._wireProviders();
        this._wireDismissal();

        Main.layoutManager.addTopChrome(this);
    }

    private _buildLayout(settings: Gio.Settings): void {
        const bgStyleClass = this._backgroundStyleClass(settings);

        this._root = new St.BoxLayout({
            width: DIALOG_WIDTH,
            height: DIALOG_HEIGHT,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._root);

        const leftColumn = new St.BoxLayout({ vertical: true, width: 300, style: 'spacing: 16px;' });
        const weatherCard = new WeatherCard(settings.get_boolean('use-fahrenheit'));
        weatherCard.add_style_class_name(bgStyleClass);
        const calendarCard = new CalendarCard();
        calendarCard.add_style_class_name(bgStyleClass);
        const musicCard = new MusicCard();
        musicCard.add_style_class_name(bgStyleClass);
        leftColumn.add_child(weatherCard);
        leftColumn.add_child(calendarCard);
        leftColumn.add_child(musicCard);
        this._root.add_child(leftColumn);

        this._launcherPanel = new AppLauncherPanel(this._appProvider);
        this._launcherPanel.x_expand = true;
        this._root.add_child(this._launcherPanel);

        const rightColumn = new St.BoxLayout({ vertical: true, width: 320, style: 'spacing: 16px;' });
        const statsWrap = new St.BoxLayout({ style_class: 'ormic-panel' });
        statsWrap.add_style_class_name(bgStyleClass);
        statsWrap.add_child(new StatsRow());
        const notificationsPanel = new NotificationsPanel();
        notificationsPanel.add_style_class_name(bgStyleClass);
        rightColumn.add_child(statsWrap);
        rightColumn.add_child(notificationsPanel);
        this._root.add_child(rightColumn);

        this._weatherCardRef = weatherCard;
        this._musicCardRef = musicCard;
        this._statsRowRef = statsWrap.get_children()[0] as StatsRow;
        this._notificationsPanelRef = notificationsPanel;
    }

    private _weatherCardRef!: WeatherCard;
    private _musicCardRef!: MusicCard;
    private _statsRowRef!: StatsRow;
    private _notificationsPanelRef!: NotificationsPanel;

    private _wireProviders(): void {
        this._weatherProvider.start((data, error) => this._weatherCardRef.setData(data, error));
        this._musicProvider.start((track) => this._musicCardRef.setTrack(track));
        this._statsProvider.start((samples) => this._statsRowRef.update(samples));
        this._notificationsProvider.start((groups) => this._notificationsPanelRef.update(groups));

        this._musicCardRef.onPlayPause(() => this._musicProvider.playPause());
        this._musicCardRef.onNext(() => this._musicProvider.next());
        this._musicCardRef.onPrevious(() => this._musicProvider.previous());
    }

    private _wireDismissal(): void {
        this.connect('button-press-event', (_actor: Clutter.Actor, event: Clutter.Event) => {
            const [x, y] = event.get_coords();
            const point = new Graphene.Point({ x, y });
            if (!this._root.get_transformed_extents().contains_point(point)) {
                this.close();
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.connect('key-press-event', (_actor: Clutter.Actor, event: Clutter.Event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                this.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    private _backgroundStyleClass(settings: Gio.Settings): string {
        const style = settings.get_string('background-style');
        return style === 'blur' ? '' : `ormic-bg-${style}`;
    }

    open(): void {
        if (this.visible) return;

        const monitor = Main.layoutManager.primaryMonitor!;
        this.set_position(monitor.x, monitor.y);
        this.set_size(monitor.width, monitor.height);

        this.visible = true;
        this.opacity = 0;

        // pushModal can legitimately be refused when another modal grab is active.
        const grab = Main.pushModal(this, { actionMode: Main.actionMode });
        if (!grab) {
            this.visible = false;
            this._modalGrab = null;
            console.error('Ormic Dashboard: pushModal was refused — another modal grab is active, not opening.');
            return;
        }
        this._modalGrab = grab;

        void easeActor(this, { opacity: 255, duration: 180 });
        this._launcherPanel.focusSearch();
    }

    close(): void {
        if (!this.visible) return;
        if (this._modalGrab) {
            Main.popModal(this._modalGrab);
            this._modalGrab = null;
        }
        void easeActor(this, { opacity: 0, duration: 120, onComplete: () => { this.visible = false; } });
    }

    toggle(): void {
        if (this.visible) this.close();
        else this.open();
    }

    destroy(): void {
        this._weatherProvider.stop();
        this._musicProvider.stop();
        this._statsProvider.stop();
        this._notificationsProvider.stop();
        this._appProvider.destroy();
        super.destroy();
    }
}
