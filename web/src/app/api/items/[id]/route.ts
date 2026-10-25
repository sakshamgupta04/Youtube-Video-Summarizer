import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch item to verify ownership and retrieve storage_path
    const { data: item, error: fetchError } = await supabase
      .from("items")
      .select("id, user_id, storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !item) {
      return NextResponse.json(
        { error: "Item not found or unauthorized to delete" },
        { status: 404 }
      );
    }

    // 2. If item has an uploaded file in Supabase storage, remove it to reclaim disk space
    if (item.storage_path) {
      try {
        const adminSupabase = createAdminClient();
        const { error: storageError } = await adminSupabase.storage
          .from("uploads")
          .remove([item.storage_path]);

        if (storageError) {
          console.warn("Storage removal warning:", storageError.message);
        }
      } catch (storageErr) {
        console.warn("Failed to remove file from storage bucket:", storageErr);
      }
    }

    // 3. Delete database record (chunks cascade delete automatically via foreign key)
    const { error: deleteError } = await supabase
      .from("items")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete item" },
      { status: 500 }
    );
  }
}
