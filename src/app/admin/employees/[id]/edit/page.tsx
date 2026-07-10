"use client"

import { useEffect, useState, use } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"

interface Employee {
  id: string
  employeeId: string
  department: string | null
  position: string | null
  hireDate: string
  isActive: boolean
  annualLeaveBalance: number
  sickLeaveBalance: number
  user: {
    id: string
    email: string
    name: string
    role: string
    createdAt: string
  }
  vacationBalances: Array<{
    vacationType: { id: string; name: string; color: string }
    totalDays: number
    usedDays: number
    pendingDays: number
  }>
}

export default function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  return <EditEmployeePageContent params={params} />
}

function EditEmployeePageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: "",
    email: "",
    department: "",
    position: "",
    hireDate: "",
    annualLeaveBalance: 20,
    sickLeaveBalance: 10,
    isActive: true,
  })

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/dashboard/employee")
    }
  }, [status, router, session?.user?.role])

  const fetchEmployee = async () => {
    try {
      const res = await fetch("/api/admin/employees")
      if (!res.ok) {
        setError("Failed to load employee")
        return
      }
      const employees = await res.json()
      const emp = employees.find((e: Employee) => e.id === id)
      if (!emp) {
        setError("Employee not found")
        return
      }
      setEmployee(emp)
      setForm({
        name: emp.user.name || "",
        email: emp.user.email,
        department: emp.department || "",
        position: emp.position || "",
        hireDate: format(new Date(emp.hireDate), "yyyy-MM-dd"),
        annualLeaveBalance: emp.annualLeaveBalance,
        sickLeaveBalance: emp.sickLeaveBalance,
        isActive: emp.isActive,
      })
    } catch {
      setError("Failed to load employee")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "ADMIN") {
      fetchEmployee()
    }
  }, [session, id])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!form.name || form.name.length < 2) {
      errors.name = "Name must be at least 2 characters"
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
    setSuccessMessage(null)

    if (!validateForm()) {
      return
    }

    setSaving(true)

    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          department: form.department || undefined,
          position: form.position || undefined,
          hireDate: form.hireDate ? new Date(form.hireDate).toISOString() : undefined,
          annualLeaveBalance: form.annualLeaveBalance,
          sickLeaveBalance: form.sickLeaveBalance,
          isActive: form.isActive,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (typeof data.error === "object") {
          setFormErrors(data.error)
        } else {
          setError(data.error || "Failed to update employee")
        }
        return
      }

      setSuccessMessage("Employee updated successfully")
      fetchEmployee()
    } catch {
      setError("Failed to update employee")
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: string, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error && !employee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <div className="text-red-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/admin/employees" className="text-blue-600 hover:text-blue-800">
            Back to Employees
          </Link>
        </div>
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
              <h1 className="text-xl font-bold text-gray-900">Edit Employee</h1>
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
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {successMessage}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Employee Information</h2>
            <p className="mt-1 text-sm text-gray-500">
              Employee ID: <span className="font-mono text-gray-700">{employee?.employeeId}</span>
            </p>
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
                  disabled={saving}
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={form.email}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-gray-50 text-gray-500"
                  disabled
                />
                <p className="mt-1 text-xs text-gray-400">Email cannot be changed</p>
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
                  disabled={saving}
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
                  disabled={saving}
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
                disabled={saving}
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => handleChange("isActive", e.target.checked)}
                  className="sr-only peer"
                  disabled={saving}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <span className="text-sm font-medium text-gray-700">Active Employee</span>
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
                  disabled={saving}
                />
                {formErrors.annualLeaveBalance && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.annualLeaveBalance}</p>
                )}
                {employee && (
                  <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                    <span>
                      Used: <span className="font-medium text-gray-700">
                        {employee.vacationBalances.find(b => b.vacationType.name === "ANNUAL")?.usedDays || 0}
                      </span>
                    </span>
                    <span>
                      Pending: <span className="font-medium text-gray-700">
                        {employee.vacationBalances.find(b => b.vacationType.name === "ANNUAL")?.pendingDays || 0}
                      </span>
                    </span>
                  </div>
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
                  disabled={saving}
                />
                {formErrors.sickLeaveBalance && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.sickLeaveBalance}</p>
                )}
                {employee && (
                  <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                    <span>
                      Used: <span className="font-medium text-gray-700">
                        {employee.vacationBalances.find(b => b.vacationType.name === "SICK")?.usedDays || 0}
                      </span>
                    </span>
                    <span>
                      Pending: <span className="font-medium text-gray-700">
                        {employee.vacationBalances.find(b => b.vacationType.name === "SICK")?.pendingDays || 0}
                      </span>
                    </span>
                  </div>
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
              disabled={saving}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}