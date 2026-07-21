# Development

This document describes how ZmanBar is structured and how to work on it locally without breaking GNOME Shell extension compatibility.

## Architecture

ZmanBar is a GNOME Shell extension written for GJS.

The installed extension root must contain the GNOME Shell entrypoints:

- `metadata.json` identifies the extension, supported shell versions, UUID, settings schema, and release metadata.
- `extension.js` is loaded by GNOME Shell when the extension is enabled.
- `prefs.js` is loaded by GNOME Shell when opening preferences.
- `schemas/` contains the GSettings schema referenced by `metadata.json`.

Internal modules live in `src/`:

- `src/aboutPage.js` builds the preferences About page and developer logging UI.
- `src/logging.js` contains optional debug logging helpers.
- `src/kosher-zmanim.js` is the bundled GJS-compatible zmanim and Hebrew calendar calculation library.

Supporting project files live outside the runtime-critical entrypoints:

- `assets/` contains screenshots and static assets.
- `docs/` contains testing and structure documentation.
- `scripts/` contains validation and packaging helpers.
- `.github/` contains GitHub automation and collaboration templates.

See [docs/STRUCTURE.md](docs/STRUCTURE.md) for GNOME Shell layout constraints.

## Local setup

Install the tools used by the repository checks:

```sh
sudo apt-get install libglib2.0-bin nodejs python3 zip
```

Clone the repository and enter it:

```sh
git clone https://github.com/salameli/ZmanBar-fork.git
cd ZmanBar-fork
```

Link the checkout into the local GNOME Shell extensions directory:

```sh
mkdir -p ~/.local/share/gnome-shell/extensions
ln -sfn "$PWD" ~/.local/share/gnome-shell/extensions/ZmanBar@salameli.github.io
```

Restart GNOME Shell:

- X11: press `Alt` + `F2`, type `r`, and press `Enter`.
- Wayland: log out and log back in.

Then enable ZmanBar from the Extensions app.

## Development workflow

1. Create a focused branch from `main`.
2. Make the smallest practical change.
3. Keep `extension.js`, `metadata.json`, `prefs.js`, and `schemas/` compatible with GNOME Shell expectations.
4. Run automated checks.
5. Perform manual smoke testing when UI behavior, settings, packaging, or GNOME Shell integration may be affected.

## Automated checks

Run:

```sh
./scripts/check.sh
```

The check script verifies:

- Required extension files exist.
- JavaScript entrypoints and internal modules parse successfully.
- `metadata.json` is valid JSON.
- GSettings schemas compile.
- Local or generated files are not present in the extension tree.

## Packaging

Build a release zip with:

```sh
./scripts/package.sh
```

The package is written to `dist/` and should preserve the GNOME Shell extension root layout.

## Manual testing

Use [docs/TESTING.md](docs/TESTING.md) for the full manual checklist. At minimum, verify:

- The extension enables and disables cleanly.
- The Hebrew date appears in the top panel.
- The calendar menu date is updated and restored correctly.
- Preferences open successfully.
- Location search and selection still work when related code changes.
