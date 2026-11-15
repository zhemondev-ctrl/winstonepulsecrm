# Windows version of scripts/build-signed-apk.sh - official company-signed Winstone Connect
# release build with no GitHub/CI. Fails closed; never prints, copies or uploads passwords
# or the keystore (Gradle reads them from android\local.properties itself). The only
# signing value it handles is the PUBLIC certificate SHA-256 fingerprint.
$ErrorActionPreference = "Stop"

$androidDir = if ($env:WINSTONE_ANDROID_DIR) { $env:WINSTONE_ANDROID_DIR } else { Join-Path (Split-Path -Parent $PSScriptRoot) "android" }
$props = Join-Path $androidDir "local.properties"
$expectedPackage = "com.winstone.connect"
$approvedFp = "2e6150e6065245c1b2b54137512d63ed400d229b881d1b915a2906174e1c7e6d"

function Fail($msg) { Write-Host "OFFICIAL RELEASE BLOCKED: $msg" -ForegroundColor Red; exit 1 }

function Prop($key, $envName) {
  $v = [Environment]::GetEnvironmentVariable($envName)
  if (-not $v -and (Test-Path $props)) {
    $line = Get-Content $props | Where-Object { $_ -match "^\s*$([regex]::Escape($key))\s*=" } | Select-Object -Last 1
    if ($line) { $v = ($line -split "=", 2)[1].Trim() }
  }
  return $v
}
function NormFp($s) { if (-not $s) { return "" }; return ($s -replace "[:\s]", "").ToLower() }

if (-not (Test-Path $androidDir)) { Fail "android project folder not found at $androidDir" }

# 1) Signing inputs present (names only).
$missing = @()
$storeFile = Prop "RELEASE_STORE_FILE" "WINSTONE_KEYSTORE_PATH"
if (-not $storeFile) { $missing += "RELEASE_STORE_FILE" }
if (-not (Prop "RELEASE_STORE_PASSWORD" "WINSTONE_KEYSTORE_PASSWORD")) { $missing += "RELEASE_STORE_PASSWORD" }
if (-not (Prop "RELEASE_KEY_ALIAS" "WINSTONE_KEY_ALIAS")) { $missing += "RELEASE_KEY_ALIAS" }
$expectedFp = NormFp (Prop "RELEASE_CERT_SHA256" "WINSTONE_RELEASE_CERT_SHA256")
if (-not $expectedFp) { $missing += "RELEASE_CERT_SHA256" }
if ($missing.Count -gt 0) { Fail "missing: $($missing -join ', ') (set in android\local.properties; values are never printed)" }
if ($expectedFp -notmatch "^[0-9a-f]{64}$") { Fail "RELEASE_CERT_SHA256 is not a 64-hex SHA-256 fingerprint" }
if ($expectedFp -ne $approvedFp) { Fail "RELEASE_CERT_SHA256 is not the pinned company signer" }
$gradleFile = Join-Path $androidDir "app\build.gradle.kts"
if (-not (Test-Path $gradleFile)) { Fail "app\build.gradle.kts missing" }
$wantCode = ([regex]::Match((Get-Content $gradleFile -Raw), '(?m)^\s*versionCode\s*=\s*(\d+)')).Groups[1].Value
$wantName = ([regex]::Match((Get-Content $gradleFile -Raw), '(?m)^\s*versionName\s*=\s*"([^"]+)"')).Groups[1].Value
if ($wantName -ne "2.22" -or $wantCode -ne "33") { Fail "this release requires version 2.22 (code 33)" }
if (-not (Test-Path $storeFile)) { Fail "keystore file not found at RELEASE_STORE_FILE" }

$projectRoot = (Resolve-Path (Join-Path $androidDir "..")).Path
$storeAbs = (Resolve-Path $storeFile).Path
if ($storeAbs.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  Fail "keystore is inside the project folder; move it to a private location outside the project"
}

# 2) No keystore anywhere in the project.
$stray = Get-ChildItem -Path $projectRoot -Recurse -File -Include *.jks, *.keystore, *.p12 -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "[\\/](node_modules|build|\.gradle|\.git)[\\/]" } | Select-Object -First 5
if ($stray) { Fail "keystore file(s) found inside the project - remove them first: $($stray.FullName -join '; ')" }

