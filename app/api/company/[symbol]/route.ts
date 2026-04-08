import { NextResponse } from "next/server";

import { fetchCompanySnapshot } from "@/lib/finance/alpha-vantage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await context.params;
  const normalized = symbol.trim().toUpperCase();

  if (!normalized) {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }

  const snapshot = await fetchCompanySnapshot(normalized);
  return NextResponse.json(snapshot);
}
