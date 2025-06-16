import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

class NetworkMountIndicator extends PanelMenu.Button {
    static {
        GObject.registerClass(this);
    }

    _init(settings) {
        super._init(0.0, _('Network Auto Mount'));
        
        this._settings = settings;
        this._icon = new St.Icon({
            icon_name: 'folder-remote-symbolic',
            style_class: 'system-status-icon'
        });
        this.add_child(this._icon);
        
        this._bookmarks = [];
        this._mountedLocations = new Map();
        this._symlinkPaths = new Map(); // Track symlinks for cleanup
        this._retryQueue = new Map();
        this._timeoutId = null;
        this._source = null;
        this._startupMountInProgress = false;
        
        this._connectSettings();
        this._buildMenu();
        this._loadBookmarks();
        this._startPeriodicCheck();
        this._setupNotificationSource();
        
        // Mount all enabled bookmarks on startup with status updates
        this._startupMountInProgress = true;
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
            this._checkAndMountAll(false, true); // isManual=false, isStartup=true
            return GLib.SOURCE_REMOVE;
        });
        
        // Additional status refresh after startup mounts complete
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            this._startupMountInProgress = false;
            this._updateBookmarksList();
            this._updateStatus();
            return GLib.SOURCE_REMOVE;
        });
    }
    
    _connectSettings() {
        this._settings.connect('changed::check-interval', () => {
            this._startPeriodicCheck();
        });
        
        this._settings.connect('changed::bookmark-settings', () => {
            this._loadBookmarkSettings();
            this._updateBookmarksList();
        });
    }
    
    _setupNotificationSource() {
        this._source = new MessageTray.Source({
            title: _('Network Auto Mount'),
            iconName: 'folder-remote-symbolic'
        });
        Main.messageTray.add(this._source);
    }
    
    _notify(title, message, isError = false) {
        if (!this._settings.get_boolean('show-notifications')) return;
        
        if (isError && !this._settings.get_boolean('show-error-notifications')) return;
        if (!isError && !this._settings.get_boolean('show-success-notifications')) return;
        
        let notification = new MessageTray.Notification(this._source, title, message);
        notification.setTransient(true);
        if (isError) notification.setUrgency(MessageTray.Urgency.HIGH);
        this._source.showNotification(notification);
    }
    
    _buildMenu() {
        // Header with status
        this._headerItem = new PopupMenu.PopupMenuItem(_('Network Auto Mount'), {
            reactive: false,
            style_class: 'popup-menu-item-header'
        });
        this.menu.addMenuItem(this._headerItem);
        
        // Status line
        this._statusItem = new PopupMenu.PopupMenuItem('', {
            reactive: false,
            style_class: 'popup-menu-item-inactive'
        });
        this.menu.addMenuItem(this._statusItem);
        
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Bookmarks section
        this._bookmarksSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._bookmarksSection);
        
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Controls
        let configItem = new PopupMenu.PopupMenuItem(_('Settings'));
        configItem.connect('activate', () => {
            this._openSettings();
        });
        this.menu.addMenuItem(configItem);
        
        let refreshItem = new PopupMenu.PopupMenuItem(_('Check All Now'));
        refreshItem.connect('activate', () => {
            this._checkAndMountAll(true);
        });
        this.menu.addMenuItem(refreshItem);
        
        let mountAllItem = new PopupMenu.PopupMenuItem(_('Mount All Enabled'));
        mountAllItem.connect('activate', () => {
            this._mountAllEnabled();
        });
        this.menu.addMenuItem(mountAllItem);
        
        let unmountAllItem = new PopupMenu.PopupMenuItem(_('Unmount All'));
        unmountAllItem.connect('activate', () => {
            this._unmountAll();
        });
        this.menu.addMenuItem(unmountAllItem);
    }

    _updateStatus() {
        let enabled = this._bookmarks.filter(b => b.enabled).length;
        let mounted = this._bookmarks.filter(b => b.enabled && this._isLocationMounted(b.uri)).length;
        let interval = this._settings.get_int('check-interval');
        
        this._statusItem.label.text = _(`${mounted}/${enabled} mounted \u2022 Check every ${interval}min`);
        
        // Update icon based on status
        if (enabled === 0) {
            this._icon.icon_name = 'folder-remote-symbolic';
        } else if (mounted === enabled) {
            this._icon.icon_name = 'folder-remote-symbolic'; // All good
            this._icon.add_style_class_name('success');
        } else if (mounted > 0) {
            this._icon.icon_name = 'dialog-warning-symbolic'; // Partial
        } else {
            this._icon.icon_name = 'dialog-error-symbolic'; // None mounted
        }
    }
    
    _loadBookmarks() {
        try {
            let bookmarksFile = Gio.File.new_for_path(
                GLib.get_home_dir() + '/.config/gtk-3.0/bookmarks'
            );
            
            if (!bookmarksFile.query_exists(null)) {
                this._updateBookmarksList([]);
                return;
            }
            
            let [success, contents] = bookmarksFile.load_contents(null);
            if (!success) return;
            
            let bookmarkLines = new TextDecoder().decode(contents).split('\n');
            this._bookmarks = bookmarkLines
                .filter(line => line.trim() && line.includes('://') && !line.startsWith('file://'))
                .map(line => {
                    let [uri, ...nameParts] = line.trim().split(' ');
                    let name = nameParts.join(' ') || this._extractNameFromUri(uri);
                    return { 
                        uri, 
                        name, 
                        enabled: true,
                        customMountPoint: '',
                        lastAttempt: 0,
                        failCount: 0
                    };
                });
                
            this._loadBookmarkSettings();
            this._updateBookmarksList();
            
        } catch (e) {
            console.error('Error loading bookmarks:', e);
            this._bookmarks = [];
        }
    }
    
    _loadBookmarkSettings() {
        try {
            let settingsStr = this._settings.get_string('bookmark-settings');
            if (!settingsStr) return;
            
            let bookmarkSettings = JSON.parse(settingsStr);
            this._bookmarks.forEach(bookmark => {
                let settings = bookmarkSettings[bookmark.uri];
                if (settings) {
                    bookmark.enabled = settings.enabled !== false;
                    bookmark.customMountPoint = settings.customMountPoint || '';
                }
            });
        } catch (e) {
            console.error('Error loading bookmark settings:', e);
        }
    }
    
    _saveBookmarkSettings() {
        try {
            let bookmarkSettings = {};
            this._bookmarks.forEach(bookmark => {
                bookmarkSettings[bookmark.uri] = {
                    enabled: bookmark.enabled,
                    customMountPoint: bookmark.customMountPoint
                };
            });
            
            this._settings.set_string('bookmark-settings', JSON.stringify(bookmarkSettings));
        } catch (e) {
            console.error('Error saving bookmark settings:', e);
        }
    }
    
    _extractNameFromUri(uri) {
        try {
            let parsed = GLib.Uri.parse(uri, GLib.UriFlags.NONE);
            let path = parsed.get_path() || '';
            let host = parsed.get_host() || 'unknown';
            return path.length > 1 ? `${host}${path}` : host;
        } catch (e) {
            return uri;
        }
    }
    
    _updateBookmarksList() {
        this._bookmarksSection.removeAll();
        
        if (this._bookmarks.length === 0) {
            let noBookmarksItem = new PopupMenu.PopupMenuItem(_('No network bookmarks found'), {
                reactive: false,
                style_class: 'popup-menu-item-inactive'
            });
            this._bookmarksSection.addMenuItem(noBookmarksItem);
            this._updateStatus();
            return;
        }
        
        this._bookmarks.forEach((bookmark, index) => {
            // Single line with everything combined
            let item = this._createBookmarkItem(bookmark, index);
            this._bookmarksSection.addMenuItem(item);
        });
        
        this._updateStatus();
    }
    
    _createBookmarkItem(bookmark, index) {
        let item = new PopupMenu.PopupSwitchMenuItem(bookmark.name, bookmark.enabled);
        
        // Connect the toggle functionality - only controls auto-mount setting
        item.connect('toggled', (item, state) => {
            this._bookmarks[index].enabled = state;
            this._saveBookmarkSettings();
            this._updateStatus();
            this._updateBookmarksList(); // Refresh to update status
        });
        
        // Update the label to include all status info in one line
        this._updateCompleteItemLabel(item, bookmark);
        
        // Add click handler for manual mount/unmount on the main item text
        item.connect('activate', () => {
            if (this._isLocationMounted(bookmark.uri)) {
                this._unmountLocation(bookmark);
            } else {
                this._mountLocation(bookmark);
            }
        });
        
        return item;
    }
    
    _updateCompleteItemLabel(item, bookmark) {
        let isMounted = this._isLocationMounted(bookmark.uri);
        let statusSymbol = isMounted ? '\u{1f7e2}' : '\u26aa';
        
        if (bookmark.failCount > 0) {
            statusSymbol = '\u{1f7e1}';
        }
        
        // Build complete status info
        let statusParts = [bookmark.name];
        
        // Add mount status and symlink path
        if (isMounted) {
            let symlinkPath = this._getSymlinkPath(bookmark);
            statusParts.push(`(Mounted → ${symlinkPath})`);
        } else if (bookmark.failCount > 0) {
            statusParts.push(`(Failed ${bookmark.failCount}x)`);
        }
        
        // Combine everything into one line
        let labelText = `${statusSymbol} ${statusParts.join(' ')}`;
        item.label.text = labelText;
    }
    
    _isLocationMounted(uri) {
        try {
            let file = Gio.File.new_for_uri(uri);
            let mount = file.find_enclosing_mount(null);
            return mount !== null;
        } catch (e) {
            return false;
        }
    }
    
    _getGvfsMountPath(uri) {
        try {
            let file = Gio.File.new_for_uri(uri);
            let mount = file.find_enclosing_mount(null);
            if (mount) {
                let root = mount.get_root();
                return root.get_path();
            }
        } catch (e) {
            console.error('Error getting GVFS mount path:', e);
        }
        return null;
    }
    
    _getSymlinkPath(bookmark) {
        let basePath = this._settings.get_string('custom-mount-base');
        if (!basePath) {
            basePath = GLib.get_home_dir() + '/NetworkMounts';
        }
        
        // Use custom mount point name if specified, otherwise use sanitized bookmark name
        let linkName = bookmark.customMountPoint || this._sanitizeForFilename(bookmark.name);
        return `${basePath}/${linkName}`;
    }
    
    _sanitizeForFilename(name) {
        // Replace problematic characters with safe alternatives
        return name.replace(/[<>:"\/\\|?*]/g, '_')
                  .replace(/\s+/g, '_')
                  .replace(/_+/g, '_')
                  .replace(/^_|_$/g, '');
    }
    
    _createSymlink(bookmark) {
        try {
            let gvfsPath = this._getGvfsMountPath(bookmark.uri);
            if (!gvfsPath) {
                console.error('Could not get GVFS mount path for:', bookmark.name);
                return false;
            }
            
            let symlinkPath = this._getSymlinkPath(bookmark);
            let symlinkDir = GLib.path_get_dirname(symlinkPath);
            
            // Create base directory if it doesn't exist
            let baseDir = Gio.File.new_for_path(symlinkDir);
            try {
                baseDir.make_directory_with_parents(null);
            } catch (e) {
                // Directory might already exist
                if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
                    console.error('Failed to create symlink directory:', e);
                    return false;
                }
            }
            
            // Remove existing symlink if present
            this._removeSymlink(bookmark);
            
            // Create the symbolic link
            let symlinkFile = Gio.File.new_for_path(symlinkPath);
            try {
                symlinkFile.make_symbolic_link(gvfsPath, null);
                this._symlinkPaths.set(bookmark.uri, symlinkPath);
                console.log(`Created symlink: ${symlinkPath} → ${gvfsPath}`);
                return true;
            } catch (e) {
                console.error(`Failed to create symlink for ${bookmark.name}:`, e);
                return false;
            }
            
        } catch (e) {
            console.error('Error creating symlink:', e);
            return false;
        }
    }
    
    _removeSymlink(bookmark) {
        try {
            let symlinkPath = this._symlinkPaths.get(bookmark.uri);
            if (!symlinkPath) {
                // Try to get the path even if not tracked
                symlinkPath = this._getSymlinkPath(bookmark);
            }
            
            let symlinkFile = Gio.File.new_for_path(symlinkPath);
            if (symlinkFile.query_exists(null)) {
                // Check if it's actually a symlink before removing
                let info = symlinkFile.query_info('standard::is-symlink', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
                if (info && info.get_is_symlink()) {
                    symlinkFile.delete(null);
                    console.log(`Removed symlink: ${symlinkPath}`);
                }
            }
            
            this._symlinkPaths.delete(bookmark.uri);
            return true;
            
        } catch (e) {
            console.error('Error removing symlink:', e);
            return false;
        }
    }
    
    _mountLocation(bookmark, isRetry = false, isStartup = false) {
        if (this._isLocationMounted(bookmark.uri)) {
            // Even if already mounted, ensure symlink exists
            this._createSymlink(bookmark);
            if (!isRetry && !isStartup) this._notify(_('Already Mounted'), bookmark.name);
            return;
        }
        
        try {
            let file = Gio.File.new_for_uri(bookmark.uri);
            let mountOp = new Gio.MountOperation();
            
            file.mount_enclosing_volume(
                Gio.MountMountFlags.NONE,
                mountOp,
                null,
                (file, result) => {
                    try {
                        file.mount_enclosing_volume_finish(result);
                        console.log(`Successfully mounted: ${bookmark.name}`);
                        
                        bookmark.failCount = 0;
                        bookmark.lastAttempt = Date.now();
                        this._mountedLocations.set(bookmark.uri, Date.now());
                        
                        // Create symlink after successful mount
                        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                            let symlinkCreated = this._createSymlink(bookmark);
                            
                            if (!isStartup) {
                                let message = symlinkCreated ? 
                                    `${bookmark.name} → ${this._getSymlinkPath(bookmark)}` : 
                                    bookmark.name;
                                this._notify(_('Mounted Successfully'), message);
                            }
                            
                            // Always update the menu after successful mount and symlink creation
                            this._updateBookmarksList();
                            this._updateStatus();
                            
                            return GLib.SOURCE_REMOVE;
                        });
                        
                    } catch (e) {
                        console.error(`Failed to mount ${bookmark.name}:`, e);
                        this._handleMountFailure(bookmark, e.message);
                    }
                }
            );
        } catch (e) {
            console.error(`Error mounting ${bookmark.name}:`, e);
            this._handleMountFailure(bookmark, e.message);
        }
    }
    
    _handleMountFailure(bookmark, errorMsg) {
        bookmark.failCount++;
        bookmark.lastAttempt = Date.now();
        
        let maxRetries = this._settings.get_int('retry-attempts');
        if (bookmark.failCount <= maxRetries) {
            // Schedule retry
            let retryDelay = this._settings.get_int('retry-delay');
            this._scheduleRetry(bookmark, retryDelay);
            
            this._notify(
                _('Mount Failed - Retrying'), 
                _(`${bookmark.name} (attempt ${bookmark.failCount}/${maxRetries})`), 
                true
            );
        } else {
            this._notify(
                _('Mount Failed'), 
                _(`${bookmark.name}: ${errorMsg}`), 
                true
            );
        }
        
        this._updateBookmarksList();
    }
    
    _scheduleRetry(bookmark, delaySecs) {
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, delaySecs, () => {
            if (bookmark.enabled && !this._isLocationMounted(bookmark.uri)) {
                this._mountLocation(bookmark, true, this._startupMountInProgress);
            }
            return GLib.SOURCE_REMOVE;
        });
    }
    
    _unmountLocation(bookmark) {
        try {
            let file = Gio.File.new_for_uri(bookmark.uri);
            let mount = file.find_enclosing_mount(null);
            
            if (mount) {
                // Remove symlink before unmounting
                this._removeSymlink(bookmark);
                
                mount.unmount_with_operation(
                    Gio.MountUnmountFlags.NONE,
                    null,
                    null,
                    (mount, result) => {
                        try {
                            mount.unmount_with_operation_finish(result);
                            console.log(`Successfully unmounted: ${bookmark.name}`);
                            
                            this._mountedLocations.delete(bookmark.uri);
                            this._notify(_('Unmounted'), bookmark.name);
                            
                            // Always update the menu after successful unmount
                            this._updateBookmarksList();
                            this._updateStatus();
                            
                        } catch (e) {
                            console.error(`Failed to unmount ${bookmark.name}:`, e);
                            this._notify(_('Unmount Failed'), `${bookmark.name}: ${e.message}`, true);
                        }
                    }
                );
            } else {
                // If not mounted, still try to clean up any stale symlinks
                this._removeSymlink(bookmark);
                this._notify(_('Not Mounted'), bookmark.name);
            }
        } catch (e) {
            console.error(`Error unmounting ${bookmark.name}:`, e);
        }
    }
    
    _checkAndMountAll(manual = false, isStartup = false) {
        let mounted = 0;
        let total = 0;
        this._loadBookmarks();
        this._updateStatus();
        this._bookmarks
            .filter(bookmark => bookmark.enabled)
            .forEach(bookmark => {
                total++;
                if (this._isLocationMounted(bookmark.uri)) {
                    mounted++;
                    // Ensure symlink exists for already mounted locations
                    this._createSymlink(bookmark);
                } else {
                    this._mountLocation(bookmark, false, isStartup);
                }
            });
            
        if (manual) {
            this._notify(_('Mount Check'), _(`Checking ${total} locations, ${mounted} already mounted`));
        }
    }
    
    _mountAllEnabled() {
        let count = 0;
        this._bookmarks
            .filter(bookmark => bookmark.enabled)
            .forEach(bookmark => {
                if (!this._isLocationMounted(bookmark.uri)) {
                    this._mountLocation(bookmark);
                    count++;
                }
            });
            
        this._notify(_('Mounting All'), _(`Attempting to mount ${count} locations`));
    }
    
    _unmountAll() {
        let count = 0;
        this._bookmarks.forEach(bookmark => {
            if (this._isLocationMounted(bookmark.uri)) {
                this._unmountLocation(bookmark);
                count++;
            }
        });
        
        this._notify(_('Unmounting All'), _(`Unmounting ${count} locations`));
    }
    
    _startPeriodicCheck() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
        }
        
        let interval = this._settings.get_int('check-interval');
        this._timeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval * 60,
            () => {
                this._checkAndMountAll();
                return GLib.SOURCE_CONTINUE;
            }
        );
    }
    
    _openSettings() {
        try {
            GLib.spawn_command_line_async('gnome-extensions prefs network-automount@gavindi.github.com');
        } catch (e) {
            this._notify(_('Settings'), _('Could not open preferences'), true);
        }
    }
    
    _cleanupAllSymlinks() {
        // Clean up all tracked symlinks
        this._bookmarks.forEach(bookmark => {
            this._removeSymlink(bookmark);
        });
        this._symlinkPaths.clear();
    }
    
    destroy() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = null;
        }
        
        // Clean up all symlinks when extension is disabled
        this._cleanupAllSymlinks();
        
        if (this._source) {
            this._source.destroy();
        }
        super.destroy();
    }
}

export default class NetworkAutoMountExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new NetworkMountIndicator(this._settings);
        Main.panel.addToStatusArea('network-automount', this._indicator);
    }
    
    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        this._settings = null;
    }
}