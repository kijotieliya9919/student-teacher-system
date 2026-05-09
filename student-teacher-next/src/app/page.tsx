import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-800 to-green-600 text-white">
      <div className="text-center max-w-2xl px-4">
        <h1 className="text-4xl font-bold mb-4">FORESTRY TRAINING INSTITUTE OLMOTONYI</h1>
        <p className="text-xl mb-8 text-green-100">Student-Teacher Assignment Portal</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/login" className="px-8 py-3 bg-white text-green-800 rounded-lg font-semibold hover:bg-green-50 transition">
            Login
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-green-700/50 p-6 rounded-lg">
            <h3 className="font-bold text-lg mb-2">Students</h3>
            <p className="text-green-100 text-sm">View assignments, submit work, track your grades and progress.</p>
          </div>
          <div className="bg-green-700/50 p-6 rounded-lg">
            <h3 className="font-bold text-lg mb-2">Teachers</h3>
            <p className="text-green-100 text-sm">Create assignments for your classes, review submissions, and grade students.</p>
          </div>
          <div className="bg-green-700/50 p-6 rounded-lg">
            <h3 className="font-bold text-lg mb-2">Administrators</h3>
            <p className="text-green-100 text-sm">Manage users, classes, and oversee the entire system.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
