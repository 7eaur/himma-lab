import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ detail: "خدمة المختبر غير مهيأة بعد." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const code = String(body?.code || "").trim().toUpperCase();
  if (!code) return NextResponse.json({ detail: "أدخل كود المشاركة." }, { status: 400 });

  const { data, error } = await supabase
    .from("calibration_participants")
    .select("id,code,is_active")
    .eq("code", code)
    .maybeSingle();

  if (error) return NextResponse.json({ detail: "تعذر التحقق من الكود الآن." }, { status: 500 });
  if (!data || !data.is_active) return NextResponse.json({ detail: "الكود غير صحيح أو غير مفعّل." }, { status: 401 });

  return NextResponse.json({ ok: true, code: data.code });
}
