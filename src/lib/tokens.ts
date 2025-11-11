import crypto from "crypto";

export function randomToken(len = 32) {
  return crypto.randomBytes(len).toString("hex");
}
