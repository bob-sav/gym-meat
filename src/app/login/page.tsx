// src/app/login/page.tsx
import LoginClient from "./LoginClient";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { verify?: string; from?: string };
}) {
  const verify = searchParams?.verify ?? null;
  const from = searchParams?.from ?? null;

  return <LoginClient verify={verify} from={from} />;
}
