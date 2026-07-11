import { PrismaClient, Role, VacationTypeEnum } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create vacation types
  const vacationTypes = [
    { name: VacationTypeEnum.ANNUAL, description: "Annual leave", defaultDays: 20, color: "#3B82F6" },
    { name: VacationTypeEnum.SICK, description: "Sick leave", defaultDays: 10, color: "#EF4444" },
    { name: VacationTypeEnum.UNPAID, description: "Unpaid leave", defaultDays: 0, color: "#6B7280" },
    { name: VacationTypeEnum.MATERNITY, description: "Maternity leave", defaultDays: 90, color: "#EC4899" },
    { name: VacationTypeEnum.PATERNITY, description: "Paternity leave", defaultDays: 14, color: "#8B5CF6" },
    { name: VacationTypeEnum.BEREAVEMENT, description: "Bereavement leave", defaultDays: 5, color: "#1F2937" },
    { name: VacationTypeEnum.OTHER, description: "Other leave", defaultDays: 0, color: "#F59E0B" },
  ]

  for (const vt of vacationTypes) {
    await prisma.vacationType.upsert({
      where: { name: vt.name },
      update: {},
      create: vt,
    })
  }
  console.log("Vacation types created.")

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 12)
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      email: "admin@company.com",
      name: "Admin User",
      password: adminPassword,
      role: Role.ADMIN,
    },
  })
  console.log("Admin user created:", adminUser.email)

  // Create employee user
  const empPassword = await bcrypt.hash("employee123", 12)
  const empUser = await prisma.user.upsert({
    where: { email: "john@company.com" },
    update: {},
    create: {
      email: "john@company.com",
      name: "John Doe",
      password: empPassword,
      role: Role.EMPLOYEE,
    },
  })
  console.log("Employee user created:", empUser.email)

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
  console.log("Employee record created:", employee.employeeId)

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
  console.log("Vacation balances created for year", currentYear)

  console.log("Seeding complete!")
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
