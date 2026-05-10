export interface User {
  id: string
  email: string
  password: string
  fullName: string
  role: 'admin' | 'teacher' | 'student'
  classId?: number
}

export interface Class {
  id: number
  name: string
  code: string
}

export interface Assignment {
  id: number
  title: string
  description: string
  classId: number
  fileUrl?: string
  dueDate: string
  createdAt: string
}

export interface Submission {
  id: number
  assignmentId: number
  studentId: string
  studentName?: string
  fileUrl?: string
  grade?: number
  feedback?: string
  submittedAt: string
}

let uidCounter = 3
let cidCounter = 4
let aidCounter = 4
let sidCounter = 4

const KEYS = {
  USERS: 'ls_users',
  CLASSES: 'ls_classes',
  ASSIGNMENTS: 'ls_assignments',
  SUBMISSIONS: 'ls_submissions',
  SESSION: 'ls_session',
}

function getArr<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(key)
  return raw ? JSON.parse(raw) : []
}

function setArr<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data))
}

function genId(): string {
  return crypto.randomUUID?.() || Math.random().toString(36).slice(2, 11)
}

export function seedIfEmpty() {
  if (typeof window === 'undefined') return
  const exists = localStorage.getItem(KEYS.USERS)
  if (exists) return

  localStorage.setItem(KEYS.USERS, JSON.stringify([
    { id: genId(), email: 'admin@forestry.edu', password: 'admin123', fullName: 'Dr. Admin', role: 'admin' },
    { id: genId(), email: 'teacher@forestry.edu', password: 'teacher123', fullName: 'Prof. Jane', role: 'teacher', classId: 1 },
    { id: genId(), email: 'student@forestry.edu', password: 'student123', fullName: 'John Student', role: 'student', classId: 1 },
  ]))

  localStorage.setItem(KEYS.CLASSES, JSON.stringify([
    { id: 1, name: 'Forestry 101', code: 'FOR101' },
    { id: 2, name: 'Forestry 202', code: 'FOR202' },
    { id: 3, name: 'Wildlife Mgmt', code: 'WLM301' },
  ]))

  localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify([
    { id: 1, title: 'Tree Identification', description: 'Identify 10 local tree species and submit photos.', classId: 1, dueDate: '2026-06-15', createdAt: '2026-05-01' },
    { id: 2, title: 'Forest Mapping', description: 'Create a topographic map of the given forest area.', classId: 1, dueDate: '2026-07-01', createdAt: '2026-05-10' },
    { id: 3, title: 'Wildlife Report', description: 'Write a report on local wildlife observations.', classId: 2, dueDate: '2026-06-30', createdAt: '2026-05-15' },
  ]))

  localStorage.setItem(KEYS.SUBMISSIONS, JSON.stringify([
    { id: 1, assignmentId: 1, studentId: '', studentName: 'John Student', fileUrl: '', grade: 85, feedback: 'Good work!', submittedAt: '2026-05-20' },
  ]))
}

function addFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}

