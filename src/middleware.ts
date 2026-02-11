import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Phase 1-5: No auth enforced (admin-only development)
// Phase 8: Enable Clerk auth and route protection for customer routes

const hasClerkKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isCustomerRoute = createRouteMatcher(["/create(.*)", "/books(.*)"]);

function noopMiddleware(request: NextRequest) {
  void request;
  return NextResponse.next();
}

export default hasClerkKey
  ? clerkMiddleware(async (auth, req) => {
      if (isCustomerRoute(req)) {
        await auth.protect();
      }
    })
  : noopMiddleware;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
