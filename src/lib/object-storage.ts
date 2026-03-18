import { promises as fs } from "node:fs";
import path from "node:path";
import { put } from "@vercel/blob";

interface UploadObjectInput {
  storageKey: string;
  body: Buffer | string;
  contentType: string;
  cacheControlMaxAge?: number;
}

interface UploadObjectResult {
  storageKey: string;
  publicUrl: string | null;
}

const LOCAL_SNAPSHOT_DIR = path.join(process.cwd(), "data", "snapshots");

export function isObjectStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function uploadObject(input: UploadObjectInput): Promise<UploadObjectResult> {
  if (!isObjectStorageConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }

  const blob = await put(input.storageKey, input.body, {
    access: "public",
    addRandomSuffix: false,
    contentType: input.contentType,
    cacheControlMaxAge: input.cacheControlMaxAge,
    token: process.env.BLOB_READ_WRITE_TOKEN
  });

  return {
    storageKey: input.storageKey,
    publicUrl: blob.url
  };
}

export async function saveSnapshotHtml(storageKey: string, html: string): Promise<void> {
  if (isObjectStorageConfigured()) {
    await uploadObject({
      storageKey,
      body: html,
      contentType: "text/html; charset=utf-8",
      cacheControlMaxAge: 0
    });
    return;
  }

  await fs.mkdir(LOCAL_SNAPSHOT_DIR, { recursive: true });
  const localPath = path.join(LOCAL_SNAPSHOT_DIR, path.basename(storageKey));
  await fs.writeFile(localPath, html, "utf8");
}
