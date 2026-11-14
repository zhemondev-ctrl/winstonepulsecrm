# Winlog Calls — Android পরীক্ষা ও স্বাক্ষরের একক ফলপত্র

## বর্তমান সিদ্ধান্ত

**Signed APK আছে, কিন্তু final company release ও ফোনে কল/CRM sync এখনও যাচাই হয়নি।**

Winlog Calls-এর বর্তমান read-only snapshot: **4d2adf90**। এই চ্যাট থেকে সেই প্রকল্পের পর্দা বা কোড পরিবর্তন করা যায় না; নিচের ফলপত্র সেখানে পরবর্তী build-এর যাচাইয়ের জন্য ব্যবহার করা যাবে। CRM-এর 2.22/code33 নিয়ম Winlog-এর পরিচয় নয়।

## ১. আপলোড করা APK: যাচাইকৃত তথ্য

| বিষয় | ফল |
|---|---|
| APK | `WinLog-10.apk` |
| Package | `com.winlog.app` |
| Version | `1.0.10`, code `10` |
| Size | 5,467,079 bytes |
| APK SHA-256 | `f8a7730d79af767bb935455398b4f9a26016072a56016b01753cb5f0924d520f` |
| Android apksigner | **Verifies**, v2 signature=true, single signer |
| Public signer subject | `CN=WinLog, O=WinLog, C=BD` |
| Certificate SHA-256 | `fa8806705e81c2b9852ce9043962e20821f308bb579f7f23cecaa49b418f14bf` |
| SDK | min 24, target 36 |
| App loads | `https://winlog-calls.lovable.app` |
| Cryptographic inspection time | 15 Nov 2026, 04:50–04:52 Dhaka |
| Approved Winlog signer confirmation | **PENDING** — trusted company fingerprint/independent approval absent |
| Exact source commit of this APK | **UNKNOWN** — snapshot commit is not APK build provenance |

বর্তমান source-এ package `com.winlog.app`; versionName ও versionCode GitHub run number থেকে তৈরি হয়। Run number 10 হলে 1.0.10/code10 হতে পারে, কিন্তু version মিললেই নির্দিষ্ট commit বা run প্রমাণ হয় না।

## ২. Android ও অন্যান্য পরীক্ষার ফল আলাদা

| পরীক্ষা | বিদ্যমান প্রমাণ | ফলের সীমা |
|---|---|---|
| Android local unit test | `ExampleUnitTest.java`: 2+2=4 | Template মাত্র; এই যাচাইয়ে চালানো হয়নি; কল/sync পরীক্ষা নয় |
| Android instrumentation | `ExampleInstrumentedTest.java` আছে | Handset/emulator run output নেই; NOT RUN |
| Web sync-health tests | permission/auth/offline/stale/background status rules-এর test source আছে | এই snapshot-এ চালানো হয়নি; ফোন upload প্রমাণ নয় |
| Web app-release tests | queued/building/success/failure/tag mapping source আছে | এই snapshot-এ চালানো হয়নি; real CI ফল নয় |
| Workflow-trigger test | push branch behavior-এর source আছে | signature fingerprint বা handset acceptance পরীক্ষা নয় |
| Actual APK install/open on user's phone | ফোনের সংযোগ/ফল নেই | **NOT RUN** |
| Outgoing/incoming/missed calls | ফোন ও server read-back নেই | **NOT VERIFIED** |
| Foreground/background retry ও duplicate prevention | device evidence নেই | **NOT VERIFIED** |
| Winlog → crm.winstonebd.com bridge | uploaded APK Winlog site খোলে; CRM read-back নেই | **NOT VERIFIED** — Winlog upload মানেই Pulse CRM sync নয় |

আগের CRM-এর 101টি regression PASS এই Winlog Android পরীক্ষার ফল নয়; এখানে তা PASS হিসেবে যোগ করা হয়নি।

## ৩. পরবর্তী build-এর পুনর্ব্যবহারযোগ্য checklist

প্রতি APK-এর জন্য টেবিলটি কপি করে নতুন ফল লিখুন; আগের পরীক্ষার ফল overwrite করবেন না।

| Gate | Expected / evidence | Result | Checked by / Dhaka date |
|---|---|---|---|
| File name + SHA-256 | নতুন APK-এর actual hash | PENDING | — |
| Package | `com.winlog.app` | PENDING | — |
| Version name/code | অনুমোদিত build/run-এর expected values | PENDING | — |
| Signature validity | apksigner Verifies; single signer | PENDING | — |
| Approved signer match | trusted company public fingerprint-এর exact match | PENDING | — |
| Source provenance | full commit SHA + build receipt/run | PENDING | — |
| Install/update | device model/Android; queued data অক্ষত | NOT RUN | — |
| Own-account login | authorized real staff, no credential capture | NOT RUN | — |
| Answered outgoing SIM call | same phone CallLog identity/time/duration vs saved Winlog row | NOT RUN | — |
| Incoming SIM call | same call vs saved row | NOT RUN | — |
| Missed/rejected call | no false answered/talk evidence | NOT RUN | — |
| Offline/reconnect | queue retained; saved read-back after reconnect | NOT RUN | — |
| Background upload | actual accepted receipt, not timer scheduled | NOT RUN | — |
| Repeat sync | same external call ID; no duplicate saved row | NOT RUN | — |
| WhatsApp, if enabled | notification-derived evidence labelled as such; no SIM talk-proof claim | NOT RUN | — |
| Pulse CRM bridge, if required | same call identity saved/read back in authorized Pulse CRM view | NOT RUN | — |

Signature tools, public certificate ও APK hash যাচাইয়ে কোনো password লাগে না। Keystore, local.properties, access token বা password পাঠাবেন না। ফোনের screenshot/log-এ customer names/numbers ও notifications ঢেকে দিন। ইনস্টল ব্যর্থ হলে পুরনো অ্যাপ uninstall বা pending data মুছবেন না।

## ৪. কার্যকরী বাধা

- Real-device ফলের জন্য ফোনে authorized test এবং matching server read-back দরকার; এই পরিবেশে ফোন সংযুক্ত নেই।
- Approved Winlog certificate-এর independent trusted record দরকার; APK-এর নিজের fingerprint-কে নিজেই approved ধরা হয়নি।
- Snapshot-এ source-controlled keystore রয়েছে; সেটি খোলা, ব্যবহার বা কপি করা হয়নি। বৈধ signature নিরাপদ key custody-এর প্রমাণ নয়।
- Pulse CRM-এর live `/desk` ও `/signin` আগের যাচাইয়ে maintenance lock দেখিয়েছে; বাংলা dashboard/actual limits/counts এখনও blocked। Billing/payment/unlock অপরিবর্তিত।
- এই চ্যাটে Winlog Calls-এর `/version` বা dashboard-এ নতুন panel বসানো হয়নি; সেখানে UI implementation করতে Winlog Calls-এর নিজস্ব চ্যাট খুলতে হবে।

**কোনো APK build, ফোনকল, database write, publication, signing-secret ব্যবহার বা অনুমতির পরিবর্তন করা হয়নি।**