import SignupSuccessClient from "./SignupSuccessClient";

type PageSearchParams = {
  session_id?: string;
};

export const dynamic = "force-dynamic";

export default function SignupSuccessPage({
  searchParams,
}: {
  searchParams?: PageSearchParams;
}) {
  const sessionId = searchParams?.session_id ?? "";

  return <SignupSuccessClient sessionId={sessionId} />;
}
