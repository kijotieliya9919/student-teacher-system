import { requireAuth } from '@/lib/auth'

export default async function StudentDashboard() {
  await requireAuth('student')

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-6">Student Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/student/assignments" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition block">
          <h3 className="font-semibold text-lg">My Assignments</h3>
          <p className="text-sm text-gray-500 mt-2">View and submit assignments</p>
        </a>
        <a href="/student/submissions" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition block">
          <h3 className="font-semibold text-lg">My Submissions</h3>
          <p className="text-sm text-gray-500 mt-2">Check your submitted work and grades</p>
        </a>
      </div>
    </div>
  )
}
