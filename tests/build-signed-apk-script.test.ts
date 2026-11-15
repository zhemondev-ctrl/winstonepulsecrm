import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// The official release script must refuse to build before Gradle runs whenever
// signing inputs are missing/unsafe, and must never print secret values.
const SCRIPT = resolve(__dirname, "../scripts/build-signed-apk.sh");
const SECRET = "Sup3r-Secret-Pass!";
const GOOD_FP = "2E:61:50:E6:06:52:45:C1:B2:B5:41:37:51:2D:63:ED:40:0D:22:9B:88:1D:1B:91:5A:29:06:17:4E:1C:7E:6D";

let root: string;
let androidDir: string;

function run(props: string) {
  writeFileSync(join(androidDir, "local.properties"), props);
  const env: Record<string, string> = { PATH: process.env.PATH ?? "", WINSTONE_ANDROID_DIR: androidDir };
  const r = spawnSync("bash", [SCRIPT], { env, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "signed-apk-"));
  androidDir = join(root, "proj", "android");
  mkdirSync(androidDir, { recursive: true });
  mkdirSync(join(androidDir, "app"));
  writeFileSync(join(androidDir, "app", "build.gradle.kts"), 'versionCode = 33\nversionName = "2.22"\n');
  mkdirSync(join(root, "private"), { recursive: true });
  writeFileSync(join(root, "private", "company.jks"), "x");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("build-signed-apk.sh fails closed", () => {
  it("rejects replacing the approved company fingerprint with another valid fingerprint", () => {
    const r = run(`RELEASE_STORE_FILE=${join(root, "private", "company.jks")}\nRELEASE_STORE_PASSWORD=${SECRET}\nRELEASE_KEY_ALIAS=winstone\nRELEASE_CERT_SHA256=${"ab".repeat(32)}\n`);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("not the pinned company signer");
    expect(r.out).not.toContain(SECRET);
  });

  it.each([['2.21', 33], ['2.22', 32], ['1.0.10', 10]])("rejects source version %s/code %s before any build", (name, code) => {
    writeFileSync(join(androidDir, "app", "build.gradle.kts"), `versionCode = ${code}\nversionName = "${name}"\n`);
    const r = run(`RELEASE_STORE_FILE=${join(root, "private", "company.jks")}\nRELEASE_STORE_PASSWORD=${SECRET}\nRELEASE_KEY_ALIAS=winstone\nRELEASE_CERT_SHA256=${GOOD_FP}\n`);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("requires version 2.22 (code 33)");
    expect(r.out).not.toContain(SECRET);
  });
  it("lists every missing signing input by name only", () => {
    const r = run(`RELEASE_STORE_PASSWORD=${SECRET}\n`);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("OFFICIAL RELEASE BLOCKED");
    expect(r.out).toContain("RELEASE_STORE_FILE");
    expect(r.out).toContain("RELEASE_KEY_ALIAS");
    expect(r.out).toContain("RELEASE_CERT_SHA256");
    expect(r.out).not.toContain(SECRET);
  });

  it("refuses a fingerprint that is not a 64-hex SHA-256", () => {
    const r = run(
      `RELEASE_STORE_FILE=${join(root, "private", "company.jks")}\nRELEASE_STORE_PASSWORD=${SECRET}\nRELEASE_KEY_ALIAS=winstone\nRELEASE_CERT_SHA256=abc123\n`,
    );
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("not a 64-hex");
    expect(r.out).not.toContain(SECRET);
  });

  it("refuses a keystore stored inside the project folder", () => {
    mkdirSync(join(root, "proj", "keys"));
    writeFileSync(join(root, "proj", "keys", "k.jks"), "x");
    const r = run(
      `RELEASE_STORE_FILE=${join(root, "proj", "keys", "k.jks")}\nRELEASE_STORE_PASSWORD=${SECRET}\nRELEASE_KEY_ALIAS=winstone\nRELEASE_CERT_SHA256=${GOOD_FP}\n`,
    );
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("inside the project folder");
  });

  it("refuses when any stray keystore exists in the project", () => {
    writeFileSync(join(androidDir, "winstone-release.jks"), "x");
    const r = run(
      `RELEASE_STORE_FILE=${join(root, "private", "company.jks")}\nRELEASE_STORE_PASSWORD=${SECRET}\nRELEASE_KEY_ALIAS=winstone\nRELEASE_CERT_SHA256=${GOOD_FP}\n`,
    );
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("keystore file(s) found inside the project");
    expect(r.out).not.toContain(SECRET);
  });

  it("stops before Gradle when no Android SDK is available", () => {
    const r = run(
      `RELEASE_STORE_FILE=${join(root, "private", "company.jks")}\nRELEASE_STORE_PASSWORD=${SECRET}\nRELEASE_KEY_ALIAS=winstone\nRELEASE_CERT_SHA256=${GOOD_FP}\n`,
    );
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("Android SDK not found");
    expect(r.out).not.toContain(SECRET);
  });
});

// Windows PowerShell 5.1 reads BOM-less .ps1 files as Windows-1252, so a UTF-8
// em dash becomes a curly quote and breaks parsing (seen on the signing PC).
describe("Windows .ps1 build scripts", () => {
  it.each(["build-signed-apk.ps1", "build-debug-apk.ps1"])("%s is plain ASCII", (name) => {
    const text = readFileSync(resolve(__dirname, "../scripts", name), "utf8");
    const bad = [...text].filter((c) => c.charCodeAt(0) > 127);
    expect(bad).toEqual([]);
  });
});
