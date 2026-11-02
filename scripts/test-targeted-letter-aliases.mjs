import assert from "node:assert/strict";
import fs from "node:fs";
import { matchTargetedLetterAlias } from "../lib/targeted-letter-alias.ts";

const corpus = JSON.parse(fs.readFileSync(new URL("../data/himma-v2-voice-cases.json", import.meta.url),"utf8"));
const catalog = JSON.parse(fs.readFileSync(new URL("../data/himma-v2-targeted-letter-asr-aliases.json", import.meta.url),"utf8"));
const letters = corpus.cases.filter((item)=> item.prompt === "اقرأ الحرف بصوت واضح.");
const removedBare = new Map([
  ["V2-PRE-Q06","ل"],["L1-04-GP-04","ق"],["L1-04-IC-A01","ب"],
  ["L1-04-IC-A03","م"],["SUP-03-GP-01","س"],["SUP-03-SC-01","د"],
  ["SUP-03-GP-03","ل"],["SUP-03-SC-03","ف"],["V2-POST-Q06","ق"]
]);
const latinAdditions = new Map([["SUP-03-SC-01","do"],["V2-POST-Q06","qo"],["SUP-03-GP-01","So"]]);

assert.equal(letters.length,10);
assert.equal(catalog.sourceContentVersion, corpus.contentVersion);
assert.equal(catalog.academicEffect,"none");
assert.equal(catalog.policy,"do_not_fail_from_asr_only");
assert.deepEqual(new Set(Object.keys(catalog.cases)), new Set(letters.map((item)=>item.sourceQuestionId)));

for (const item of letters) {
  const entry = catalog.cases[item.sourceQuestionId];
  assert.equal(entry.reference,item.text);
  assert.equal(item.aliases.length,0,"Canonical corpus stays unchanged");
  assert.equal(new Set(entry.variants.map(v=>v.text.toLowerCase())).size,entry.variants.length,
    "No duplicate spellings for the same item");
  for (const variant of entry.variants) {
    const matched=matchTargetedLetterAlias(variant.text + ".",item.text,entry.variants);
    assert.equal(matched.matched,true,JSON.stringify({item:item.text,variant}));
    assert.equal(matched.matchedAlias,variant.text);
    assert.equal(matched.matchKind,variant.kind);
    assert.equal(matched.vowelVerified,false);
    assert.equal(matched.effect,"do_not_fail_from_asr_only");
  }
  assert.equal(matchTargetedLetterAlias(item.text+".",item.text,entry.variants).matchKind,"exact_vowelled_text");
  assert.equal(matchTargetedLetterAlias(null,item.text,entry.variants).matched,false);
  assert.equal(matchTargetedLetterAlias("Rock.",item.text,entry.variants).matched,false);
  assert.equal(matchTargetedLetterAlias("la ba",item.text,entry.variants).matched,false);
  const wrongMark = item.text.includes("َ") ? "ِ" : item.text.includes("ِ") ? "ُ" : "َ";
  assert.equal(matchTargetedLetterAlias(item.text[0]+wrongMark,item.text,entry.variants).matched,false,
    "Explicitly wrong vowel must not be masked by a candidate");
  if(removedBare.has(item.sourceQuestionId)) {
    const letter=removedBare.get(item.sourceQuestionId);
    assert.equal(entry.variants.some(v=>v.kind==="bare_letter"),false);
    assert.equal(matchTargetedLetterAlias(letter,item.text,entry.variants).matched,false,
      "User-requested bare letter must not be matched");
  }
  if(latinAdditions.has(item.sourceQuestionId)){
    const latin=latinAdditions.get(item.sourceQuestionId);
    assert.ok(entry.variants.some(v=>v.text===latin&&v.kind==="latin_transliteration"));
    assert.equal(matchTargetedLetterAlias(latin.toUpperCase(),item.text,entry.variants).matched,true);
  }
}
// The bare-letter option for رَ was NOT requested for removal; preserve it.
assert.equal(matchTargetedLetterAlias("ر", "رَ",catalog.cases["L1-04-GP-02"].variants).matched,true);
assert.equal(matchTargetedLetterAlias("لا","لِ",catalog.cases["SUP-03-GP-03"].variants).matched,false);
assert.equal(matchTargetedLetterAlias("لي","لَ",catalog.cases["V2-PRE-Q06"].variants).matched,false);
assert.equal(matchTargetedLetterAlias("قو","قِ",catalog.cases["L1-04-GP-04"].variants).matched,false);
assert.equal(matchTargetedLetterAlias("قي","قُ",catalog.cases["V2-POST-Q06"].variants).matched,false);
assert.equal(matchTargetedLetterAlias("لا.","لَ",catalog.cases["V2-PRE-Q06"].variants).warning,
  "short_vowel_vs_long_vowel_unverified");
console.log("Safe letter aliases: 9 bare variants removed, ر unchanged, do/qo/So added, no vowel auto-accept.");
