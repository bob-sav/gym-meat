import { auth } from "@/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <main style={{ maxWidth: 520, margin: "3rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>GYM-Meat</h1>

      {session?.user ? (
        <div style={{ lineHeight: 1.7 }}>
          <p>
            Signed in as <b>{session.user.email}</b>
          </p>
          <p>Name: {session.user.name ?? "—"}</p>

          <Link
            style={{ marginTop: 8 }}
            className="my_button"
            href="/api/auth/signout"
          >
            Sign out
          </Link>
        </div>
      ) : (
        <p>
          You’re not signed in. <a href="/login">Log in</a> ·{" "}
          <a href="/signup">Sign up</a>
        </p>
      )}
    </main>
  );
}
