import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes: redirect to /login if not authenticated
  // Sample demo items (/item/sample-*) and public shared notes (/s/*) are open for exploration
  const isSampleItem = request.nextUrl.pathname.startsWith("/item/sample-");
  const isPublicShare = request.nextUrl.pathname.startsWith("/s/");
  const isProtected =
    (
      request.nextUrl.pathname.startsWith("/library") ||
      request.nextUrl.pathname.startsWith("/add") ||
      request.nextUrl.pathname.startsWith("/search") ||
      request.nextUrl.pathname.startsWith("/item")
    ) &&
    !isSampleItem &&
    !isPublicShare;

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // If logged in and visiting login, redirect to intended target or library
  if (user && request.nextUrl.pathname === "/login") {
    const nextPath = request.nextUrl.searchParams.get("next") || "/library";
    const url = request.nextUrl.clone();
    url.pathname = nextPath.startsWith("/") ? nextPath : "/library";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
