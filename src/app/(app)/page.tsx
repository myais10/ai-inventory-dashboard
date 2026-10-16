import { redirect } from "next/navigation";
import { isManager, requireSession } from "@/lib/auth/session";

export default async function Home() {
  const s = await requireSession();
  redirect(isManager(s) ? "/team" : "/desk");
}
