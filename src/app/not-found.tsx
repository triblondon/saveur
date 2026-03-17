import Link from "next/link";

export default function NotFound() {
  return (
    <section className="card">
      <h2>Recipe not found</h2>
      <p className="muted">The recipe may have been deleted or never existed.</p>
      <Link href="/">Back to home</Link>
    </section>
  );
}
