import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect("/auth/signin")
  }

  if (session.user?.role === "ADMIN") {
    redirect("/dashboard/admin")
  }

  redirect("/dashboard/employee")
}