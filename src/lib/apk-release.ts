/**
 * Owner-approved public signing certificate fingerprint (SHA-256) for
 * com.winstone.connect — the key that also signed v2.3. Public, not a secret.
 */
export const APPROVED_SIGNER_SHA256 = "2e6150e6065245c1b2b54137512d63ed400d229b881d1b915a2906174e1c7e6d";

/** Certificate subject of the approved company signer (public). */
export const APPROVED_SIGNER_SUBJECT = "CN=Winstone Connect, O=Winstone, C=BD";

/** Formats a hex SHA-256 the way apksigner/keytool print it: AA:BB:CC… (uppercase, colon-separated). */
export function formatFingerprint(hex: string): string {
  const clean = hex.toLowerCase().replace(/[^a-f0-9]/g, "");
  return (clean.toUpperCase().match(/.{1,2}/g) ?? []).join(":");
}

/** First version built from the latest code with scripts/build-signed-apk. */
export const FIRST_OFFICIAL_VERSION_CODE = 33;

export type ApkRelease = {
  bucket: string;
  file: string;
  version: string;
  versionCode: number;
  packageName: string;
  sizeBytes: number;
  sha256: string;
  signerSha256: string;
  server: string;
  companySigned: boolean;
  /** True only when the file came out of scripts/build-signed-apk with its release record and .sha256 matching. */
  builtByReleaseScript: boolean;
  /** Missing evidence is never approval; bind reviewed build/device evidence to these exact bytes. */
  acceptance?: { apkSha256: string; sourceCommit: string; reviewedAt: string; deviceTestPassed: boolean };
  addedAt: string;
};

/**
 * The phone app file IT hands to agents (WhatsApp, pen drive, email or the
 * IT Console download). Facts below were read from the uploaded file itself
 * (v2 signature verified, one signer). Company-signed, but repackaged from the
 * 2.21-test code rather than built from the latest source with the release
 * script, so it is not yet the official release.
 *
 * When the key holder's 2.22 build arrives: verify the file (signer, package,
 * version, sha256 vs .sha256 and release record), upload it to the bucket,
 * then replace these facts and set builtByReleaseScript: true.
 */
export const APK_RELEASE: ApkRelease = {
  bucket: "android-apk",
  file: "winstone-connect-2.21-release.apk",
  version: "2.21",
  versionCode: 32,
  packageName: "com.winstone.connect",
  sizeBytes: 19336016,
  sha256: "c5e1e5861bf384975086e6b206b17283348e3524d97ab0d5fb784942be394710",
  signerSha256: "2e6150e6065245c1b2b54137512d63ed400d229b881d1b915a2906174e1c7e6d",
  server: "https://crm.winstonebd.com",
  companySigned: true,
  builtByReleaseScript: false,
  addedAt: "2026-11-01T21:20:00Z",
};

export type ApkReleaseStatus = "official" | "company_signed_older_code" | "not_company_signed";

/** Official = approved company key + company package + release-script build of 2.22 or later. */
export function apkReleaseStatus(r: ApkRelease): ApkReleaseStatus {
  const signed =
    r.companySigned &&
    r.signerSha256.toLowerCase() === APPROVED_SIGNER_SHA256 &&
    r.packageName === "com.winstone.connect" &&
    /^[a-f0-9]{64}$/.test(r.sha256);
  if (!signed) return "not_company_signed";
  const evidence = r.acceptance;
  if (r.builtByReleaseScript && r.versionCode >= FIRST_OFFICIAL_VERSION_CODE &&
    evidence?.apkSha256 === r.sha256 && /^[a-f0-9]{40}$/i.test(evidence.sourceCommit) &&
    Number.isFinite(Date.parse(evidence.reviewedAt)) && evidence.deviceTestPassed === true) return "official";
  return "company_signed_older_code";
}

/** Minutes a signed IT Console download link stays valid. */
export const APK_LINK_MINUTES = 60;
