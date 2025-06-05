import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class NetworkAutoMountPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        
        // General Settings Page
        const generalPage = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic'
        });
        
        this._addGeneralSettings(generalPage);
        window.add(generalPage);
        
        // Notifications Page
        const notificationsPage = new Adw.PreferencesPage({
            title: _('Notifications'),
            icon_name: 'preferences-desktop-notifications-symbolic'
        });
        
        this._addNotificationSettings(notificationsPage);
        window.add(notificationsPage);
        
        // Mount Points Page
        const mountsPage = new Adw.PreferencesPage({
            title: _('Mount Points'),
            icon_name: 'folder-symbolic'
        });
        
        this._addMountSettings(mountsPage);
        window.add(mountsPage);
        
        // Advanced Page
        const advancedPage = new Adw.PreferencesPage({
            title: _('Advanced'),
            icon_name: 'preferences-other-symbolic'
        });
        
        this._addAdvancedSettings(advancedPage);
        window.add(advancedPage);
    }
    
    _addGeneralSettings(page) {
        const group = new Adw.PreferencesGroup({
            title: _('Automatic Mounting'),
            description: _('Configure how often to check and mount network locations')
        });
        
        // Check interval
        const intervalRow = new Adw.SpinRow({
            title: _('Check Interval'),
            subtitle: _('Minutes between automatic mount checks'),
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 60,
                step_increment: 1,
                page_increment: 5,
                value: this._settings.get_int('check-interval')
            })
        });
        
        intervalRow.connect('notify::value', () => {
            this._settings.set_int('check-interval', intervalRow.get_value());
        });
        
        group.add(intervalRow);
        page.add(group);
    }
    
    _addNotificationSettings(page) {
        const group = new Adw.PreferencesGroup({
            title: _('Notification Preferences'),
            description: _('Choose when to show notifications')
        });
        
        // Master notifications toggle
        const notificationsRow = new Adw.SwitchRow({
            title: _('Show Notifications'),
            subtitle: _('Enable or disable all notifications')
        });
        
        this._settings.bind('show-notifications', notificationsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(notificationsRow);
        
        // Success notifications
        const successRow = new Adw.SwitchRow({
            title: _('Success Notifications'),
            subtitle: _('Show notifications when mounts succeed')
        });
        
        this._settings.bind('show-success-notifications', successRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(successRow);
        
        // Error notifications
        const errorRow = new Adw.SwitchRow({
            title: _('Error Notifications'),
            subtitle: _('Show notifications when mounts fail')
        });
        
        this._settings.bind('show-error-notifications', errorRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(errorRow);
        
        page.add(group);
    }
    
    _addMountSettings(page) {
        const group = new Adw.PreferencesGroup({
            title: _('Custom Mount Points'),
            description: _('Configure where network locations are mounted')
        });
        
        // Custom mount base directory
        const mountBaseRow = new Adw.EntryRow({
            title: _('Base Mount Directory'),
            text: this._settings.get_string('custom-mount-base')
        });
        
        mountBaseRow.connect('notify::text', () => {
            this._settings.set_string('custom-mount-base', mountBaseRow.get_text());
        });
        
        // Add browse button
        const browseButton = new Gtk.Button({
            icon_name: 'folder-open-symbolic',
            valign: Gtk.Align.CENTER
        });
        
        browseButton.connect('clicked', () => {
            this._chooseMountDirectory(mountBaseRow);
        });
        
        mountBaseRow.add_suffix(browseButton);
        group.add(mountBaseRow);
        
        // Info about default behavior
        const infoRow = new Adw.ActionRow({
            title: _('Default Behavior'),
            subtitle: _('If empty, system will choose mount points automatically')
        });
        group.add(infoRow);
        
        page.add(group);
    }
    
    _addAdvancedSettings(page) {
        const retryGroup = new Adw.PreferencesGroup({
            title: _('Retry Settings'),
            description: _('Configure retry behavior for failed mounts')
        });
        
        // Retry attempts
        const attemptsRow = new Adw.SpinRow({
            title: _('Retry Attempts'),
            subtitle: _('Number of times to retry failed mounts'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 10,
                step_increment: 1,
                page_increment: 1,
                value: this._settings.get_int('retry-attempts')
            })
        });
        
        attemptsRow.connect('notify::value', () => {
            this._settings.set_int('retry-attempts', attemptsRow.get_value());
        });
        
        retryGroup.add(attemptsRow);
        
        // Retry delay
        const delayRow = new Adw.SpinRow({
            title: _('Retry Delay'),
            subtitle: _('Seconds to wait between retry attempts'),
            adjustment: new Gtk.Adjustment({
                lower: 5,
                upper: 300,
                step_increment: 5,
                page_increment: 30,
                value: this._settings.get_int('retry-delay')
            })
        });
        
        delayRow.connect('notify::value', () => {
            this._settings.set_int('retry-delay', delayRow.get_value());
        });
        
        retryGroup.add(delayRow);
        page.add(retryGroup);
        
        // Debug group
        const debugGroup = new Adw.PreferencesGroup({
            title: _('Debugging'),
            description: _('Tools for troubleshooting')
        });
        
        const logRow = new Adw.ActionRow({
            title: _('View Extension Logs'),
            subtitle: _('Open journal to view extension debug output')
        });
        
        const logButton = new Gtk.Button({
            label: _('Open Logs'),
            valign: Gtk.Align.CENTER
        });
        
        logButton.connect('clicked', () => {
            try {
                GLib.spawn_command_line_async('gnome-logs');
            } catch (e) {
                console.error('Could not open logs:', e);
            }
        });
        
        logRow.add_suffix(logButton);
        debugGroup.add(logRow);
        page.add(debugGroup);
    }
    
    _chooseMountDirectory(entry) {
        const dialog = new Gtk.FileChooserDialog({
            title: _('Choose Mount Base Directory'),
            action: Gtk.FileChooserAction.SELECT_FOLDER,
            modal: true,
            transient_for: this.get_root()
        });
        
        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.add_button(_('Select'), Gtk.ResponseType.ACCEPT);
        
        dialog.connect('response', (dialog, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                const file = dialog.get_file();
                if (file) {
                    entry.set_text(file.get_path());
                }
            }
            dialog.destroy();
        });
        
        dialog.show();
    }
}
