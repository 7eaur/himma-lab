import { NextResponse } from "next/server";

function pronunciationRegionAvailable() {
  if (process.env.HIMMA_AZURE_PRONUNCIATION_ENDPOINT?.trim()) return true;
  if (process.env.HIMMA_AZURE_SPEECH_REGION?.trim()) return true;
  const endpoint = process.env.HIMMA_AZURE_SPEECH_ENDPOINT?.trim();
  if (!endpoint) return false;
  try {
    const host = new URL(endpoint).hostname;
    return host.endsWith(".api.cognitive.microsoft.com");
  } catch {
    return false;
  }
}

export async function GET() {
  const keyConfigured = Boolean(process.env.HIMMA_AZURE_SPEECH_API_KEY?.trim());
  const lexicalConfigured = Boolean(process.env.HIMMA_AZURE_SPEECH_ENDPOINT?.trim()) && keyConfigured;
  const pronunciationConfigured = keyConfigured && pronunciationRegionAvailable();

  return NextResponse.json({
    lexical: {
      provider: "azure-speech",
      configured: lexicalConfigured,
      locale: "ar-OM",
    },
    pronunciation: {
      provider: "azure-pronunciation-assessment",
      configured: pronunciationConfigured,
      locale: process.env.HIMMA_AZURE_PRONUNCIATION_LOCALE?.trim() || "ar-SA",
    },
    storage: {
      configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    },
    academicEffect: "none",
  });
}
