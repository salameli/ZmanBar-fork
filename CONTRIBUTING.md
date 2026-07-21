# Contributing

Thank you for your interest in improving ZmanBar. This project aims to stay small, maintainable, and compatible with GNOME Shell while preserving existing behavior.

## Prepare your environment

You need a GNOME Shell development environment with:

- GNOME Shell matching one of the versions listed in `metadata.json`.
- `glib-compile-schemas` from GLib.
- `node` for JavaScript syntax checks.
- `python3` for JSON validation.
- `zip` for release package validation.
- `pre-commit` for local Git hooks.

On Debian/Ubuntu-based systems:

```sh
sudo apt-get install libglib2.0-bin nodejs python3 zip
python3 -m pip install --user pre-commit
```

Clone the repository:

```sh
git clone https://github.com/salameli/ZmanBar-fork.git
cd ZmanBar-fork
pre-commit install
pre-commit install --hook-type commit-msg
```

## Develop locally

GNOME Shell requires `metadata.json`, `extension.js`, and `prefs.js` at the extension root. Do not move those files unless you also preserve the installed extension layout.

For local testing, install or link the repository into the expected extension directory:

```sh
mkdir -p ~/.local/share/gnome-shell/extensions
ln -sfn "$PWD" ~/.local/share/gnome-shell/extensions/ZmanBar@salameli.github.io
```

Restart GNOME Shell or log out and back in, then enable the extension from the Extensions app.

## Test changes

Run the automated checks before opening a pull request:

```sh
./scripts/check.sh
```

Validate the release package layout when changing files included in the extension:

```sh
./scripts/package.sh
```

Use the manual checklist in [docs/TESTING.md](docs/TESTING.md) for behavior changes or release preparation.

## Repository access

You do not need write access to this repository to open a pull request.

If you are not a repository collaborator, fork the project on GitHub, clone your fork, create a branch there, and open a pull request back to `salameli/ZmanBar-fork:main`:

```sh
git clone https://github.com/<your-username>/ZmanBar-fork.git
cd ZmanBar-fork
git checkout -b docs/update-contribution-guide
```

If you have write access, create a focused branch directly in this repository and open a pull request from that branch into `main`.

To request write access, open an issue or contact the maintainer with a short description of what you plan to maintain. Until access is granted, use the fork-based workflow.

## Branches

Create focused branches from `main`:

```sh
git checkout main
git pull
git checkout -b docs/update-testing-notes
```

Prefer short, descriptive branch names such as:

- `fix/location-search-error`
- `docs/contribution-guide`
- `refactor/preferences-layout`

## Commit conventions

Use Conventional Commits:

- `fix: correct location search error handling`
- `docs: update testing checklist`
- `refactor: simplify preferences layout`
- `chore: update repository metadata`
- `ci: update validation workflow`

Keep commits focused. Avoid mixing code changes, documentation updates, and formatting-only changes unless they are part of the same small change.

The repository includes a `commit-msg` pre-commit hook that validates this format locally when installed with:

```sh
pre-commit install --hook-type commit-msg
```

## Pull requests

Before submitting a pull request:

1. Confirm the branch is up to date with `main`.
2. Run `./scripts/check.sh`.
3. Run `./scripts/package.sh` if packaging could be affected.
4. Complete the PR template.
5. Describe manual testing performed, especially for GNOME Shell UI behavior.

Pull requests should avoid unrelated refactors and should not change the extension UUID, license, or GNOME Shell package layout unless that is the explicit purpose of the change.
