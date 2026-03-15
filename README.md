# give-thanks

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A CLI for thanking open source maintainers — star repos and post gratitude in GitHub Discussions.

Small and mid-size OSS maintainers rarely hear how their work is being used. Stars are anonymous. Issues are complaints. `give-thanks` closes that feedback loop with a single command.

## Install

```bash
npm install -g give-thanks
```

Or use without installing:

```bash
npx give-thanks chalk
```

## Usage

### Thank a package

```bash
# By package name (resolves via npm/PyPI registries)
give-thanks chalk

# With context about how you use it
give-thanks chalk --used-for "colorful CLI output in our dev tools"

# By GitHub repo directly
give-thanks sindresorhus/chalk

# With a custom message
give-thanks chalk --message "This library saved us weeks of work. Thank you!"
```

### Scan your project

```bash
# Scan current directory for dependencies
give-thanks --scan

# Scan a specific project
give-thanks --scan ./my-project
```

This reads `package.json` and `requirements.txt`/`pyproject.toml`, filters out packages you've already thanked, and presents an interactive checklist.

### View your history

```bash
give-thanks --history
```

## What it does

1. **Stars the repo** (always)
2. **Posts a thank-you message** in GitHub Discussions (preferred) or falls back to an issue
3. **Tracks your history** locally at `~/.give-thanks/history.json` to prevent duplicates

## Authentication

`give-thanks` authenticates with GitHub in this order:

1. **GitHub CLI** (`gh auth token`) — if you have `gh` installed and logged in
2. **`GITHUB_TOKEN` env var** — set this if you don't use `gh`

## Supported ecosystems

| Ecosystem | Resolve by name | Scan dependencies |
|---|---|---|
| npm | Yes | `package.json` |
| PyPI | Yes | `requirements.txt`, `pyproject.toml` |
| GitHub | `owner/repo` | — |

More ecosystems can be added via the resolver/scanner plugin interface.

## License

MIT
