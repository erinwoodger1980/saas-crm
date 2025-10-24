import CreateAccountClient from "./CreateAccountClient";

type PageSearchParams = {
  session_id?: string;
  token?: string;
};

export const dynamic = "force-dynamic";

export default function CreateAccountPage(props: any) {
  const searchParams = (props?.searchParams as PageSearchParams) || {};
  const sessionId = searchParams?.session_id ?? "";
  const initialToken = searchParams?.token ?? "";

  return <CreateAccountClient sessionId={sessionId} initialToken={initialToken} />;
}
