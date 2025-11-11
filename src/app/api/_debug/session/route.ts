export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth(); // pass req
  const cookie = req.headers.get("cookie") || "";
  return new Response(
    JSON.stringify(
      { ok: !!session, user: session?.user ?? null, cookie },
      null,
      2
    ),
    { headers: { "content-type": "application/json" } }
  );
}
