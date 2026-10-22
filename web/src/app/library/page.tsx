import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LibraryClient from "./library-client";

function LibraryLoading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="spinner" />
    </div>
  );
}

async function LibraryContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <LibraryClient userEmail={user.email ?? ""} />;
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<LibraryLoading />}>
      <LibraryContent />
    </Suspense>
  );
}
