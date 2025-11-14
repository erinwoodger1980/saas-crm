import { redirect } from "next/navigation";

export default function AdminDevRedirect() {
  // Legacy path /admin/dev -> new Developer Dashboard
  redirect("/dev");
}
