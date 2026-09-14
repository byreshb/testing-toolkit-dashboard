import { describe, expect, it } from "vitest";
import {
  clamp,
  cramersV,
  lastDelta,
  mean,
  normalisedEntropy,
  round,
  wilsonInterval,
} from "./stats";

describe("wilsonInterval", () => {
  it("is [0, 1] with no observations", () => {
    expect(wilsonInterval(0, 0)).toEqual({ lower: 0, upper: 1 });
  });

  it("narrows as the sample grows", () => {
    const small = wilsonInterval(1, 3);
    const large = wilsonInterval(100, 300);
    expect(large.upper - large.lower).toBeLessThan(small.upper - small.lower);
    expect(round(large.lower, 2)).toBe(0.28);
    expect(round(large.upper, 2)).toBe(0.39);
  });

  it("matches the textbook value for 3 of 10", () => {
    const { lower, upper } = wilsonInterval(3, 10);
    expect(round(lower, 3)).toBe(0.108);
    expect(round(upper, 3)).toBe(0.603);
  });
});

describe("normalisedEntropy", () => {
  it("is 0 for one category or nothing", () => {
    expect(normalisedEntropy([])).toBe(0);
    expect(normalisedEntropy([7])).toBe(0);
    expect(normalisedEntropy([7, 0])).toBe(0);
  });

  it("is 1 for a uniform spread and in between otherwise", () => {
    expect(normalisedEntropy([4, 4])).toBe(1);
    expect(normalisedEntropy([2, 2, 2, 2])).toBe(1);
    const skewed = normalisedEntropy([9, 1]);
    expect(skewed).toBeGreaterThan(0);
    expect(skewed).toBeLessThan(1);
  });
});

describe("cramersV", () => {
  it("is 0 for degenerate tables", () => {
    expect(cramersV([])).toBe(0);
    expect(cramersV([[1, 2]])).toBe(0);
    expect(
      cramersV([
        [0, 0],
        [0, 0],
      ]),
    ).toBe(0);
  });

  it("is 1 for a perfect association and 0 for independence", () => {
    expect(
      round(
        cramersV([
          [5, 0],
          [0, 5],
        ]),
      ),
    ).toBe(1);
    expect(
      round(
        cramersV([
          [5, 5],
          [5, 5],
        ]),
      ),
    ).toBe(0);
  });
});

describe("small helpers", () => {
  it("mean, round, clamp and lastDelta", () => {
    expect(mean([])).toBe(0);
    expect(mean([1, 2, 3])).toBe(2);
    expect(round(1.23456)).toBe(1.235);
    expect(round(1.23456, 1)).toBe(1.2);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(lastDelta([])).toBe(0);
    expect(lastDelta([1])).toBe(0);
    expect(lastDelta([1, 4])).toBe(3);
  });
});
