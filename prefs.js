// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Knirby

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SUPER = '<Super>';

// The magnifier's mouse-tracking modes, as offered here.
const TRACKING = [
    ['proportional', 'Keep what is under the pointer in place'],
    ['centered', 'Keep the pointer centred'],
    ['push', 'Move only when the pointer reaches an edge'],
];

export default class SuperScrollZoomPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const magnifier = new Gio.Settings({schema_id: 'org.gnome.desktop.a11y.magnifier'});
        const wm = new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'});
        window._settings = [settings, magnifier, wm];
        window.set_default_size(560, 640);

        const page = new Adw.PreferencesPage({
            title: 'Zoom',
            icon_name: 'zoom-in-symbolic',
        });
        page.set_banner(this._modifierBanner(wm));
        page.add(this._zoomGroup(settings, magnifier));
        page.add(this._shortcutGroup(window, settings));
        window.add(page);
    }

    _modifierBanner(wm) {
        // Zooming follows the window-drag modifier; say so when it is not Super.
        const banner = new Adw.Banner({button_label: 'Use Super'});
        const sync = () => {
            const modifier = wm.get_string('mouse-button-modifier');
            const name = modifier.replace(/[<>]/g, '') || 'none';
            banner.title = `Zoom uses the window-drag key, which is set to ${name}`;
            banner.revealed = modifier !== SUPER;
        };
        wm.connect('changed::mouse-button-modifier', sync);
        banner.connect('button-clicked', () => wm.set_string('mouse-button-modifier', SUPER));
        sync();
        return banner;
    }

    _zoomGroup(settings, magnifier) {
        const group = new Adw.PreferencesGroup({
            title: 'Zooming',
            description: 'Hold Super and scroll up to zoom in, down to zoom out.',
        });

        const step = new Adw.SpinRow({
            title: 'Zoom per notch',
            subtitle: 'Percent added by each notch of the wheel',
            adjustment: new Gtk.Adjustment({lower: 5, upper: 100, step_increment: 5}),
        });
        const syncStep = () => {
            step.value = Math.round((settings.get_double('zoom-step') - 1) * 100);
        };
        settings.connect('changed::zoom-step', syncStep);
        syncStep();
        step.connect('notify::value', () => settings.set_double('zoom-step', 1 + step.value / 100));
        group.add(step);

        const max = new Adw.SpinRow({
            title: 'Maximum zoom',
            subtitle: 'Times the normal size',
            adjustment: new Gtk.Adjustment({lower: 2, upper: 32, step_increment: 1}),
        });
        settings.bind('max-zoom', max, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(max);

        const tracking = new Adw.ComboRow({
            title: 'Follow the pointer',
            model: Gtk.StringList.new(TRACKING.map(([, label]) => label)),
        });
        const syncTracking = () => {
            const index = TRACKING.findIndex(([mode]) => mode === magnifier.get_string('mouse-tracking'));
            tracking.selected = Math.max(index, 0);
        };
        magnifier.connect('changed::mouse-tracking', syncTracking);
        syncTracking();
        tracking.connect('notify::selected', () =>
            magnifier.set_string('mouse-tracking', TRACKING[tracking.selected][0]));
        group.add(tracking);

        const osd = new Adw.SwitchRow({
            title: 'Show the zoom level',
            subtitle: 'A brief on-screen popup while zooming',
        });
        settings.bind('show-osd', osd, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(osd);

        return group;
    }

    _shortcutGroup(window, settings) {
        const group = new Adw.PreferencesGroup({title: 'Shortcut'});
        const label = new Gtk.ShortcutLabel({
            disabled_text: 'Disabled',
            valign: Gtk.Align.CENTER,
        });
        const row = new Adw.ActionRow({
            title: 'Reset zoom',
            subtitle: 'Back to the normal view',
            activatable: true,
        });
        row.add_suffix(label);
        const sync = () => {
            label.accelerator = settings.get_strv('reset-zoom')[0] ?? '';
        };
        settings.connect('changed::reset-zoom', sync);
        sync();
        row.connect('activated', () => this._captureShortcut(window, settings, 'reset-zoom'));
        group.add(row);
        return group;
    }

    _captureShortcut(window, settings, key) {
        const dialog = new Adw.AlertDialog({
            heading: 'Set Shortcut',
            body: 'Press the new shortcut, Backspace to disable it, or Escape to cancel.',
        });
        dialog.add_response('cancel', 'Cancel');

        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (_controller, keyval, _keycode, state) => {
            const mods = state & Gtk.accelerator_get_default_mod_mask();
            if (!mods && keyval === Gdk.KEY_Escape) {
                dialog.close();
                return Gdk.EVENT_STOP;
            }
            if (!mods && keyval === Gdk.KEY_BackSpace) {
                settings.set_strv(key, []);
                dialog.close();
                return Gdk.EVENT_STOP;
            }
            // Wait for a full combination, not a lone modifier.
            if (!mods || !Gtk.accelerator_valid(keyval, mods))
                return Gdk.EVENT_STOP;
            settings.set_strv(key, [Gtk.accelerator_name(Gdk.keyval_to_lower(keyval), mods)]);
            dialog.close();
            return Gdk.EVENT_STOP;
        });
        dialog.add_controller(controller);
        dialog.present(window);
    }
}
