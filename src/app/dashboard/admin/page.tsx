"use client"

import { Suspense } from "react"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts"

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

interface Employee {
  id: string
  employeeId: string
  department: string | null
  position: string | null
  hireDate: string
  user: {
    id: string
    name: string
    email: string
  }
  balances: Balance[]
  stats: {
    totalApprovedDays: number
    totalPendingDays: number
    totalRejectedDays: number
    totalRequests: number
  }
}

interface VacationRequest {
  id: string
  startDate: string
  endDate: string
  totalDays: number
  status: "PENDING" | "APPROVED" | "REJECTED"
  reason: string
  adminNotes: string | null
  createdAt: string
  approvedAt: string | null
  vacationType: VacationType
  employee: {
    id: string
    employeeId: string
    user: {
      id: string
      name: string
      email: string
    }
  }
  approvedBy: {
    id: string
    name: string
    email: string
  } | null
}

interface VacationTypeStat {
  vacationType: VacationType
  totalAllocated: number
  totalUsed: number
  totalPending: number
  utilizationRate: number
}

interface DepartmentStat {
  department: string
  count: number
  totalApprovedDays: number
  totalPendingDays: number
}

interface MonthlyRequest {
  status: string
  count: number
}

interface AdminDashboardData {
  employeeOverview: Employee[]
  pendingRequests: VacationRequest[]
  processedRequests: VacationRequest[]
  stats: {
    totalEmployees: number
    totalPendingRequests: number
    totalApprovedRequests: number
    totalRejectedRequests: number
    vacationTypeStats: VacationTypeStat[]
    departmentStats: DepartmentStat[]
    monthlyRequests: MonthlyRequest[]
  }
}

const statusColors = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
}

const statusLabels = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
}

const CHART_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
]



export default function AdminDashboard() {
  return <AdminDashboardContent />
}

function AdminDashboardContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<AdminDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "employees" | "requests" | "analytics">("overview")

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role && session.user.role !== "ADMIN") {
      router.replace("/dashboard/employee")
    }
  }, [status, router, session?.user?.role])

  const fetchDashboard = async () => {
    try {
      const res = await fetch("/api/dashboard/admin")
      if (!res.ok) {
        if (res.status === 403) {
          setError("Access denied. Admin privileges required.")
        } else {
          setError("Failed to load dashboard")
        }
        return
      }
      const data = await res.json()
      setData(data)
    } catch {
      setError("Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "ADMIN") {
      ;(async () => {
        await fetchDashboard()
      })()
    } else if (status === "authenticated") {
      router.push("/dashboard/employee")
    }
  }, [session, status, router])



  // When required auth is enabled, build-time pre-render may not have session data yet.
  // Guard against accessing undefined properties.
  if (status === "loading" || loading || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
          <div className="text-red-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/dashboard/employee" className="text-blue-600 hover:text-blue-800">
            Go to Employee Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { employeeOverview, pendingRequests, processedRequests, stats } = data

  const getStatusBadge = (status: string) => (
    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[status as keyof typeof statusColors]}`}>
      {statusLabels[status as keyof typeof statusLabels]}
    </span>
  )

  const formatDate = (dateStr: string) => format(new Date(dateStr), "MMM d, yyyy")

  // Chart data preparation
  const vacationTypeChartData = stats.vacationTypeStats.map((vts, index) => ({
    name: vts.vacationType.name,
    allocated: vts.totalAllocated,
    used: vts.totalUsed,
    pending: vts.totalPending,
    color: vts.vacationType.color || CHART_COLORS[index % CHART_COLORS.length],
  }))

  const departmentChartData = stats.departmentStats.map((ds) => ({
    name: ds.department,
    employees: ds.count,
    approvedDays: ds.totalApprovedDays,
    pendingDays: ds.totalPendingDays,
  }))

  const monthlyChartData = stats.monthlyRequests.reduce((acc, mr) => {
    const existing = acc.find((m) => m.status === mr.status)
    if (existing) {
      existing.count += mr.count
    } else {
      acc.push({ status: mr.status, count: mr.count })
    }
    return acc
  }, [] as { status: string; count: number }[])

  const statusChartData = [
    { name: "Approved", value: stats.totalApprovedRequests, color: "#10B981" },
    { name: "Pending", value: stats.totalPendingRequests, color: "#F59E0B" },
    { name: "Rejected", value: stats.totalRejectedRequests, color: "#EF4444" },
  ].filter((d) => d.value > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{session?.user?.name}</span>
              <span className="text-sm text-gray-400">|</span>
              <Link href="/api/auth/signout" className="text-sm text-blue-600 hover:text-blue-800">
                Sign Out
              </Link>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <nav className="border-t border-gray-200" aria-label="Admin dashboard tabs">
            <ul className="flex flex-wrap -mb-px text-sm font-medium text-center" role="tablist">
              {[
                { id: "overview", label: "Overview", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                )},
                { id: "employees", label: "Employees", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                )},
                { id: "requests", label: "Requests", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                )},
                { id: "analytics", label: "Analytics", icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                )},
              ].map((tab) => (
                <li key={tab.id} role="presentation">
                  <button
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`${tab.id}-panel`}
                    id={`${tab.id}-tab`}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 rounded-t-lg transition-colors ${
                      activeTab === tab.id
                        ? "border-blue-600 text-blue-600 bg-blue-50"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div id="overview-panel" role="tabpanel" aria-labelledby="overview-tab">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-500">Total Employees</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalEmployees}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-500">Pending Requests</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalPendingRequests}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-500">Approved Requests</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalApprovedRequests}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-500">Rejected Requests</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalRejectedRequests}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Vacation Type Distribution */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Vacation Balance by Type</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vacationTypeChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis type="number" tickFormatter={(v) => `${v}d`} />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="allocated" name="Allocated" fill="#E5E7EB" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="used" name="Used" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="pending" name="Pending" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-4 mt-4">
                  {vacationTypeChartData.map((v, i) => (
                    <div key={v.name} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: v.color }}></span>
                      <span className="text-sm text-gray-600">{v.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Request Status Pie Chart */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Status Distribution</h3>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Department Distribution & Monthly Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Department Distribution */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Employees by Department</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis type="number" tickFormatter={(v) => v} />
                      <YAxis dataKey="name" type="category" width={120} />
                      <Tooltip />
                      <Bar dataKey="employees" name="Employees" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Trends */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Request Trends</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" tickFormatter={(v) => v} />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ fill: "#3B82F6", strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Vacation Type Utilization Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Vacation Type Utilization</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Allocated</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.vacationTypeStats.map((vts) => (
                      <tr key={vts.vacationType.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: vts.vacationType.color }}></span>
                            <span className="text-sm font-medium text-gray-900">{vts.vacationType.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{vts.totalAllocated} days</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{vts.totalUsed} days</td>
                        <td className="px-6 py-4 text-sm text-yellow-600">{vts.totalPending} days</td>
                        <td className="px-6 py-4 text-sm text-green-600 font-medium">
                          {vts.totalAllocated - vts.totalUsed - vts.totalPending} days
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(100, vts.utilizationRate)}%`,
                                backgroundColor: vts.utilizationRate >= 90 ? "#EF4444" : vts.utilizationRate >= 70 ? "#F59E0B" : "#10B981",
                              }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">{vts.utilizationRate.toFixed(1)}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Employees Tab */}
        {activeTab === "employees" && (
          <div id="employees-panel" role="tabpanel" aria-labelledby="employees-tab">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Employee Overview</h2>
              <Link href="/admin/employees/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
                Add Employee
              </Link>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hire Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approved Days</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Days</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Requests</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employeeOverview.map((emp) => (
                      <tr key={emp.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{emp.user.name}</p>
                            <p className="text-sm text-gray-500">{emp.user.email}</p>
                            <p className="text-xs text-gray-400">ID: {emp.employeeId}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">{emp.department || "—"}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{emp.position || "—"}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{formatDate(emp.hireDate)}</td>
                        <td className="px-6 py-4 text-sm text-green-600 font-medium">{emp.stats.totalApprovedDays}</td>
                        <td className="px-6 py-4 text-sm text-yellow-600 font-medium">{emp.stats.totalPendingDays}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{emp.stats.totalRequests}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/employees/${emp.id}`}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              View
                            </Link>
                            <Link
                              href={`/admin/employees/${emp.id}/edit`}
                              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                            >
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {employeeOverview.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="mt-2">No employees found</p>
                  <Link href="/admin/employees/new" className="mt-2 inline-block text-blue-600 hover:text-blue-800">
                    Add your first employee
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <div id="requests-panel" role="tabpanel" aria-labelledby="requests-tab">
            {/* Pending Requests */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Pending Approval Queue</h2>
                <span className="bg-yellow-100 text-yellow-800 text-sm font-medium px-2 py-1 rounded-full">
                  {pendingRequests.length} pending
                </span>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {pendingRequests.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <p className="mt-2">No pending requests</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pendingRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{request.employee.user.name}</p>
                              <p className="text-sm text-gray-500">{request.employee.user.email}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: request.vacationType.color }}></span>
                              <span className="text-sm font-medium text-gray-900">{request.vacationType.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatDate(request.startDate)} - {formatDate(request.endDate)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{request.totalDays}</td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900 max-w-xs truncate" title={request.reason}>{request.reason}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{formatDate(request.createdAt)}</td>
                          <td className="px-6 py-4">
                            <Link
                              href={`/admin/vacation-requests/${request.id}`}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Review
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Processed Requests History */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Approval History</h2>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approved By</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {processedRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{request.employee.user.name}</p>
                              <p className="text-sm text-gray-500">{request.employee.user.email}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: request.vacationType.color }}></span>
                              <span className="text-sm font-medium text-gray-900">{request.vacationType.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatDate(request.startDate)} - {formatDate(request.endDate)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{request.totalDays}</td>
                          <td className="px-6 py-4">{getStatusBadge(request.status)}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {request.approvedBy?.name || "—"}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {request.approvedAt ? formatDate(request.approvedAt) : "—"}
                          </td>
                          <td className="px-6 py-4">
                            {request.adminNotes ? (
                              <button
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                onClick={() => alert(`Admin Notes: ${request.adminNotes}`)}
                              >
                                View Notes
                              </button>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {processedRequests.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <p>No processed requests yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <div id="analytics-panel" role="tabpanel" aria-labelledby="analytics-tab">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Advanced Analytics</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Vacation Type Utilization Chart */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Vacation Utilization by Type</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vacationTypeChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis type="number" tickFormatter={(v) => `${v}d`} />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="allocated" name="Allocated" fill="#E5E7EB" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="used" name="Used" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="pending" name="Pending" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Department Vacation Days */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Vacation Days by Department</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis type="number" tickFormatter={(v) => `${v}d`} />
                      <YAxis dataKey="name" type="category" width={120} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="approvedDays" name="Approved Days" fill="#10B981" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="pendingDays" name="Pending Days" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Employee Vacation Balance Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Employee Vacation Balances Detail</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                      {stats.vacationTypeStats.map((vts) => (
                        <th key={vts.vacationType.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: vts.vacationType.color }}></span>
                            {vts.vacationType.name}
                          </div>
                        </th>
                      ))}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Available</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employeeOverview.map((emp) => {
                      const totalAvailable = emp.balances.reduce((sum, b) => sum + b.availableDays, 0)
                      return (
                        <tr key={emp.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-gray-900">{emp.user.name}</p>
                            <p className="text-xs text-gray-500">{emp.user.email}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{emp.department || "—"}</td>
                          {emp.balances.map((balance) => (
                            <td key={balance.vacationType.id} className="px-6 py-4">
                              <div className="text-sm">
                                <span className="font-medium text-gray-900">{balance.availableDays}</span>
                                <span className="text-gray-500 ml-1">/ {balance.totalDays}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                <div
                                  className="h-1.5 rounded-full"
                                  style={{
                                    width: `${Math.min(100, balance.totalDays > 0 ? ((balance.usedDays + balance.pendingDays) / balance.totalDays) * 100 : 0)}%`,
                                    backgroundColor: balance.usedDays + balance.pendingDays >= balance.totalDays * 0.9 ? "#EF4444" : balance.usedDays + balance.pendingDays >= balance.totalDays * 0.7 ? "#F59E0B" : "#10B981",
                                  }}
                                ></div>
                              </div>
                            </td>
                          ))}
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{totalAvailable} days</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}