#!/usr/bin/env node
//
// Interactive release builder for Scaffold.
//
// `npm run tauri:build` runs this. It lets you build native installers for
// macOS, Linux, and Windows, then collects every finished installer into a
// clean share-ready folder at dist-releases/<version>/<platform>/.
//
// Because Tauri compiles a native Rust binary, it cannot cross-compile
// installers: only the current OS can be built locally. For the other two we
// generate + dispatch a GitHub Actions workflow that builds them in the cloud.
//
// Pure Node stdlib, no dependencies.
//

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = path.resolve(import.meta.dirname, "..");
const BUNDLE_DIR = path.join(ROOT, "src-tauri/target/release/bundle");
const RELEASES_DIR = path.join(ROOT, "dist-releases");
const WORKFLOW_REL = ".github/workflows/build-release.yml";
const WORKFLOW_PATH = path.join(ROOT, WORKFLOW_REL);

// ---------------------------------------------------------------------------
// Terminal helpers (ANSI — mirrors scripts/upload-itch.sh styling)
// ---------------------------------------------------------------------------

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const log = (m) => console.log(`${c.blue}${c.bold}▸ ${m}${c.reset}`);
const ok = (m) => console.log(`${c.green}${c.bold}✓ ${m}${c.reset}`);
const warn = (m) => console.log(`${c.yellow}${c.bold}! ${m}${c.reset}`);
const dim = (m) => console.log(`${c.dim}  ${m}${c.reset}`);
const fail = (m) => {
  console.error(`${c.red}${c.bold}✖ ${m}${c.reset}`);
  process.exit(1);
};

function banner() {
  console.log();
  console.log(`${c.bold}${c.magenta}  ╔═╗╔═╗╔═╗ ╦ ╦╔╦╗╦╔═╗╔╗╔${c.reset}`);
  console.log(`${c.bold}${c.magenta}  ║  ║ ║║   ║║║ ║ ║║   ║║║${c.reset}`);
  console.log(`${c.bold}${c.magenta}  ╚═╝╚═╝╚═╝ ╚╩╝ ╩ ╩╚═╝╝╚╝${c.reset}`);
  console.log(`${c.dim}  Release Builder${c.reset}`);
  console.log();
}

// ---------------------------------------------------------------------------
// Version reconciliation (package.json + tauri.conf.json + Cargo.toml)
// ---------------------------------------------------------------------------

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readVersion() {
  const pkg = readJson(path.join(ROOT, "package.json")).version;
  const tauri = readJson(path.join(ROOT, "src-tauri/tauri.conf.json")).version;
  const cargoRaw = fs.readFileSync(path.join(ROOT, "src-tauri/Cargo.toml"), "utf8");
  const cargoMatch = cargoRaw.match(/^version\s*=\s*"([^"]+)"/m);
  const cargo = cargoMatch ? cargoMatch[1] : null;

  if (pkg !== tauri || pkg !== cargo) {
    console.error();
    fail(
      `Version mismatch across project files — they must all agree:\n` +
        `    package.json            ${pkg}\n` +
        `    src-tauri/tauri.conf.json ${tauri}\n` +
        `    src-tauri/Cargo.toml    ${cargo}\n` +
        `Update them to the same value and re-run.`
    );
  }
  return pkg;
}

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

function detectPlatform() {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}

function platformLabel(p) {
  return { macos: "macOS", linux: "Linux", windows: "Windows" }[p];
}

// Artifact discovery — mirrors the ordering in scripts/upload-itch.sh.
const ARTIFACT_SPECS = {
  macos: [
    { dir: "dmg", glob: "*.dmg", kind: "dmg" },
    { dir: "macos", glob: "*.app", kind: "app" },
  ],
  linux: [
    { dir: "appimage", glob: "*.AppImage", kind: "appimage" },
    { dir: "deb", glob: "*.deb", kind: "deb" },
  ],
  windows: [
    { dir: "nsis", glob: "*.exe", kind: "nsis" },
    { dir: "msi", glob: "*.msi", kind: "msi" },
  ],
};

