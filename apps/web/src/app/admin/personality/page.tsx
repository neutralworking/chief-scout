import { redirect } from "next/navigation";

export default function PersonalityRedirect() {
  redirect("/admin?tab=personality");
}
