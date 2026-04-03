import { NextResponse } from "next/server";
import path from "node:path";
import { getCurrentUser, touchSession } from "@/lib/auth/current-user";
import { getRecipeByIdForUser, updateRecipeForUser } from "@/lib/store";
import { uploadObject } from "@/lib/object-storage";
import { forbiddenResponse, routeErrorResponse, unauthorizedResponse } from "@/lib/api/route-helpers";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  const base = path.basename(name).trim().toLowerCase();
  const safe = base.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-");
  return safe || "photo";
}

function extensionForType(contentType: string): string {
  if (contentType === "image/jpeg") {
    return ".jpg";
  }

  if (contentType === "image/png") {
    return ".png";
  }

  if (contentType === "image/webp") {
    return ".webp";
  }

  return ".bin";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorizedResponse();
  }

  const params = await context.params;
  const recipe = await getRecipeByIdForUser(params.id, user.id);
  if (!recipe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const entry = formData.get("file") ?? formData.get("photo");

  if (!(entry instanceof File)) {
    return NextResponse.json({ error: "Expected multipart form field `file`" }, { status: 400 });
  }

  if (!entry.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are supported" }, { status: 400 });
  }

  if (entry.size <= 0) {
    return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
  }

  if (entry.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Image exceeds max size (${MAX_FILE_SIZE_BYTES} bytes)` },
      { status: 413 }
    );
  }

  const extension = path.extname(entry.name) || extensionForType(entry.type);
  const safeFilename = sanitizeFilename(entry.name.replace(/\.[^.]+$/, "")) + extension;
  const storageKey = `photos/${recipe.id}/${Date.now()}-${safeFilename}`;
  const bytes = Buffer.from(await entry.arrayBuffer());

  const stored = await uploadObject({
    storageKey,
    body: bytes,
    contentType: entry.type,
    cacheControlMaxAge: 31_536_000
  });

  if (!stored.publicUrl) {
    return NextResponse.json(
      { error: "Upload succeeded but no public URL could be created for this object." },
      { status: 500 }
    );
  }

  try {
    const updated = await updateRecipeForUser(user.id, recipe.id, { heroPhotoUrl: stored.publicUrl });
    if (!updated) {
      return NextResponse.json({ error: "Recipe not found after upload" }, { status: 404 });
    }

    return touchSession(NextResponse.json({
      recipe: updated
    }), user);
  } catch (error) {
    if (error instanceof Error && error.message.includes("No write access")) {
      return forbiddenResponse();
    }
    return routeErrorResponse(error, "Unable to update recipe photo");
  }
}
