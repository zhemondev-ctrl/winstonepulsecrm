import { describe, expect, it } from "vitest";
import {
  APK_LINK_MINUTES,
  APK_RELEASE,
  APPROVED_SIGNER_SHA256,
  apkReleaseStatus,
  type ApkRelease,
} from "@/lib/apk-release";

const release22: ApkRelease = {
  ...APK_RELEASE,
  file: "winstone-connect-2.22-33-release.apk",
  version: "2.22",
  versionCode: 33,
  builtByReleaseScript: true,
};

describe("agent APK handed out by IT", () => {
  it("is the 2.21 company package that talks to the live CRM", () => {
    expect(APK_RELEASE.version).toBe("2.21");
    expect(APK_RELEASE.versionCode).toBe(32);
    expect(APK_RELEASE.packageName).toBe("com.winstone.connect");
    expect(APK_RELEASE.server).toBe("https://crm.winstonebd.com");
  });
  it("is signed by the owner-approved company key", () => {
    expect(APK_RELEASE.signerSha256).toBe(APPROVED_SIGNER_SHA256);
  });
  it("2.21 is company-signed older code, not official", () => {
    expect(apkReleaseStatus(APK_RELEASE)).toBe("company_signed_older_code");
  });
  it("2.22 signed build without handset/source evidence is not final", () => {
    expect(apkReleaseStatus(release22)).toBe("company_signed_older_code");
  });
  it("requires reviewed source and phone evidence for the exact APK bytes", () => {
    const accepted = { ...release22, acceptance: { apkSha256: release22.sha256, sourceCommit: "a".repeat(40), reviewedAt: "2026-11-15T00:00:00Z", deviceTestPassed: true } };
    expect(apkReleaseStatus(accepted)).toBe("official");
    expect(apkReleaseStatus({ ...accepted, acceptance: { ...accepted.acceptance, apkSha256: "b".repeat(64) } })).not.toBe("official");
    expect(apkReleaseStatus({ ...accepted, acceptance: { ...accepted.acceptance, deviceTestPassed: false } })).not.toBe("official");
  });
  it("2.22 not built by the release script is not official", () => {
    expect(apkReleaseStatus({ ...release22, builtByReleaseScript: false })).toBe("company_signed_older_code");
  });
  it("2.22 signed by any other key is never official", () => {
    expect(apkReleaseStatus({ ...release22, signerSha256: "a".repeat(64) })).toBe("not_company_signed");
  });
  it("the test package is never official", () => {
    expect(apkReleaseStatus({ ...release22, packageName: "com.winstone.connect.test" })).toBe("not_company_signed");
  });
  it("is stored privately with a real sha256 and short-lived links", () => {
    expect(APK_RELEASE.bucket).toBe("android-apk");
    expect(APK_RELEASE.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(APK_LINK_MINUTES).toBeLessThanOrEqual(60);
  });
});

describe("download page signing details", () => {
  it("shows the approved certificate fingerprint in apksigner format", async () => {
    const { formatFingerprint } = await import("@/lib/apk-release");
    expect(formatFingerprint(APPROVED_SIGNER_SHA256)).toBe(
      "2E:61:50:E6:06:52:45:C1:B2:B5:41:37:51:2D:63:ED:40:0D:22:9B:88:1D:1B:91:5A:29:06:17:4E:1C:7E:6D",
    );
  });
  it("names the approved signer certificate", async () => {
    const { APPROVED_SIGNER_SUBJECT } = await import("@/lib/apk-release");
    expect(APPROVED_SIGNER_SUBJECT).toBe("CN=Winstone Connect, O=Winstone, C=BD");
  });
});
