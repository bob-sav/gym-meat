import ResetClient from "./ResetClient";

export default function Page({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token ?? "";
  return <ResetClient token={token} />;
}