export const store = {
  auth: {
    login(email: string, password: string) {
      const users = getArr<User>(KEYS.USERS)
      const user = users.find(u => u.email === email && u.password === password)
      if (!user) return { ok: false, error: 'Invalid email or password' }
      localStorage.setItem(KEYS.SESSION, JSON.stringify(user))
      return { ok: true, user }
    },
    logout() {
      localStorage.removeItem(KEYS.SESSION)
    },
    session(): User | null {
      if (typeof window === 'undefined') return null
      const raw = localStorage.getItem(KEYS.SESSION)
      return raw ? JSON.parse(raw) : null
    },
    register(data: { email: string; password: string; fullName: string; role: 'student' | 'teacher'; classId?: number }) {
      const users = getArr<User>(KEYS.USERS)
      if (users.find(u => u.email === data.email)) return { ok: false, error: 'Email already registered' }
      const user: User = { id: genId(), ...data }
      users.push(user)
      setArr(KEYS.USERS, users)
      return { ok: true, user }
    },
  },

  users: {
    all() { return getArr<User>(KEYS.USERS) },
    byId(id: string) { return getArr<User>(KEYS.USERS).find(u => u.id === id) || null },
    byRole(role: string) { return getArr<User>(KEYS.USERS).filter(u => u.role === role) },
    update(id: string, changes: Partial<User>) {
      const users = getArr<User>(KEYS.USERS)
      const idx = users.findIndex(u => u.id === id)
      if (idx === -1) return null
      users[idx] = { ...users[idx], ...changes }
      setArr(KEYS.USERS, users)
      return users[idx]
    },
    delete(id: string) {
      const users = getArr<User>(KEYS.USERS).filter(u => u.id !== id)
      setArr(KEYS.USERS, users)
    },
  },

  classes: {
    all() { return getArr<Class>(KEYS.CLASSES) },
    byId(id: number) { return getArr<Class>(KEYS.CLASSES).find(c => c.id === id) || null },
    create(data: { name: string; code: string }) {
      const classes = getArr<Class>(KEYS.CLASSES)
      const cls: Class = { id: cidCounter++, ...data }
      classes.push(cls)
      setArr(KEYS.CLASSES, classes)
      return cls
    },
    update(id: number, changes: Partial<Class>) {
      const classes = getArr<Class>(KEYS.CLASSES)
      const idx = classes.findIndex(c => c.id === id)
      if (idx === -1) return null
      classes[idx] = { ...classes[idx], ...changes }
      setArr(KEYS.CLASSES, classes)
      return classes[idx]
    },
    delete(id: number) {
      setArr(KEYS.CLASSES, getArr<Class>(KEYS.CLASSES).filter(c => c.id !== id))
    },
  },

  assignments: {
    all() { return getArr<Assignment>(KEYS.ASSIGNMENTS) },
    byId(id: number) { return getArr<Assignment>(KEYS.ASSIGNMENTS).find(a => a.id === id) || null },
    byClass(classId: number) { return getArr<Assignment>(KEYS.ASSIGNMENTS).filter(a => a.classId === classId) },
    async create(data: { title: string; description: string; classId: number; file?: File; dueDate: string }) {
      const assignments = getArr<Assignment>(KEYS.ASSIGNMENTS)
      const assignment: Assignment = {
        id: aidCounter++, title: data.title, description: data.description,
        classId: data.classId, dueDate: data.dueDate, createdAt: new Date().toISOString().slice(0, 10),
        fileUrl: data.file ? await addFile(data.file) : undefined,
      }
      assignments.push(assignment)
      setArr(KEYS.ASSIGNMENTS, assignments)
      return assignment
    },
    delete(id: number) {
      setArr(KEYS.ASSIGNMENTS, getArr<Assignment>(KEYS.ASSIGNMENTS).filter(a => a.id !== id))
    },
  },

  submissions: {
    all() { return getArr<Submission>(KEYS.SUBMISSIONS) },
    byAssignment(assignmentId: number) { return getArr<Submission>(KEYS.SUBMISSIONS).filter(s => s.assignmentId === assignmentId) },
    byStudent(studentId: string) { return getArr<Submission>(KEYS.SUBMISSIONS).filter(s => s.studentId === studentId) },
    async submit(data: { assignmentId: number; studentId: string; studentName: string; file?: File }) {
      const submissions = getArr<Submission>(KEYS.SUBMISSIONS)
      const submission: Submission = {
        id: sidCounter++, assignmentId: data.assignmentId,
        studentId: data.studentId, studentName: data.studentName,
        fileUrl: data.file ? await addFile(data.file) : undefined,
        submittedAt: new Date().toISOString().slice(0, 10),
      }
      submissions.push(submission)
      setArr(KEYS.SUBMISSIONS, submissions)
      return submission
    },
    grade(id: number, grade: number, feedback: string) {
      const submissions = getArr<Submission>(KEYS.SUBMISSIONS)
      const idx = submissions.findIndex(s => s.id === id)
      if (idx === -1) return null
      submissions[idx].grade = grade
      submissions[idx].feedback = feedback
      setArr(KEYS.SUBMISSIONS, submissions)
      return submissions[idx]
    },
  },
}
