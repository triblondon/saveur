import { NewRecipeForm } from "@/components/NewRecipeForm";
import styles from "@/app/styles/page.module.css";

export default function NewRecipePage() {
  return (
    <section className={styles.page}>
      <h2 className={styles.heading}>New recipe</h2>
      <p className={`muted ${styles.description}`}>
        Manual entry supports prep tasks and timed cook steps.
      </p>
      <NewRecipeForm />
    </section>
  );
}
