# Network Auto Mount
![screenshot](https://github.com/gavindi/network-automount/blob/master/media/NetworkautomountScreenshot.png)

## Mount your bookmarked network shares
This extension will mount your bookmarked network shares and periodically check them should they become unmounted for any reason.  It has options to control (re)mount frequency.

I was inspired by [Gigolo](https://docs.xfce.org/apps/gigolo/start) but sometimes crashes and also doesn't display a MessageTray icon under Wayland sessions.  Also, I thought "why does this need to be an app?".  So, I vibed with Claude to create this.

## Installation from source

The extension can be installed directly from source, either for the convenience of using git or to test the latest development version. Clone the desired branch with git

### Build Dependencies

This extension has no special build dependancies.

### Building

Clone the repository or download the branch from github. A simple Makefile is included.

```bash
git clone https://github.com/gavindi/network-automount
make -C network-automount install
```
#### Key Features
##### Build Process

Compiles GSettings schemas (required for preferences)
Copies all necessary files to a build directory
Creates proper directory structure

##### Installation Options

```bash
make install - Install to user directory (recommended)
make install-system - System-wide installation (requires sudo)
```
##### Development Workflow

```bash
make dev - One command to clean, install, and enable
make status - Check if extension is installed/enabled
make restart-shell - Restart GNOME Shell on X11
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

## Bug Reporting

Bugs should be reported to the Github bug tracker [https://github.com/gavindi/network-automount/issues](https://github.com/gavindi/network-automount/issues).

## License
Network Automount Gnome Shell extension is distributed under the terms of the GNU General Public License,
version 2 or later. See the COPYING file for details.