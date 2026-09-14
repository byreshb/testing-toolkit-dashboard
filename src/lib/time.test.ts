import { describe, expect, it } from "vitest";
import { daysBetween, isoDate, parseInstant, recentWeeks, weekStart } from "./time";

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart(new Date("2026-09-13T23:00:00Z"))).toBe("2026-09-07"); // Sunday
    expect(weekStart(new Date("2026-09-14T00:00:00Z"))).toBe("2026-09-14"); // Monday
    expect(weekStart(new Date("2026-09-16T12:00:00Z"))).toBe("2026-09-14"); // Wednesday
  });
});

describe("daysBetween", () => {
  it("counts whole days ignoring the time of day", () => {
    expect(daysBetween(new Date("2026-09-13T23:59:00Z"), new Date("2026-09-20T00:01:00Z"))).toBe(7);
    expect(daysBetween(new Date("2026-09-13T00:00:00Z"), new Date("2026-08-30T00:00:00Z"))).toBe(
      -14,
    );
  });
});

describe("parseInstant", () => {
  it("accepts ISO dates and instants and rejects the rest", () => {
    expect(parseInstant("2026-09-13")?.toISOString()).toBe("2026-09-13T00:00:00.000Z");
    expect(parseInstant("2026-09-13T08:00:00Z")?.toISOString()).toBe("2026-09-13T08:00:00.000Z");
    expect(parseInstant("")).toBeUndefined();
    expect(parseInstant("yesterday")).toBeUndefined();
    expect(parseInstant(42)).toBeUndefined();
  });
});

describe("recentWeeks", () => {
  it("lists week starts ending with the current week", () => {
    expect(recentWeeks(new Date("2026-09-13T10:00:00Z"), 3)).toEqual([
      "2026-08-24",
      "2026-08-31",
      "2026-09-07",
    ]);
    expect(isoDate(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-01");
  });
});
