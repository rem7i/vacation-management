import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isOnAdmin = req.nextUrl.pathname.startsWith("/admin")
  const isOnAuth = req.nextUrl.pathname.startsWith("/auth")
  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard")
  const isOnApi = req.nextUrl.pathname.startsWith("/api")

  const role = req.auth?.user?.role
  const dashboardUrl = role === "ADMIN" ? "/dashboard/admin" : "/dashboard/employee"

  // Allow access to auth pages if not logged in
  if (isOnAuth) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL(dashboardUrl, req.nextUrl))
    }
    return NextResponse.next()
  }

  // Redirect to sign in if not logged in
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/auth/signin", req.nextUrl))
  }

  // Admin routes - only admins can access
  if (isOnAdmin && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard/employee", req.nextUrl))
  }

  // API routes - check admin access for admin APIs
  if (isOnApi && req.nextUrl.pathname.startsWith("/api/admin") && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!api/auth|api/seed|_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
}