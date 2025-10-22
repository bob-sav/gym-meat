import Link from "next/link";

export default function ThankYouPage({
  searchParams,
}: {
  searchParams: { code?: string; gym?: string };
}) {
  const code = searchParams?.code ?? "";
  const gym = searchParams?.gym ?? "";

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Thank you!</h1>
      {code ? (
        <>
          <p>Your order has been placed.</p>
          <p style={{ marginTop: 12 }}>
            <b>Pickup code:</b>{" "}
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 24,
                padding: "4px 8px",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                display: "inline-block",
              }}
            >
              {code}
            </span>
          </p>
          {gym && (
            <p style={{ marginTop: 8 }}>
              <b>Pickup location:</b> {gym}
            </p>
          )}
          <p style={{ marginTop: 16 }}>
            Show this code at the gym to receive your order.
          </p>

          <div style={{ marginTop: 24 }}>
            <Link className="my_button" href="/products">
              Back to products
            </Link>
          </div>
        </>
      ) : (
        <p>
          No code found. If you just ordered, please check your browser history.
        </p>
      )}
    </main>
  );
}
