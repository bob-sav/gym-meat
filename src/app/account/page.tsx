import SettingsClient from "./SettingsClient";
import { auth } from "@/auth";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) {
    // middleware should protect, but just in case:
    return null;
  }
  return <SettingsClient email={session.user.email ?? ""} />;
}
