"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function NewEmployeePage() {
  return <NewEmployeePageContent />
}

function NewEmployeePageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()

interface EmployeeFormData {
  email: string
  name: string
  password: string
  employeeId: string
  department: string
  position: string
  hireDate: string
  annualLeaveBalance: number
  sickLeaveBalance: number
}
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<EmployeeFormData>({
    email: "",
    name: "",
    password: "",
    employeeId: "",
    department: "",
    position: "",
    hireDate: new Date().toISOString().split("T")[0],
    annualLeaveBalance: 20,
    sickLeaveBalance: 10,
  })

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/dashboard/employee")
    }
  }, [status, router, session?.user?.role])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!form.email) {
      errors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = "Invalid email format"
    }

    if (!form.name || form.name.length < 2) {
      errors.name = "Name must be at least 2 characters"
    }

    if (!form.password || form.password.length < 6) {
      errors.password = "Password must be at least 6 characters"
    }

    if (!form.employeeId) {
      errors.employeeId = "Employee ID is required"
    }

    if (form.annualLeaveBalance < 0) {
      errors.annualLeaveBalance = "Annual leave balance cannot be negative"
    }

    if (form.sickLeaveBalance < 0) {
      errors.sickLeaveBalance = "Sick leave balance cannot be negative"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          department: form.department || undefined,
          position: form.position || undefined,
          hireDate: form.hireDate ? new Date(form.hireDate).toISOString() : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (typeof data.error === "object") {
          setFormErrors(data.error)
        } else {
          setError(data.error || "Failed to create employee")
        }
        return
      }

      router.push("/admin/employees")
    } catch {
      setError("Failed to create employee")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof EmployeeFormData, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin/employees" className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Add New Employee</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{session?.user?.name}</span>
              <Link href="/api/auth/signout" className="text-sm text-blue-600 hover:text-blue-800">
                Sign Out
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Employee Information</h2>
            <p className="mt-1 text-sm text-gray-500">Fill in the employee details below</p>
          </div>

          <div className="px-6 py-4 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.name ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="John Doe"
                  disabled={loading}
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.email ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="john@company.com"
                  disabled={loading}
                />
                {formErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password *
                </label>
                <input
                  type="password"
                  id="password"
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.password ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="••••••••"
                  disabled={loading}
                />
                {formErrors.password && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.password}</p>
                )}
              </div>

              <div>
                <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700">
                  Employee ID *
                </label>
                <input
                  type="text"
                  id="employeeId"
                  value={form.employeeId}
                  onChange={(e) => handleChange("employeeId", e.target.value)}
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.employeeId ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="EMP001"
                  disabled={loading}
                />
                {formErrors.employeeId && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.employeeId}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                  Department
                </label>
                <input
                  type="text"
                  id="department"
                  value={form.department}
                  onChange={(e) => handleChange("department", e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Engineering"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-700">
                  Position
                </label>
                <input
                  type="text"
                  id="position"
                  value={form.position}
                  onChange={(e) => handleChange("position", e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Software Engineer"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="hireDate" className="block text-sm font-medium text-gray-700">
                Hire Date
              </label>
              <input
                type="date"
                id="hireDate"
                value={form.hireDate}
                onChange={(e) => handleChange("hireDate", e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Balances</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="annualLeaveBalance" className="block text-sm font-medium text-gray-700">
                  Annual Leave Days
                </label>
                <input
                  type="number"
                  id="annualLeaveBalance"
                  value={form.annualLeaveBalance}
                  onChange={(e) => handleChange("annualLeaveBalance", parseInt(e.target.value) || 0)}
                  min="0"
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.annualLeaveBalance ? "border-red-300" : "border-gray-300"
                  }`}
                  disabled={loading}
                />
                {formErrors.annualLeaveBalance && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.annualLeaveBalance}</p>
                )}
              </div>

              <div>
                <label htmlFor="sickLeaveBalance" className="block text-sm font-medium text-gray-700">
                  Sick Leave Days
                </label>
                <input
                  type="number"
                  id="sickLeaveBalance"
                  value={form.sickLeaveBalance}
                  onChange={(e) => handleChange("sickLeaveBalance", parseInt(e.target.value) || 0)}
                  min="0"
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.sickLeaveBalance ? "border-red-300" : "border-gray-300"
                  }`}
                  disabled={loading}
                />
                {formErrors.sickLeaveBalance && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.sickLeaveBalance}</p>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <Link
              href="/admin/employees"
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Employee"}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}