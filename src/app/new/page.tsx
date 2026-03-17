import { NewRecipeForm } from "@/components/NewRecipeForm";

export default function NewRecipePage() {
  return (
    <section>
      <h2>New recipe</h2>
      <p className="muted">Manual entry supports prep tasks and timed cook steps.</p>
      <NewRecipeForm />
    </section>
  );
}
