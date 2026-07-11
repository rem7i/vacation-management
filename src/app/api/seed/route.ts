import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function GET() {
  try {
    // Create vacation types
    const vacationTypes = [
      { name: "ANNUAL" as const, description: "Annual leave", defaultDays: 20, color: "#3B82F6" },
      { name: "SICK" as const, description: "Sick leave", defaultDays: 10, color: "#EF4444" },
      { name: "UNPAID" as const, description: "Unpaid leave", defaultDays: 0, color: "#6B7280" },
      { name: "MATERNITY" as const, description: "Maternity leave", defaultDays: 90, color: "#EC4899" },
      { name: "PATERNITY" as const, description: "Paternity leave", defaultDays: 14, color: "#8B5CF6" },
      { name: "BEREAVEMENT" as const, description: "Bereavement leave", defaultDays: 5, color: "#1F2937" },
      { name: "OTHER" as const, description: "Other leave", defaultDays: 0, color: "#F59E0B" },
    ]

    for (const vt of vacationTypes) {
      await prisma.vacationType.upsert({
        where: { name: vt.name },
        update: {},
        create: vt,
      })
    }

    // Create admin user
    const adminPassword = await bcrypt.hash("admin123", 12)
    const adminUser = await prisma.user.upsert({
      where: { email: "admin@company.com" },
      update: {},
      create: {
        email: "admin@company.com",
        name: "Admin User",
        password: adminPassword,
        role: "ADMIN",
      },
    })

    // Create employee user
    const empPassword = await bcrypt.hash("employee123", 12)
    const empUser = await prisma.user.upsert({
      where: { email: "john@company.com" },
      update: {},
      create: {
        email: "john@company.com",
        name: "John Doe",
        password: empPassword,
        role: "EMPLOYEE",
      },
    })

    // Create employee record for John
    const employee = await prisma.employee.upsert({
      where: { userId: empUser.id },
      update: {},
      create: {
        userId: empUser.id,
        employeeId: "EMP001",
        department: "Engineering",
        position: "Software Developer",
        hireDate: new Date("2023-01-15"),
        annualLeaveBalance: 20,
        sickLeaveBalance: 10,
      },
    })

    // Create vacation balances for current year
    const currentYear = new Date().getFullYear()
    const allTypes = await prisma.vacationType.findMany()

    for (const vt of allTypes) {
      await prisma.vacationBalance.upsert({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId: employee.id,
            vacationTypeId: vt.id,
            year: currentYear,
          },
        },
        update: {},
        create: {
          employeeId: employee.id,
          vacationTypeId: vt.id,
          totalDays: vt.defaultDays,
          usedDays: 0,
          pendingDays: 0,
          year: currentYear,
        },
      })
    }

    return NextResponse.json({ success: true, message: "Database seeded successfully" })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
