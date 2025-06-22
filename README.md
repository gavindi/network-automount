# Network Share Automount
![screenshot](https://github.com/gavindi/network-automount/blob/master/media/NetworkautomountScreenshot.png)

## Mount your bookmarked network shares
This extension will mount your bookmarked network shares and periodically check them should they become unmounted for any reason.  It has options to control (re)mount frequency.

I was inspired by [Gigolo](https://docs.xfce.org/apps/gigolo/start) but sometimes crashes and also doesn't display a MessageTray icon under Wayland sessions.  Also, I thought "why does this need to be an app?".  So, I vibed with Claude to create this.

## Installation from source

The extension can be installed directly from source, either for the convenience of using git or to test the latest development version. Clone the desired branch with git

### Build Dependencies

This extension has no special build dependancies.

### Quick Install

Clone the repository or download the branch from github. A simple Makefile is included.

```bash
git clone https://github.com/gavindi/network-share-automount
cd network-share-automount
make install
```

##### Build Process

Compiles GSettings schemas (required for preferences)
Copies all necessary files to a build directory
Creates proper directory structure

##### Installation Options

```bash
# Install to user directory (recommended)
make install

# System-wide installation (requires sudo)
make install-system
```
##### Development Workflow

```bash
# One command to clean, install, and enable
make dev

# Check if extension is installed/enabled
make status

# Restart GNOME Shell on X11
make restart-shell
```
##### Distribution

```bash
make dist - Creates a zip file for sharing/publishing
```

##### Quick Usage

```bash
# Build and install the extension
make install

# Enable it
make enable

# Or do everything at once for development
make dev
```

# Step-by-Step Custom Mount Points Setup

## Scenario: Setting up a home network with NAS access

**Goal**: Access your NAS shares easily from `~/NetworkMounts/` folder

---

## Step 1: Add Network Bookmarks First

Before configuring the extension, you need network bookmarks in your file manager:

1. **Open Files (Nautilus)**
2. **Connect to Server** (Ctrl+L or sidebar)
3. **Enter your network addresses**:
   ```
   smb://192.168.1.100/documents
   smb://192.168.1.100/media  
   smb://192.168.1.100/backup
   ```
4. **Authenticate** when prompted
5. **Bookmark each share** (Ctrl+D or click bookmark star)

**Verify**: Check that bookmarks appear in Files sidebar

---

## Step 2: Configure Base Directory

1. **Open Extension Settings**:
   ```bash
   gnome-extensions prefs network-automount@gavindi.github.com
   ```
   
2. **Go to "Mount Points" tab**

3. **Set Base Mount Directory**:
   ```
   /home/[username]/NetworkMounts
   ```
   Or simply: `~/NetworkMounts`

4. **Click browse button** (📁) if you prefer visual selection

**Result**: All symlinks will be created under `~/NetworkMounts/`

---

## Step 3: Configure Each Bookmark

Go to **"Bookmarks" tab** - you should see your network bookmarks listed.

### For Documents Share:
```
📋 192.168.1.100/documents
├── ☑️ Auto Mount: ON
├── ☑️ Create Symlink: ON
├── 📝 Symlink Name: "NAS-Documents"
└── Custom Mount Point: [leave empty]
```

### For Media Share:
```
📋 192.168.1.100/media
├── ☑️ Auto Mount: ON  
├── ☑️ Create Symlink: ON
├── 📝 Symlink Name: "NAS-Media"
└── Custom Mount Point: [leave empty]
```

### For Backup Share:
```
📋 192.168.1.100/backup
├── ☑️ Auto Mount: ON
├── ☑️ Create Symlink: ON  
├── 📝 Symlink Name: "NAS-Backup"
└── Custom Mount Point: [leave empty]
```

**Click "Apply" or close settings**

---

## Step 4: Test the Setup

1. **Wait 10-15 seconds** for auto-mounting

2. **Check the status**:
   - Extension icon in top bar should show mounted shares
   - Click extension icon to see mount status

3. **Verify symlinks created**:
   ```bash
   ls -la ~/NetworkMounts/
   ```
   Should show:
   ```
   lrwxrwxrwx NAS-Documents -> /run/user/1000/gvfs/smb-share:server=192.168.1.100,share=documents
   lrwxrwxrwx NAS-Media -> /run/user/1000/gvfs/smb-share:server=192.168.1.100,share=media  
   lrwxrwxrwx NAS-Backup -> /run/user/1000/gvfs/smb-share:server=192.168.1.100,share=backup
   ```

4. **Test access**:
   ```bash
   cd ~/NetworkMounts/NAS-Documents
   ls
   ```

---

## Step 5: Use Your Network Shares

### In File Manager:
- Navigate to **~/NetworkMounts/**
- Double-click **NAS-Documents**, **NAS-Media**, etc.
- Bookmark `~/NetworkMounts/` for quick access

### In Applications:
- **Media Player**: Open `~/NetworkMounts/NAS-Media/Movies/`
- **Document Editor**: Open files from `~/NetworkMounts/NAS-Documents/`
- **Backup Software**: Backup to `~/NetworkMounts/NAS-Backup/`

### In Terminal:
```bash
# Navigate to shares
cd ~/NetworkMounts/NAS-Documents

# Use in scripts  
rsync -av ~/Documents/ ~/NetworkMounts/NAS-Backup/Documents/

# Check disk usage
df -h ~/NetworkMounts/NAS-Media
```

---

## Step 6: Verification & Troubleshooting

### Check Extension Status:
```bash
gnome-extensions list --enabled | grep network-automount
```

### Check Mount Status:
```bash
gio mount -l | grep smb
```

### Check Symlinks:
```bash
find ~/NetworkMounts -type l -ls
```

### If Something's Wrong:

1. **No symlinks**: Check "Create Symlink" is enabled
2. **Permission errors**: Ensure `~/NetworkMounts` is writable
3. **Broken symlinks**: Unmount/remount shares via extension menu
4. **Shares not mounting**: Check network connectivity and credentials

### Force Refresh:
1. Click extension icon → "Check All Now"
2. Or disable/enable extension:
   ```bash
   gnome-extensions disable network-automount@gavindi.github.com
   gnome-extensions enable network-automount@gavindi.github.com
   ```

---

## Success! 🎉

You now have:
- ✅ Automatic mounting of network shares
- ✅ Easy access via `~/Network/Mounts` 
- ✅ Custom names for each share
- ✅ Integration with all applications

### Next Steps:
- Add desktop shortcuts: `ln -s ~/NetworkMounts/NAS-Media ~/Desktop/Media`
- Configure backup scripts using the symlink paths
- Add more network shares as needed

**Pro Tip**: The extension will automatically recreate symlinks after reboots, network changes, or credential updates!

## Bug Reporting

Bugs should be reported to the Github bug tracker [https://github.com/gavindi/network-share-automount/issues](https://github.com/gavindi/network-share-automount/issues).

## License
Network Automount Gnome Shell extension is distributed under the terms of the GNU General Public License, version 2. See the LICENSE file for details.