import assert from "node:assert/strict";
import fs from "node:fs";
import { matchTargetedLetterAlias } from "../lib/targeted-letter-alias.ts";

const corpus = JSON.parse(fs.readFileSync(new URL("../data/himma-v2-voice-cases.json", import.meta.url),"utf8"));
const catalog = JSON.parse(fs.readFileSync(new URL("../data/himma-v2-targeted-letter-asr-aliases.json", import.meta.url),"utf8"));
const letters = corpus.cases.filter((item)=> item.prompt === "اقرأ الحرف بصوت واضح.");

assert.equal(letters.length,10);
assert.equal(catalog.sourceContentVersion, corpus.contentVersion);
assert.equal(catalog.academicEffect,"none");
assert.equal(catalog.policy,"do_not_fail_from_asr_only");
assert.deepEqual(new Set(Object.keys(catalog.cases)), new Set(letters.map((item)=>item.sourceQuestionId)));

for(const item of letters) {
  const entry = catalog.cases[item.sourceQuestionId];
  assert.equal(entry.reference,item.text);
  assert.equal(item.aliases.length,0,"Canonical bank remains free of experiment aliases");
  assert.equal(entry.variants.length,3);
  assert.deepEqual(entry.variants.map((v)=>v.kind),["bare_letter","long_vowel_spelling","latin_transliteration"]);
  for(const variant of entry.variants) {
    const matched = matchTargetedLetterAlias(variant.text + ".",item.text,entry.variants);
    assert.equal(matched.matched,true,JSON.stringify({item:item.text,variant}));
    assert.equal(matched.matchedAlias,variant.text);
    assert.equal(matched.matchKind,variant.kind);
    assert.equal(matched.vowelVerified,false);
    assert.equal(matched.effect,"do_not_fail_from_asr_only");
  }
  assert.equal(matchTargetedLetterAlias(item.text+".",item.text,entry.variants).matchKind,"exact_vowelled_text");
  assert.equal(matchTargetedLetterAlias(null,item.text,entry.variants).matched,false);
  assert.equal(matchTargetedLetterAlias("Rock.",item.text,entry.variants).matched,false);
  assert.equal(matchTargetedLetterAlias("لام",item.text,entry.variants).matched,false);
  assert.equal(matchTargetedLetterAlias("la ba",item.text,entry.variants).matched,false);
  const wrongMark = item.text.includes("َ") ? "ِ" : item.text.includes("ِ") ? "ُ" : "َ";
  const mismatchedVowel = item.text[0]+wrongMark;
  assert.equal(matchTargetedLetterAlias(mismatchedVowel,item.text,entry.variants).matched,false,
    "Explicitly wrong vowel must not be masked by bare-letter candidate");
}

assert.equal(matchTargetedLetterAlias("لا","لِ",catalog.cases["SUP-03-GP-03"].variants).matched,false);
assert.equal(matchTargetedLetterAlias("لي","لَ",catalog.cases["V2-PRE-Q06"].variants).matched,false);
assert.equal(matchTargetedLetterAlias("قو","قِ",catalog.cases["L1-04-GP-04"].variants).matched,false);
assert.equal(matchTargetedLetterAlias("قي","قُ",catalog.cases["V2-POST-Q06"].variants).matched,false);
assert.equal(matchTargetedLetterAlias("لا.","لَ",catalog.cases["V2-PRE-Q06"].variants).warning,"short_vowel_vs_long_vowel_unverified");
assert.equal(matchTargetedLetterAlias(" LA. ","لَ",catalog.cases["V2-PRE-Q06"].variants).matchKind,"latin_transliteration");

console.log("10 targeted-letter alias contracts passed: conservative no-fail evidence only, no haraka or madd auto-acceptance.");
