import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const vacationRequestSchema = z.object({
  vacationTypeId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().min(5),
})

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const employee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
  })

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  const where = session.user.role === "ADMIN" 
    ? {} 
    : { employeeId: employee.id }

  const requests = await prisma.vacationRequest.findMany({
    where,
    include: {
      employee: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      vacationType: true,
      approvedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(requests)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const employee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    include: {
      vacationBalances: {
        where: { year: new Date().getFullYear() },
        include: { vacationType: true },
      },
    },
  })

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  if (!employee.isActive) {
    return NextResponse.json({ error: "Employee account is deactivated" }, { status: 400 })
  }

  try {
    const body = await request.json()
    const data = vacationRequestSchema.parse(body)

    const startDate = new Date(data.startDate)
    const endDate = new Date(data.endDate)

    if (startDate > endDate) {
      return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 })
    }

    if (startDate < new Date(new Date().setHours(0, 0, 0, 0))) {
      return NextResponse.json({ error: "Start date cannot be in the past" }, { status: 400 })
    }

    // Calculate total days (excluding weekends)
    const totalDays = calculateBusinessDays(startDate, endDate)
    if (totalDays <= 0) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 })
    }

    // Check vacation type exists and is active
    const vacationType = await prisma.vacationType.findUnique({
      where: { id: data.vacationTypeId },
    })

    if (!vacationType || !vacationType.isActive) {
      return NextResponse.json({ error: "Invalid vacation type" }, { status: 400 })
    }

    // Check balance for the vacation type
    const balance = employee.vacationBalances.find(
      (b: { vacationTypeId: string }) => b.vacationTypeId === data.vacationTypeId
    )

    if (!balance) {
      return NextResponse.json({ error: "No balance found for this vacation type" }, { status: 400 })
    }

    const availableDays = balance.totalDays - balance.usedDays - balance.pendingDays
    if (availableDays < totalDays) {
      return NextResponse.json(
        { error: `Insufficient balance. Available: ${availableDays} days, Requested: ${totalDays} days` },
        { status: 400 }
      )
    }

    // Check for overlapping requests
    const overlappingRequest = await prisma.vacationRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ["PENDING", "APPROVED"] },
        OR: [
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } },
            ],
          },
        ],
      },
    })

    if (overlappingRequest) {
      return NextResponse.json(
        { error: "You have an overlapping vacation request" },
        { status: 400 }
      )
    }

    // Create the request
    const vacationRequest = await prisma.vacationRequest.create({
      data: {
        employeeId: employee.id,
        vacationTypeId: data.vacationTypeId,
        startDate,
        endDate,
        totalDays,
        reason: data.reason,
        status: "PENDING",
      },
      include: {
        vacationType: true,
        employee: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    })

    // Update pending days in balance
    await prisma.vacationBalance.update({
      where: { id: balance.id },
      data: { pendingDays: balance.pendingDays + totalDays },
    })

    return NextResponse.json(vacationRequest, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten().fieldErrors }, { status: 400 })
    }
    console.error("Error creating vacation request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0
  const current = new Date(startDate)
  while (current <= endDate) {
    const dayOfWeek = current.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}