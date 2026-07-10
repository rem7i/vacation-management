import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const employee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    include: {
      user: true,
      vacationBalances: {
        where: { year: new Date().getFullYear() },
        include: { vacationType: true },
      },
      vacationRequests: {
        include: { vacationType: true },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  const currentYear = new Date().getFullYear()
  const vacationTypes = await prisma.vacationType.findMany({ where: { isActive: true } })

  // Calculate balances with all vacation types
  const balances = vacationTypes.map((vt: { id: string; name: string; color: string; defaultDays: number }) => {
    const balance = employee.vacationBalances.find((b: { vacationTypeId: string; totalDays: number; usedDays: number; pendingDays: number }) => b.vacationTypeId === vt.id)
    return {
      vacationType: vt,
      totalDays: balance?.totalDays ?? 0,
      usedDays: balance?.usedDays ?? 0,
      pendingDays: balance?.pendingDays ?? 0,
      availableDays: (balance?.totalDays ?? 0) - (balance?.usedDays ?? 0) - (balance?.pendingDays ?? 0),
    }
  })

  // Pending requests
  const pendingRequests = employee.vacationRequests.filter((r: { status: string }) => r.status === "PENDING")

  // Recent requests (last 10)
  const recentRequests = employee.vacationRequests.slice(0, 10)

  // Stats
  const totalApprovedDays = employee.vacationRequests
    .filter((r: { status: string; totalDays: number }) => r.status === "APPROVED")
    .reduce((sum: number, r: { totalDays: number }) => sum + r.totalDays, 0)

  const totalPendingDays = employee.vacationRequests
    .filter((r: { status: string; totalDays: number }) => r.status === "PENDING")
    .reduce((sum: number, r: { totalDays: number }) => sum + r.totalDays, 0)

  const totalRejectedDays = employee.vacationRequests
    .filter((r: { status: string; totalDays: number }) => r.status === "REJECTED")
    .reduce((sum: number, r: { totalDays: number }) => sum + r.totalDays, 0)

  return NextResponse.json({
    employee: {
      id: employee.id,
      employeeId: employee.employeeId,
      department: employee.department,
      position: employee.position,
      hireDate: employee.hireDate,
      isActive: employee.isActive,
      user: {
        id: employee.user.id,
        name: employee.user.name,
        email: employee.user.email,
      },
    },
    balances,
    pendingRequests,
    recentRequests,
    stats: {
      totalApprovedDays,
      totalPendingDays,
      totalRejectedDays,
      totalRequests: employee.vacationRequests.length,
    },
  })
}