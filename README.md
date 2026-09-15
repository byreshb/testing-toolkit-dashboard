# testing-toolkit-dashboard

[![CI](https://github.com/byreshb/testing-toolkit-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/byreshb/testing-toolkit-dashboard/actions/workflows/ci.yml)

A web dashboard that shows test health over time, read from the files three testing tools
already produce:

- [flake-detector](https://github.com/byreshb/flake-detector): run history and the flakiness
  ranking, plus the quarantine ledger.
- [test-quality-linter](https://github.com/byreshb/test-quality-linter): findings per rule and
  per file, one report per lint run.
- [llm-eval-harness](https://github.com/byreshb/llm-eval-harness): evaluation scores per case
  and tag, and drift between prompt versions and models.

## The problem

Each of those tools reports on one run. That is the right shape for a CI gate, but it is not
what a team needs when deciding where to spend effort. The questions are about trends: is
flakiness going down or are we just quarantining more, are the tests written this month better
than the ones written last month, did the last prompt change move the evaluation scores and for
which cases. Answering them today means opening a dozen reports by hand and comparing numbers.

This dashboard reads the tools' output directories, keeps no database of its own, and shows the
trend: three tiles with sparklines on the overview, a ranked flaky-test table with per-test
history and quarantine expiry warnings, findings per rule over time with the worst files, and
evaluation scores with a prompt-version and model comparison. Point it at a repository and it
finds the files where the tools leave them.

## Status

Under construction. The delivery plan is in [docs/design.md](docs/design.md); the file formats
the dashboard reads are in [docs/data-format.md](docs/data-format.md).

## Requirements

- Node.js 22 or newer (the runtime; the code is TypeScript)
- npm 10 or newer

## Quick start

```bash
git clone https://github.com/byreshb/testing-toolkit-dashboard.git
cd testing-toolkit-dashboard
npm ci
npm run fixtures                       # builds the sample SQLite history from fixtures/
TOOLKIT_DATA_DIR=fixtures/acme-shop npm run dev
```

Open http://localhost:3000. The sample repository under `fixtures/acme-shop` contains one flaky
test, one test that was flaky and got fixed, one real regression, a quarantine ledger with an
expired entry, four lint runs and five evaluation runs across three prompt versions and two
models.

To look at your own project, set `TOOLKIT_DATA_DIR` to its root. The dashboard looks for
`.flake/history.db`, `target/tql/*.sarif` and `target/llm-eval/*.json`, the tools' default
locations. See [docs/data-format.md](docs/data-format.md) for the alternatives.

To show several repositories and switch between them, set `TOOLKIT_REPOS` instead, a
comma-separated list of `name=path` pairs:

```bash
TOOLKIT_REPOS="shop=../acme-shop,widgets=../widgets" npm run dev
```

A switcher then appears in the header; `TOOLKIT_DATA_DIR` and `--data` are ignored while
`TOOLKIT_REPOS` is set.

## Configuration

| Setting            | Meaning                                                              | Default   |
| ------------------ | -------------------------------------------------------------------- | --------- |
| `TOOLKIT_DATA_DIR` | Directory to read; a repository root or a prepared data directory    | `.`       |
| `--data <dir>`     | Same as `TOOLKIT_DATA_DIR`, takes precedence when both are given     |           |
| `TOOLKIT_REPOS`    | `name=path,name=path,...`; several repositories with a switcher      | unset     |
| `TOOLKIT_NOW`      | ISO 8601 instant used as "now" for expiry warnings and trend windows | the clock |

## Building and testing

```bash
npm run check      # tsc --noEmit, eslint, prettier --check
npm test           # Vitest with coverage (85% line threshold on the data layer)
npm run build      # next build
npm run format     # apply Prettier
```

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request to `main`: `npm ci`,
`npm run check`, `npm test` with coverage, `npm run build`, and uploads the coverage report as
an artifact.

## Releasing

See [docs/releasing.md](docs/releasing.md). Releases are git tags `vX.Y.Z`; the release
workflow attaches the packed tarball to a GitHub Release. Publishing to npm is planned and not
done yet.

## License

Apache License 2.0, see [LICENSE](LICENSE).
