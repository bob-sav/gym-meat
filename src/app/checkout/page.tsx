import CheckoutForm from "./ui/CheckoutForm";

export default function CheckoutPage() {
  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Checkout</h1>
      <CheckoutForm />
    </main>
  );
}
