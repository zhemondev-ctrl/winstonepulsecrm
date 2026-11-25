# Winstone Pulse Web Companion

A separate, lightweight WebView wrapper for the CRM desk. It does not replace or modify the native Winstone Connect app.

## Build

From this directory's parent, `android/`:

```bash
./gradlew :webcompanion:assembleDebug
```

The installable debug APK is written to `webcompanion/build/outputs/apk/debug/webcompanion-debug.apk`. GitHub Actions builds this APK on pull requests and publishes it as a short-lived workflow artifact. It is a debug build for evaluation and sideloading; it is not an official company-signed release.

The app loads only `https://crm.winstonebd.com/desk` and other HTTPS pages on `crm.winstonebd.com` inside the WebView. Telephone links use the native dialer; WhatsApp, email, SMS and non-CRM web links are handed to installed apps. WebView SSL errors are always cancelled.
