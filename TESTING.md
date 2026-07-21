# Testing

## Automated checks

Run the lightweight validation script before committing or packaging a release:

```sh
./scripts/check.sh
```

The script checks JavaScript syntax, validates `metadata.json`, compiles the GNOME settings schema, verifies required extension files, and fails if local/generated files are present in the extension tree.

## Manual smoke test

Use this checklist before publishing a release:

- Install the extension from the repository into `~/.local/share/gnome-shell/extensions/ZmanBar@dev-in-the-bm.github.io/`.
- Restart GNOME Shell or log out and back in.
- Enable ZmanBar from the Extensions app.
- Confirm the Hebrew date appears in the top panel.
- Open the clock/calendar menu and confirm the full Hebrew date appears below the existing date.
- Close and reopen the menu several times; the date should not duplicate.
- Disable and re-enable the extension several times; the panel clock should return to normal when disabled.
- Open extension preferences.
- Search for a location, select it, and confirm the location subtitle updates.
- Confirm the date updates according to shkiah for the configured location.
- Turn logging on in the hidden developer settings and confirm logs appear.
- Turn logging off and confirm routine debug logs stop appearing.

## Release package sanity check

The release zip should contain only the files needed by GNOME Shell, such as:

- `metadata.json`
- `extension.js`
- `prefs.js`
- `aboutPage.js`
- `logging.js`
- `kosher-zmanim.js`
- `schemas/org.gnome.shell.extensions.zmanbar.gschema.xml`
- image/SVG assets used by preferences and the README

It should not contain local state, logs, source package experiments, or generated schema output.
