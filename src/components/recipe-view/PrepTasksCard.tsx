import ReactMarkdown from "react-markdown";
import type { Recipe } from "@/lib/types";
import styles from "@/components/styles/recipe-view.module.css";

interface PrepTasksCardProps {
  prepTasks: Recipe["prepTasks"];
}

export function PrepTasksCard({ prepTasks }: PrepTasksCardProps) {
  if (prepTasks.length === 0) {
    return null;
  }

  return (
    <article className="card">
      <h3 className={styles.prepTitle}>Prep tasks</h3>
      <ol className={styles.prepList}>
        {prepTasks.map((task, index) => (
          <li key={`${index}-${task.preparationName}`} className={styles.prepItem}>
            <strong>{task.preparationName}</strong>
            {task.detail ? (
              <div className={styles.prepDetail}>
                <ReactMarkdown>{task.detail}</ReactMarkdown>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </article>
  );
}

