import { requireAuth } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/server'
import CreateClassForm from './create-class-form'

export default async function AdminClasses() {
  const { supabase } = await requireAuth('admin')
  const svc = createServiceClient()

  const { data: classes } = await svc
    .from('classes')
    .select('*')
    .order('name')

  const { data: teachers } = await svc
    .from('users')
    .select('id, full_name, email')
    .eq('role', 'teacher')

  const classData = await Promise.all((classes || []).map(async (c: any) => {
    const teacher = (teachers || []).find((t: any) => t.id === c.teacher_id)
    const { count } = await svc
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', c.id)
      .eq('role', 'student')
    return { ...c, teacherName: teacher?.full_name || 'Unassigned', studentCount: count || 0 }
  }))

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-green-800">Classes</h1>
      </div>

      <div className="mb-8">
        <CreateClassForm teachers={teachers || []} />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-medium text-gray-600">Name</th>
              <th className="text-left p-3 font-medium text-gray-600">Code</th>
              <th className="text-left p-3 font-medium text-gray-600">Teacher</th>
              <th className="text-left p-3 font-medium text-gray-600">Students</th>
            </tr>
          </thead>
          <tbody>
            {classData.map(c => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3 text-sm text-gray-500">{c.code}</td>
                <td className="p-3 text-sm text-gray-500">{c.teacherName}</td>
                <td className="p-3">{c.studentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
