import { redirect } from "next/navigation";

export default function KCPreviewRedirect() {
  redirect("/admin?tab=kc-preview");
}
