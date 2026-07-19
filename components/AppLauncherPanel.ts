// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — App Launcher Panel

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import type { AppProvider } from '../providers/AppProvider.js';
import { HOME_CATEGORY } from '../providers/AppProvider.js';
import type { AppEntry } from '../types.js';

export class AppLauncherPanel extends St.BoxLayout {
    static {
        GObject.registerClass({ GTypeName: 'OrmicAppLauncherPanel' }, this);
    }

    private _provider: AppProvider;
    private _entry: St.Entry;
    private _sidebar: St.BoxLayout;
    private _gridScroll: St.ScrollView;
    private _grid: St.Viewport;
    private _activeCategory = HOME_CATEGORY.id;

    constructor(provider: AppProvider) {
        super({ style_class: 'ormic-launcher-panel', vertical: true, x_expand: true, y_expand: true });
        this._provider = provider;

        this._entry = new St.Entry({ style_class: 'ormic-search-entry', hint_text: 'Search apps…', x_expand: true, can_focus: true });
        this._entry.clutter_text.connect('text-changed', () => this._renderResults());
        this.add_child(this._entry);

        const body = new St.BoxLayout({ x_expand: true, y_expand: true });

        this._sidebar = new St.BoxLayout({ vertical: true });
        const sidebarScroll = new St.ScrollView({ y_expand: true, overlay_scrollbars: true, style: 'width: 140px;' });
        sidebarScroll.set_child(this._sidebar);
        body.add_child(sidebarScroll);

        this._grid = new St.Viewport({
            layout_manager: new Clutter.GridLayout({ column_homogeneous: true, row_homogeneous: false }),
            x_expand: true,
        });
        this._gridScroll = new St.ScrollView({ x_expand: true, y_expand: true, overlay_scrollbars: true });
        this._gridScroll.set_child(this._grid);
        body.add_child(this._gridScroll);

        this.add_child(body);

        this._buildSidebar();
        this._renderResults();

        this._provider.onChange(() => { this._buildSidebar(); this._renderResults(); });
    }


    focusSearch(): void {
        this._entry.grab_key_focus();
    }

    private _buildSidebar(): void {
        this._sidebar.destroy_all_children();
        for (const category of this._provider.getCategories()) {
            const btn = new St.Button({
                style_class: `ormic-category-tab${category.id === this._activeCategory ? ' ormic-category-active' : ''}`,
                x_expand: true,
            });
            const row = new St.BoxLayout();
            row.add_child(new St.Icon({ icon_name: category.iconName, icon_size: 14 }));
            row.add_child(new St.Label({ text: category.label, y_align: Clutter.ActorAlign.CENTER, style: 'margin-left: 8px;' }));
            btn.set_child(row);

            btn.connect('clicked', () => this._selectCategory(category.id));

            btn.connect('enter-event', () => this._selectCategory(category.id));

            this._sidebar.add_child(btn);
        }
    }

    private _selectCategory(categoryId: string): void {
        if (this._activeCategory === categoryId) return;
        this._activeCategory = categoryId;
        this._entry.set_text('');
        this._buildSidebar();
        this._renderResults();
    }

    private _renderResults(): void {
        const query = this._entry.get_text();
        this._grid.destroy_all_children();
        const layout = this._grid.layout_manager as Clutter.GridLayout;

        let apps: AppEntry[];
        if (query.trim().length > 0) {
            apps = this._provider.search(query);
        } else if (this._activeCategory === HOME_CATEGORY.id) {

            const favorites = this._provider.getFavorites();
            const rest = this._provider.getAllApps().filter((a) => !a.isFavorite);
            apps = [...favorites, ...rest];
        } else {
            apps = this._provider.getAppsInCategory(this._activeCategory);
        }

        const columns = 5;
        apps.forEach((app, idx) => {
            const tile = this._buildTile(app);
            layout.attach(tile, idx % columns, Math.floor(idx / columns), 1, 1);
        });

        if (apps.length === 0) {
            this._grid.add_child(new St.Label({ style_class: 'ormic-muted', text: 'No apps found.', style: 'padding: 24px;' }));
        }
    }

    private _buildTile(app: AppEntry): St.Widget {
        const btn = new St.Button({ style_class: 'ormic-app-tile' });
        const box = new St.BoxLayout({ vertical: true, x_align: Clutter.ActorAlign.CENTER });
        box.add_child(new St.Icon({ style_class: 'ormic-app-icon', gicon: Gio.Icon.new_for_string(app.iconName), x_align: Clutter.ActorAlign.CENTER }));
        const label = new St.Label({ style_class: 'ormic-app-label', text: app.name, x_align: Clutter.ActorAlign.CENTER });
        label.clutter_text.ellipsize = 3;
        box.add_child(label);
        btn.set_child(box);

        btn.connect('clicked', () => this._provider.launch(app.id));


        btn.connect('button-release-event', (_actor: unknown, event: { get_button(): number }) => {
            if (event.get_button() === 3) {
                this._provider.toggleFavorite(app.id);
                this._renderResults();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        return btn;
    }
}
