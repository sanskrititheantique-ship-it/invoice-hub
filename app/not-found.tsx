import Link from "next/link";

export default function NotFound() {
  return (
    <main className="login">
      <div className="stack" style={{ maxWidth: 380, textAlign: "center" }}>
        <h1 style={{ fontSize: 28 }}>Not found</h1>
        <p className="muted" style={{ margin: 0 }}>This invoice or page doesn&apos;t exist, or its share link was turned off.</p>
        <Link className="btn" href="/">Go to Invoice Hub</Link>
      </div>
    </main>
  );
}
