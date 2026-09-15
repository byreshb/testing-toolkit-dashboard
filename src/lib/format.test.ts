import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatDelta,
  formatPercent,
  formatScore,
  pluralise,
  shortTestId,
} from "./format";

describe("format helpers", () => {
  it("formats percentages and scores", () => {
    expect(formatPercent(0.0714)).toBe("7%");
    expect(formatPercent(0.0714, 1)).toBe("7.1%");
    expect(formatScore(0.8491)).toBe("0.85");
    expect(formatScore(null)).toBe("n/a");
    expect(formatScore(undefined)).toBe("n/a");
  });

  it("formats dates and instants in UTC", () => {
    expect(formatDate("2026-09-10T21:00:00Z")).toBe("2026-09-10");
    expect(formatDate("2026-09-10")).toBe("2026-09-10");
    expect(formatDate(null)).toBe("");
    expect(formatDate("soon")).toBe("soon");
    expect(formatDateTime("2026-09-10T21:00:00Z")).toBe("2026-09-10 21:00");
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDateTime("later")).toBe("later");
  });

  it("formats signed deltas", () => {
    expect(formatDelta(3)).toBe("+3");
    expect(formatDelta(-0.049, 2)).toBe("-0.05");
    expect(formatDelta(0.001, 2)).toBe("±0.00");
    expect(formatDelta(2.1, 1, " pts")).toBe("+2.1 pts");
  });

  it("shortens test ids and pluralises", () => {
    expect(shortTestId("com.acme.shop.CheckoutTest#appliesCoupon")).toBe(
      "CheckoutTest#appliesCoupon",
    );
    expect(shortTestId("CheckoutTest")).toBe("CheckoutTest");
    expect(pluralise(1, "test")).toBe("1 test");
    expect(pluralise(2, "test")).toBe("2 tests");
    expect(pluralise(0, "entry", "entries")).toBe("0 entries");
  });
});
