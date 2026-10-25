import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ItemClient from "./item-client";

import { SAMPLE_ITEMS } from "@/lib/sample-data";

interface ItemPageProps {
  params: Promise<{ id: string }>;
}

export default async function ItemPage({ params }: ItemPageProps) {
  const { id } = await params;

  // 1. Check if visitor is viewing one of the 3 pre-processed sample library videos
  if (SAMPLE_ITEMS[id]) {
    const sampleItem = SAMPLE_ITEMS[id];
    return (
      <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><span className="spinner" /></div>}>
        <ItemClient item={sampleItem as any} mediaUrl={null} userEmail="visitor@echonotes.ai" />
      </Suspense>
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: item, error } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !item) {
    notFound();
  }

  // Generate signed playback URL if uploaded audio or video
  let mediaUrl: string | null = null;
  if (item.storage_path && (item.source_type === "audio" || item.source_type === "video")) {
    const { data: signedData } = await supabase.storage
      .from("uploads")
      .createSignedUrl(item.storage_path, 7200); // 2 hours
    mediaUrl = signedData?.signedUrl || null;
  }

  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><span className="spinner" /></div>}>
      <ItemClient item={item} mediaUrl={mediaUrl} userEmail={user.email || ""} />
    </Suspense>
  );
}
