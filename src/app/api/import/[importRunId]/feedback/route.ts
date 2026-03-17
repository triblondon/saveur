import { NextResponse } from "next/server";
import { listImportFeedback } from "@/lib/store";

export async function GET(_: Request, context: { params: Promise<{ importRunId: string }> }) {
  const params = await context.params;
  const feedback = await listImportFeedback(params.importRunId);

  return NextResponse.json({ feedback });
}
