import { redirect } from "next/navigation";

export default function EditorRedirect() {
  redirect("/admin?tab=editor");
}
