import { redirect } from "next/navigation";

export default function LoginDashboardRedirectPage() {
  redirect("/dashboard");
}
