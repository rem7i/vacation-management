import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key")
  if (key !== "vacation-seed-2024") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: string[] = []

  try {
    // Create schema tables via raw SQL
    const createTablesSQL = `
      CREATE TYPE "Role" AS ENUM ('ADMIN', 'EMPLOYEE');
      CREATE TYPE "VacationTypeEnum" AS ENUM ('ANNUAL', 'SICK', 'UNPAID', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'OTHER');
      CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL,
        "name" TEXT,
        "password" TEXT NOT NULL,
        "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
        "emailVerified" TIMESTAMP(3),
        "image" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

      CREATE TABLE IF NOT EXISTS "Account" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "providerAccountId" TEXT NOT NULL,
        "refresh_token" TEXT,
        "access_token" TEXT,
        "expires_at" INTEGER,
        "token_type" TEXT,
        "scope" TEXT,
        "id_token" TEXT,
        "session_state" TEXT,
        CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "sessionToken" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "expires" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");

      CREATE TABLE IF NOT EXISTS "VerificationToken" (
        "identifier" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "expires" TIMESTAMP(3) NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token");
      CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

      CREATE TABLE IF NOT EXISTS "Employee" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "employeeId" TEXT NOT NULL,
        "department" TEXT,
        "position" TEXT,
        "hireDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "annualLeaveBalance" INTEGER NOT NULL DEFAULT 20,
        "sickLeaveBalance" INTEGER NOT NULL DEFAULT 10,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "Employee_userId_key" ON "Employee"("userId");
      CREATE UNIQUE INDEX IF NOT EXISTS "Employee_employeeId_key" ON "Employee"("employeeId");

      CREATE TABLE IF NOT EXISTS "VacationType" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" "VacationTypeEnum" NOT NULL,
        "description" TEXT,
        "defaultDays" INTEGER NOT NULL DEFAULT 0,
        "color" TEXT NOT NULL DEFAULT '#3B82F6',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "VacationType_name_key" ON "VacationType"("name");

      CREATE TABLE IF NOT EXISTS "VacationBalance" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "employeeId" TEXT NOT NULL,
        "vacationTypeId" TEXT NOT NULL,
        "totalDays" INTEGER NOT NULL DEFAULT 0,
        "usedDays" INTEGER NOT NULL DEFAULT 0,
        "pendingDays" INTEGER NOT NULL DEFAULT 0,
        "year" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "VacationBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "VacationBalance_vacationTypeId_fkey" FOREIGN KEY ("vacationTypeId") REFERENCES "VacationType"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "VacationBalance_employeeId_vacationTypeId_year_key" ON "VacationBalance"("employeeId", "vacationTypeId", "year");

      CREATE TABLE IF NOT EXISTS "VacationRequest" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "employeeId" TEXT NOT NULL,
        "vacationTypeId" TEXT NOT NULL,
        "startDate" TIMESTAMP(3) NOT NULL,
        "endDate" TIMESTAMP(3) NOT NULL,
        "totalDays" INTEGER NOT NULL,
        "reason" TEXT NOT NULL,
        "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
        "adminNotes" TEXT,
        "approvedById" TEXT,
        "approvedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "VacationRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "VacationRequest_vacationTypeId_fkey" FOREIGN KEY ("vacationTypeId") REFERENCES "VacationType"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "VacationRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `

    // Execute each statement separately
    const statements = createTablesSQL
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0)

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        // Ignore "already exists" errors
        if (!msg.includes("already exists")) {
          results.push(`WARN: ${msg.substring(0, 100)}`)
        }
      }
    }
    results.push("Schema tables created/verified")

    // Seed vacation types
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
    results.push("Vacation types seeded")

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
    results.push("Admin user created: " + adminUser.email)

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
    results.push("Employee user created: " + empUser.email)

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
    results.push("Employee record created: " + employee.employeeId)

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
    results.push("Vacation balances seeded for " + currentYear)

    return NextResponse.json({ success: true, results })
  } catch (error) {
    return NextResponse.json({ error: String(error), results }, { status: 500 })
  }
}
