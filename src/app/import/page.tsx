import { ImportUrlForm } from "@/components/ImportUrlForm";
import styles from "@/app/styles/page.module.css";

export default function ImportPage() {
  return (
    <section className={styles.page}>
      <h2 className={styles.heading}>Import from URL</h2>
      <p className={`muted ${styles.description}`}>
        LLM import supports recipe URLs from any source with schema-guided extraction.
      </p>
      <ImportUrlForm />
    </section>
  );
}
