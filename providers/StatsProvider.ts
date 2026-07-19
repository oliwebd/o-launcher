// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — System Stats Provider

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import type { StatSample } from '../types.js';
import { repeatEvery, clearTimer, formatBytes } from '../utils.js';

export type StatsCallback = (samples: StatSample[]) => void;

interface CpuTimes { idle: number; total: number }

/**
 * Reads live system load straight from /proc and the VFS, avoiding a GTop
 * dependency so the extension has no extra native package requirement.
 */
export class StatsProvider {
    private _settings: Gio.Settings;
    private _timerId = 0;
    private _lastCpu: CpuTimes | null = null;
    private _callback: StatsCallback | null = null;

    constructor(settings: Gio.Settings) {
        this._settings = settings;
    }

    start(callback: StatsCallback): void {
        this._callback = callback;
        this._sampleOnce();
        const seconds = this._settings.get_int('stats-refresh-seconds');
        this._timerId = repeatEvery(seconds * 1000, () => {
            this._sampleOnce();
            return true;
        });
    }

    stop(): void {
        clearTimer(this._timerId);
        this._timerId = 0;
    }

    private _sampleOnce(): void {
        const cpu = this._readCpuPercent();
        const memory = this._readMemory();
        const disk = this._readDisk();
        this._callback?.([cpu, memory, disk].filter((s): s is StatSample => s !== null));
    }

    private _readCpuPercent(): StatSample | null {
        try {
            const [ok, contents] = GLib.file_get_contents('/proc/stat');
            if (!ok) return null;
            const line = new TextDecoder().decode(contents).split('\n')[0];
            const parts = line.trim().split(/\s+/).slice(1).map(Number);
            const idle = parts[3] + (parts[4] ?? 0); // idle + iowait
            const total = parts.reduce((a, b) => a + b, 0);

            let percent = 0;
            if (this._lastCpu) {
                const deltaIdle = idle - this._lastCpu.idle;
                const deltaTotal = total - this._lastCpu.total;
                percent = deltaTotal > 0 ? 100 * (1 - deltaIdle / deltaTotal) : 0;
            }
            this._lastCpu = { idle, total };

            return { id: 'cpu', label: 'CPU', percent: Math.round(percent), detail: `${Math.round(percent)}% load` };
        } catch (e) {
            logError(e as Error, 'ormic-dashboard: failed to read /proc/stat');
            return null;
        }
    }

    private _readMemory(): StatSample | null {
        try {
            const [ok, contents] = GLib.file_get_contents('/proc/meminfo');
            if (!ok) return null;
            const text = new TextDecoder().decode(contents);
            const kv = new Map<string, number>();
            for (const line of text.split('\n')) {
                const match = line.match(/^(\w+):\s+(\d+)/);
                if (match) kv.set(match[1], Number(match[2]) * 1024); // kB -> bytes
            }
            const total = kv.get('MemTotal') ?? 0;
            const available = kv.get('MemAvailable') ?? 0;
            const used = total - available;
            const percent = total > 0 ? Math.round((used / total) * 100) : 0;

            return {
                id: 'memory',
                label: 'Memory',
                percent,
                detail: `${formatBytes(used)} / ${formatBytes(total)}`,
            };
        } catch (e) {
            logError(e as Error, 'ormic-dashboard: failed to read /proc/meminfo');
            return null;
        }
    }

    private _readDisk(): StatSample | null {
        try {
            const home = Gio.File.new_for_path(GLib.get_home_dir());
            const info = home.query_filesystem_info('filesystem::*', null);
            const total = info.get_attribute_uint64('filesystem::size');
            const free = info.get_attribute_uint64('filesystem::free');
            const used = total - free;
            const percent = total > 0 ? Math.round((used / total) * 100) : 0;

            return {
                id: 'disk',
                label: 'Disk',
                percent,
                detail: `${formatBytes(used)} / ${formatBytes(total)}`,
            };
        } catch (e) {
            logError(e as Error, 'ormic-dashboard: failed to read filesystem info');
            return null;
        }
    }
}
