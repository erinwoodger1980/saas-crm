// 🚫 No imports above these lines
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const dynamicParams = true;

import SuccessClient from "./success-client";

export default function BillingSuccessPage() {
  return <SuccessClient />;
}