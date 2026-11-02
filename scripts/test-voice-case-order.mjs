import assert from "node:assert/strict";
import fs from "node:fs";
import { groupVoiceCasesForDisplay } from "../lib/voice-case-order.ts";

const source = JSON.parse(fs.readFileSync(new URL("../data/himma-v2-voice-cases.json", import.meta.url), "utf8"));
const original = source.cases.map((item) => ({ ...item }));
const groups = groupVoiceCasesForDisplay(source.cases);

assert.deepEqual(groups.map((group) => group.key), ["letters", "words", "sentences", "texts"]);
assert.deepEqual(groups.map((group) => group.label), ["الحروف", "الكلمات", "الجمل", "النصوص"]);
assert.deepEqual(groups.map((group) => group.cases.length), [10, 22, 20, 10]);
const ordered = groups.flatMap((group) => group.cases);
assert.equal(ordered.length, 62);
assert.equal(new Set(ordered.map((item) => item.key)).size, 62);
assert.deepEqual(new Set(ordered.map((item) => item.key)), new Set(source.cases.map((item) => item.key)));
for (const group of groups) {
  assert.deepEqual(group.cases.map((item) => item.sequence),
    [...group.cases.map((item) => item.sequence)].sort((a,b)=>a-b));
}
assert.equal(groups[2].cases.filter((item) => item.prompt === "اقرأ الجملة بصوت واضح.").length, 9);
assert.equal(groups[2].cases.filter((item) => item.prompt === "اقرأ الجملتين بصوت واضح.").length, 11);
assert.equal(groups[0].cases[0].key, "V2-PRE-Q06");
assert.deepEqual(source.cases, original, "Presentation must not mutate the canonical content order");
console.log("Lab display order validated: 10 letters -> 22 words -> 20 sentences -> 10 texts; 62 IDs unchanged.");
