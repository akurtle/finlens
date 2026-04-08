import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { buildFallbackAnalysis } from "@/lib/finance/analysis";
import type { CompanySnapshot } from "@/lib/types";

const AnalysisSchema = z.object({
  answer: z.string(),
  keyPoints: z.array(z.string()).min(2).max(4),
  citations: z
    .array(
      z.object({
        label: z.string(),
        detail: z.string(),
        source: z.string(),
        period: z.string().nullable(),
        metric: z.string().nullable(),
        value: z.string().nullable()
      })
    )
    .max(6),
  confidence: z.enum(["high", "medium", "low"])
});

export async function POST(request: Request) {
  const body = (await request.json()) as {
    question?: string;
    snapshot?: CompanySnapshot;
  };

  if (!body.question || !body.snapshot) {
    return NextResponse.json({ error: "Question and snapshot are required." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(buildFallbackAnalysis(body.question, body.snapshot));
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are FinLens, a financial research copilot. Answer only from the provided parsed dataset. Do not invent values. Keep the answer concise, mention directionality when relevant, and produce citations tied to the supplied periods."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Question: ${body.question}`,
                `Company: ${body.snapshot.profile.symbol} - ${body.snapshot.profile.name}`,
                "Dataset:",
                JSON.stringify(trimSnapshot(body.snapshot), null, 2)
              ].join("\n")
            }
          ]
        }
      ],
      text: {
        format: zodTextFormat(AnalysisSchema, "finlens_analysis")
      }
    });

    return NextResponse.json(response.output_parsed);
  } catch (error) {
    console.error("OpenAI analysis failed, using fallback.", error);
    return NextResponse.json(buildFallbackAnalysis(body.question, body.snapshot));
  }
}

function trimSnapshot(snapshot: CompanySnapshot) {
  return {
    profile: {
      symbol: snapshot.profile.symbol,
      name: snapshot.profile.name,
      sector: snapshot.profile.sector,
      industry: snapshot.profile.industry,
      source: snapshot.profile.source
    },
    metrics: snapshot.metrics,
    quarterly: snapshot.quarterly.slice(0, 8),
    annual: snapshot.annual.slice(0, 3)
  };
}
