import { cookies } from "next/headers";

export const ADMIN_COOKIE = "himma_lab_admin";

export async function isAdminRequest() {
  const expected = process.env.ADMIN_DASHBOARD_TOKEN?.trim();
  if (!expected) return false;
  const store = await cookies();
  return store.get(ADMIN_COOKIE)?.value === expected;
}
