// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — Stat Rings

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import type { StatSample } from '../types.js';

const RING_SIZE = 72;
const RING_THICKNESS = 6;
const TRACK_COLOR: [number, number, number] = [0.85, 0.86, 0.93];
const PROGRESS_COLOR: [number, number, number] = [0.31, 0.36, 0.57];

class StatRing extends St.BoxLayout {
    static {
        GObject.registerClass({ GTypeName: 'OrmicStatRing' }, this);
    }
    private _area: St.DrawingArea;
    private _percent = 0;
    private _label: St.Label;
    private _caption: St.Label;

    constructor(caption: string) {
        super({ style_class: 'ormic-stat-tile', vertical: true, x_align: Clutter.ActorAlign.CENTER });

        this._area = new St.DrawingArea({ width: RING_SIZE, height: RING_SIZE, x_align: Clutter.ActorAlign.CENTER });
        this._area.connect('repaint', () => this._draw());
        this.add_child(this._area);

        this._label = new St.Label({ style_class: 'ormic-stat-value', x_align: Clutter.ActorAlign.CENTER });
        this.add_child(this._label);

        this._caption = new St.Label({ style_class: 'ormic-stat-label', text: caption, x_align: Clutter.ActorAlign.CENTER });
        this.add_child(this._caption);
    }

    setPercent(percent: number, detail: string): void {
        this._percent = Math.max(0, Math.min(100, percent));
        this._label.text = `${Math.round(this._percent)}%`;
        (this._area as any).set_tooltip_text(detail);
        this._area.queue_repaint();
    }

    private _draw(): void {
        const cr = this._area.get_context();
        const [w, h] = this._area.get_surface_size();
        const cx = w / 2, cy = h / 2;
        const radius = Math.min(w, h) / 2 - RING_THICKNESS;

        cr.setLineWidth(RING_THICKNESS);
        cr.setLineCap(1); // ROUND

        cr.setSourceRGB(...TRACK_COLOR);
        cr.arc(cx, cy, radius, 0, 2 * Math.PI);
        cr.stroke();

        const fraction = this._percent / 100;
        const start = -Math.PI / 2;
        const end = start + fraction * 2 * Math.PI;
        cr.setSourceRGB(...PROGRESS_COLOR);
        cr.arc(cx, cy, radius, start, end);
        cr.stroke();

        cr.$dispose();
    }
}

export class StatsRow extends St.BoxLayout {
    static {
        GObject.registerClass({ GTypeName: 'OrmicStatsRow' }, this);
    }
    private _rings = new Map<string, StatRing>();

    constructor() {
        super({ x_expand: true });
        for (const [id, label] of [['cpu', 'CPU'], ['memory', 'RAM'], ['disk', 'Disk']] as const) {
            const ring = new StatRing(label);
            this._rings.set(id, ring);
            this.add_child(ring);
        }
    }

    update(samples: StatSample[]): void {
        for (const sample of samples)
            this._rings.get(sample.id)?.setPercent(sample.percent, sample.detail);
    }
}
