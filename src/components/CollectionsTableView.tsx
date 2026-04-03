"use client";

import Link from "next/link";
import { useState } from "react";
import type { CollectionSummary } from "@/lib/types";
import { CollectionQuickCreateForm } from "@/components/CollectionQuickCreateForm";
import styles from "@/app/styles/collections.module.css";

interface CollectionsTableViewProps {
  collections: CollectionSummary[];
}

function ownerLabel(collection: CollectionSummary): string {
  return collection.role === "OWNER" ? "You" : "Shared";
}

export function CollectionsTableView({ collections }: CollectionsTableViewProps) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <section className={styles.page}>
      <div className={styles.listTopBar}>
        <h2 className={styles.listHeading}>Collections</h2>
        <button
          type="button"
          className="secondary"
          onClick={() => setShowCreate((previous) => !previous)}
        >
          {showCreate ? "Close" : "+ New collection"}
        </button>
      </div>

      {showCreate ? <CollectionQuickCreateForm /> : null}

      {collections.length === 0 ? (
        <p className={`muted ${styles.empty}`}>No collections yet.</p>
      ) : (
        <div className={`card ${styles.tableWrap}`}>
          <table className={styles.collectionsTable}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner</th>
                <th>Recipes</th>
                <th>Visibility</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.id}>
                  <td data-label="Name">
                    <Link href={`/collections/${collection.id}` as never} className={styles.tableLink}>
                      {collection.name}
                    </Link>
                  </td>
                  <td data-label="Owner">{ownerLabel(collection)}</td>
                  <td data-label="Recipes">{collection.recipeCount}</td>
                  <td data-label="Visibility">
                    {collection.visibility === "public" ? "Public" : "Private"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
