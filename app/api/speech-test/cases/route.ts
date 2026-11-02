import { NextResponse } from "next/server";
import { SPEECH_CONTENT_VERSION, SPEECH_SOURCE, TEST_CASES } from "@/lib/speech-experiment";

export async function GET() {
  const cases = TEST_CASES.map((item) => ({
    sequence: item.sequence,
    key: item.key,
    sourceQuestionId: item.sourceQuestionId,
    group: item.group,
    groupLabel: item.groupLabel,
    ownerId: item.ownerId,
    role: item.role,
    prompt: item.prompt,
    label: item.label,
    text: item.text,
    mode: item.mode,
    pronunciationAssessment: item.pronunciationAssessment,
    focus: item.focus,
    skillGroup: item.skillGroup,
    errorFocus: item.errorFocus,
  }));

  return NextResponse.json({
    contentVersion: SPEECH_CONTENT_VERSION,
    source: SPEECH_SOURCE,
    total: cases.length,
    cases,
  });
}
