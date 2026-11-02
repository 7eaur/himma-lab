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

const newCandidates=[
  {id:"L1-04-GP-02",target:"رَ",spoken:"راء.",kind:"arabic_letter_name_spelling",source:"observed_human_correct"},
  {id:"L1-04-IC-A03",target:"مَ",spoken:"ماء.",kind:"arabic_letter_name_spelling",source:"observed_human_correct"},
  {id:"SUP-03-GP-03",target:"لِ",spoken:"例。",kind:"chinese_phonetic_hypothesis",source:"observed_human_correct",pinyin:"lì"},
  {id:"V2-PRE-Q06",target:"لَ",spoken:"啦。",kind:"chinese_phonetic_hypothesis",source:"pinyin_candidate",pinyin:"la"},
  {id:"L1-04-IC-A03",target:"مَ",spoken:"吗。",kind:"chinese_phonetic_hypothesis",source:"pinyin_candidate",pinyin:"ma"},
  {id:"SUP-03-GP-01",target:"سُ",spoken:"苏。",kind:"chinese_phonetic_hypothesis",source:"pinyin_candidate",pinyin:"sū"},
  {id:"L1-04-IC-A01",target:"بُ",spoken:"不。",kind:"chinese_phonetic_hypothesis",source:"pinyin_candidate",pinyin:"bù"},
];
for(const entry of newCandidates){
  const candidates=catalog.cases[entry.id].variants;
  const found=matchTargetedLetterAlias(entry.spoken,entry.target,candidates);
  assert.equal(found.matched,true,JSON.stringify(entry));
  assert.equal(found.matchKind,entry.kind);
  assert.equal(found.evidenceSource,entry.source);
  assert.equal(found.pinyin,entry.pinyin || null);
  assert.equal(found.vowelVerified,false);
  assert.equal(found.effect,"do_not_fail_from_asr_only");
  assert.ok(found.warning);
}
// Arbitrary ideographs that are not close to the relevant Arabic phoneme
// must not be turned into aliases just because Azure hallucinated Chinese.
for(const [id,target,transcript] of [
  ["V2-POST-Q06","قُ","嗯。"],
  ["L1-04-GP-04","قِ","对。"],
  ["L1-04-GP-02","رَ","好。"],
  ["SUP-03-GP-03","لِ","不。"],
  ["V2-PRE-Q06","لَ","例。"],
  ["L1-04-IC-A01","بُ","吗。"]
]){
  assert.equal(matchTargetedLetterAlias(transcript,target,catalog.cases[id].variants).matched,false);
}
assert.equal(catalog.schemaVersion,"1.2");
assert.equal(newCandidates.length,7);

console.log("Targeted letter alias v1.2 passed: راء/ماء plus five phonetic Chinese candidates, no automatic vowel approval.");
