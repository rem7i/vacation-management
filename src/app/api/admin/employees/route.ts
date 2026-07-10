import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"

const employeeSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(6),
  employeeId: z.string().min(1),
  department: z.string().optional(),
  position: z.string().optional(),
  hireDate: z.string().optional(),
  annualLeaveBalance: z.number().int().min(0).default(20),
  sickLeaveBalance: z.number().int().min(0).default(10),
})

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const employees = await prisma.employee.findMany({
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      },
      vacationBalances: {
        where: { year: new Date().getFullYear() },
        include: { vacationType: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(employees)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const data = employeeSchema.parse(body)

    const existingUser = await prisma.user.findUnique({ where: { email: data.email } })
    if (existingUser) {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 })
    }

    const existingEmployeeId = await prisma.employee.findUnique({ where: { employeeId: data.employeeId } })
    if (existingEmployeeId) {
      return NextResponse.json({ error: "Employee ID already exists" }, { status: 400 })
    }

    const hashedPassword = await bcrypt.hash(data.password, 12)

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashedPassword,
        role: "EMPLOYEE",
      },
    })

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        employeeId: data.employeeId,
        department: data.department,
        position: data.position,
        hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
        annualLeaveBalance: data.annualLeaveBalance,
        sickLeaveBalance: data.sickLeaveBalance,
      },
    })

    // Create vacation balances for the current year
    const currentYear = new Date().getFullYear()
    const vacationTypes = await prisma.vacationType.findMany({ where: { isActive: true } })

    for (const vt of vacationTypes) {
      let totalDays = 0
      if (vt.name === "ANNUAL") totalDays = data.annualLeaveBalance
      else if (vt.name === "SICK") totalDays = data.sickLeaveBalance
      else totalDays = vt.defaultDays

      await prisma.vacationBalance.create({
        data: {
          employeeId: employee.id,
          vacationTypeId: vt.id,
          totalDays,
          usedDays: 0,
          pendingDays: 0,
          year: currentYear,
        },
      })
    }

    return NextResponse.json({ user, employee }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten().fieldErrors }, { status: 400 })
    }
    console.error("Error creating employee:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}