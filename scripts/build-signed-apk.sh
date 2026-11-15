#!/usr/bin/env bash
# Official company-signed Winstone Connect release build.
# Runs on the key custodian's trusted computer (JDK 17 + Android SDK / Android Studio)
# or in the manual, approver-gated .github/workflows/android-release.yml.
#
# Fails closed. It never prints, copies or uploads passwords or the keystore; Gradle
# reads them from android/local.properties (or WINSTONE_* env) itself. The only
# signing value it handles is the PUBLIC certificate SHA-256 fingerprint.
#
# Required (android/local.properties or env):
#   RELEASE_STORE_FILE      / WINSTONE_KEYSTORE_PATH       keystore OUTSIDE the project folder
#   RELEASE_STORE_PASSWORD  / WINSTONE_KEYSTORE_PASSWORD
#   RELEASE_KEY_ALIAS       / WINSTONE_KEY_ALIAS
#   RELEASE_CERT_SHA256     / WINSTONE_RELEASE_CERT_SHA256 approved public fingerprint
# Optional: RELEASE_KEY_PASSWORD / WINSTONE_KEY_PASSWORD (defaults to store password).
set -euo pipefail

ANDROID_DIR="${WINSTONE_ANDROID_DIR:-$(cd "$(dirname "$0")/.." && pwd)/android}"
PROPS="$ANDROID_DIR/local.properties"
EXPECTED_PACKAGE="com.winstone.connect"
APPROVED_FP="2e6150e6065245c1b2b54137512d63ed400d229b881d1b915a2906174e1c7e6d"

fail() { echo "OFFICIAL RELEASE BLOCKED: $*" >&2; exit 1; }

prop() { # prop <local.properties key> <env name>
  local v="${!2:-}"
  if [ -z "$v" ] && [ -f "$PROPS" ]; then
    v="$(grep -E "^[[:space:]]*$1[[:space:]]*=" "$PROPS" | tail -n1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' || true)"
  fi
  printf '%s' "$v"
}

norm_fp() { printf '%s' "$1" | tr -d ': \t\r\n' | tr '[:upper:]' '[:lower:]'; }

[ -d "$ANDROID_DIR" ] || fail "android project folder not found at $ANDROID_DIR"

