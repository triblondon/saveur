import { ImportUrlForm } from "@/components/ImportUrlForm";

export default function ImportPage() {
  return (
    <section>
      <h2>Import from URL</h2>
      <p className="muted">Phase 1 supports Gousto URLs with partial autofill fallback.</p>
      <ImportUrlForm />
    </section>
  );
}
