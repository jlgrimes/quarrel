import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = resolve(import.meta.dirname, "..");
const packageJsonPath = resolve(rootDir, "package.json");
const tauriConfigPath = resolve(rootDir, "src-tauri", "tauri.conf.json");
const cargoTomlPath = resolve(rootDir, "src-tauri", "Cargo.toml");

const dryRun = process.argv.includes("--dry-run");
const shouldOpen = process.argv.includes("--open");

function parseStrictSemver(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(
      `Version must be strict x.y.z (received "${version}").`,
    );
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function bumpPatch(version) {
  const { major, minor, patch } = parseStrictSemver(version);
  return `${major}.${minor}.${patch + 1}`;
}

function semverToBuildNumber(version) {
  const { major, minor, patch } = parseStrictSemver(version);
  // Integer-only build number for Tauri CLI / iOS CFBundleVersion.
  // Example: 1.0.3 -> 10003
  return String(major * 10000 + minor * 100 + patch);
}

function updatePackageVersionInCargoToml(cargoToml, nextVersion) {
  const lines = cargoToml.split("\n");
  let inPackage = false;
  let replaced = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\[package\]\s*$/.test(line)) {
      inPackage = true;
      continue;
    }
    if (inPackage && /^\s*\[.*\]\s*$/.test(line)) {
      inPackage = false;
    }
    if (inPackage && /^\s*version\s*=/.test(line)) {
      lines[i] = `version = "${nextVersion}"`;
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    throw new Error("Could not update [package] version in Cargo.toml");
  }

  return lines.join("\n");
}

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const nextVersion = bumpPatch(pkg.version);
const buildNumber = semverToBuildNumber(nextVersion);

pkg.version = nextVersion;

const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, "utf8"));
tauriConfig.version = nextVersion;

const cargoToml = readFileSync(cargoTomlPath, "utf8");
const updatedCargoToml = updatePackageVersionInCargoToml(cargoToml, nextVersion);

if (!dryRun) {
  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
  writeFileSync(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);
  writeFileSync(cargoTomlPath, updatedCargoToml);
}

console.log(`iOS build version: ${nextVersion} (build ${buildNumber})`);

if (dryRun) {
  process.exit(0);
}

const args = [
  "ios",
  "build",
  "--export-method",
  "debugging",
  "--build-number",
  buildNumber,
];

if (shouldOpen) {
  args.push("--open");
}

const result = spawnSync("tauri", args, { stdio: "inherit" });
if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
