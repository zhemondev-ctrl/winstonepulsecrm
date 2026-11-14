import type { SecurityEvidence } from "./security-history";

// Curated observations from tool responses, not a live scanner integration.
// Keep historical observations; add subsequent evidence rather than replacing it.
export const securityHistory: SecurityEvidence[] = [
  {
    id: "deep-20261114-145704", recordedAt: "2026-11-14T15:02:33Z", scanAt: "2026-11-14T14:57:04.839Z", kind: "deep", revision: null, revisionBasis: "unknown", state: "stale", critical: 2, tests: null,
    summary: { en: "Two critical findings reported; scanner marked this result outdated. No code revision was supplied.", bn: "দুটি গুরুতর সমস্যা পাওয়া যায়; ফল পুরোনো হিসেবে চিহ্নিত। স্ক্যানের কোড সংস্করণ দেওয়া হয়নি।" },
    findings: [
      { id: "lov_finding_8a3e16b247fedc86", title: { en: "Unassigned lead edits", bn: "বরাদ্দহীন লিড পরিবর্তন" }, state: "reported" },
      { id: "lov_finding_d831a56546e40269", title: { en: "Direct self-rated completion", bn: "নিজে নম্বর দিয়ে লিড সম্পন্ন করা" }, state: "reported" },
    ],
  },
  {
    id: "tests-e41e0544", recordedAt: "2026-11-14T15:09:54Z", scanAt: null, kind: "tests", revision: "e41e0544", revisionBasis: "saved-code", state: "passed", critical: null, tests: 51,
    summary: { en: "51 isolated checks passed. Ownership fix saved; existing completion guard verified offline. Both selected findings marked fixed; this is not deep-scan verification.", bn: "৫১টি পৃথক পরীক্ষা সফল। মালিকানা সংশোধন সংরক্ষিত; বিদ্যমান সম্পন্ন করার সুরক্ষা অফলাইনে যাচাই। নির্বাচিত দুটি সমস্যা সংশোধিত চিহ্নিত; এটি গভীর স্ক্যানের যাচাই নয়।" },
    findings: [
      { id: "lov_finding_8a3e16b247fedc86", title: { en: "Unassigned lead edits", bn: "বরাদ্দহীন লিড পরিবর্তন" }, state: "resolved-in-code" },
      { id: "lov_finding_d831a56546e40269", title: { en: "Direct self-rated completion", bn: "নিজে নম্বর দিয়ে লিড সম্পন্ন করা" }, state: "resolved-in-code" },
    ],
  },
  {
    id: "basic-20261114-1510", recordedAt: "2026-11-14T15:10:28Z", scanAt: null, kind: "basic", revision: null, revisionBasis: "unknown", state: "passed", critical: 0, tests: null,
    summary: { en: "Fresh basic database checks found no issues. These checks do not examine code or verify either selected fix.", bn: "নতুন প্রাথমিক ডেটাবেস পরীক্ষায় সমস্যা পাওয়া যায়নি। এটি কোড বা নির্বাচিত সংশোধন যাচাই করে না।" }, findings: [],
  },
  {
    id: "deep-request-e41e0544", recordedAt: "2026-11-14T15:10:28Z", scanAt: null, kind: "deep", revision: "e41e0544", revisionBasis: "saved-code", state: "pending", critical: null, tests: null,
    summary: { en: "Deep scan requested after confirming saved revision e41e0544. Completion for this revision remains unconfirmed: the next available result still carried the older 14:57 timestamp.", bn: "সংরক্ষিত e41e0544 নিশ্চিত করার পর গভীর স্ক্যান চাওয়া হয়েছে। এই সংস্করণের ফল নিশ্চিত নয়: পরবর্তী উপলব্ধ ফলেও পুরোনো ১৪:৫৭ UTC সময় ছিল।" }, findings: [],
  },
];