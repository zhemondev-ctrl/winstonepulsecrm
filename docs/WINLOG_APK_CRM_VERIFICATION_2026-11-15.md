# Winlog Calls APK ও লাইভ CRM — একত্রিত যাচাই

যাচাই: ১৫ নভেম্বর ২০২৬, ০৪:৫০–০৪:৫২ ঢাকা (১৪ নভেম্বর ২২:৫০–২২:৫২ UTC)।

## সিদ্ধান্ত

- **Signed APK আছে:** আপলোড করা `WinLog-10.apk`-এর ডিজিটাল স্বাক্ষর Android `apksigner` দিয়ে বৈধ পাওয়া গেছে।
- **এটি CRM 2.22/code33 নয়:** এটি আলাদা Winlog Calls, সংস্করণ **1.0.10/code10**, প্যাকেজ **com.winlog.app**।
- **কোম্পানির অনুমোদিত Winlog release নিশ্চিত নয়:** বৈধ স্বাক্ষর একা অনুমোদিত কোম্পানি release বা latest-source build প্রমাণ করে না। CRM-এর অনুমোদিত সার্টিফিকেটের সঙ্গে এটি মেলে না; আলাদা Winlog signer-এর অনুমোদিত নির্ভরযোগ্য রেকর্ড দেওয়া হয়নি।
- **ফোনে কল ও CRM sync যাচাই হয়নি:** এই পরিবেশে ব্যবহারকারীর ফোনের সংযোগ নেই। APK পরীক্ষা ফোনে ইনস্টল বা কল করার পরীক্ষা নয়।
- **লাইভ এজেন্ট ড্যাশবোর্ড দেখা যাচ্ছে না:** `crm.winstonebd.com/desk` ও `/signin`-এ রক্ষণাবেক্ষণ লক দেখা গেছে। প্রকৃত লিড সংখ্যা, অবশিষ্ট দৈনিক সীমা ও সম্পূর্ণ বাংলা ড্যাশবোর্ড যাচাই বাধাগ্রস্ত।

## APK প্রমাণ

| বিষয় | পরীক্ষিত ফল |
|---|---|
| ফাইল | WinLog-10.apk |
| আকার | 5,467,079 bytes |
| ফাইল SHA-256 | `f8a7730d79af767bb935455398b4f9a26016072a56016b01753cb5f0924d520f` |
| ZIP integrity | ত্রুটিযুক্ত entry নেই |
| প্যাকেজ | `com.winlog.app` |
| versionName / versionCode | `1.0.10` / `10` |
| minSdk / targetSdk | `24` / `36` |
| Manifest debuggable | attribute অনুপস্থিত; explicit debug flag নেই |
| Cryptographic verification | `Verifies`; v2=true; v1/v3/v3.1/v4=false; 1 signer |
| Public certificate subject | `CN=WinLog, O=WinLog, C=BD` |
| Certificate SHA-256 | `fa8806705e81c2b9852ce9043962e20821f308bb579f7f23cecaa49b418f14bf` |
| Key | RSA, 2048 bits |
| Capacitor server URL | `https://winlog-calls.lovable.app` |
| CRM package/version comparison | `com.winstone.connect` / `2.22` / `33` — **মেলে না** |
| CRM signer comparison | `2e6150e6065245c1b2b54137512d63ed400d229b881d1b915a2906174e1c7e6d` — **মেলে না** |
| Latest source/build provenance | যাচাই হয়নি; APK থেকে commit বা approved build receipt প্রতিষ্ঠিত হয়নি |

CRM-এর signer দিয়ে Winlog-এর অনুমোদন অনুমান করা যাবে না। নতুন APK তৈরি করা হয়নি; শুধু আপলোডের পরীক্ষা হয়েছে। সার্টিফিকেটের fingerprint সর্বজনীন তথ্য; কোনো keystore/password ব্যবহার বা প্রকাশ করা হয়নি।

## লাইভ CRM প্রমাণ

| পরীক্ষা | ফল |
|---|---|
| `/signin` | HTTP 200; রক্ষণাবেক্ষণ লক দৃশ্যমান |
| `/desk`, উপলব্ধ সেশন পুনঃস্থাপনের পর | HTTP 200; একই রক্ষণাবেক্ষণ লক; এজেন্টের হিসাব দৃশ্যমান নয় |
| বাংলা ভাষা পছন্দ | `winstone.lang=bn` দিয়ে পরীক্ষা; লকের প্রধান লেখা ইংরেজি, একটি সহায়ক বাংলা লাইন আছে — সম্পূর্ণ বাংলা প্রমাণ নয় |
| লকের প্রদর্শিত কারণ | `SYSTEM MAINTENANCE LOCKED`, `PAYMENT REQUIRED`; এটি UI-এর দাবি, অর্থপ্রদানের বাস্তব অবস্থা স্বাধীনভাবে যাচাই নয় |
| `/manual` | HTTP 200; version 1.7.0, $35.29 এবং 50-lead markers উত্তীর্ণ |
| নতুন ড্যাশবোর্ডের নির্দিষ্ট revision | নিশ্চিত নয়; fetched DailyAllocationSummary asset-এ প্রত্যাশিত নতুন markers পাওয়া যায়নি, যা একা revision নির্ধারণ করে না |
| এজেন্টের বাস্তব লিড/অবশিষ্ট সীমা | যাচাই হয়নি; কোনো সংখ্যা অনুমান করা হয়নি |
| পর্যবেক্ষিত browser page errors | 0; লকের কারণে কাজের flow পরীক্ষা হয়নি |

