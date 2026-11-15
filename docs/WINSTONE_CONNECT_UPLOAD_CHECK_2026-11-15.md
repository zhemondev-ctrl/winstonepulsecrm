# Winstone Connect 2.22 / code 33 — uploaded source and build verification

Checked: 2026-11-15 00:46 UTC / 06:46 Dhaka.
User selected **Winstone Connect 2.22 / code 33**, not Winlog Calls.
CRM source revision tested: `12088a71e409fbc93d483916f63802f10c18aff3`.

## Uploaded ZIP

`winstone-connect-nov-15-2026-5-57-03-am.zip` contains 67 entries and **no APK**.
It is an AI Studio Android template: package `com.winstone.connect`, namespace
`com.example`, version `1.0` / code `1`, and a `Hello Android!` activity.
It has no CRM sign-in, call sync, lead intake or Internet permission in its manifest.
It was inspected under `/tmp`; it did not replace the existing CRM Android source.

The quoted debug APK hash, certificate and Firebase registration are supplied
claims, **not independently verified**: that APK and Firebase settings were not
available in this upload. A debug certificate is not the approved company signer.
No keystore was generated, copied, used or requested in chat.

## Existing correct CRM Android source

| Check | Evidence / result |
|---|---|
| Package and version | `android/app/build.gradle.kts`: `com.winstone.connect`, `2.22`, code `33` |
| CRM origin | `WinstoneApi.BASE_URL`: `https://crm.winstonebd.com` |
| Agent sign-in | `WinstoneAgentApi.signIn`: existing `/api/public/agent/login` path |
| Authenticated workspace | `WinstoneApi.fetchWorkspace`: per-agent device token |
| Call sync | Stable call UID and existing `/api/public/agent/call-state` path |
| Lead intake | Existing lead payload and offline queue; captures remain unassigned, LeadHub routes |
| Offline retry | Existing unique report/lead queue names and owner-bound work |
| Approved public signer guard | `2e6150e6065245c1b2b54137512d63ed400d229b881d1b915a2906174e1c7e6d` pinned by both official build scripts |
| Version guard | Both official build scripts require exactly `2.22` / `33` |

These are **source and regression-test findings**, not a successful live login,
actual phone connection, verified call, or saved CRM lead.
No additional parallel sync or assignment path was added.

## Actual build attempt

`bash scripts/build-signed-apk.sh` exited **1**, before Gradle:

```text
OFFICIAL RELEASE BLOCKED: missing: RELEASE_STORE_FILE RELEASE_STORE_PASSWORD RELEASE_KEY_ALIAS RELEASE_CERT_SHA256 (set in android/local.properties; values are never printed)
```

Java, PowerShell, Android SDK and ADB were unavailable in this sandbox.
Company signing inputs were absent. **No APK was produced**, so a new APK's
checksum, signature, package, version and installability were not verified.
The fingerprint guard cannot substitute for possession of the real private key.

## Regression results

**50 passed / 0 failed across 5 test files:**

- `tests/build-signed-apk-script.test.ts`: 11
- `tests/android-api-compatibility.test.ts`: 7
- `tests/android-sync-failures.test.ts`: 11
- `tests/android-auto-call-wiring.test.ts`: 3
- `tests/device-lead-write-security.test.ts`: 18

These tests are isolated script/contract/security regressions, **not Android
Gradle unit-test output or handset tests**. Phone sign-in, outgoing/incoming calls,
offline replay, CRM read-back and duplicate prevention on a real phone remain
**NOT RUN**. No production customer data was written.

## Next successful build and acceptance

The key custodian must run the existing official build script on a trusted
JDK 17 / Android SDK computer, with the approved keystore outside the repository
and credentials configured privately. Do not paste credentials or upload the key.
Do not use the uploaded 1.0/code1 template or debug APK as the official release.

Share only the resulting `winstone-connect-2.22-33-release.apk`, its checksum and
release record for independent verification. Then record real handset evidence
in the existing Android release-readiness checklist, bound to that exact checksum.
An approved signer alone does not establish final-release or CRM-sync acceptance.

No publication, release dispatch, maintenance unlock, role change, lead assignment,
historical deletion or cross-project modification was performed.