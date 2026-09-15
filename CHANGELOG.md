# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Overview page with three stat tiles (flaky tests, test-quality findings, LLM eval score),
  each with a trend sparkline, a delta against the previous period, and a warning list for
  expired and soon-to-expire quarantine entries.
- Flaky tests page: weekly flakiness trend chart, a ranked table with score, recovery and
  flip counts, runner correlation and a per-build outcome strip, the quarantine ledger, and a
  per-test detail page with the score breakdown and full build history.
- JSON API (`/api/overview`, `/api/flaky`, `/api/flaky/[testId]`) backing the same data the
  pages show.
- Playwright end-to-end tests for both pages, running against the built application served
  over the fixture repository.
- Data layer: readers for the flake detector's `history.db` and `quarantine.yaml`, the
  linter's SARIF and JSON reports, and the eval harness's reports and baselines, with
  flakiness scoring (rerun recovery, flip rate with Wilson intervals, failure-message
  entropy, runner correlation), weekly flakiness trend, findings per rule over time,
  prompt-version variants, drift comparison and per-tag scores.
- Project skeleton: Next.js application shell, TypeScript strict configuration, ESLint,
  Prettier, Vitest with an 85% line-coverage gate, GitHub Actions CI and release workflows.
- Fixture data for one sample repository (`fixtures/acme-shop`) covering the flake detector's
  run history and quarantine ledger, the test-quality linter's SARIF and JSON reports, and the
  LLM evaluation harness's reports and baselines.
- Data directory resolution through `TOOLKIT_DATA_DIR` or the `--data` flag.

[Unreleased]: https://github.com/byreshb/testing-toolkit-dashboard/commits/main
