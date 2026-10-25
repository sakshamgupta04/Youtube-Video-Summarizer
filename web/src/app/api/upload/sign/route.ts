import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileName } = body;

    if (!fileName) {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 });
    }

    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${user.id}/${Date.now()}_${sanitizedName}`;

    // Create signed upload URL using admin client with service key to bypass storage RLS
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase.storage
      .from("uploads")
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to create signed upload URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      storagePath,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
