// This form works reliably with Next.js 15 + Auth.js v5:
// revert to a straight re-export (works with Next 15 + Auth.js v5)
import { authHandlers } from "@/auth";

export const GET = authHandlers.GET;
export const POST = authHandlers.POST;
