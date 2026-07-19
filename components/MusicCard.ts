// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — Music Card

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import type { MusicTrack } from '../types.js';

export type TransportCallback = () => void;

export class MusicCard extends St.BoxLayout {
    static {
        GObject.registerClass({ GTypeName: 'OrmicMusicCard' }, this);
    }

    private _art: St.Icon | St.Widget;
    private _title: St.Label;
    private _artist: St.Label;
    private _playBtn: St.Button;
    private _playIcon: St.Icon;
    private _prevBtn: St.Button;
    private _nextBtn: St.Button;
    private _emptyLabel: St.Label;
    private _content: St.BoxLayout;

    constructor() {
        super({ style_class: 'ormic-panel', vertical: true, x_expand: true, y_expand: true });

        this._emptyLabel = new St.Label({
            style_class: 'ormic-muted',
            text: 'Nothing playing',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true,
        });

        this._content = new St.BoxLayout({ vertical: true, x_expand: true, y_expand: true, visible: false });

        this._art = new St.Icon({ style_class: 'ormic-music-art', icon_name: 'audio-x-generic-symbolic', icon_size: 64, x_expand: true, y_expand: true });
        this._content.add_child(this._art);

        this._title = new St.Label({ style_class: 'ormic-music-title' });
        this._title.clutter_text.ellipsize = 3;
        this._content.add_child(this._title);

        this._artist = new St.Label({ style_class: 'ormic-music-artist' });
        this._content.add_child(this._artist);

        const transport = new St.BoxLayout({ x_expand: true, x_align: Clutter.ActorAlign.CENTER });
        this._prevBtn = new St.Button({ style_class: 'ormic-music-transport-btn', child: new St.Icon({ icon_name: 'media-skip-backward-symbolic', icon_size: 16 }) });
        this._playIcon = new St.Icon({ icon_name: 'media-playback-start-symbolic', icon_size: 16 });
        this._playBtn = new St.Button({ style_class: 'ormic-music-play-btn', child: this._playIcon });
        this._nextBtn = new St.Button({ style_class: 'ormic-music-transport-btn', child: new St.Icon({ icon_name: 'media-skip-forward-symbolic', icon_size: 16 }) });
        transport.add_child(this._prevBtn);
        transport.add_child(this._playBtn);
        transport.add_child(this._nextBtn);
        this._content.add_child(transport);

        this.add_child(this._emptyLabel);
        this.add_child(this._content);
    }

    onPlayPause(cb: TransportCallback): void { this._playBtn.connect('clicked', cb); }
    onNext(cb: TransportCallback): void { this._nextBtn.connect('clicked', cb); }
    onPrevious(cb: TransportCallback): void { this._prevBtn.connect('clicked', cb); }

    setTrack(track: MusicTrack | null): void {
        if (!track) {
            this._emptyLabel.visible = true;
            this._content.visible = false;
            return;
        }
        this._emptyLabel.visible = false;
        this._content.visible = true;

        this._title.text = track.title;
        this._artist.text = track.artist;
        this._playIcon.icon_name = track.playing ? 'media-playback-pause-symbolic' : 'media-playback-start-symbolic';
        this._prevBtn.reactive = track.canGoPrevious;
        this._nextBtn.reactive = track.canGoNext;
        this._setArt(track.artUrl);
    }

    private _setArt(artUrl: string | null): void {
        if (!artUrl || !artUrl.startsWith('file://')) return;
        const file = Gio.File.new_for_uri(artUrl);
        const gicon = new Gio.FileIcon({ file });
        const newArt = new St.Icon({
            style_class: 'ormic-music-art',
            gicon,
            icon_size: 200,
            x_expand: true,
            y_expand: true,
        });
        this._content.replace_child(this._art, newArt);
        this._art = newArt;
    }
}
