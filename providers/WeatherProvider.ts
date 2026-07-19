// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — Weather Provider

import Soup from 'gi://Soup';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import type { WeatherData } from '../types.js';
import { repeatEvery, clearTimer } from '../utils.js';

const CONDITION_BY_CODE: Record<number, string> = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Rime fog',
    51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
    80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers',
    95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Severe thunderstorm',
};

export type WeatherCallback = (data: WeatherData | null, error: string | null) => void;

export class WeatherProvider {
    private _session = new Soup.Session();
    private _settings: Gio.Settings;
    private _timerId = 0;
    private _stopped = false;
    private _callback!: WeatherCallback;

    constructor(settings: Gio.Settings) {
        this._settings = settings;
    }

    start(callback: WeatherCallback): void {
        this._stopped = false;
        this._callback = callback;
        this.refreshNow();
        const minutes = this._settings.get_int('weather-refresh-minutes');
        this._timerId = repeatEvery(minutes * 60 * 1000, () => {
            this.refreshNow();
            return true;
        });
    }

    stop(): void {
        this._stopped = true;
        clearTimer(this._timerId);
        this._session.abort();
    }

    refreshNow(): void {
        const lat = this._settings.get_double('weather-latitude');
        const lon = this._settings.get_double('weather-longitude');
        const cityName = this._settings.get_string('weather-city-name');
        const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,apparent_temperature,weather_code,is_day` +
            `&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;

        const message = Soup.Message.new('GET', url);
        this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (_session, result) => {
            try {
                const bytes = this._session.send_and_read_finish(result);
                if (message.get_status() !== Soup.Status.OK) {
                    this._callback(null, `Weather request failed (${message.get_status()})`);
                    return;
                }
                const text = new TextDecoder().decode(bytes.toArray());
                const json = JSON.parse(text);
                this._callback({
                    cityName,
                    tempC: Math.round(json.current.temperature_2m),
                    feelsLikeC: Math.round(json.current.apparent_temperature),
                    highC: Math.round(json.daily.temperature_2m_max[0]),
                    lowC: Math.round(json.daily.temperature_2m_min[0]),
                    condition: CONDITION_BY_CODE[json.current.weather_code],
                    weatherCode: json.current.weather_code,
                    isDay: json.current.is_day === 1,
                }, null);
            } catch (e) {
                if (this._stopped) return;
                this._callback(null, String(e));
            }
        });
    }
}

export function weatherIconName(code: number, isDay: boolean): string {
    switch (code) {
        case 0:
        case 1:
            return isDay ? 'weather-clear-symbolic' : 'weather-clear-night-symbolic';
        case 2:
            return isDay ? 'weather-few-clouds-symbolic' : 'weather-few-clouds-night-symbolic';
        case 3:
            return 'weather-overcast-symbolic';
        case 45:
        case 48:
            return 'weather-fog-symbolic';
        case 51: case 53: case 55: case 61: case 63: case 65: case 80: case 81: case 82:
            return 'weather-showers-symbolic';
        case 71: case 73: case 75:
            return 'weather-snow-symbolic';
        case 95: case 96: case 99:
            return 'weather-storm-symbolic';
        default:
            return 'weather-severe-alert-symbolic';
    }
}
