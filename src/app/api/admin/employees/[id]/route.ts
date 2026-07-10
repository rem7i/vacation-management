import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"

const updateEmployeeSchema = z.object({
  name: z.string().min(2).optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  hireDate: z.string().optional(),
  isActive: z.boolean().optional(),
  annualLeaveBalance: z.number().int().min(0).optional(),
  sickLeaveBalance: z.number().int().min(0).optional(),
  password: z.string().min(6).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      },
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

  return NextResponse.json(employee)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const data = updateEmployeeSchema.parse(body)

    const employee = await prisma.employee.findUnique({ where: { id } })
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.name) updateData.name = data.name
    if (data.department !== undefined) updateData.department = data.department
    if (data.position !== undefined) updateData.position = data.position
    if (data.hireDate) updateData.hireDate = new Date(data.hireDate)
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.annualLeaveBalance !== undefined) updateData.annualLeaveBalance = data.annualLeaveBalance
    if (data.sickLeaveBalance !== undefined) updateData.sickLeaveBalance = data.sickLeaveBalance

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true, createdAt: true },
        },
        vacationBalances: {
          where: { year: new Date().getFullYear() },
          include: { vacationType: true },
        },
      },
    })

    // Update user name if provided
    if (data.name) {
      await prisma.user.update({
        where: { id: employee.userId },
        data: { name: data.name },
      })
    }

    // Update password if provided
    if (data.password) {
      const hashedPassword = await bcrypt.hash(data.password, 12)
      await prisma.user.update({
        where: { id: employee.userId },
        data: { password: hashedPassword },
      })
    }

    // Update vacation balances if balances changed
    if (data.annualLeaveBalance !== undefined || data.sickLeaveBalance !== undefined) {
      const currentYear = new Date().getFullYear()
      
      if (data.annualLeaveBalance !== undefined) {
        await prisma.vacationBalance.updateMany({
          where: {
            employeeId: id,
            vacationType: { name: "ANNUAL" },
            year: currentYear,
          },
          data: { totalDays: data.annualLeaveBalance },
        })
      }
      
      if (data.sickLeaveBalance !== undefined) {
        await prisma.vacationBalance.updateMany({
          where: {
            employeeId: id,
            vacationType: { name: "SICK" },
            year: currentYear,
          },
          data: { totalDays: data.sickLeaveBalance },
        })
      }
    }

    return NextResponse.json(updatedEmployee)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten().fieldErrors }, { status: 400 })
    }
    console.error("Error updating employee:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  const employee = await prisma.employee.findUnique({ where: { id } })
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  // Soft delete - deactivate employee and user
  await prisma.employee.update({
    where: { id },
    data: { isActive: false },
  })

  await prisma.user.update({
    where: { id: employee.userId },
    data: { email: `deactivated_${Date.now()}_${employee.userId}@deleted.local` },
  })

  return NextResponse.json({ message: "Employee deactivated successfully" })
}