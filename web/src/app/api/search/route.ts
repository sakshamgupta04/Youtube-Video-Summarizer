import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const itemId = searchParams.get("item_id") || null;
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  return handleSearch(query, itemId, limit);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query || body.q || "";
    const itemId = body.itemId || body.item_id || null;
    const limit = parseInt(body.limit || "10", 10);

    return handleSearch(query, itemId, limit);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}

async function handleSearch(query: string, itemId: string | null, limit: number) {
  if (!query.trim()) {
    return NextResponse.json({ results: [], mode: "none" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8000";
  const workerSecret = process.env.WORKER_SECRET || "echonotes-shared-secret-key-384";

  // 1. Attempt semantic embedding search via worker
  try {
    const embedRes = await fetch(`${workerUrl}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Secret": workerSecret,
      },
      body: JSON.stringify({ text: query.trim() }),
      signal: AbortSignal.timeout(5000), // 5-second timeout
    });

    if (embedRes.ok) {
      const { embedding } = await embedRes.json();
      if (embedding && Array.isArray(embedding)) {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "match_chunks",
          {
            q: embedding,
            n: limit,
            only_item: itemId || undefined,
          }
        );

        if (!rpcError && rpcData) {
          const enriched = await enrichResultsWithItems(supabase, rpcData);
          return NextResponse.json({
            results: enriched,
            mode: "semantic",
          });
        }
      }
    }
  } catch (err) {
    console.warn("Semantic embedding failed, falling back to keyword search:", err);
  }

  // 2. Fallback: ilike keyword search
  try {
    let fallbackQuery = supabase
      .from("chunks")
      .select("item_id, start_sec, text")
      .ilike("text", `%${query.trim()}%`)
      .limit(limit);

    if (itemId) {
      fallbackQuery = fallbackQuery.eq("item_id", itemId);
    }

    const { data: keywordData, error: keywordError } = await fallbackQuery;

    if (keywordError) {
      return NextResponse.json({ error: keywordError.message }, { status: 500 });
    }

    const rawResults = (keywordData || []).map((row) => ({
      ...row,
      score: 1.0,
    }));
    const enriched = await enrichResultsWithItems(supabase, rawResults);

    return NextResponse.json({
      results: enriched,
      mode: "keyword",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Search failed." },
      { status: 500 }
    );
  }
}

async function enrichResultsWithItems(supabase: any, results: any[]) {
  if (!results.length) return [];
  const itemIds = Array.from(new Set(results.map((r) => r.item_id).filter(Boolean)));
  if (!itemIds.length) return results;

  const { data: items } = await supabase
    .from("items")
    .select("id, title, source_type")
    .in("id", itemIds);

  const itemMap = new Map<string, { title?: string | null; source_type?: string }>(
    (items || []).map((it: any) => [it.id, it])
  );

  return results.map((r) => {
    const item = itemMap.get(r.item_id);
    return {
      ...r,
      item_title: item?.title || "Untitled Item",
      source_type: item?.source_type || "video",
    };
  });
}
