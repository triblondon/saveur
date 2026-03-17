import { ImportUrlForm } from "@/components/ImportUrlForm";
import styles from "@/app/styles/page.module.css";

export default function ImportPage() {
  return (
    <section className={styles.page}>
      <h2 className={styles.heading}>Import from URL</h2>
      <p className={`muted ${styles.description}`}>
        Phase 1 supports Gousto URLs with partial autofill fallback.
      </p>
      <ImportUrlForm />
    </section>
  );
}