# 1) Signing inputs present (names only are ever printed).
missing=()
STORE_FILE="$(prop RELEASE_STORE_FILE WINSTONE_KEYSTORE_PATH)"
[ -n "$STORE_FILE" ] || missing+=("RELEASE_STORE_FILE")
[ -n "$(prop RELEASE_STORE_PASSWORD WINSTONE_KEYSTORE_PASSWORD)" ] || missing+=("RELEASE_STORE_PASSWORD")
[ -n "$(prop RELEASE_KEY_ALIAS WINSTONE_KEY_ALIAS)" ] || missing+=("RELEASE_KEY_ALIAS")
EXPECTED_FP="$(norm_fp "$(prop RELEASE_CERT_SHA256 WINSTONE_RELEASE_CERT_SHA256)")"
[ -n "$EXPECTED_FP" ] || missing+=("RELEASE_CERT_SHA256")
[ ${#missing[@]} -eq 0 ] || fail "missing: ${missing[*]} (set in android/local.properties; values are never printed)"

[[ "$EXPECTED_FP" =~ ^[0-9a-f]{64}$ ]] || fail "RELEASE_CERT_SHA256 is not a 64-hex SHA-256 fingerprint"
[ "$EXPECTED_FP" = "$APPROVED_FP" ] || fail "RELEASE_CERT_SHA256 is not the pinned company signer"
GRADLE_FILE="$ANDROID_DIR/app/build.gradle.kts"
[ -f "$GRADLE_FILE" ] || fail "app/build.gradle.kts missing"
WANT_CODE="$(grep -E '^[[:space:]]*versionCode[[:space:]]*=' "$GRADLE_FILE" | head -n1 | grep -oE '[0-9]+' || true)"
WANT_NAME="$(grep -E '^[[:space:]]*versionName[[:space:]]*=' "$GRADLE_FILE" | head -n1 | sed -E 's/.*"([^"]+)".*/\1/' || true)"
[ "$WANT_NAME" = "2.22" ] && [ "$WANT_CODE" = "33" ] || fail "this release requires version 2.22 (code 33)"
[ -f "$STORE_FILE" ] || fail "keystore file not found at RELEASE_STORE_FILE"

PROJECT_ROOT="$(cd "$ANDROID_DIR/.." && pwd)"
STORE_ABS="$(cd "$(dirname "$STORE_FILE")" && pwd)/$(basename "$STORE_FILE")"
case "$STORE_ABS" in
  "$PROJECT_ROOT"/*) fail "keystore is inside the project folder; move it to a private location outside the project" ;;
esac

# 2) No keystore may live anywhere in the project (retired keys included).
stray="$(find "$PROJECT_ROOT" \( -name node_modules -o -name build -o -name .gradle -o -name .git \) -prune -o \
  -type f \( -name '*.jks' -o -name '*.keystore' -o -name '*.p12' \) -print 2>/dev/null | head -n 5)"
[ -z "$stray" ] || fail "keystore file(s) found inside the project — remove them first:
$stray"

# 3) Android SDK tools.
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
[ -n "$SDK" ] || SDK="$(prop sdk.dir __WINSTONE_UNUSED__)"
[ -n "$SDK" ] && [ -d "$SDK/build-tools" ] || fail "Android SDK not found (set ANDROID_HOME or sdk.dir)"
BT="$(ls -1 "$SDK/build-tools" | sort -V | tail -n1)"
APKSIGNER="$SDK/build-tools/$BT/apksigner"
AAPT2="$SDK/build-tools/$BT/aapt2"
[ -x "$APKSIGNER" ] && [ -x "$AAPT2" ] || fail "apksigner/aapt2 missing in build-tools $BT"

# 4) Unit tests + release build.
cd "$ANDROID_DIR"
chmod +x ./gradlew
./gradlew --no-daemon clean :app:testDebugUnitTest :app:assembleRelease

APK="app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] || fail "signed $APK not produced (an *-unsigned.apk means signing was not applied)"

# 5) Signature: v2 verified, exactly one signer, fingerprint equals the approved one.
SIG="$("$APKSIGNER" verify --verbose --print-certs "$APK")" || fail "apksigner verify failed"
grep -q "Verified using v2 scheme (APK Signature Scheme v2): true" <<<"$SIG" || fail "APK is not v2-signed"
SIGNERS="$(grep -cE '^Signer #[0-9]+ certificate SHA-256 digest:' <<<"$SIG" || true)"
[ "$SIGNERS" = "1" ] || fail "expected exactly 1 signer, found $SIGNERS"
GOT_FP="$(norm_fp "$(grep -E '^Signer #1 certificate SHA-256 digest:' <<<"$SIG" | cut -d: -f2-)")"
[ "$GOT_FP" = "$EXPECTED_FP" ] || fail "signer fingerprint mismatch (got $GOT_FP, approved $EXPECTED_FP)"

# 6) Identity: official package, matching version, not debuggable.
BADGING="$("$AAPT2" dump badging "$APK")"
PKG_LINE="$(grep -E '^package:' <<<"$BADGING" | head -n1)"
GOT_PKG="$(sed -E "s/.*name='([^']+)'.*/\1/" <<<"$PKG_LINE")"
GOT_CODE="$(sed -E "s/.*versionCode='([^']+)'.*/\1/" <<<"$PKG_LINE")"
GOT_NAME="$(sed -E "s/.*versionName='([^']+)'.*/\1/" <<<"$PKG_LINE")"
[ "$GOT_PKG" = "$EXPECTED_PACKAGE" ] || fail "package is $GOT_PKG, expected $EXPECTED_PACKAGE"
[ "$GOT_CODE" = "$WANT_CODE" ] && [ "$GOT_NAME" = "$WANT_NAME" ] || fail "version $GOT_NAME/$GOT_CODE does not match build.gradle.kts $WANT_NAME/$WANT_CODE"
! grep -q "application-debuggable" <<<"$BADGING" || fail "APK is debuggable"

# 7) Output: renamed APK + .sha256 + release record (public facts only).
OUT="$ANDROID_DIR/release-out"
mkdir -p "$OUT"
NAME="winstone-connect-$GOT_NAME-$GOT_CODE-release.apk"
cp "$APK" "$OUT/$NAME"
cd "$OUT"
if command -v sha256sum >/dev/null 2>&1; then SUM="$(sha256sum "$NAME" | awk '{print $1}')"; else SUM="$(shasum -a 256 "$NAME" | awk '{print $1}')"; fi
printf '%s  %s\n' "$SUM" "$NAME" > "$NAME.sha256"
SIZE="$(wc -c < "$NAME" | tr -d ' ')"
cat > "$NAME.release-record.txt" <<EOF
Winstone Connect official release record (public facts only)
Built (Dhaka):       $(TZ=Asia/Dhaka date '+%Y-%m-%d %H:%M')
Package:             $GOT_PKG
Version:             $GOT_NAME (code $GOT_CODE)
Signer SHA-256:      $GOT_FP (matches approved fingerprint)
APK SHA-256:         $SUM
Size (bytes):        $SIZE
Build-tools:         $BT
Unit tests:          passed (testDebugUnitTest)
Status:              SIGNED — not yet approved for agent phones until the real-device test
                     (docs/ANDROID_OFFICIAL_RELEASE_HANDOVER.md section E) passes.
EOF

echo ""
echo "Official release APK verified."
echo "APK:      $OUT/$NAME"
echo "SHA-256:  $SUM"
echo "Signer:   $GOT_FP"
echo "Version:  $GOT_NAME ($GOT_CODE)"
echo "Record:   $OUT/$NAME.release-record.txt"
