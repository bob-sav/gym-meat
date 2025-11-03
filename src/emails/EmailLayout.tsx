// src/emails/EmailLayout.tsx
import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
} from "@react-email/components";

export default function EmailLayout({
  children,
  title = "Gym Meat",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <Html>
      <Head />
      <Body
        style={{
          background: "#f6f7f9",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <Container
          style={{
            maxWidth: 560,
            margin: "24px auto",
            background: "#fff",
            padding: 20,
            borderRadius: 8,
          }}
        >
          <Section>
            <Text style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              {title}
            </Text>
          </Section>
          <Hr />
          <Section>{children}</Section>
          <Hr />
          <Section>
            <Text style={{ fontSize: 12, color: "#666" }}>
              This is an automated message from nudli.xyz · Please do not reply.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
