# Project structure

ZmanBar keeps the files required by GNOME Shell at the extension package root while moving internal modules and contributor documentation into dedicated directories.

## GNOME Shell package constraints

- `metadata.json` must be in the extension root so GNOME Shell can identify the extension.
- `extension.js` must be in the extension root because it is the runtime entrypoint loaded by GNOME Shell.
- `prefs.js` must be in the extension root when preferences are provided.
- `schemas/` remains at the extension root so GSettings schemas can be compiled and installed using the standard extension layout.
- Internal JavaScript modules can live in subdirectories as long as root entrypoints import them with package-relative paths.

These constraints limit how far the repository can be reorganized without adding a build step or generated root-level wrappers.

## Layout

- `src/` contains internal JavaScript modules.
- `assets/` contains screenshots and static assets.
- `docs/` contains testing and contributor documentation.
- `scripts/` contains development and release helper scripts.
- `dist/` is ignored and used for generated release packages.
