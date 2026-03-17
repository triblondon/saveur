import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Photo upload not implemented in this scaffold"
    },
    { status: 501 }
  );
}
