// SPDX-License-Identifier: GPL-2.0-or-later
// Ormic Dashboard — Calendar Card

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export type DaySelectedCallback = (isoDate: string) => void;

export class CalendarCard extends St.BoxLayout {
    static {
        GObject.registerClass({ GTypeName: 'OrmicCalendarCard' }, this);
    }

    private _viewYear: number;
    private _viewMonth: number; // 0-11
    private _selectedIso: string;
    private _grid: St.Widget;
    private _monthLabel: St.Label;
    private _onDaySelected: DaySelectedCallback | null = null;

    constructor() {
        super({ style_class: 'ormic-panel', vertical: true, x_expand: true });

        const today = GLib.DateTime.new_now_local();
        this._viewYear = today.get_year();
        this._viewMonth = today.get_month() - 1;
        this._selectedIso = today.format('%Y-%m-%d')!;

        const nav = new St.BoxLayout({ x_expand: true });
        const prevBtn = new St.Button({ style_class: 'ormic-calendar-nav-btn', child: new St.Icon({ icon_name: 'go-previous-symbolic', icon_size: 14 }) });
        prevBtn.connect('clicked', () => this._shiftMonth(-1));
        this._monthLabel = new St.Label({ style_class: 'ormic-calendar-month-label', x_expand: true, x_align: Clutter.ActorAlign.CENTER, y_align: Clutter.ActorAlign.CENTER });
        const nextBtn = new St.Button({ style_class: 'ormic-calendar-nav-btn', child: new St.Icon({ icon_name: 'go-next-symbolic', icon_size: 14 }) });
        nextBtn.connect('clicked', () => this._shiftMonth(1));
        nav.add_child(prevBtn);
        nav.add_child(this._monthLabel);
        nav.add_child(nextBtn);
        this.add_child(nav);

        const weekdayRow = new St.BoxLayout({ x_expand: true });
        for (const wd of WEEKDAY_LABELS) {
            weekdayRow.add_child(new St.Label({
                style_class: 'ormic-calendar-weekday', text: wd, x_expand: true, x_align: Clutter.ActorAlign.CENTER,
            }));
        }
        this.add_child(weekdayRow);

        this._grid = new St.Widget({
            layout_manager: new Clutter.GridLayout({ column_homogeneous: true, row_homogeneous: true }),
            x_expand: true,
        });
        this.add_child(this._grid);

        this._render();
    }

    onDaySelected(cb: DaySelectedCallback): void {
        this._onDaySelected = cb;
    }

    private _shiftMonth(delta: number): void {
        this._viewMonth += delta;
        if (this._viewMonth < 0) { this._viewMonth = 11; this._viewYear--; }
        if (this._viewMonth > 11) { this._viewMonth = 0; this._viewYear++; }
        this._render();
    }

    private _render(): void {
        const monthStart = GLib.DateTime.new_local(this._viewYear, this._viewMonth + 1, 1, 0, 0, 0);
        this._monthLabel.text = monthStart.format('%B %Y')!;

        const layout = this._grid.layout_manager as Clutter.GridLayout;
        this._grid.destroy_all_children();

        // ISO weekday: Monday=1..Sunday=7 -> column offset so Monday is column 0
        const leadingBlank = (monthStart.get_day_of_week() + 6) % 7;
        const daysInMonth = this._daysInMonth(this._viewYear, this._viewMonth);
        const todayIso = GLib.DateTime.new_now_local().format('%Y-%m-%d')!;

        const prevMonthDays = this._daysInMonth(
            this._viewMonth === 0 ? this._viewYear - 1 : this._viewYear,
            this._viewMonth === 0 ? 11 : this._viewMonth - 1,
        );

        let row = 0, col = 0;
        const totalCells = Math.ceil((leadingBlank + daysInMonth) / 7) * 7;

        for (let cell = 0; cell < totalCells; cell++) {
            let dayNum: number, inCurrentMonth: boolean, year = this._viewYear, month = this._viewMonth;

            if (cell < leadingBlank) {
                dayNum = prevMonthDays - (leadingBlank - cell - 1);
                inCurrentMonth = false;
                month = this._viewMonth === 0 ? 11 : this._viewMonth - 1;
                year = this._viewMonth === 0 ? this._viewYear - 1 : this._viewYear;
            } else if (cell < leadingBlank + daysInMonth) {
                dayNum = cell - leadingBlank + 1;
                inCurrentMonth = true;
            } else {
                dayNum = cell - leadingBlank - daysInMonth + 1;
                inCurrentMonth = false;
                month = this._viewMonth === 11 ? 0 : this._viewMonth + 1;
                year = this._viewMonth === 11 ? this._viewYear + 1 : this._viewYear;
            }

            const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isToday = iso === todayIso;
            const isSelected = iso === this._selectedIso;

            const styleClasses = ['ormic-calendar-day'];
            if (!inCurrentMonth) styleClasses.push('ormic-day-outside');
            if (isToday) styleClasses.push('ormic-day-today');
            if (isSelected) styleClasses.push('ormic-day-selected');

            const btn = new St.Button({
                style_class: styleClasses.join(' '),
                label: String(dayNum),
                x_expand: true,
                y_expand: true,
            });
            btn.connect('clicked', () => {
                this._selectedIso = iso;
                if (!inCurrentMonth) { this._viewYear = year; this._viewMonth = month; }
                this._render();
                this._onDaySelected?.(iso);
            });

            layout.attach(btn, col, row, 1, 1);
            col++;
            if (col === 7) { col = 0; row++; }
        }
    }

    private _daysInMonth(year: number, month0: number): number {
        return new Date(year, month0 + 1, 0).getDate();
    }
}
