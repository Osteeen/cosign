import { Wordmark } from "@/components/wordmark";

// Shown to a store whose order link is wrong, cut off, or for an order that
// doesn't exist. Stores have no Cosign account, so no "your agents" link here.
export default function OrderNotFound() {
  return (
    <main className="page">
      <div className="narrow panel-stack rise">
        <div className="store-order-top">
          <Wordmark />
          <span className="tag">Store view</span>
        </div>
        <h1 className="panel-title">This order link doesn&apos;t work</h1>
        <p className="panel-text">
          The link may be incomplete, or it was copied wrong. Ask the Cosign owner who sent it to send the order link again.
        </p>
      </div>
    </main>
  );
}
