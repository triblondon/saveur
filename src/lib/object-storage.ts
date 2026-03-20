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
const LOCAL_OBJECT_DIR = path.join(process.cwd(), "data", "objects");

interface LocalObjectMetadata {
  contentType: string;
  cacheControlMaxAge?: number;
}

interface LocalObjectReadResult {
  body: Buffer;
  contentType: string;
  cacheControlMaxAge: number | null;
}

function sanitizeStorageKey(storageKey: string): string {
  const normalized = path.posix.normalize(storageKey).replace(/^\/+/, "");
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`Invalid storage key: ${storageKey}`);
  }

  return normalized;
}

function localObjectPath(storageKey: string): string {
  return path.join(LOCAL_OBJECT_DIR, sanitizeStorageKey(storageKey));
}

function localObjectMetaPath(storageKey: string): string {
  return `${localObjectPath(storageKey)}.meta.json`;
}

function localObjectPublicUrl(storageKey: string): string {
  const safe = sanitizeStorageKey(storageKey)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/storage/${safe}`;
}

export function isObjectStorageConfigured(): boolean {
  return process.env.NODE_ENV === "production" && Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function uploadObject(input: UploadObjectInput): Promise<UploadObjectResult> {
  if (isObjectStorageConfigured()) {
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

  const objectPath = localObjectPath(input.storageKey);
  await fs.mkdir(path.dirname(objectPath), { recursive: true });
  await fs.writeFile(objectPath, input.body);

  const metadata: LocalObjectMetadata = {
    contentType: input.contentType
  };
  if (typeof input.cacheControlMaxAge === "number") {
    metadata.cacheControlMaxAge = input.cacheControlMaxAge;
  }

  await fs.writeFile(localObjectMetaPath(input.storageKey), JSON.stringify(metadata), "utf8");

  return {
    storageKey: input.storageKey,
    publicUrl: localObjectPublicUrl(input.storageKey)
  };
}

export async function readLocalObject(storageKey: string): Promise<LocalObjectReadResult | null> {
  const objectPath = localObjectPath(storageKey);
  const metaPath = localObjectMetaPath(storageKey);

  try {
    const [body, metaRaw] = await Promise.all([
      fs.readFile(objectPath),
      fs.readFile(metaPath, "utf8")
    ]);

    const parsed = JSON.parse(metaRaw) as Partial<LocalObjectMetadata>;
    const contentType =
      typeof parsed.contentType === "string" && parsed.contentType.trim()
        ? parsed.contentType
        : "application/octet-stream";
    const cacheControlMaxAge =
      typeof parsed.cacheControlMaxAge === "number" && parsed.cacheControlMaxAge >= 0
        ? parsed.cacheControlMaxAge
        : null;

    return {
      body,
      contentType,
      cacheControlMaxAge
    };
  } catch {
    return null;
  }
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
