import { requireAuth } from '@/lib/auth'

export default async function TeacherDashboard() {
  const { user } = await requireAuth('teacher')

  return (
    <div>
      <h1 className="text-2xl font-bold text-green-800 mb-6">Teacher Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/teacher/assignments/new" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition block">
          <h3 className="font-semibold text-lg">Upload Assignment</h3>
          <p className="text-sm text-gray-500 mt-2">Create new assignments for your class</p>
        </a>
        <a href="/teacher/classes" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition block">
          <h3 className="font-semibold text-lg">My Classes</h3>
          <p className="text-sm text-gray-500 mt-2">View your classes and students</p>
        </a>
      </div>
    </div>
  )
}
