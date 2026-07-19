// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — MPRIS Music Provider

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type { MusicTrack } from '../types.js';

const MPRIS_PREFIX = 'org.mpris.MediaPlayer2.';
const PLAYER_IFACE = 'org.mpris.MediaPlayer2.Player';

const PLAYER_XML = `
<node>
  <interface name="org.mpris.MediaPlayer2.Player">
    <method name="PlayPause"/>
    <method name="Next"/>
    <method name="Previous"/>
    <property name="PlaybackStatus" type="s" access="read"/>
    <property name="Metadata" type="a{sv}" access="read"/>
    <property name="Position" type="x" access="read"/>
    <property name="CanGoNext" type="b" access="read"/>
    <property name="CanGoPrevious" type="b" access="read"/>
  </interface>
</node>`;
const PlayerProxyInfo = Gio.DBusInterfaceInfo.new_for_xml(PLAYER_XML);

export type MusicCallback = (track: MusicTrack | null) => void;

/** Watches DBus for MPRIS players and surfaces the active one. */
export class MusicProvider {
    private _bus = Gio.DBus.session;
    private _proxies = new Map<string, Gio.DBusProxy>();
    private _propsChangedIds = new Map<string, number>();
    private _callback: MusicCallback | null = null;
    private _watcherId = 0;
    private _activeBusName: string | null = null;

    start(callback: MusicCallback): void {
        this._callback = callback;
        this._bus.call(
            'org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'ListNames',
            null, GLib.VariantType.new('(as)'), Gio.DBusCallFlags.NONE, -1, null,
            (_conn, result) => {
                try {
                    const [names] = this._bus.call_finish(result).deep_unpack() as [string[]];
                    names.filter((n) => n.startsWith(MPRIS_PREFIX)).forEach((n) => this._attach(n));
                } catch (e) {
                    logError(e as Error, 'ormic-dashboard: failed to list DBus names');
                }
            },
        );

        this._watcherId = this._bus.signal_subscribe(
            'org.freedesktop.DBus', 'org.freedesktop.DBus', 'NameOwnerChanged',
            '/org/freedesktop/DBus', null, Gio.DBusSignalFlags.NONE,
            (_conn, _sender, _path, _iface, _signal, params) => {
                const [name, oldOwner, newOwner] = params.deep_unpack() as [string, string, string];
                if (!name.startsWith(MPRIS_PREFIX)) return;
                if (newOwner && !oldOwner) this._attach(name);
                else if (oldOwner && !newOwner) this._detach(name);
            },
        );
    }

    stop(): void {
        if (this._watcherId) this._bus.signal_unsubscribe(this._watcherId);
        for (const name of [...this._proxies.keys()]) this._detach(name);
    }

    private _attach(busName: string): void {
        if (this._proxies.has(busName)) return;
        Gio.DBusProxy.new(
            this._bus, Gio.DBusProxyFlags.NONE, PlayerProxyInfo,
            busName, '/org/mpris/MediaPlayer2', PLAYER_IFACE, null,
            (_src, result) => {
                try {
                    const proxy = Gio.DBusProxy.new_finish(result);
                    this._proxies.set(busName, proxy);
                    const id = proxy.connect('g-properties-changed', () => this._emitBest());
                    this._propsChangedIds.set(busName, id);
                    this._emitBest();
                } catch (e) {
                    logError(e as Error, `ormic-dashboard: failed to attach MPRIS proxy for ${busName}`);
                }
            },
        );
    }

    private _detach(busName: string): void {
        const proxy = this._proxies.get(busName)!;
        const id = this._propsChangedIds.get(busName)!;
        proxy.disconnect(id);
        this._proxies.delete(busName);
        this._propsChangedIds.delete(busName);
        if (this._activeBusName === busName) this._activeBusName = null;
        this._emitBest();
    }


    private _emitBest(): void {
        if (!this._callback) return;
        let chosen: [string, Gio.DBusProxy] | null = null;

        for (const entry of this._proxies) {
            const status = entry[1].get_cached_property('PlaybackStatus')?.deep_unpack();
            if (status === 'Playing') { chosen = entry; break; }
        }
        if (!chosen && this._activeBusName && this._proxies.has(this._activeBusName)) {
            chosen = [this._activeBusName, this._proxies.get(this._activeBusName)!];
        }
        if (!chosen) {
            const first = this._proxies.entries().next();
            if (!first.done) chosen = first.value;
        }

        if (!chosen) { this._callback(null); return; }
        this._activeBusName = chosen[0];
        this._callback(this._toTrack(chosen[0], chosen[1]));
    }

    private _toTrack(busName: string, proxy: Gio.DBusProxy): MusicTrack {
        const metadataVariant = proxy.get_cached_property('Metadata');
        const metadata = metadataVariant
            ? (metadataVariant.deep_unpack() as Record<string, GLib.Variant>)
            : {} as Record<string, GLib.Variant>;

        return {
            title: metadata['xesam:title']?.deep_unpack() as string ?? '',
            artist: (metadata['xesam:artist']?.deep_unpack() as string[] ?? []).join(', '),
            artUrl: metadata['mpris:artUrl']?.deep_unpack() as string ?? null,
            playing: proxy.get_cached_property('PlaybackStatus')?.deep_unpack() === 'Playing',
            canGoNext: proxy.get_cached_property('CanGoNext')?.deep_unpack() as boolean ?? false,
            canGoPrevious: proxy.get_cached_property('CanGoPrevious')?.deep_unpack() as boolean ?? false,
            positionSec: Math.round((proxy.get_cached_property('Position')?.deep_unpack() as number ?? 0) / 1_000_000),
            lengthSec: Math.round((metadata['mpris:length']?.deep_unpack() as number ?? 0) / 1_000_000),
            busName,
        };
    }

    playPause(): void {
        if (!this._activeBusName) return;
        this._proxies.get(this._activeBusName)!.call('PlayPause', null, Gio.DBusCallFlags.NONE, -1, null, null);
    }

    next(): void {
        if (!this._activeBusName) return;
        this._proxies.get(this._activeBusName)!.call('Next', null, Gio.DBusCallFlags.NONE, -1, null, null);
    }

    previous(): void {
        if (!this._activeBusName) return;
        this._proxies.get(this._activeBusName)!.call('Previous', null, Gio.DBusCallFlags.NONE, -1, null, null);
    }
}
