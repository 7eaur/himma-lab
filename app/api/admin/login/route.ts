import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string } | null;
  const expected = process.env.ADMIN_DASHBOARD_TOKEN?.trim();
  if (!expected) return NextResponse.json({ detail: "رمز لوحة المشرف غير مهيأ على الخادم." }, { status: 503 });
  if (!body?.token || body.token !== expected) return NextResponse.json({ detail: "رمز الدخول غير صحيح." }, { status: 401 });

  const store = await cookies();
  store.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  return NextResponse.json({ ok: true });
}
