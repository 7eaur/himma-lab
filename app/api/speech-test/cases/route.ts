import { NextResponse } from "next/server";
import { TEST_CASES } from "@/lib/speech-experiment";

export async function GET() {
  return NextResponse.json({ cases: TEST_CASES });
}
