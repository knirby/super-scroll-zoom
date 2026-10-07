// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Knirby

// Super Scroll Zoom: hold Super and scroll to zoom the whole screen through
// GNOME's built-in magnifier.
//
// Mutter hands a scroll over a window straight to the app unless the
// window-drag modifier (org.gnome.desktop.wm.preferences mouse-button-modifier)
// is held, so zooming follows that modifier, Super by default.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// The magnifier eases each change over 100 ms; switch it off once zooming
// back to 1x has finished.
const SETTLE_MS = 150;
const UNZOOMED = 1.0;

export default class SuperScrollZoom extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._magnifier = new Gio.Settings({schema_id: 'org.gnome.desktop.a11y.magnifier'});
        this._a11y = new Gio.Settings({schema_id: 'org.gnome.desktop.a11y.applications'});
        this._settleId = 0;
        this._icons = {
            in: new Gio.ThemedIcon({name: 'zoom-in-symbolic'}),
            out: new Gio.ThemedIcon({name: 'zoom-out-symbolic'}),
            reset: new Gio.ThemedIcon({name: 'zoom-original-symbolic'}),
        };

        // Captured before the window manager's own modifier+scroll handler,
        // which would switch workspaces.
        global.stage.connectObject('captured-event',
            (_stage, event) => this._onEvent(event), this);

        Main.wm.addKeybinding('reset-zoom', this._settings,
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._reset());
    }

    disable() {
        Main.wm.removeKeybinding('reset-zoom');
        global.stage.disconnectObject(this);
        if (this._settleId)
            GLib.source_remove(this._settleId);
        this._settleId = 0;
        this._settings = null;
        this._magnifier = null;
        this._a11y = null;
        this._icons = null;
    }

    _onEvent(event) {
        if (event.type() !== Clutter.EventType.SCROLL)
            return Clutter.EVENT_PROPAGATE;

        const {compositorModifiers} = global.display;
        if (!compositorModifiers ||
            (event.get_state() & compositorModifiers) !== compositorModifiers)
            return Clutter.EVENT_PROPAGATE;

        // Wheels report each notch twice, smooth and discrete, one of them
        // marked emulated; count only the real one.
        if (!(event.get_flags() & Clutter.EventFlags.POINTER_EMULATED))
            this._scroll(event);
        return Clutter.EVENT_STOP;
    }

    _scroll(event) {
        let notches;
        switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.UP:
            notches = 1;
            break;
        case Clutter.ScrollDirection.DOWN:
            notches = -1;
            break;
        case Clutter.ScrollDirection.SMOOTH:
            notches = -event.get_scroll_delta()[1];
            break;
        default:
            return;
        }
        if (!notches)
            return;

        const step = this._settings.get_double('zoom-step');
        const max = this._settings.get_double('max-zoom');
        const zoom = Math.clamp(this._zoom() * step ** notches, UNZOOMED, max);
        this._setZoom(zoom, notches > 0 ? this._icons.in : this._icons.out);
    }

    _reset() {
        if (this._zoom() > UNZOOMED)
            this._setZoom(UNZOOMED, this._icons.reset);
    }

    _zoom() {
        if (this._settleId || !this._a11y.get_boolean('screen-magnifier-enabled'))
            return UNZOOMED;
        return this._magnifier.get_double('mag-factor');
    }

    _setZoom(zoom, icon) {
        if (this._settleId) {
            GLib.source_remove(this._settleId);
            this._settleId = 0;
        }

        // Near 1x, snap to it so zooming out always ends at the normal view.
        if (zoom < UNZOOMED + 0.01)
            zoom = UNZOOMED;

        if (zoom === UNZOOMED) {
            this._magnifier.set_double('mag-factor', UNZOOMED);
            this._settleId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SETTLE_MS, () => {
                this._settleId = 0;
                this._a11y.set_boolean('screen-magnifier-enabled', false);
                return GLib.SOURCE_REMOVE;
            });
        } else {
            if (!this._a11y.get_boolean('screen-magnifier-enabled')) {
                // Start the magnifier at 1x so it eases into the first step.
                this._magnifier.set_double('mag-factor', UNZOOMED);
                this._a11y.set_boolean('screen-magnifier-enabled', true);
            }
            this._magnifier.set_double('mag-factor', zoom);
        }

        if (this._settings.get_boolean('show-osd'))
            this._showLevel(zoom, icon);
    }

    _showLevel(zoom, icon) {
        // The bar fills on a log scale, so every notch moves it equally.
        const max = this._settings.get_double('max-zoom');
        const level = Math.log(zoom) / Math.log(max);
        const label = `${Math.round(zoom * 100)}%`;
        const monitor = global.display.get_current_monitor();
        // GNOME 49 renamed show() to showOne(); before it, show() took these arguments.
        const osd = Main.osdWindowManager;
        if (osd.showOne)
            osd.showOne(monitor, icon, label, level, 1);
        else
            osd.show(monitor, icon, label, level, 1);
    }
}
