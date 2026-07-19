// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — Shared Utilities

import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

/**
 * Adaptive compatibility shims (same idea as ormic-launcher's utils.ts).
 * GNOME's GJS API shifts slightly release to release; these wrappers pick
 * the modern call when present and fall back gracefully otherwise, so the
 * extension keeps working from GNOME 46 through 50+ without version checks
 * scattered through the codebase.
 */

/** Run `fn` once after `ms` milliseconds. */
export function timeoutOnce(ms: number, fn: () => void): number {
    if (typeof (GLib as unknown as { timeout_add_once?: unknown }).timeout_add_once === 'function') {
        // @ts-expect-error - present on newer GLib bindings only
        return GLib.timeout_add_once(GLib.PRIORITY_DEFAULT, ms, fn);
    }
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        fn();
        return GLib.SOURCE_REMOVE;
    });
}

/** Run `fn` once the main loop is idle. */
export function idleOnce(fn: () => void): number {
    if (typeof (GLib as unknown as { idle_add_once?: unknown }).idle_add_once === 'function') {
        // @ts-expect-error - present on newer GLib bindings only
        return GLib.idle_add_once(GLib.PRIORITY_DEFAULT_IDLE, fn);
    }
    return GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        fn();
        return GLib.SOURCE_REMOVE;
    });
}

/** Repeat `fn` every `ms` milliseconds until it returns false. Returns the source id. */
export function repeatEvery(ms: number, fn: () => boolean | void): number {
    return GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        const keepGoing = fn();
        return keepGoing === false ? GLib.SOURCE_REMOVE : GLib.SOURCE_CONTINUE;
    });
}

export function clearTimer(id: number | null | undefined): void {
    if (id) GLib.source_remove(id);
}

interface EaseParams {
    opacity?: number;
    scale_x?: number;
    scale_y?: number;
    translation_y?: number;
    duration?: number;
    mode?: Clutter.AnimationMode;
    delay?: number;
    onComplete?: () => void;
}

/** Promise-based ease that works whether easeAsync exists or not. */
export function easeActor(actor: Clutter.Actor, params: EaseParams): Promise<void> {
    const { onComplete, ...clutterParams } = params;
    return new Promise((resolve) => {
        const asyncCapable = actor as unknown as { easeAsync?: (p: object) => Promise<void> };
        if (typeof asyncCapable.easeAsync === 'function') {
            asyncCapable.easeAsync({
                ...clutterParams,
                mode: clutterParams.mode ?? Clutter.AnimationMode.EASE_OUT_QUAD,
            }).then(() => {
                onComplete?.();
                resolve();
            });
        } else {
            const legacy = actor as unknown as { ease: (p: object) => void };
            legacy.ease({
                ...clutterParams,
                mode: clutterParams.mode ?? Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    onComplete?.();
                    resolve();
                },
            });
        }
    });
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** Format bytes as a human-readable string (used by the stats ring tooltips). */
export function formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** exp).toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}
