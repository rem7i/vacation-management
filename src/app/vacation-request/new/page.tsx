"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { differenceInCalendarDays, format } from "date-fns"

interface VacationType {
  id: string
  name: string
  color: string
  defaultDays: number
}

interface Balance {
  vacationType: VacationType
  totalDays: number
  usedDays: number
  pendingDays: number
  availableDays: number
}

interface DashboardData {
  balances: Balance[]
}

export default function NewVacationRequestPage() {
  return <NewVacationRequestPageContent />
}

function NewVacationRequestPageContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    vacationTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
  })

  const [businessDays, setBusinessDays] = useState(0)

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "EMPLOYEE") {
      router.push("/dashboard/admin")
    }
  }, [status, router, session?.user?.role])

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/dashboard/employee")
        if (!res.ok) {
          setError("Failed to load dashboard data")
          return
        }
        const data = await res.json()
        setDashboardData(data)
      } catch {
        setError("Failed to load dashboard data")
      } finally {
        setLoading(false)
      }
    }

    if (session) {
      fetchDashboard()
    }
  }, [session])

  useEffect(() => {
    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate)
      const end = new Date(form.endDate)
      if (start <= end) {
        let count = 0
        const current = new Date(start)
        while (current <= end) {
          const dayOfWeek = current.getDay()
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++
          }
          current.setDate(current.getDate() + 1)
        }
        setBusinessDays(count)
      } else {
        setBusinessDays(0)
      }
    } else {
      setBusinessDays(0)
    }
  }, [form.startDate, form.endDate])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!form.vacationTypeId) {
      errors.vacationTypeId = "Please select a vacation type"
    }

    if (!form.startDate) {
      errors.startDate = "Start date is required"
    }

    if (!form.endDate) {
      errors.endDate = "End date is required"
    }

    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate)
      const end = new Date(form.endDate)
      if (start > end) {
        errors.endDate = "End date must be after start date"
      }
      if (start < new Date(new Date().setHours(0, 0, 0, 0))) {
        errors.startDate = "Start date cannot be in the past"
      }
    }

    if (!form.reason || form.reason.length < 5) {
      errors.reason = "Reason must be at least 5 characters"
    }

    if (businessDays <= 0 && form.startDate && form.endDate) {
      errors.endDate = "Date range must include at least one business day"
    }

    if (form.vacationTypeId && businessDays > 0 && dashboardData) {
      const balance = dashboardData.balances.find(
        (b) => b.vacationType.id === form.vacationTypeId
      )
      if (balance && balance.availableDays < businessDays) {
        errors.vacationTypeId = `Insufficient balance. Available: ${balance.availableDays} days, Requested: ${businessDays} days`
      }
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

    setSubmitting(true)

    try {
      const res = await fetch("/api/vacation-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacationTypeId: form.vacationTypeId,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
          reason: form.reason,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (typeof data.error === "object") {
          setFormErrors(data.error)
        } else {
          setError(data.error || "Failed to submit request")
        }
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/dashboard/employee")
      }, 2000)
    } catch {
      setError("Failed to submit request")
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const selectedBalance = dashboardData?.balances.find(
    (b) => b.vacationType.id === form.vacationTypeId
  )

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error && !dashboardData) {
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
          <Link href="/dashboard/employee" className="text-blue-600 hover:text-blue-800">
            Back to Dashboard
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
              <Link href="/dashboard/employee" className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Request Vacation</h1>
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
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Vacation request submitted successfully! Redirecting...
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">New Vacation Request</h2>
            <p className="mt-1 text-sm text-gray-500">Fill in the details for your vacation request</p>
          </div>

          <div className="px-6 py-4 space-y-6">
            <div>
              <label htmlFor="vacationType" className="block text-sm font-medium text-gray-700">
                Vacation Type *
              </label>
              <select
                id="vacationType"
                value={form.vacationTypeId}
                onChange={(e) => handleChange("vacationTypeId", e.target.value)}
                className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.vacationTypeId ? "border-red-300" : "border-gray-300"
                }`}
                disabled={submitting}
              >
                <option value="">Select vacation type</option>
                {dashboardData?.balances.map((balance) => (
                  <option key={balance.vacationType.id} value={balance.vacationType.id}>
                    {balance.vacationType.name} - {balance.availableDays} days available
                  </option>
                ))}
              </select>
              {formErrors.vacationTypeId && (
                <p className="mt-1 text-sm text-red-600">{formErrors.vacationTypeId}</p>
              )}
            </div>

            {selectedBalance && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: selectedBalance.vacationType.color }}
                  ></div>
                  <span className="font-medium text-gray-900">{selectedBalance.vacationType.name}</span>
                </div>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{selectedBalance.totalDays}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{selectedBalance.usedDays}</p>
                    <p className="text-xs text-gray-500">Used</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-yellow-600">{selectedBalance.pendingDays}</p>
                    <p className="text-xs text-gray-500">Pending</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-blue-600">{selectedBalance.availableDays}</p>
                    <p className="text-xs text-gray-500">Available</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                  Start Date *
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={form.startDate}
                  onChange={(e) => handleChange("startDate", e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.startDate ? "border-red-300" : "border-gray-300"
                  }`}
                  disabled={submitting}
                />
                {formErrors.startDate && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.startDate}</p>
                )}
              </div>

              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                  End Date *
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={form.endDate}
                  onChange={(e) => handleChange("endDate", e.target.value)}
                  min={form.startDate || new Date().toISOString().split("T")[0]}
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.endDate ? "border-red-300" : "border-gray-300"
                  }`}
                  disabled={submitting}
                />
                {formErrors.endDate && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.endDate}</p>
                )}
              </div>
            </div>

            {businessDays > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-800">
                    {businessDays} business day{businessDays !== 1 ? "s" : ""} (excluding weekends)
                  </span>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                Reason *
              </label>
              <textarea
                id="reason"
                value={form.reason}
                onChange={(e) => handleChange("reason", e.target.value)}
                rows={4}
                className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.reason ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="Please provide a reason for your vacation request..."
                disabled={submitting}
              />
              {formErrors.reason && (
                <p className="mt-1 text-sm text-red-600">{formErrors.reason}</p>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <Link
              href="/dashboard/employee"
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting || success}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}