import { getDemoSnapshot } from "@/lib/finance/demo-data";
import { parseAlphaVantageSnapshot } from "@/lib/finance/parser";

const BASE_URL = "https://www.alphavantage.co/query";

export async function fetchCompanySnapshot(symbol: string) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    return getDemoSnapshot(symbol);
  }

  try {
    const [overview, income, balance, cashflow, earnings] = await Promise.all([
      fetchFunction("OVERVIEW", symbol, apiKey),
      fetchFunction("INCOME_STATEMENT", symbol, apiKey),
      fetchFunction("BALANCE_SHEET", symbol, apiKey),
      fetchFunction("CASH_FLOW", symbol, apiKey),
      fetchFunction("EARNINGS", symbol, apiKey)
    ]);

    return parseAlphaVantageSnapshot({
      overview,
      income,
      balance,
      cashflow,
      earnings
    });
  } catch (error) {
    console.error("Falling back to demo financial data.", error);
    return getDemoSnapshot(symbol);
  }
}

async function fetchFunction(functionName: string, symbol: string, apiKey: string) {
  const params = new URLSearchParams({
    function: functionName,
    symbol,
    apikey: apiKey
  });

  const response = await fetch(`${BASE_URL}?${params.toString()}`, {
    next: { revalidate: 60 * 30 }
  });

  if (!response.ok) {
    throw new Error(`Alpha Vantage request failed for ${functionName}.`);
  }

  const payload = await response.json();

  if (payload.Note || payload.Information || payload["Error Message"]) {
    throw new Error(payload.Note ?? payload.Information ?? payload["Error Message"]);
  }

  return payload;
}
