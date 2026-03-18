import { promises as fs } from "node:fs";
import path from "node:path";
import { Storage } from "@google-cloud/storage";

interface UploadObjectInput {
  storageKey: string;
  body: Buffer | string;
  contentType: string;
  cacheControl?: string;
}

interface UploadObjectResult {
  storageKey: string;
  publicUrl: string | null;
}

const LOCAL_SNAPSHOT_DIR = path.join(process.cwd(), "data", "snapshots");

let storageClient: Storage | null = null;

function parseJsonCredentials(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  }
}

function getGcsBucketName(): string | null {
  return process.env.GCS_BUCKET?.trim() || null;
}

function getStorageClient(): Storage {
  if (storageClient) {
    return storageClient;
  }

  const rawCredentials =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ?? process.env.GCS_CREDENTIALS_JSON ?? null;

  const credentials = rawCredentials ? parseJsonCredentials(rawCredentials) : undefined;
  storageClient = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCS_PROJECT_ID,
    credentials
  });

  return storageClient;
}

function encodePathSegments(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function toPublicUrl(bucket: string, storageKey: string): string {
  const base = process.env.GCS_PUBLIC_BASE_URL?.trim();
  const encoded = encodePathSegments(storageKey);

  if (base) {
    return `${base.replace(/\/$/, "")}/${encoded}`;
  }

  return `https://storage.googleapis.com/${bucket}/${encoded}`;
}

export function isObjectStorageConfigured(): boolean {
  return Boolean(getGcsBucketName());
}

export async function uploadObject(input: UploadObjectInput): Promise<UploadObjectResult> {
  const bucket = getGcsBucketName();
  if (!bucket) {
    throw new Error("GCS_BUCKET is not configured");
  }

  const storage = getStorageClient();
  const file = storage.bucket(bucket).file(input.storageKey);

  const options: {
    metadata: { contentType: string; cacheControl?: string };
    resumable: boolean;
  } = {
    resumable: false,
    metadata: {
      contentType: input.contentType,
      cacheControl: input.cacheControl
    }
  };

  if (Buffer.isBuffer(input.body)) {
    await file.save(input.body, options);
  } else {
    await file.save(Buffer.from(input.body, "utf8"), options);
  }

  return {
    storageKey: input.storageKey,
    publicUrl: toPublicUrl(bucket, input.storageKey)
  };
}

export async function saveSnapshotHtml(storageKey: string, html: string): Promise<void> {
  if (isObjectStorageConfigured()) {
    await uploadObject({
      storageKey,
      body: html,
      contentType: "text/html; charset=utf-8",
      cacheControl: "private, max-age=0, no-store"
    });
    return;
  }

  await fs.mkdir(LOCAL_SNAPSHOT_DIR, { recursive: true });
  const localPath = path.join(LOCAL_SNAPSHOT_DIR, path.basename(storageKey));
  await fs.writeFile(localPath, html, "utf8");
}
