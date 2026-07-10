import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { z } from "zod"

const approveRejectSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  adminNotes: z.string().optional(),
})

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
    const data = approveRejectSchema.parse(body)

    const vacationRequest = await prisma.vacationRequest.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            vacationBalances: {
              where: { year: new Date().getFullYear() },
              include: { vacationType: true },
            },
          },
        },
        vacationType: true,
      },
    })

    if (!vacationRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (vacationRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Request already processed" }, { status: 400 })
    }

    const balance = vacationRequest.employee.vacationBalances.find(
      (b: { vacationTypeId: string }) => b.vacationTypeId === vacationRequest.vacationTypeId
    )

    if (!balance) {
      return NextResponse.json({ error: "Balance not found" }, { status: 400 })
    }

    let updatedRequest

    if (data.status === "APPROVED") {
      // Check if still has enough balance
      const availableDays = balance.totalDays - balance.usedDays - balance.pendingDays
      if (availableDays < vacationRequest.totalDays) {
        return NextResponse.json(
          { error: "Insufficient balance at time of approval" },
          { status: 400 }
        )
      }

      updatedRequest = await prisma.vacationRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          adminNotes: data.adminNotes,
          approvedById: session.user.id,
          approvedAt: new Date(),
        },
        include: {
          employee: { include: { user: { select: { id: true, name: true, email: true } } } },
          vacationType: true,
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      })

      // Update balance: move from pending to used
      await prisma.vacationBalance.update({
        where: { id: balance.id },
        data: {
          pendingDays: balance.pendingDays - vacationRequest.totalDays,
          usedDays: balance.usedDays + vacationRequest.totalDays,
        },
      })
    } else {
      // REJECTED
      updatedRequest = await prisma.vacationRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          adminNotes: data.adminNotes,
          approvedById: session.user.id,
          approvedAt: new Date(),
        },
        include: {
          employee: { include: { user: { select: { id: true, name: true, email: true } } } },
          vacationType: true,
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      })

      // Update balance: remove from pending
      await prisma.vacationBalance.update({
        where: { id: balance.id },
        data: { pendingDays: balance.pendingDays - vacationRequest.totalDays },
      })
    }

    return NextResponse.json(updatedRequest)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten().fieldErrors }, { status: 400 })
    }
    console.error("Error processing request:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}