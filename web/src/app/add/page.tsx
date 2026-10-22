import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AddItemClient from "./add-client";

function AddLoading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="spinner" />
    </div>
  );
}

async function AddContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <AddItemClient userId={user.id} userEmail={user.email ?? ""} />;
}

export default function AddPage() {
  return (
    <Suspense fallback={<AddLoading />}>
      <AddContent />
    </Suspense>
  );
}
