"use client"

import { useEffect, useState, use } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"

interface VacationType {
  id: string
  name: string
  color: string
  defaultDays: number
}

interface Employee {
  id: string
  employeeId: string
  user: {
    id: string
    name: string
    email: string
  }
  department: string | null
  position: string | null
}

interface VacationRequest {
  id: string
  startDate: string
  endDate: string
  totalDays: number
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  reason: string
  adminNotes: string | null
  createdAt: string
  approvedAt: string | null
  vacationType: VacationType
  employee: Employee
  approvedBy: {
    id: string
    name: string
    email: string
  } | null
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
}

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
}

export default function AdminVacationRequestPage({ params }: { params: Promise<{ id: string }> }) {
  return <AdminVacationRequestPageContent params={params} />
}

function AdminVacationRequestPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [request, setRequest] = useState<VacationRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [action, setAction] = useState<"APPROVED" | "REJECTED" | null>(null)

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "ADMIN") {
      router.push("/dashboard/employee")
    }
  }, [status, router, session?.user?.role])

  const fetchRequest = async () => {
    try {
      const res = await fetch("/api/dashboard/admin")
      if (!res.ok) {
        setError("Failed to load request details")
        return
      }
      const data = await res.json()
      const allRequests = [...data.pendingRequests, ...data.processedRequests]
      const found = allRequests.find((r: VacationRequest) => r.id === id)
      if (!found) {
        setError("Request not found")
        return
      }
      setRequest(found)
    } catch {
      setError("Failed to load request details")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "ADMIN") {
      fetchRequest()
    }
  }, [session, id])

  const formatDate = (dateStr: string) => format(new Date(dateStr), "MMM d, yyyy")
  const formatDateTime = (dateStr: string) => format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a")

  const handleAction = async () => {
    if (!action || !request) return

    setProcessing(true)
    try {
      const res = await fetch(`/api/admin/vacation-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: action,
          adminNotes: adminNotes || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to process request")
        return
      }

      fetchRequest()
      setAction(null)
      setAdminNotes("")
    } catch {
      setError("Failed to process request")
    } finally {
      setProcessing(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error && !request) {
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
          <Link href="/dashboard/admin" className="text-blue-600 hover:text-blue-800">
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
              <Link href="/dashboard/admin" className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Vacation Request Details</h1>
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

        {request && (
          <div className="space-y-6">
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Request Information</h2>
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusColors[request.status]}`}>
                  {statusLabels[request.status]}
                </span>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Vacation Type</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: request.vacationType.color }}
                      ></span>
                      <span className="font-medium text-gray-900">{request.vacationType.name}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Days</p>
                    <p className="font-medium text-gray-900 mt-1">{request.totalDays} business days</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Start Date</p>
                    <p className="font-medium text-gray-900 mt-1">{formatDate(request.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">End Date</p>
                    <p className="font-medium text-gray-900 mt-1">{formatDate(request.endDate)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Reason</p>
                  <p className="text-gray-900 mt-1 whitespace-pre-wrap">{request.reason}</p>
                </div>
              </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Employee Information</h2>
              </div>

              <div className="px-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-medium text-gray-900 mt-1">{request.employee.user.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900 mt-1">{request.employee.user.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-sm text-gray-500">Employee ID</p>
                    <p className="font-medium text-gray-900 mt-1 font-mono">{request.employee.employeeId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Department</p>
                    <p className="font-medium text-gray-900 mt-1">{request.employee.department || "—"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
              </div>

              <div className="px-6 py-4">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Submitted</p>
                      <p className="text-sm text-gray-500">{formatDateTime(request.createdAt)}</p>
                    </div>
                  </div>

                  {request.approvedAt && (
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        request.status === "APPROVED" ? "bg-green-500" : "bg-red-500"
                      }`}></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {request.status === "APPROVED" ? "Approved" : "Rejected"}
                        </p>
                        <p className="text-sm text-gray-500">{formatDateTime(request.approvedAt)}</p>
                        {request.approvedBy && (
                          <p className="text-sm text-gray-500">by {request.approvedBy.name}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {request.adminNotes && (
              <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Admin Notes</h2>
                </div>
                <div className="px-6 py-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{request.adminNotes}</p>
                </div>
              </div>
            )}

            {request.status === "PENDING" && (
              <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Review Request</h2>
                </div>

                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label htmlFor="adminNotes" className="block text-sm font-medium text-gray-700">
                      Admin Notes (optional)
                    </label>
                    <textarea
                      id="adminNotes"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Add any notes for this decision..."
                      disabled={processing}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setAction("APPROVED")
                      }}
                      disabled={processing}
                      className={`flex-1 px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 ${
                        action === "APPROVED" ? "ring-2 ring-offset-2 ring-green-500" : ""
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Approve
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setAction("REJECTED")
                      }}
                      disabled={processing}
                      className={`flex-1 px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 ${
                        action === "REJECTED" ? "ring-2 ring-offset-2 ring-red-500" : ""
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Reject
                      </div>
                    </button>
                  </div>

                  {action && (
                    <div className={`p-4 rounded-lg ${
                      action === "APPROVED" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                    }`}>
                      <p className={`text-sm ${
                        action === "APPROVED" ? "text-green-800" : "text-red-800"
                      }`}>
                        {action === "APPROVED"
                          ? "By approving, the requested days will be deducted from the employee's leave balance."
                          : "By rejecting, the pending days will be released back to the employee's balance."}
                      </p>
                      <button
                        onClick={handleAction}
                        disabled={processing}
                        className={`mt-3 px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white ${
                          action === "APPROVED" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                        } disabled:opacity-50`}
                      >
                        {processing ? "Processing..." : `Confirm ${action === "APPROVED" ? "Approval" : "Rejection"}`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}