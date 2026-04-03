"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CollectionDetail, CollectionSummary } from "@/lib/types";
import styles from "@/components/styles/collection-controls.module.css";

interface CollectionOwnerControlsProps {
  collection: CollectionDetail;
  writableCollections: CollectionSummary[];
}

type Panel = "edit" | "share" | "delete" | null;

export function CollectionOwnerControls({ collection, writableCollections }: CollectionOwnerControlsProps) {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? "");
  const [visibility, setVisibility] = useState<"private" | "public">(collection.visibility);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"COLLABORATOR" | "VIEWER">("COLLABORATOR");
  const [deleteMode, setDeleteMode] = useState<"DELETE_RECIPES" | "REASSIGN">("DELETE_RECIPES");
  const [targetCollectionId, setTargetCollectionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reassignmentTargets = useMemo(
    () => writableCollections.filter((entry) => entry.id !== collection.id),
    [collection.id, writableCollections]
  );

  function togglePanel(next: Exclude<Panel, null>) {
    setError(null);
    setActivePanel((previous) => (previous === next ? null : next));
  }

  async function updateCollection() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/collections/${collection.id}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          visibility
        })
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to save collection");
      }
      router.refresh();
      setActivePanel(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save collection");
    } finally {
      setSaving(false);
    }
  }

  async function addMember() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/collections/${collection.id}/members`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          email: memberEmail.trim(),
          role: memberRole
        })
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to add member");
      }
      setMemberEmail("");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to add member");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(userId: string) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/collections/${collection.id}/members`, {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          userId
        })
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to remove member");
      }
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to remove member");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCollection() {
    if (!window.confirm("Delete this collection?")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/collections/${collection.id}`, {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          mode: deleteMode,
          targetCollectionId: deleteMode === "REASSIGN" ? targetCollectionId : undefined
        })
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Unable to delete collection");
      }
      router.push("/collections");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to delete collection");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`card ${styles.controlsFooter}`}>
      <div className={styles.actionsRow}>
        <button type="button" className="secondary" onClick={() => togglePanel("edit")}>
          Owner controls
        </button>
        <button type="button" className="secondary" onClick={() => togglePanel("share")}>
          Share collection
        </button>
        <button type="button" className="secondary" onClick={() => togglePanel("delete")}>
          Delete collection
        </button>
      </div>

      {activePanel === "edit" ? (
        <div className={`card ${styles.panel}`}>
          <h3 className={styles.heading}>Owner controls</h3>
          <div className={styles.row}>
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              Visibility
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as "private" | "public")}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </label>
          </div>
          <label>
            Description
            <textarea
              value={description}
              rows={2}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className={styles.row}>
            <button type="button" onClick={() => void updateCollection()} disabled={saving}>
              {saving ? "Saving..." : "Save collection"}
            </button>
            <button type="button" className="secondary" onClick={() => setActivePanel(null)} disabled={saving}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {activePanel === "share" ? (
        <div className={`card ${styles.panel}`}>
          <h3 className={styles.heading}>Share collection</h3>
          <div className={styles.row}>
            <label>
              User email
              <input value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} />
            </label>
            <label>
              Role
              <select
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value as "COLLABORATOR" | "VIEWER")}
              >
                <option value="COLLABORATOR">Collaborator</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </label>
          </div>
          <div className={styles.row}>
            <button type="button" className="secondary" onClick={() => void addMember()} disabled={saving}>
              Add member
            </button>
            <button type="button" className="secondary" onClick={() => setActivePanel(null)} disabled={saving}>
              Close
            </button>
          </div>

          <div className={styles.memberList}>
            {collection.collaborators.map((user) => (
              <div key={`collab-${user.id}`} className={styles.memberRow}>
                <span>
                  {user.name} ({user.email}) · Collaborator
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void removeMember(user.id)}
                  disabled={saving}
                >
                  Remove
                </button>
              </div>
            ))}
            {collection.viewers.map((user) => (
              <div key={`viewer-${user.id}`} className={styles.memberRow}>
                <span>
                  {user.name} ({user.email}) · Viewer
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void removeMember(user.id)}
                  disabled={saving}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activePanel === "delete" ? (
        <div className={`card ${styles.panel}`}>
          <h3 className={styles.heading}>Delete collection</h3>
          <label>
            Delete mode
            <select
              value={deleteMode}
              onChange={(event) => setDeleteMode(event.target.value as "DELETE_RECIPES" | "REASSIGN")}
            >
              <option value="DELETE_RECIPES">Delete all recipes in this collection</option>
              <option value="REASSIGN">Reassign recipes to another writable collection</option>
            </select>
          </label>
          {deleteMode === "REASSIGN" ? (
            <label>
              Reassign to
              <select
                value={targetCollectionId}
                onChange={(event) => setTargetCollectionId(event.target.value)}
              >
                <option value="">Select collection</option>
                {reassignmentTargets.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className={styles.row}>
            <button
              type="button"
              className="secondary"
              onClick={() => void deleteCollection()}
              disabled={saving}
            >
              Delete collection
            </button>
            <button type="button" className="secondary" onClick={() => setActivePanel(null)} disabled={saving}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </article>
  );
}
