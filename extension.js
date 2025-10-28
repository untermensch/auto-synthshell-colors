import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const INTERFACE_SCHEMA = 'org.gnome.desktop.interface';
const ACCENT_COLOR = 'accent-color';
const ALLOWED_COLORS = ['green','blue','slate','pink','red','orange','yellow','teal','purple'];

export default class AutoSynthColorsExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._settings = null;
        this._changeId = null;
    }

enable() {
    this._settings = new Gio.Settings({ schema: INTERFACE_SCHEMA });
    this._changeId = this._settings.connect(
        'changed::' + ACCENT_COLOR,
        this._onAccentColorChanged.bind(this)
    );
    this._onAccentColorChanged();
    console.log('[auto-synthshell-colors] enabled');
}
    disable() {
    if (this._changeId && this._settings) {
        this._settings.disconnect(this._changeId);
        this._changeId = null;
    }

    this._restoreDefaultsInMainScript();
    this._settings = null;
    console.log('[auto-synthshell-colors] disabled and restored defaults');
}


    _onAccentColorChanged() {
        try {
            const accentValue = this._settings.get_string(ACCENT_COLOR);
            const color = this._mapToAllowedColor(accentValue);
            this._setMainScriptToExtensionConfig(color);
        } catch (e) {
            console.log(`[auto-synthshell-colors] accent change handler error: ${e}`);
        }
    }

    _mapToAllowedColor(accentValue) {
        if (!accentValue || typeof accentValue !== 'string') return 'green';
        const m = accentValue.match(/([a-zA-Z]+)/);
        let cand = m ? m[1].toLowerCase() : accentValue.toLowerCase();
        if (ALLOWED_COLORS.includes(cand)) return cand;
        for (let c of ALLOWED_COLORS) if (accentValue.toLowerCase().includes(c)) return c;
        return 'green';
    }

    _setMainScriptToExtensionConfig(color) {
        const home = GLib.get_home_dir();
        const mainPath = `${home}/.config/synth-shell/synth-shell-prompt.sh`;
        const mainFile = Gio.File.new_for_path(mainPath);

        if (!mainFile.query_exists(null)) {
            console.log(`[auto-synthshell-colors] main script not found: ${mainPath}`);
            return;
        }

        try {
            let [ok, raw] = GLib.file_get_contents(mainPath);
            if (!ok) {
                console.log(`[auto-synthshell-colors] cannot read main script: ${mainPath}`);
                return;
            }

            let contents = new TextDecoder().decode(raw);
            const original = contents;

            const extDir = this.dir.get_path();
            const extConfigPath = `${extDir}/auto-synthshell-colors-prompt.${color}.config`;

            contents = contents.replace(
                /(local\s+user_config_file\s*=\s*")[^"]*(")/,
                `$1${extConfigPath}$2`
            );

            contents = contents.replace(
                /(local\s+sys_config_file\s*=\s*")[^"]*(")/,
                `$1${extConfigPath}$2`
            );

            contents = contents.replace(/auto-synthshell-colors-prompt\.[a-zA-Z0-9_-]+\.config/g,
                `auto-synthshell-colors-prompt.${color}.config`);

            if (contents !== original) {
                GLib.file_set_contents(mainPath, contents);
                console.log(`[auto-synthshell-colors] synth-shell-prompt.sh updated -> ${extConfigPath}`);
            } else {
                console.log('[auto-synthshell-colors] synth-shell-prompt.sh already up-to-date for this color');
            }
        } catch (e) {
            console.log(`[auto-synthshell-colors] error updating main script: ${e}`);
        }
    }

    _restoreDefaultsInMainScript() {
        const home = GLib.get_home_dir();
        const mainPath = `${home}/.config/synth-shell/synth-shell-prompt.sh`;
        const mainFile = Gio.File.new_for_path(mainPath);

        if (!mainFile.query_exists(null)) {
            console.log(`[auto-synthshell-colors] main script not found for restore: ${mainPath}`);
            return;
        }

        try {
            let [ok, raw] = GLib.file_get_contents(mainPath);
            if (!ok) return;
            let contents = new TextDecoder().decode(raw);
            const original = contents;

            contents = contents.replace(
                /(local\s+user_config_file\s*=\s*")[^"]*(")/,
                `$1$HOME/.config/synth-shell/synth-shell-prompt.config$2`
            );

            contents = contents.replace(
                /(local\s+sys_config_file\s*=\s*")[^"]*(")/,
                `$1/etc/synth-shell/synth-shell-prompt.config$2`
            );

            contents = contents.replace(/auto-synthshell-colors-prompt\.[a-zA-Z0-9_-]+\.config/g,
                'synth-shell-prompt.config');

            if (contents !== original) {
                GLib.file_set_contents(mainPath, contents);
                console.log('[auto-synthshell-colors] synth-shell-prompt.sh restored to defaults');
            } else {
                console.log('[auto-synthshell-colors] synth-shell-prompt.sh already at defaults');
            }
        } catch (e) {
            console.log(`[auto-synthshell-colors] error restoring main script: ${e}`);
        }
    }
}
