import SignupSuccessClient from "./SignupSuccessClient";

type PageSearchParams = {
  session_id?: string;
};

export const dynamic = "force-dynamic";

export default function SignupSuccessPage(props: any) {
  const searchParams = (props?.searchParams as PageSearchParams) || {};
  const sessionId = searchParams?.session_id ?? "";

  return <SignupSuccessClient sessionId={sessionId} />;
}
