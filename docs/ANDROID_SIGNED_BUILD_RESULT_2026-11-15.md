# কোম্পানির স্বাক্ষরিত APK — বিল্ড ও যাচাই ফল

Checked at 2026-11-15 00:37 UTC / 06:37 Dhaka. This is a build-attempt and guard-test report, not an APK or handset acceptance certificate.

## Winstone Connect CRM

| পরীক্ষা | প্রকৃত ফল |
|---|---|
| Requested package | `com.winstone.connect` |
| Requested version | `2.22`, code `33` |
| Source Gradle version | `2.22`, code `33` |
| Source parity before edits | Local and GitHub main both `f0f35cb7cfc1c1cf01609101d637ab3184cf5d34` |
| Approved public certificate SHA-256 | `2e6150e6065245c1b2b54137512d63ed400d229b881d1b915a2906174e1c7e6d` |
| Real build attempt | BLOCKED before Gradle: missing signing inputs |
| APK produced by this request | **NO** |
| Actual new APK signature/hash/version | **NOT VERIFIED — no APK produced** |
| Phone call / CRM sync acceptance | **NOT RUN — no connected handset** |

The actual script returned exit 1:

```text
OFFICIAL RELEASE BLOCKED: missing: RELEASE_STORE_FILE RELEASE_STORE_PASSWORD RELEASE_KEY_ALIAS RELEASE_CERT_SHA256 (set in android/local.properties; values are never printed)
```

Java, PowerShell and Android SDK/signing environment were not available in the checked sandbox. No private keystore or password was read or printed.

### Build protection implemented here

- Both `scripts/build-signed-apk.sh` and `.ps1` now reject any configured fingerprint different from the pinned company certificate, even when the replacement is a valid SHA-256 fingerprint.
- Both reject source versions other than exactly `2.22` / `33` before Gradle.
- Existing post-build checks still require verified v2 signature, exactly one signer, matching certificate, `com.winstone.connect`, exact source version and a non-debuggable APK before producing the APK/checksum/release record.
- Shell execution regressions cover replacement signer, `2.21/code33`, `2.22/code32`, `1.0.10/code10`, missing inputs, unsafe key location and missing SDK.
- **29 tests passed** across build-script and Android CI checks; shell syntax check passed. These are script/CI regressions, not Android device tests. PowerShell runtime execution was not available.

### GitHub signing runner — read-only evidence

Using ZH's GitHub API for `zhemondev-ctrl/winstonepulsecrm`:

- `android-release` exists, but `protection_rules` is empty, admins can bypass, and no deployment branch policy is configured.
- Environment signing-secret inventory is empty (`total_count: 0`).
- A release was **not dispatched**: the required reviewer protection and company signing inputs are absent.
- The uploaded `android-release_2.yml` matches the existing CRM release workflow; merely uploading it does not configure GitHub reviewers or signing secrets.

The key custodian must configure the protected reviewer gate and four environment secrets (`ANDROID_KEYSTORE_BASE64`, `WINSTONE_KEYSTORE_PASSWORD`, `WINSTONE_KEY_ALIAS`, `WINSTONE_KEY_PASSWORD`) privately, verify latest-source parity, then run the existing manual official release. Never paste the key, alias or passwords into chat. Share only the resulting APK, checksum, release record and public provenance for independent verification. Handset acceptance is still required before rollout.

## Winlog Calls — separate project

Read-only snapshot `cbd2ad63` of Winlog Calls was inspected. It is **not** Winstone Connect CRM.

| Requirement | Status |
|---|---|
| Package | Must stay `com.winlog.app` |
| Version family | User requested `1.0.x`; do not impose CRM `2.22/code33` |
| Company fingerprint check | Requested, **NOT ADDED to Winlog Calls** from this chat |
| Current workflow | Verifies signature validity only; does not pin company fingerprint/package/version |
| Write access to that project's source | Read-only snapshot; cannot change or push back from this CRM chat |

Continue in the Winlog Calls project: use a reviewed, protected company signing path; pin the requested company public certificate independently of environment overrides; require a single verified v2/v3 signer, package `com.winlog.app`, version matching `^1\.0\.[0-9]+$`, the exact expected version/code for that run and a non-debuggable APK. Run these checks **before naming, uploading or publishing** the APK, and save checksum-bound source/build results. Add negative tests for another signer, wrong package, CRM `2.22`, malformed version, wrong code and debuggable APK.

The previously inspected `WinLog-10.apk` had a different signer. Moving Winlog to the CRM company signer is not an in-place update of that APK; do not uninstall phones or lose pending uploads to force an update. Winlog's source rules currently describe a committed keystore; no private key was read, copied or reused here.

## সিদ্ধান্ত

CRM build guards are strengthened and tested; a company-signed 2.22/code33 APK has **not** been created. Winlog guards need implementation in its own chat. No CRM lock removal, production data change, APK distribution, GitHub dispatch or website publication was performed.