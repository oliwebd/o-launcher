// SPDX-License-Identifier: GPL-2.0-or-later
// O-Launcher — Preferences Window

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class OrmicDashboardPreferences extends ExtensionPreferences {
    async fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        const generalGroup = new Adw.PreferencesGroup({ title: 'General' });
        page.add(generalGroup);

        const shortcutRow = new Adw.ActionRow({ title: 'Toggle shortcut' });
        const shortcutLabel = new Gtk.ShortcutLabel({ accelerator: settings.get_strv('toggle-shortcut')[0], valign: Gtk.Align.CENTER });
        shortcutRow.add_suffix(shortcutLabel);
        generalGroup.add(shortcutRow);

        const bgRow = new Adw.ComboRow({
            title: 'Panel background',
            subtitle: 'Applies to weather, calendar, music and notifications — the launcher stays solid',
            model: Gtk.StringList.new(['Blur', 'Transparent 20%', 'Transparent 30%', 'Transparent 50%', 'Solid']),
        });
        const styleValues = ['blur', 'transparent-20', 'transparent-30', 'transparent-50', 'solid'];
        bgRow.selected = Math.max(0, styleValues.indexOf(settings.get_string('background-style')));
        bgRow.connect('notify::selected', () => {
            settings.set_string('background-style', styleValues[bgRow.selected]);
        });
        generalGroup.add(bgRow);

        const weatherGroup = new Adw.PreferencesGroup({ title: 'Weather' });
        page.add(weatherGroup);

        const cityRow = new Adw.EntryRow({ title: 'City label' });
        cityRow.text = settings.get_string('weather-city-name');
        cityRow.connect('notify::text', () => settings.set_string('weather-city-name', cityRow.text));
        weatherGroup.add(cityRow);

        const latRow = new Adw.SpinRow({
            title: 'Latitude',
            adjustment: new Gtk.Adjustment({ lower: -90, upper: 90, step_increment: 0.01, value: settings.get_double('weather-latitude') }),
            digits: 2,
        });
        latRow.connect('notify::value', () => settings.set_double('weather-latitude', latRow.value));
        weatherGroup.add(latRow);

        const lonRow = new Adw.SpinRow({
            title: 'Longitude',
            adjustment: new Gtk.Adjustment({ lower: -180, upper: 180, step_increment: 0.01, value: settings.get_double('weather-longitude') }),
            digits: 2,
        });
        lonRow.connect('notify::value', () => settings.set_double('weather-longitude', lonRow.value));
        weatherGroup.add(lonRow);

        const fahrenheitRow = new Adw.SwitchRow({ title: 'Use Fahrenheit' });
        fahrenheitRow.active = settings.get_boolean('use-fahrenheit');
        fahrenheitRow.connect('notify::active', () => settings.set_boolean('use-fahrenheit', fahrenheitRow.active));
        weatherGroup.add(fahrenheitRow);

        const weatherRefreshRow = new Adw.SpinRow({
            title: 'Weather refresh (minutes)',
            adjustment: new Gtk.Adjustment({ lower: 5, upper: 120, step_increment: 5, value: settings.get_int('weather-refresh-minutes') }),
        });
        weatherRefreshRow.connect('notify::value', () => settings.set_int('weather-refresh-minutes', weatherRefreshRow.value));
        weatherGroup.add(weatherRefreshRow);

        const perfGroup = new Adw.PreferencesGroup({ title: 'Performance' });
        page.add(perfGroup);

        const statsRefreshRow = new Adw.SpinRow({
            title: 'System stats refresh (seconds)',
            adjustment: new Gtk.Adjustment({ lower: 1, upper: 30, step_increment: 1, value: settings.get_int('stats-refresh-seconds') }),
        });
        statsRefreshRow.connect('notify::value', () => settings.set_int('stats-refresh-seconds', statsRefreshRow.value));
        perfGroup.add(statsRefreshRow);
    }
}
