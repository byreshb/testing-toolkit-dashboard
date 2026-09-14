# Data formats

The dashboard reads the files that the three tools write. It does not modify them. This page
lists where it looks and what it expects to find. The schemas follow the producing projects;
until those projects ship, the fixtures under `fixtures/acme-shop` are the reference.

## Data directory

`TOOLKIT_DATA_DIR` (or `--data`) names one directory. Inside it the dashboard tries, in order:

| Tool                | Candidates                          | Marker               |
| ------------------- | ----------------------------------- | -------------------- |
| flake-detector      | `.flake/`, `flake/`, the dir itself | `history.db` present |
| test-quality-linter | `tql/`, `target/tql/`               | directory exists     |
| llm-eval-harness    | `llm-eval/`, `target/llm-eval/`     | directory exists     |

So a repository root works with the tools' default output locations, and a directory laid out
as `flake/`, `tql/`, `llm-eval/` works for data collected from CI. A tool whose directory is
absent gets an empty state on its page instead of an error.

## flake-detector

Project: https://github.com/byreshb/flake-detector

### `history.db`

SQLite file written by `flake ingest`. Tables read:

```sql
CREATE TABLE build_run (
  id INTEGER PRIMARY KEY,
  workflow_run_id TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,  -- 2 for a GitHub "re-run" of the same commit
  commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  timestamp TEXT NOT NULL              -- ISO 8601, UTC
);

CREATE TABLE test_run (
  id INTEGER PRIMARY KEY,
  build_run_id INTEGER NOT NULL REFERENCES build_run (id),
  class_name TEXT NOT NULL,
  method_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  branch TEXT NOT NULL,
  runner TEXT,
  duration_ms INTEGER NOT NULL,
  outcome TEXT NOT NULL,               -- PASS, FAIL, ERROR or SKIPPED
  failure_hash TEXT                    -- hash of the failure message, NULL on PASS/SKIPPED
);
```

A Surefire rerun (`flakyFailure` / `rerunFailure`) produces several `test_run` rows for the same
test in the same build, in timestamp order. A test id is `class_name#method_name`.

### `quarantine.yaml`

```yaml
entries:
  - test: com.acme.shop.CheckoutTest#appliesCoupon
    reason: Coupon service stub races with the cart cache on CI
    owner: byresh
    added: 2026-08-25
    expires: 2026-09-20
    issue: https://github.com/acme/shop/issues/412
```

Dates are `YYYY-MM-DD`. `issue` is optional. An entry is _expired_ when `expires` is before
today and _expiring soon_ when it is within 14 days.

## test-quality-linter

Project: https://github.com/byreshb/test-quality-linter

One file per lint run, either SARIF 2.1.0 (`*.sarif`, from `tql lint --format sarif` or the
Maven plugin) or the linter's JSON (`*.json`, from `tql lint --format json`). The linter
overwrites its output on each run, so to keep a history copy the file with a unique name, for
example `target/tql/tql-<date>.sarif`, before the next run.

From a SARIF file the dashboard reads `runs[0].results[]` (`ruleId`, `level`, `message.text`,
the first `physicalLocation`, and `properties.fixHint`), `runs[0].tool.driver.rules[]` for rule
names, `runs[0].invocations[0].startTimeUtc` for the run time and
`runs[0].versionControlProvenance[0].revisionId` for the commit. SARIF levels map to
severities: `error` to ERROR, `warning` to WARN, `note` to INFO.

The JSON form:

```json
{
  "tool": "test-quality-linter",
  "version": "1.0.0",
  "startedAt": "2026-09-12T09:31:27Z",
  "commit": "c19",
  "branch": "main",
  "filesScanned": 14,
  "findings": [
    {
      "ruleId": "TQL003",
      "rule": "NoAssertion",
      "severity": "WARN",
      "file": "src/test/java/com/acme/shop/CartTest.java",
      "line": 71,
      "column": 3,
      "message": "Test 'mergesCarts' has no assertion",
      "fixHint": "Assert on the merged item list"
    }
  ]
}
```

When a file has no timestamp inside it, the file's modification time is used.

## llm-eval-harness

Project: https://github.com/byreshb/llm-eval-harness

### Reports

One `*.json` file per run, in the shape of `target/llm-eval/report.json`. As with the linter,
keep one file per run (`report-<date>-<prompt>.json`) to have a history.

```json
{
  "tool": "llm-eval-harness",
  "startedAt": "2026-09-10T08:00:55Z",
  "commit": "c18",
  "dataset": "golden/support-answers.yaml",
  "prompt": { "name": "support-answer", "version": 3 },
  "model": "claude-sonnet-5",
  "summary": { "cases": 10, "passed": 9, "passRate": 0.9, "meanScore": 0.89, "costUsd": 0.02 },
  "cases": [
    {
      "name": "refund-window",
      "tags": ["refunds", "policy"],
      "passed": true,
      "score": 0.9,
      "checks": [{ "type": "similarTo", "passed": true, "score": 0.93, "threshold": 0.8 }],
      "inputTokens": 370,
      "outputTokens": 90,
      "latencyMs": 900,
      "costUsd": 0.002
    }
  ],
  "drift": {
    "baseline": {
      "prompt": { "name": "support-answer", "version": 3 },
      "model": "claude-sonnet-5"
    },
    "threshold": 0.1,
    "verdict": "OK",
    "cases": [
      {
        "name": "refund-window",
        "baselineScore": 0.91,
        "currentScore": 0.9,
        "delta": -0.01,
        "regressed": false
      }
    ]
  }
}
```

`drift` is present only when the run was compared with a baseline.

### Baselines

`baselines/*.json`, as written by the harness's `BaselineStore`: one file per (dataset, prompt
version, model) with `recordedAt` and `cases[]` of `name`, `passed`, `score`.
