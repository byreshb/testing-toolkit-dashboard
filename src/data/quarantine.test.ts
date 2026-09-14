import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseQuarantine, readQuarantine } from "./quarantine";

const FLAKE_DIR = resolve("fixtures/acme-shop/.flake");
const NOW = new Date("2026-09-13T12:00:00Z");

describe("readQuarantine", () => {
  it("returns undefined when the ledger does not exist", () => {
    expect(readQuarantine(mkdtempSync(join(tmpdir(), "flake-")), NOW)).toBeUndefined();
  });

  it("classifies entries against now and sorts the most urgent first", () => {
    const ledger = readQuarantine(FLAKE_DIR, NOW);
    expect(ledger?.problems).toEqual([]);
    expect(ledger?.entries).toEqual([
      {
        test: "com.acme.shop.InventoryTest#reservesStock",
        reason: "Clock skew on the ARM runner",
        owner: "priya",
        added: "2026-06-01",
        expires: "2026-08-30",
        issue: "https://github.com/acme/shop/issues/377",
        status: "expired",
        daysLeft: -14,
      },
      {
        test: "com.acme.shop.CheckoutTest#appliesCoupon",
        reason: "Coupon service stub races with the cart cache on CI",
        owner: "byresh",
        added: "2026-08-25",
        expires: "2026-09-20",
        issue: "https://github.com/acme/shop/issues/412",
        status: "expiring",
        daysLeft: 7,
      },
    ]);
  });
});

describe("parseQuarantine", () => {
  it("accepts quoted dates and marks far-off entries active", () => {
    const ledger = parseQuarantine(
      `entries:\n  - test: a.B#c\n    expires: "2026-12-01"\n    reason: slow\n`,
      NOW,
    );
    expect(ledger.entries[0]).toMatchObject({
      test: "a.B#c",
      status: "active",
      daysLeft: 79,
      owner: "",
      added: "",
    });
    expect(ledger.entries[0]).not.toHaveProperty("issue");
  });

  it("tolerates an empty ledger", () => {
    expect(parseQuarantine("", NOW)).toEqual({ entries: [], problems: [] });
    expect(parseQuarantine("entries:\n", NOW)).toEqual({ entries: [], problems: [] });
  });

  it("reports malformed entries instead of failing", () => {
    const ledger = parseQuarantine(
      `entries:\n  - just a string\n  - test: a.B#c\n  - reason: no test id\n    expires: 2026-10-01\n`,
      NOW,
    );
    expect(ledger.entries).toEqual([]);
    expect(ledger.problems).toEqual([
      "entry 1 is not a mapping",
      "entry 2 needs a test id and an expiry date",
      "entry 3 needs a test id and an expiry date",
    ]);
    expect(parseQuarantine("entries: 42\n", NOW).problems).toEqual(["`entries` is not a list"]);
  });
});
