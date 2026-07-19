// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — Weather Card

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import type { WeatherData } from '../types.js';
import { weatherIconName } from '../providers/WeatherProvider.js';

export class WeatherCard extends St.BoxLayout {
    static {
        GObject.registerClass({ GTypeName: 'OrmicWeatherCard' }, this);
    }

    private _condition: St.Label;
    private _temp: St.Label;
    private _icon: St.Icon;
    private _sub: St.Label;
    private _useFahrenheit: boolean;

    constructor(useFahrenheit = false) {
        super({
            style_class: 'ormic-panel',
            vertical: true,
            x_expand: true,
            y_expand: false,
        });
        this._useFahrenheit = useFahrenheit;

        const cityRow = new St.BoxLayout({ x_expand: true });
        this._condition = new St.Label({ style_class: 'ormic-weather-condition', text: 'Loading…' });
        cityRow.add_child(this._condition);
        this.add_child(cityRow);

        const mainRow = new St.BoxLayout({ y_align: Clutter.ActorAlign.CENTER, x_expand: true });
        this._temp = new St.Label({ style_class: 'ormic-weather-temp', text: '--°', y_align: Clutter.ActorAlign.CENTER });
        this._icon = new St.Icon({ style_class: 'ormic-weather-icon', icon_name: 'weather-clear-symbolic', x_expand: true, x_align: Clutter.ActorAlign.END });
        mainRow.add_child(this._temp);
        mainRow.add_child(this._icon);
        this.add_child(mainRow);

        this._sub = new St.Label({ style_class: 'ormic-weather-sub', text: '' });
        this._sub.clutter_text.line_wrap = true;
        this.add_child(this._sub);
    }

    private _fmt(celsius: number): string {
        if (this._useFahrenheit) return `${Math.round((celsius * 9) / 5 + 32)}°`;
        return `${celsius}°`;
    }

    setData(data: WeatherData | null, error: string | null): void {
        if (!data) {
            this._condition.text = error ? 'Weather unavailable' : 'Loading…';
            return;
        }
        this._condition.text = data.condition;
        this._temp.text = this._fmt(data.tempC);
        this._icon.icon_name = weatherIconName(data.weatherCode, data.isDay);
        this._sub.text =
            `Feels like ${this._fmt(data.feelsLikeC)}\n` +
            `High ${this._fmt(data.highC)} · Low ${this._fmt(data.lowC)}`;
    }
}