# 3) Android SDK tools.
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { (Prop "sdk.dir" "__WINSTONE_UNUSED__") -replace "\\\\", "\" -replace "\\:", ":" }
if (-not $sdk -or -not (Test-Path (Join-Path $sdk "build-tools"))) { Fail "Android SDK not found (set ANDROID_HOME or sdk.dir)" }
$bt = (Get-ChildItem (Join-Path $sdk "build-tools") -Directory | Sort-Object { [version]($_.Name -replace "[^0-9.].*$", "") } | Select-Object -Last 1).Name
$apksigner = Join-Path $sdk "build-tools\$bt\apksigner.bat"
$aapt2 = Join-Path $sdk "build-tools\$bt\aapt2.exe"
if (-not (Test-Path $apksigner) -or -not (Test-Path $aapt2)) { Fail "apksigner/aapt2 missing in build-tools $bt" }

# 4) Unit tests + release build.
Set-Location $androidDir
& .\gradlew.bat --no-daemon clean :app:testDebugUnitTest :app:assembleRelease
if ($LASTEXITCODE -ne 0) { Fail "Gradle tests/build failed" }
$apk = "app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apk)) { Fail "signed $apk not produced (an *-unsigned.apk means signing was not applied)" }

# 5) Signature.
$sig = (& $apksigner verify --verbose --print-certs $apk) -join "`n"
if ($LASTEXITCODE -ne 0) { Fail "apksigner verify failed" }
if ($sig -notmatch "Verified using v2 scheme \(APK Signature Scheme v2\): true") { Fail "APK is not v2-signed" }
$signerLines = [regex]::Matches($sig, "(?m)^Signer #\d+ certificate SHA-256 digest:(.*)$")
if ($signerLines.Count -ne 1) { Fail "expected exactly 1 signer, found $($signerLines.Count)" }
$gotFp = NormFp $signerLines[0].Groups[1].Value
if ($gotFp -ne $expectedFp) { Fail "signer fingerprint mismatch (got $gotFp, approved $expectedFp)" }

# 6) Identity.
$badging = (& $aapt2 dump badging $apk) -join "`n"
$pkgLine = ([regex]::Match($badging, "(?m)^package:.*$")).Value
$gotPkg = ([regex]::Match($pkgLine, "name='([^']+)'")).Groups[1].Value
$gotCode = ([regex]::Match($pkgLine, "versionCode='([^']+)'")).Groups[1].Value
$gotName = ([regex]::Match($pkgLine, "versionName='([^']+)'")).Groups[1].Value
if ($gotPkg -ne $expectedPackage) { Fail "package is $gotPkg, expected $expectedPackage" }
if ($gotCode -ne $wantCode -or $gotName -ne $wantName) { Fail "version $gotName/$gotCode does not match build.gradle.kts $wantName/$wantCode" }
if ($badging -match "application-debuggable") { Fail "APK is debuggable" }

# 7) Output.
$out = Join-Path $androidDir "release-out"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$name = "winstone-connect-$gotName-$gotCode-release.apk"
$dest = Join-Path $out $name
Copy-Item $apk $dest -Force
$sum = (Get-FileHash $dest -Algorithm SHA256).Hash.ToLower()
"$sum  $name" | Set-Content -NoNewline -Encoding ascii (Join-Path $out "$name.sha256")
$dhaka = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "Bangladesh Standard Time").ToString("yyyy-MM-dd HH:mm")
@"
Winstone Connect official release record (public facts only)
Built (Dhaka):       $dhaka
Package:             $gotPkg
Version:             $gotName (code $gotCode)
Signer SHA-256:      $gotFp (matches approved fingerprint)
APK SHA-256:         $sum
Size (bytes):        $((Get-Item $dest).Length)
Build-tools:         $bt
Unit tests:          passed (testDebugUnitTest)
Status:              SIGNED - not yet approved for agent phones until the real-device test
                     (docs/ANDROID_OFFICIAL_RELEASE_HANDOVER.md section E) passes.
"@ | Set-Content -Encoding utf8 (Join-Path $out "$name.release-record.txt")

Write-Host ""
Write-Host "Official release APK verified."
Write-Host "APK:      $dest"
Write-Host "SHA-256:  $sum"
Write-Host "Signer:   $gotFp"
Write-Host "Version:  $gotName ($gotCode)"
