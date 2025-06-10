# Network Auto Mount
![screenshot](https://github.com/gavindi/network-automount/raw/master/media/NetworkautomountScreenshot.jpg)

## Mount your bookmarked network shares
This extension will mount your bookmarked network shares and periodically check them should they become unmounted for any reason.  It has options to control (re)mount frequency.

## Installation from source

The extension can be installed directly from source, either for the convenience of using git or to test the latest development version. Clone the desired branch with git

### Build Dependencies

This extension has no special build dependancies.

### Building

Clone the repository or download the branch from github. A simple Makefile is included.

Next use `make` to install the extension into your home directory. A Shell reload is required `Alt+F2 r Enter` under Xorg or under Wayland you may have to logout and login. The extension has to be enabled  with *gnome-extensions-app* (GNOME Extensions) or with *dconf*.

```bash
git clone https://github.com/gavindi/network-automount
make -C network-automount install
```

## Bug Reporting

Bugs should be reported to the Github bug tracker [https://github.com/gavindi/network-automount/issues](https://github.com/gavindi/network-automount/issues).

## License
Network Automount Gnome Shell extension is distributed under the terms of the GNU General Public License,
version 2 or later. See the COPYING file for details.