function glob(dir, pattern) {
  if (!fs.existsSync(dir)) return [];
  const re = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
  return fs
    .readdirSync(dir)
    .filter((f) => re.test(f))
    .map((f) => path.join(dir, f));
}

// Returns [{path, kind}] for every spec that matched. Never throws.
function findArtifactsSafe(platform) {
  const out = [];
  for (const spec of ARTIFACT_SPECS[platform] ?? []) {
    for (const p of glob(path.join(BUNDLE_DIR, spec.dir), spec.glob)) {
      out.push({ path: p, kind: spec.kind });
    }
  }
  return out;
}

// Throws if nothing was found (mirrors upload-itch.sh error).
function findArtifacts(platform) {
  const found = findArtifactsSafe(platform);
  if (found.length === 0) {
    const dirs = (ARTIFACT_SPECS[platform] ?? [])
      .map((s) => `bundle/${s.dir}/${s.glob}`)
      .join(" or ");
    fail(
      `No ${platformLabel(platform)} artifact found (${dirs}). ` +
        `Run a build for this platform first.`
    );
  }
  return found;
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

function haveCmd(cmd) {
  const probe = process.platform === "win32" ? "where" : "command -v";
  return spawnSync(probe, [cmd], { stdio: "ignore" }).status === 0;
}

function runCmd(cmd, args, { cwd = ROOT } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
    child.on("error", (e) => reject(new Error(`Failed to launch ${cmd}: ${e.message}`)));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`\`${cmd} ${args.join(" ")}\` exited with code ${code}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Release output
// ---------------------------------------------------------------------------

function fileSize(p) {
  const stat = fs.statSync(p);
  const bytes = stat.isDirectory() ? dirSizeBytes(p) : stat.size;
  return bytes;
}

function dirSizeBytes(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSizeBytes(full);
    else total += fs.statSync(full).size;
  }
  return total;
}

function humanSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
}

function copyToRelease(srcPath, platform, version) {
  const destDir = path.join(RELEASES_DIR, version, platform);
  fs.mkdirSync(destDir, { recursive: true });
  const base = path.basename(srcPath);
  const dest = path.join(destDir, base);
  if (fs.statSync(srcPath).isDirectory()) {
    fs.cpSync(srcPath, dest, { recursive: true });
  } else {
    fs.copyFileSync(srcPath, dest);
  }
  return dest;
}

// ---------------------------------------------------------------------------
// Local build
// ---------------------------------------------------------------------------

// Returns { cmd, args } for invoking `tauri build` via the available package
// manager. pnpm/yarn run bare subcommands; npm must go through `npm run`.
function tauriBuildCommand() {
  if (haveCmd("pnpm")) return { cmd: "pnpm", args: ["tauri", "build"] };
  if (haveCmd("yarn")) return { cmd: "yarn", args: ["tauri", "build"] };
  warn("pnpm not found; falling back to npm. (tauri.conf.json uses pnpm — install pnpm for best results.)");
  return { cmd: "npm", args: ["run", "tauri", "--", "build"] };
}

async function localBuild(platform, version) {
  log(`Building ${platformLabel(platform)} installer locally…`);
  const { cmd, args } = tauriBuildCommand();
  dim(`Running \`${cmd} ${args.join(" ")}\` (this also runs the frontend build).`);
  try {
    await runCmd(cmd, args);
  } catch (e) {
    fail(`Local build failed: ${e.message}`);
  }

  const arts = findArtifacts(platform);
  for (const a of arts) {
    const dest = copyToRelease(a.path, platform, version);
    ok(`Copied ${path.basename(dest)} (${humanSize(fileSize(dest))}) → ${path.relative(ROOT, dest)}`);
  }
}

// ---------------------------------------------------------------------------
// GitHub Actions workflow
// ---------------------------------------------------------------------------

