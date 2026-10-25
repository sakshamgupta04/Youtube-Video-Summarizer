import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import ShareClient from "./share-client";

interface Chapter {
  start: number;
  end: number;
  title: string;
  summary: string;
}

interface SharedPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedItemPage({ params }: SharedPageProps) {
  const { token } = await params;

  if (!token) {
    notFound();
  }

  // Use the admin service client on the server side only to read by share_token
  const adminSupabase = createAdminClient();
  const { data: item, error } = await adminSupabase
    .from("items")
    .select("title, duration_sec, source_type, summary, key_points, chapters, created_at")
    .eq("share_token", token)
    .single();

  if (error || !item) {
    notFound();
  }

  const chapters = (item.chapters as Chapter[]) || [];
  const keyPoints = (item.key_points as string[]) || [];

  return (
    <ShareClient
      title={item.title || "Shared Summary"}
      durationSec={item.duration_sec}
      sourceType={item.source_type}
      summary={item.summary || ""}
      keyPoints={keyPoints}
      chapters={chapters}
      createdAt={item.created_at}
    />
  );
}
