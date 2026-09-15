#!/usr/bin/env node
// Launches the built dashboard: `npx testing-toolkit-dashboard --data <dir>`.
// Requires a build (`npm run build`) to have produced .next/standalone, which is what a
// published package ships instead of source.
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join, resolve } from "node:path";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const options = { port: process.env.PORT ?? "3000" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--data") {
      options.data = argv[++i];
    } else if (arg?.startsWith("--data=")) {
      options.data = arg.slice("--data=".length);
    } else if (arg === "--port") {
      options.port = argv[++i];
    } else if (arg?.startsWith("--port=")) {
      options.port = arg.slice("--port=".length);
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return options;
}

function printHelp() {
  console.log(`testing-toolkit-dashboard [--data <dir>] [--port <port>]

  --data <dir>   Repository to read (default: the current directory).
                 See docs/data-format.md for the file layout expected inside it.
  --port <port>  Port to listen on (default: 3000, or the PORT environment variable).

Environment variables TOOLKIT_DATA_DIR, TOOLKIT_REPOS and TOOLKIT_NOW work the same as
when running the dashboard from source; --data takes precedence over TOOLKIT_DATA_DIR.`);
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

const serverPath = join(packageRoot, ".next", "standalone", "server.js");
if (!existsSync(serverPath)) {
  console.error(
    "Missing .next/standalone/server.js. This package was not built; run `npm run build` " +
      "from a checkout (or install a published release, which ships the build).",
  );
  process.exit(1);
}

const env = { ...process.env, PORT: options.port };
if (options.data !== undefined) {
  env.TOOLKIT_DATA_DIR = isAbsolute(options.data)
    ? options.data
    : resolve(process.cwd(), options.data);
}

const child = spawn(process.execPath, [serverPath], { stdio: "inherit", cwd: packageRoot, env });
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
