import { NextResponse } from "next/server";
import { readLocalObject } from "@/lib/object-storage";

interface StorageParams {
  key?: string[];
}

export async function GET(_: Request, context: { params: Promise<StorageParams> }) {
  const params = await context.params;
  const keySegments = Array.isArray(params.key) ? params.key : [];
  let storageKey = "";

  try {
    storageKey = keySegments.map((segment) => decodeURIComponent(segment)).join("/");
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!storageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const object = await readLocalObject(storageKey);
  if (!object) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const headers = new Headers({
    "content-type": object.contentType
  });
  if (object.cacheControlMaxAge !== null) {
    headers.set("cache-control", `public, max-age=${Math.floor(object.cacheControlMaxAge)}`);
  }

  return new NextResponse(object.body, {
    status: 200,
    headers
  });
}
