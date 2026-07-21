# ZmanBar

ZmanBar is a GNOME Shell extension that adds the Hebrew date to the GNOME top panel and calendar menu.

![ZmanBar screenshot](assets/screenshot.png)

## About this fork

This repository is a fork of the original [Dev-in-the-BM/ZmanBar](https://github.com/Dev-in-the-BM/ZmanBar) project.

The goal of this fork is to keep the extension clean, maintainable, and easy to package while preserving the original functionality.

## Features

- Shows the Hebrew date in the GNOME top panel.
- Shows the full Hebrew date, including the year, in the clock/calendar menu.
- Updates the displayed Hebrew date after shkiah when a location is configured.
- Provides preferences for selecting a location.
- Uses a bundled GJS-compatible zmanim/date calculation library.

## Installation from source

Clone this fork and copy it into the GNOME Shell extensions directory:

```sh
git clone https://github.com/salameli/ZmanBar-fork.git
mkdir -p ~/.local/share/gnome-shell/extensions
cp -r ZmanBar-fork ~/.local/share/gnome-shell/extensions/ZmanBar@salameli.github.io
```

Then restart GNOME Shell:

- X11: press `Alt` + `F2`, type `r`, and press `Enter`.
- Wayland: log out and log back in.

Finally, enable **ZmanBar** from the Extensions app.

## Development

ZmanBar is written in modern JavaScript for the GJS runtime used by GNOME Shell extensions.

Important files:

- `extension.js` — panel and calendar integration.
- `prefs.js` — preferences window.
- `aboutPage.js` — about/developer page in preferences.
- `logging.js` — optional debug logging.
- `kosher-zmanim.js` — bundled zmanim and Hebrew calendar calculations.
- `schemas/org.gnome.shell.extensions.zmanbar.gschema.xml` — GNOME settings schema.

Run the basic validation checks before committing or packaging a release:

```sh
./scripts/check.sh
```

See [TESTING.md](TESTING.md) for the manual smoke-test checklist and release package sanity checks.

## Credits

Original project: [Dev-in-the-BM/ZmanBar](https://github.com/Dev-in-the-BM/ZmanBar)

This fork uses its own extension UUID: `ZmanBar@salameli.github.io`.

## License

This project is licensed under the GNU General Public License v3.0 or later.
