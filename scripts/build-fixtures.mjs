// Builds every fixtures/**/.flake/history.db from the history.sql next to it.
// The SQLite file is generated and git-ignored; the SQL is the committed source of truth.
import Database from "better-sqlite3";
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

function findSqlFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...findSqlFiles(path));
    } else if (entry === "history.sql") {
      found.push(path);
    }
  }
  return found;
}

const root = new URL("../fixtures", import.meta.url).pathname;
for (const sqlPath of findSqlFiles(root)) {
  const dbPath = join(dirname(sqlPath), "history.db");
  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }
  const db = new Database(dbPath);
  db.exec(readFileSync(sqlPath, "utf8"));
  db.close();
  console.log(`built ${dbPath}`);
}
