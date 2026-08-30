import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { getSupabaseAdmin } from "@/lib/supabase";

const datasetSplits = new Set(["unassigned", "development", "calibration", "validation"]);

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ detail: "غير مصرح." }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ detail: "قاعدة المختبر غير مهيأة." }, { status: 503 });
  const body = await request.json().catch(() => null) as { code?: string; label?: string; datasetSplit?: string } | null;
  const code = String(body?.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return NextResponse.json({ detail: "الكود يجب أن يكون 3-24 حرفًا/رقمًا إنجليزيًا." }, { status: 422 });
  const label = String(body?.label || "").trim();
  const datasetSplit = String(body?.datasetSplit || "unassigned").trim();
  if (!datasetSplits.has(datasetSplit)) return NextResponse.json({ detail: "مجموعة Dataset غير صالحة." }, { status: 422 });

  const { data, error } = await supabase
    .from("calibration_participants")
    .insert({ code, label: label || null, is_active: true, dataset_split: datasetSplit })
    .select("id,code,label,is_active,dataset_split,created_at")
    .single();

  if (error) return NextResponse.json({ detail: error.code === "23505" ? "هذا الكود مستخدم مسبقًا." : "تعذر إنشاء الكود." }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
