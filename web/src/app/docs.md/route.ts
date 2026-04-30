import { NextResponse } from "next/server";
import { DOCS_MARKDOWN } from "../../lib/docs-content";

export const dynamic = "force-dynamic";

export async function GET() {
  return new NextResponse(DOCS_MARKDOWN, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
