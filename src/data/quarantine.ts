import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { daysBetween, isoDate, parseInstant } from "@/lib/time";

export type QuarantineStatus = "active" | "expiring" | "expired";

export interface QuarantineEntry {
  test: string;
  reason: string;
  owner: string;
  added: string;
  expires: string;
  issue?: string;
  status: QuarantineStatus;
  /** Days until expiry; negative once expired. */
  daysLeft: number;
}

export interface QuarantineLedger {
  entries: QuarantineEntry[];
  /** Entries whose file content could not be understood, with a reason. */
  problems: string[];
}

/** Entries expiring within this many days are flagged as "expiring". */
export const EXPIRY_WARNING_DAYS = 14;

/**
 * Reads `quarantine.yaml` from a flake directory and classifies each entry against `now`.
 * Returns `undefined` when the file does not exist.
 */
export function readQuarantine(flakeDir: string, now: Date): QuarantineLedger | undefined {
  const path = join(flakeDir, "quarantine.yaml");
  if (!existsSync(path)) {
    return undefined;
  }
  return parseQuarantine(readFileSync(path, "utf8"), now);
}

export function parseQuarantine(text: string, now: Date): QuarantineLedger {
  const problems: string[] = [];
  const entries: QuarantineEntry[] = [];
  const doc: unknown = parse(text);
  const raw = isRecord(doc) ? doc.entries : undefined;
  if (raw === undefined || raw === null) {
    return { entries, problems };
  }
  if (!Array.isArray(raw)) {
    return { entries, problems: ["`entries` is not a list"] };
  }
  raw.forEach((item: unknown, index) => {
    if (!isRecord(item)) {
      problems.push(`entry ${index + 1} is not a mapping`);
      return;
    }
    const test = stringField(item, "test");
    const expiresAt = parseInstant(dateString(item.expires));
    if (test === undefined || expiresAt === undefined) {
      problems.push(`entry ${index + 1} needs a test id and an expiry date`);
      return;
    }
    const daysLeft = daysBetween(now, expiresAt);
    const issue = stringField(item, "issue");
    entries.push({
      test,
      reason: stringField(item, "reason") ?? "",
      owner: stringField(item, "owner") ?? "",
      added: dateString(item.added) ?? "",
      expires: isoDate(expiresAt),
      ...(issue === undefined ? {} : { issue }),
      status: daysLeft < 0 ? "expired" : daysLeft <= EXPIRY_WARNING_DAYS ? "expiring" : "active",
      daysLeft,
    });
  });
  entries.sort((a, b) => a.daysLeft - b.daysLeft || a.test.localeCompare(b.test));
  return { entries, problems };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** YAML parses bare dates as Date objects; accept both those and strings. */
function dateString(value: unknown): string | undefined {
  if (value instanceof Date) {
    return isoDate(value);
  }
  return typeof value === "string" ? value : undefined;
}
