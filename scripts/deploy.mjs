#!/usr/bin/env node
import { execSync } from "child_process";
import { rmSync, mkdirSync, cpSync, copyFileSync, existsSync } from "fs";
import { readFileSync } from "fs";
import { tmpdir } from "os";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const { name: PLUGIN_NAME, version: VERSION } = JSON.parse(
  readFileSync(join(ROOT, "plugin.json"), "utf8")
);

const SAFE_NAME = PLUGIN_NAME.replace(/ /g, "-").toLowerCase();
const ZIP_NAME = `${SAFE_NAME}-v${VERSION}.zip`;
const ZIP_PATH = join(ROOT, ZIP_NAME);

// ── 1. Build frontend ──────────────────────────────────────────────────────────
console.log(">>> Installing dependencies...");
execSync("pnpm i", { stdio: "inherit", cwd: ROOT });

console.log(">>> Building plugin...");
execSync("pnpm run build", { stdio: "inherit", cwd: ROOT });

// ── 2. Package zip ─────────────────────────────────────────────────────────────
console.log(`>>> Creating ${ZIP_NAME}...`);

rmSync(ZIP_PATH, { force: true });

const STAGING = join(tmpdir(), `decky-deploy-${Date.now()}`);
const PLUGIN_DIR = join(STAGING, SAFE_NAME);
mkdirSync(PLUGIN_DIR, { recursive: true });

// Required files
cpSync(join(ROOT, "dist"), join(PLUGIN_DIR, "dist"), { recursive: true });
copyFileSync(join(ROOT, "package.json"), join(PLUGIN_DIR, "package.json"));
copyFileSync(join(ROOT, "plugin.json"),  join(PLUGIN_DIR, "plugin.json"));

// Optional: Python backend (required only if using decky serverAPI)
const mainPy = join(ROOT, "main.py");
if (existsSync(mainPy)) copyFileSync(mainPy, join(PLUGIN_DIR, "main.py"));

// Optional: backend binaries
const binDir = join(ROOT, "backend", "out");
if (existsSync(binDir)) cpSync(binDir, join(PLUGIN_DIR, "bin"), { recursive: true });

// Optional but recommended
const readme = join(ROOT, "README.md");
if (existsSync(readme)) copyFileSync(readme, join(PLUGIN_DIR, "README.md"));

// Required if license demands inclusion
const license = join(ROOT, "LICENSE");
if (existsSync(license)) copyFileSync(license, join(PLUGIN_DIR, "LICENSE"));

execSync(`zip -r "${ZIP_PATH}" "${SAFE_NAME}" -x "*.DS_Store"`, {
  stdio: "inherit",
  cwd: STAGING,
});

rmSync(STAGING, { recursive: true, force: true });

console.log(`>>> Done: ${ZIP_NAME}`);
