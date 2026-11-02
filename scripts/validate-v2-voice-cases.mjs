import fs from "node:fs";

const path = new URL("../data/himma-v2-voice-cases.json", import.meta.url);
const payload = JSON.parse(fs.readFileSync(path, "utf8"));
const cases = payload.cases || [];

const expectedGroups = {
  pretest: 7,
  l1_lessons: 10,
  l1_supports: 7,
  l2_lessons: 12,
  l2_supports: 2,
  l3_lessons: 12,
  l3_supports: 5,
  posttest: 7,
};

const expectedPrompts = {
  "اقرأ الحرف بصوت واضح.": 10,
  "اقرأ الكلمة بصوت واضح.": 22,
  "اقرأ الجملة بصوت واضح.": 9,
  "اقرأ الجملتين بصوت واضح.": 11,
  "اقرأ النص بصوت واضح.": 10,
};

function fail(message) {
  throw new Error(message);
}

if (cases.length !== 62) fail(`Expected 62 voice cases, got ${cases.length}`);
if (new Set(cases.map((item) => item.key)).size !== 62) fail("Voice case IDs must be unique");
if (cases.some((item, index) => item.sequence !== index + 1)) fail("Voice case sequence must be contiguous 1..62");
if (cases.some((item) => !item.text?.trim() || !item.readingReference?.trim())) fail("Every case needs display and review references");
if (cases.some((item) => item.displayScoringPolicy?.academicAuthority !== "human_supervisor")) fail("All cases must retain human supervisor academic authority");
if (cases.some((item) => item.aliases?.length)) fail("V2-62 import must not inherit legacy speech aliases");
if (cases.some((item) => item.pronunciationAssessment !== Boolean(item.displayScoringPolicy?.displayDiacriticsPresent))) {
  fail("Pronunciation evidence must be requested only for explicitly displayed diacritics in the imported V2 policy");
}
if (cases.filter((item) => item.pronunciationAssessment).length !== 32) fail("Expected 32 explicitly vocalized pronunciation-evidence cases");
if (cases.some((item) => !item.displayScoringPolicy?.displayDiacriticsPresent && item.speechMode === "targeted_pronunciation")) {
  fail("Unvowelled connected reading must not be forced through targeted pronunciation mode");
}

for (const [group, count] of Object.entries(expectedGroups)) {
  const actual = cases.filter((item) => item.group === group).length;
  if (actual !== count) fail(`Group ${group}: expected ${count}, got ${actual}`);
}

for (const [prompt, count] of Object.entries(expectedPrompts)) {
  const actual = cases.filter((item) => item.prompt === prompt).length;
  if (actual !== count) fail(`Prompt ${prompt}: expected ${count}, got ${actual}`);
}

const legacyKeys = new Set(["haraka-ma", "haraka-mi", "haraka-mu", "haraka-ba", "haraka-bi", "haraka-bu", "word-sukun", "word-shadda", "word-madd", "sentence-1", "sentence-2", "passage-short", "fluency-short"]);
if (cases.some((item) => legacyKeys.has(item.key))) fail("Legacy September speech cases are still present");

console.log("Himma V2 voice corpus validated:", {
  contentVersion: payload.contentVersion,
  cases: cases.length,
  pronunciationEvidence: cases.filter((item) => item.pronunciationAssessment).length,
});
