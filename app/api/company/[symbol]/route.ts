import { NextResponse } from "next/server";

import { getCompanySnapshotRecord } from "@/lib/finance/repository";

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await context.params;
  const normalized = symbol.trim().toUpperCase();
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";

  if (!normalized) {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }

  const snapshotRecord = await getCompanySnapshotRecord(normalized, { refresh });
  return NextResponse.json(snapshotRecord);
}
