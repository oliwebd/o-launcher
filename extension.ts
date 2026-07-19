// SPDX-License-Identifier: GPL-2.0-or-later
// O-Launcher — GNOME Shell Extension
//
// Compatible with GNOME Shell 46 · 47 · 48 · 49 · 50

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

// Verified against the real ormic-launcher source: these are namespace
// exports (`import * as Main`), not default exports. The previous version
// of this file used `import Main from '...'`, which resolves to `undefined`
// at runtime rather than failing at import time — Main.wm.addKeybinding()
// would have thrown the first time enable() ran.
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { DashboardDialog } from './DashboardDialog.js';

export default class OLauncherExtension extends Extension {
    private _dialog: DashboardDialog | null = null;

    enable(): void {
        // Fail-fast: if the dialog fails to construct (a required provider
        // API is missing on this shell version, GSettings schema isn't
        // installed, etc.) we do not want enable() to report success while
        // leaving nothing usable. Let it throw — GNOME Shell will surface
        // the failure in `journalctl` and mark the extension as errored,
        // which is the correct, visible outcome instead of a silently
        // broken toggle shortcut.
        const settings = this.getSettings();
        this._dialog = new DashboardDialog(settings);

        Main.wm.addKeybinding(
            'toggle-shortcut',
            settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW | Shell.ActionMode.POPUP,
            () => this._dialog?.toggle(),
        );
    }

    disable(): void {
        Main.wm.removeKeybinding('toggle-shortcut');
        this._dialog?.destroy();
        this._dialog = null;
    }
}
