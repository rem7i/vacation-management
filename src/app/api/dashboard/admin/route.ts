import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const currentYear = new Date().getFullYear()

  // Get all employees with their balances and requests
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    include: {
      user: { select: { id: true, name: true, email: true } },
      vacationBalances: {
        where: { year: currentYear },
        include: { vacationType: true },
      },
      vacationRequests: {
        include: { vacationType: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Get all vacation types
  const vacationTypes = await prisma.vacationType.findMany({ where: { isActive: true } })

  // Get pending requests for admin queue
  const pendingRequests = await prisma.vacationRequest.findMany({
    where: { status: "PENDING" },
    include: {
      employee: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      vacationType: true,
    },
    orderBy: { createdAt: "asc" },
  })

  // Get recent approval/rejection history
  const processedRequests = await prisma.vacationRequest.findMany({
    where: { status: { in: ["APPROVED", "REJECTED"] } },
    include: {
      employee: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      vacationType: true,
      approvedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { approvedAt: "desc" },
    take: 50,
  })

  // Calculate employee overview
  const employeeOverview = employees.map((emp: typeof employees[0]) => {
    const balances = vacationTypes.map((vt: typeof vacationTypes[0]) => {
      const balance = emp.vacationBalances.find((b: { vacationTypeId: string; totalDays: number; usedDays: number; pendingDays: number }) => b.vacationTypeId === vt.id)
      return {
        vacationType: vt,
        totalDays: balance?.totalDays ?? 0,
        usedDays: balance?.usedDays ?? 0,
        pendingDays: balance?.pendingDays ?? 0,
        availableDays: (balance?.totalDays ?? 0) - (balance?.usedDays ?? 0) - (balance?.pendingDays ?? 0),
      }
    })

    const totalApprovedDays = emp.vacationRequests
      .filter((r: { status: string; totalDays: number }) => r.status === "APPROVED")
      .reduce((sum: number, r: { totalDays: number }) => sum + r.totalDays, 0)

    const totalPendingDays = emp.vacationRequests
      .filter((r: { status: string; totalDays: number }) => r.status === "PENDING")
      .reduce((sum: number, r: { totalDays: number }) => sum + r.totalDays, 0)

    const totalRejectedDays = emp.vacationRequests
      .filter((r: { status: string; totalDays: number }) => r.status === "REJECTED")
      .reduce((sum: number, r: { totalDays: number }) => sum + r.totalDays, 0)

    return {
      id: emp.id,
      employeeId: emp.employeeId,
      department: emp.department,
      position: emp.position,
      hireDate: emp.hireDate,
      user: emp.user,
      balances,
      stats: {
        totalApprovedDays,
        totalPendingDays,
        totalRejectedDays,
        totalRequests: emp.vacationRequests.length,
      },
    }
  })

  // Company-wide statistics
  const totalEmployees = employees.length
  const totalPendingRequests = pendingRequests.length
  const totalApprovedRequests = processedRequests.filter((r: { status: string }) => r.status === "APPROVED").length
  const totalRejectedRequests = processedRequests.filter((r: { status: string }) => r.status === "REJECTED").length

  // Vacation type distribution
  const vacationTypeStats = vacationTypes.map((vt: typeof vacationTypes[0]) => {
    const totalAllocated = employees.reduce((sum: number, emp: typeof employees[0]) => {
      const balance = emp.vacationBalances.find((b: { vacationTypeId: string; totalDays: number }) => b.vacationTypeId === vt.id)
      return sum + (balance?.totalDays ?? 0)
    }, 0)

    const totalUsed = employees.reduce((sum: number, emp: typeof employees[0]) => {
      const balance = emp.vacationBalances.find((b: { vacationTypeId: string; usedDays: number }) => b.vacationTypeId === vt.id)
      return sum + (balance?.usedDays ?? 0)
    }, 0)

    const totalPending = employees.reduce((sum: number, emp: typeof employees[0]) => {
      const balance = emp.vacationBalances.find((b: { vacationTypeId: string; pendingDays: number }) => b.vacationTypeId === vt.id)
      return sum + (balance?.pendingDays ?? 0)
    }, 0)

    return {
      vacationType: vt,
      totalAllocated,
      totalUsed,
      totalPending,
      utilizationRate: totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0,
    }
  })

  // Monthly request trends (last 6 months)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const monthlyRequests = await prisma.vacationRequest.groupBy({
    by: ["status"],
    where: {
      createdAt: { gte: sixMonthsAgo },
    },
    _count: { id: true },
  })

  // Department distribution
  const departmentStats: Record<string, { count: number; totalApprovedDays: number; totalPendingDays: number }> = employees.reduce((acc: Record<string, { count: number; totalApprovedDays: number; totalPendingDays: number }>, emp: typeof employees[0]) => {
    const dept = emp.department || "Unassigned"
    if (!acc[dept]) {
      acc[dept] = { count: 0, totalApprovedDays: 0, totalPendingDays: 0 }
    }
    acc[dept].count++
    acc[dept].totalApprovedDays += emp.vacationRequests
      .filter((r: { status: string; totalDays: number }) => r.status === "APPROVED")
      .reduce((sum: number, r: { totalDays: number }) => sum + r.totalDays, 0)
    acc[dept].totalPendingDays += emp.vacationRequests
      .filter((r: { status: string; totalDays: number }) => r.status === "PENDING")
      .reduce((sum: number, r: { totalDays: number }) => sum + r.totalDays, 0)
    return acc
  }, {} as Record<string, { count: number; totalApprovedDays: number; totalPendingDays: number }>)

  // Process monthly requests for chart
  const monthlyRequestsData = monthlyRequests.map((mr: { status: string; _count: { id: number } }) => ({
    status: mr.status,
    count: mr._count.id,
  }))

  return NextResponse.json({
    employeeOverview,
    pendingRequests,
    processedRequests,
    stats: {
      totalEmployees,
      totalPendingRequests,
      totalApprovedRequests,
      totalRejectedRequests,
      vacationTypeStats,
      departmentStats: Object.entries(departmentStats).map(([department, data]: [string, { count: number; totalApprovedDays: number; totalPendingDays: number }]) => ({
        department,
        count: data.count,
        totalApprovedDays: data.totalApprovedDays,
        totalPendingDays: data.totalPendingDays,
      })),
      monthlyRequests: monthlyRequestsData,
    },
  })
}