const WORKFLOW_YAML = `# Generated by scripts/build-release.mjs — do not edit by hand.
# Builds Scaffold installers for macOS, Linux, and Windows in the cloud.
name: Build Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (e.g. 0.2.0). Defaults to package.json / tag.'
        required: false
        default: ''
  push:
    tags:
      - 'v*'

permissions:
  contents: write # required to create the GitHub Release

jobs:
  build:
    runs-on: \${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: macos-latest
            platform: macos
          - os: ubuntu-22.04
            platform: linux
          - os: windows-latest
            platform: windows
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Install Linux dependencies
        if: matrix.platform == 'linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \\
            libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

      - name: Install JS dependencies
        run: pnpm install --frozen-lockfile

      - name: Resolve version
        id: ver
        shell: bash
        run: |
          if [ -n "\${{ inputs.version }}" ]; then V="\${{ inputs.version }}"
          elif [[ "\${GITHUB_REF}" == refs/tags/v* ]]; then V="\${GITHUB_REF#refs/tags/v}"
          else V=$(node -p "require('./package.json').version")
          fi
          echo "version=$V" >> "$GITHUB_OUTPUT"

      - name: Build (tauri)
        run: pnpm tauri build

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: scaffold-\${{ matrix.platform }}-\${{ steps.ver.outputs.version }}
          path: |
            src-tauri/target/release/bundle/dmg/*.dmg
            src-tauri/target/release/bundle/macos/*.app
            src-tauri/target/release/bundle/appimage/*.AppImage
            src-tauri/target/release/bundle/deb/*.deb
            src-tauri/target/release/bundle/nsis/*.exe
            src-tauri/target/release/bundle/msi/*.msi
          if-no-files-found: error

      - name: Attach installers to GitHub Release
        if: startsWith(github.ref, 'refs/tags/v')
        uses: softprops/action-gh-release@v2
        with:
          files: |
            src-tauri/target/release/bundle/dmg/*.dmg
            src-tauri/target/release/bundle/appimage/*.AppImage
            src-tauri/target/release/bundle/deb/*.deb
            src-tauri/target/release/bundle/nsis/*.exe
            src-tauri/target/release/bundle/msi/*.msi
`;

function workflowExists() {
  return fs.existsSync(WORKFLOW_PATH);
}

function ensureWorkflow({ force = false } = {}) {
  if (workflowExists() && !force) {
    return false;
  }
  fs.mkdirSync(path.dirname(WORKFLOW_PATH), { recursive: true });
  fs.writeFileSync(WORKFLOW_PATH, WORKFLOW_YAML);
  ok(`Generated ${WORKFLOW_REL}`);
  return true;
}

function manualCIInstructions(version) {
  console.log();
  log("To build the remaining platforms via GitHub Actions:");
  console.log();
  console.log(`${c.bold}  Option A — push a tag (creates a GitHub Release with all installers):${c.reset}`);
  dim(`git add .github/workflows/build-release.yml && git commit -m "ci: release workflow"`);
  dim(`git tag v${version}`);
  dim(`git push origin v${version}`);
  console.log();
  console.log(`${c.bold}  Option B — run manually from the Actions tab:${c.reset}`);
  dim("  GitHub → Actions → \"Build Release\" → Run workflow → version = " + version);
  console.log();
  console.log(`${c.dim}  When CI finishes, download the installers from the Release page${c.reset}`);
  console.log(`${c.dim}  (Option A) or the run's "Artifacts" dropdown (Option B), and drop${c.reset}`);
  console.log(`${c.dim}  them into dist-releases/${version}/{linux,windows}/.${c.reset}`);
  console.log();
}

