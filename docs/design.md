# Design

## Goal

Show the trend behind the single-run reports of `flake-detector`, `test-quality-linter` and
`llm-eval-harness`, without asking teams to run another service. The dashboard reads files,
holds no state of its own, and can be started with one command against any directory the tools
have written to.

## Shape

- **Next.js App Router** with React and TypeScript. Pages are server components: each page
  calls the data layer directly, renders HTML, and ships only the JavaScript needed for charts.
  There is no client-side state library.
- **Data layer** in `src/data/`: one reader per tool, each a set of pure functions over the
  files under a data directory. `config.ts` resolves the data directory (`--data`,
  `TOOLKIT_DATA_DIR`, working directory) and locates each tool's files inside it, accepting both
  a repository root (the tools' default output locations) and a directory prepared for the
  dashboard. Readers return plain serialisable objects so the same functions back the pages
  and the JSON API.
- **Trend calculations** in `src/lib/`: pure functions with no I/O (windowing runs into
  periods, Wilson intervals, deltas between reports), tested in isolation.
- **JSON API** under `src/app/api/`: thin route handlers over the data layer, so other tools
  (the MCP server, scripts) can reuse the same numbers the pages show.
- **Styling** with plain CSS modules and CSS variables for the light and dark themes, following
  the system preference. Charts use a small dependency; sparklines are inline SVG rendered on
  the server.

## Pages

1. **Overview**: three tiles (flakiness, findings, eval score) each with a sparkline of the
   recent trend and a headline number.
2. **Flaky tests**: ranked table with score, confidence interval and components; per-test
   history; quarantine ledger with expiry warnings.
3. **Test quality**: findings per rule over time, worst files, latest findings with fix hints.
4. **LLM evals**: score per case and per tag, prompt-version comparison, drift table.
5. A per-repository switcher when several data directories are configured.

## Deliberate trade-offs

- **Files, not a database.** The tools already write durable files; copying them into a
  database would add a service to run and a second source of truth. The cost is that history
  is only as long as the files kept, which is documented in `docs/data-format.md`.
- **Fixture-first development.** The sample repository under `fixtures/acme-shop` follows the
  schemas the three tools specify. When the tools' own test resources exist, the fixtures are
  replaced by copies of them and the readers are verified against real output.
- **Server rendering.** Reads are cheap (small SQLite file, a handful of JSON files) and happen
  on every request, so the dashboard always shows the current files with no cache to
  invalidate.

## Delivery plan

1. Skeleton, workflows, README problem statement, fixture data.
2. Data layer with tests.
3. Overview and Flaky tests pages with Playwright end-to-end tests.
4. Test quality page. Release v1.0.0.
5. LLM evals page with drift comparison.
6. Multi-repo support, Docker image, `npx` launcher. Release v1.1.0.