Manual markers সাধারণ release evidence; এগুলো নতুন বাংলা ড্যাশবোর্ড বা এজেন্টের বাস্তব 50+10 হিসাব লাইভ দৃশ্যমান হওয়ার প্রমাণ নয়। লক সরানো, বিলের অবস্থা পরিবর্তন বা পুনঃপ্রকাশ এই যাচাইয়ে করা হয়নি। বিদ্যমান Architect payment verification/unlock পথ অনুসরণ করতে হবে; লক bypass করা হয়নি।

## পরীক্ষার ফল আলাদা রাখুন

| পরীক্ষা | ফল | সীমা |
|---|---|---|
| APK signature verification | PASS | আপলোড করা binary-এর স্বাক্ষর, অনুমোদন নয় |
| APK identity vs CRM 2.22/code33 | MISMATCH | আলাদা app; CRM replacement নয় |
| Existing allocation dashboard tests | 5 PASS | isolated CRM tests; ফোন পরীক্ষা নয় |
| Existing lead quota tests | 6 PASS | isolated CRM tests; live totals নয় |
| Existing CRM signed-build script tests | 7 PASS | script regressions; এই Winlog APK-এর build provenance নয় |
| Android instrumentation / handset call tests | NOT RUN | connected handset নেই |
| Real call → CRM read-back | NOT VERIFIED | ফোনের evidence ও authorized session দরকার |

মোট বিদ্যমান CRM পরীক্ষা: **18 passed, 0 failed**। নতুন Winlog Android পরীক্ষা যোগ বা চালানো হয়নি।

## পরবর্তী build ও ফোন পরীক্ষার একক ফলপত্র

প্রতি নতুন APK-তে নিচের টেবিলের কপি নিয়ে পরীক্ষা করুন। Pending ঘর কখনো PASS ধরে নেবেন না। Winlog পরীক্ষার জন্য Winlog-এর approved package/version/signer contract চাই; CRM 2.22/code33 contract আলাদা। ফোনের queued data মুছে বা app uninstall করে পরীক্ষা শুরু করবেন না।

| Gate | বর্তমান অবস্থা | পরবর্তী পরীক্ষার প্রমাণ |
|---|---|---|
| APK filename, SHA-256, package, version | উপরে verified | APK ও public verification output |
| Approved Winlog signer match | PENDING | key custodian-এর trusted public fingerprint; দ্বিতীয় যাচাই |
| Exact source commit ও build receipt | PENDING | source SHA, build run/record |
| ফোনে install/open, device/Android version | NOT RUN | তারিখ ও cropped screenshot |
| নিজস্ব authorized agent sign-in | NOT RUN | customer/token/password ছাড়া ফল |
| Outgoing answered call | NOT RUN | সম্মত পরীক্ষার নম্বর; CallLog time/duration ও matching CRM record |
| Incoming call | NOT RUN | একই call identity ও CRM read-back |
| Missed/rejected call | NOT RUN | connected/talk score না হওয়ার প্রমাণ |
| Offline → reconnect sync | NOT RUN | queue অক্ষত, real read-back; duplicate নেই |
| Permission denied → granted | NOT RUN | অনুমতি না থাকলে unknown/unverified, পরে সঠিক sync |
| পুনরায় sync / process restart | NOT RUN | একই call-এর duplicate row/score নেই |
| Ownership/account-switch isolation | NOT RUN | অন্য agent-এর data না যাওয়া; isolated environment |
| Recording consent ও matching audio, যদি চালু থাকে | NOT RUN | explicit consent ও genuine matching audio; missing audio মানে verified নয় |
| বাংলা live dashboard ও actual remaining company/self totals | BLOCKED | Architect unlock-এর পর active agent read-only screenshot ও authoritative counts |

ফোনের পরীক্ষার ফল পাঠালে customer phone/name, audio, tokens, passwords ও notification-এর ব্যক্তিগত তথ্য ঢেকে দিন। শুধু সফল লেখা বা একটি “Synced” badge নয়—একই কলের ফোনের CallLog ও CRM-এ পড়ে পাওয়া ফল মিলতে হবে।

**এই যাচাইয়ে কোনো ফোনকল, customer/lead write, assignment, payment/unlock, signing-key ব্যবহার, APK build বা publish করা হয়নি।**