async function ciRelease(version) {
  log("Preparing GitHub Actions release workflow…");
  const wrote = ensureWorkflow({ force: false });

  if (haveCmd("gh")) {
    if (wrote) {
      warn(`${WORKFLOW_REL} was just generated — commit & push it before dispatching.`);
      manualCIInstructions(version);
      return;
    }
    log("Dispatching workflow via the gh CLI…");
    try {
      await runCmd("gh", [
        "workflow",
        "run",
        "build-release.yml",
        "-f",
        `version=${version}`,
      ]);
      const res = spawnSync(
        "gh",
        ["run", "list", "--workflow=build-release.yml", "-L1", "--json=url,databaseId"],
        { encoding: "utf8", cwd: ROOT }
      );
      try {
        const run = JSON.parse(res.stdout || "[]")[0];
        if (run?.url) ok(`CI started — watch: ${run.url}`);
      } catch {
        dim('Run "gh run watch" or check the Actions tab to monitor progress.');
      }
      dim('Installers appear under the run\'s "Artifacts" dropdown (or the Release if you used a tag).');
    } catch (e) {
      warn(`Could not dispatch via gh: ${e.message}`);
      manualCIInstructions(version);
    }
  } else {
    warn("gh CLI not installed — cannot dispatch automatically.");
    manualCIInstructions(version);
  }
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

const INSTALL_HINTS = {
  dmg: "Open the .dmg and drag Scaffold to Applications.",
  app: "Drag to Applications (the .dmg is the preferred download).",
  appimage: "chmod +x and run, or integrate with AppImageLauncher.",
  deb: "Install with: sudo dpkg -i <file>.deb",
  nsis: "Run the installer (.exe).",
  msi: "Double-click the .msi to install.",
};

function collectRelease(version) {
  const versionDir = path.join(RELEASES_DIR, version);
  const out = [];
  if (!fs.existsSync(versionDir)) return out;
  for (const platform of ["macos", "linux", "windows"]) {
    const pdir = path.join(versionDir, platform);
    if (!fs.existsSync(pdir)) continue;
    for (const entry of fs.readdirSync(pdir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(pdir, entry.name);
      const kind = inferKind(entry.name, entry.isDirectory());
      out.push({
        platform,
        filename: entry.name,
        size: humanSize(fileSize(full)),
        sizeBytes: fileSize(full),
        kind,
        hint: INSTALL_HINTS[kind] || "",
      });
    }
  }
  return out;
}

function inferKind(name, isDir) {
  if (isDir && name.endsWith(".app")) return "app";
  if (name.endsWith(".dmg")) return "dmg";
  if (name.endsWith(".AppImage")) return "appimage";
  if (name.endsWith(".deb")) return "deb";
  if (name.endsWith(".exe")) return "nsis";
  if (name.endsWith(".msi")) return "msi";
  return "";
}

function writeManifest(version, collected) {
  const versionDir = path.join(RELEASES_DIR, version);
  fs.mkdirSync(versionDir, { recursive: true });

  const date = new Date().toISOString();
  const osLabel = platformLabel(detectPlatform());

  // JSON (machine-readable)
  const json = {
    app: "Scaffold",
    version,
    generated: date,
    generatedOn: osLabel,
    artifacts: collected,
  };
  fs.writeFileSync(path.join(versionDir, "MANIFEST.json"), JSON.stringify(json, null, 2) + "\n");

  // Markdown (human-readable)
  const lines = [];
  lines.push(`# Scaffold v${version} — Release Manifest`);
  lines.push("");
  lines.push(`Generated ${date} on ${osLabel}.`);
  lines.push("");

  if (collected.length === 0) {
    lines.push("_No installers staged yet. Build a platform (locally or via CI) and re-run._");
    lines.push("");
  } else {
    for (const platform of ["macos", "linux", "windows"]) {
      const arts = collected.filter((a) => a.platform === platform);
      if (arts.length === 0) continue;
      lines.push(`## ${platformLabel(platform)}`);
      for (const a of arts) {
        lines.push(`- \`${a.filename}\` — ${a.size}`);
        if (a.hint) lines.push(`  - ${a.hint}`);
      }
      lines.push("");
    }
    lines.push("## Rebuilding in CI");
    lines.push("");
    lines.push("Rebuild any platform in the cloud: GitHub → Actions → \"Build Release\" →");
    lines.push("Run workflow, or push a tag `v" + version + "` to auto-create a Release.");
    lines.push("");
  }

  fs.writeFileSync(path.join(versionDir, "MANIFEST.md"), lines.join("\n") + "\n");
  return path.join(versionDir, "MANIFEST.md");
}

// ---------------------------------------------------------------------------
// Interactive menu
// ---------------------------------------------------------------------------

async function promptMenu(rl, question, options) {
  while (true) {
    console.log(`${c.bold}${question}${c.reset}`);
    options.forEach((o, i) => {
      console.log(`  ${c.cyan}${i + 1})${c.reset} ${o.label}`);
    });
    const ans = (await rl.question(`${c.dim}Choose [1-${options.length}]: ${c.reset}`)).trim();
    const idx = parseInt(ans, 10) - 1;
    if (idx >= 0 && idx < options.length) return options[idx].value;
    warn(`Please enter a number between 1 and ${options.length}.`);
    console.log();
  }
}

async function resolvePlan(rl, currentOS) {
  const main = await promptMenu(rl, "What would you like to build?", [
    { label: `Build for current OS only (${platformLabel(currentOS)})`, value: "current" },
    { label: "Build ALL platforms via GitHub Actions CI", value: "ci" },
    { label: "Build current OS locally + dispatch CI for the rest", value: "both" },
    { label: "Choose platforms individually", value: "custom" },
  ]);

  if (main !== "custom") {
    return { main, local: main === "current" || main === "both", ciPlatforms: main === "ci" || main === "both" ? ["macos", "linux", "windows"] : [] };
  }

  // Custom submenu — toggle each platform.
  const chosen = new Set([currentOS]); // current OS can build locally
  const all = ["macos", "linux", "windows"];
  while (true) {
    console.log();
    console.log(`${c.bold}Select platforms${c.reset} ${c.dim}(local = builds now, CI = cloud)${c.reset}`);
    all.forEach((p, i) => {
      const mark = chosen.has(p) ? `${c.green}✔${c.reset}` : `${c.dim} ${c.reset}`;
      const where = p === currentOS ? `${c.dim}(local)${c.reset}` : `${c.dim}(CI)${c.reset}`;
      console.log(`  ${c.cyan}${i + 1})${c.reset} ${mark} ${platformLabel(p)} ${where}`);
    });
    console.log(`  ${c.cyan}d)${c.reset} ${c.bold}Done${c.reset}`);
    const ans = (await rl.question(`${c.dim}Toggle [1-3], or d to finish: ${c.reset}`)).trim().toLowerCase();
    if (ans === "d") break;
    const idx = parseInt(ans, 10) - 1;
    if (idx >= 0 && idx < all.length) {
      const p = all[idx];
      if (chosen.has(p)) chosen.delete(p);
      else chosen.add(p);
    } else {
      warn("Enter 1-3 or d.");
    }
  }
  if (chosen.size === 0) fail("No platforms selected.");
  return {
    main: "custom",
    local: chosen.has(currentOS),
    ciPlatforms: [...chosen].filter((p) => p !== currentOS),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  banner();

  const version = readVersion();
  const currentOS = detectPlatform();
  ok(`Version: ${c.bold}v${version}${c.reset}   Current OS: ${c.bold}${platformLabel(currentOS)}${c.reset}`);
  console.log();

  const rl = readline.createInterface({ input, output });
  let plan;
  try {
    plan = await resolvePlan(rl, currentOS);
  } finally {
    rl.close();
  }
  console.log();

  // Local build.
  if (plan.local) {
    await localBuild(currentOS, version);
    console.log();
  }

  // CI for the rest.
  if (plan.ciPlatforms.length > 0 || plan.main === "ci") {
    await ciRelease(version);
    console.log();
  }

  // Always write a manifest from whatever is staged locally.
  const collected = collectRelease(version);
  const manifestPath = writeManifest(version, collected);
  ok(`Manifest written → ${path.relative(ROOT, manifestPath)}`);

  console.log();
  if (collected.length > 0) {
    ok(`${c.bold}Release staged at dist-releases/${version}/${c.reset}`);
    dim(`Open it: open ${path.relative(ROOT, path.join(RELEASES_DIR, version))}`);
  } else {
    warn("No local installers staged. Follow the CI instructions above, then re-run to refresh the manifest.");
  }
  console.log();
}

main().catch((e) => {
  console.error();
  fail(e?.message || String(e));
});
