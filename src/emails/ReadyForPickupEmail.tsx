// src/emails/ReadyForPickupEmail.tsx
import * as React from "react";
import EmailLayout from "./EmailLayout";

type Props = {
  shortCode: string;
  pickupGymName: string | null;
  /** Already formatted for display (e.g. "03.11.2025, 14:07") */
  pickupWhenText?: string | null;
};

export default function ReadyForPickupEmail({
  shortCode,
  pickupGymName,
  pickupWhenText,
}: Props) {
  return (
    <EmailLayout title="Your order is ready for pickup">
      <p style={{ margin: "0 0 12px" }}>
        Your order <strong>#{shortCode}</strong> has arrived at{" "}
        <strong>{pickupGymName ?? "the gym"}</strong>.
      </p>

      {pickupWhenText ? (
        <p style={{ margin: "0 0 12px" }}>
          <strong>Arrival time:</strong> {pickupWhenText}
        </p>
      ) : null}

      <p style={{ margin: "0 0 12px" }}>
        Please show the code <strong>#{shortCode}</strong> at the desk to
        collect your package.
      </p>

      <p style={{ margin: 0 }}>Thanks for ordering with Gym Meat!</p>
    </EmailLayout>
  );
}
