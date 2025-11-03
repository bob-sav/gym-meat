// src/emails/OrderConfirmationEmail.tsx
import * as React from "react";
import { Text } from "@react-email/components";
import EmailLayout from "./EmailLayout";

export default function OrderConfirmationEmail(props: {
  shortCode: string;
  pickupGymName?: string | null;
  pickupWhen?: string | null; // ISO string or formatted
  lines: { qty: number; name: string; unit?: string | null }[];
  totalCents: number;
}) {
  const total = (props.totalCents / 100).toFixed(2);
  return (
    <EmailLayout title="Order received">
      <Text>
        Thanks! Your order <b>#{props.shortCode}</b> has been received.
      </Text>
      {props.pickupGymName && (
        <Text>
          Pickup location: <b>{props.pickupGymName}</b>
        </Text>
      )}
      {props.pickupWhen && (
        <Text>
          Pickup time: <b>{props.pickupWhen}</b>
        </Text>
      )}
      <ul>
        {props.lines.map((l, i) => (
          <li key={i}>
            {l.qty}× {l.name}
            {l.unit ? ` · ${l.unit}` : ""}
          </li>
        ))}
      </ul>
      <Text>
        <b>Total:</b> €{total}
      </Text>
      <Text>Show your pickup code at the gym to receive your order.</Text>
    </EmailLayout>
  );
}
