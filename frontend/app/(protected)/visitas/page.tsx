import { redirect } from "next/navigation";
import { requireActiveSession } from "@/lib/auth-server";

/** Visit UI is deferred from the academic delivery; preserve existing API/data. */
export default async function VisitasPage() {
  const { user } = await requireActiveSession();
  redirect(user.role === "TECHNICIAN" ? "/" : "/servicos");
}
