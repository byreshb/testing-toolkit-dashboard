import { describe, expect, it } from "vitest";
import { repoHref } from "./repo-link";

describe("repoHref", () => {
  it("leaves the path unchanged for the default repo", () => {
    expect(repoHref("/flaky", undefined)).toBe("/flaky");
    expect(repoHref("/flaky", "")).toBe("/flaky");
  });

  it("appends the repo as a query param", () => {
    expect(repoHref("/flaky", "widgets")).toBe("/flaky?repo=widgets");
    expect(repoHref("/flaky/a.B%23c", "my repo")).toBe("/flaky/a.B%23c?repo=my%20repo");
  });

  it("adds to an existing query string", () => {
    expect(repoHref("/x?y=1", "widgets")).toBe("/x?y=1&repo=widgets");
  });
});
