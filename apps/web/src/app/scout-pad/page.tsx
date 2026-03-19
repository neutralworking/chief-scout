import { redirect } from "next/navigation";

export default function ScoutPadRedirect() {
  redirect("/admin?tab=scout-pad");
}
