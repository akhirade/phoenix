import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from './supabase'
import type { AppSettings, Payment, Student } from './types'
import { randomToken } from './utils'

type DataContextValue = {
  loading: boolean
  settings: AppSettings
  students: Student[]
  payments: Payment[]
  refreshAll: () => Promise<void>

  refreshStudent: (studentId: string) => Promise<void>

  upsertStudent: (student: Partial<Student> & { id?: string }) => Promise<void>
  setStudentStatus: (studentId: string, status: 'Active' | 'Inactive') => Promise<void>

  ensureAdmissionLink: (studentId: string) => Promise<string>

  addPayment: (payment: Omit<Payment, 'id' | 'created_at'>) => Promise<void>

  saveSettings: (next: AppSettings) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

const DEFAULT_SETTINGS: AppSettings = {
  defaultMonthlyFee: 1500,
  defaultDueDay: 5,
  totalSeats: 45,
  centerName: 'Phoenix Study Room',
  centerAddress: '',
  centerPhone: '',
  admissionTerms:
    'Terms and Conditions\n' +
    '1. Students have to bear the Identity Card for entering the Library.\n' +
    '2. Student should deposit their monthly fees between 15 to 5th of every month.\n' +
    '3. The collected fee will not be refunded under any circumstances.\n' +
    '4. Even if admission is taken on any date, it will be considered from 1st of that month.\n' +
    '5. In case of misconduct, your admission will be cancelled immediately.\n' +
    '6. Strict silence, decorum and discipline must be maintained in the library.\n' +
    '7. Newspapers and magazines must be read only in the study center and should not be taken to any other reading areas.\n' +
    '8. The library card is not transferable and its loss must be reported immediately.\n' +
    '9. WiFi use is strictly restricted to study purpose only.\n' +
    '10. All rights reserved to the organization regarding admission, cancellation, rule changes, etc.',
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [students, setStudents] = useState<Student[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

  async function refreshAllInternal(opts?: { silent?: boolean }) {
    const silent = !!opts?.silent
    if (!silent) setLoading(true)
    try {
      const [{ data: settingsRow }, { data: st, error: stErr }, { data: pay, error: payErr }] =
        await Promise.all([
          supabase.from('app_settings').select('*').eq('id', 'default').maybeSingle(),
          supabase.from('students').select('*'),
          supabase.from('payments').select('*'),
        ])

      if (stErr) throw stErr
      if (payErr) throw payErr

      setSettings((settingsRow as any)?.value ?? DEFAULT_SETTINGS)
      setStudents((st as any) ?? [])
      setPayments((pay as any) ?? [])
    } finally {
      if (!silent) setLoading(false)
    }
  }

  async function refreshAll() {
    return refreshAllInternal({ silent: false })
  }

  async function refreshStudent(studentId: string) {
    if (!studentId) return
    const { data, error } = await supabase.from('students').select('*').eq('id', studentId).single()
    if (error) throw error
    setStudents((prev) => prev.map((s) => (s.id === studentId ? (data as any) : s)))
  }

  useEffect(() => {
    if(authLoading) return

    if(!session){
      setStudents([])
      setPayments([])
      setSettings(DEFAULT_SETTINGS)
      setLoading(false)
      return
    }

    refreshAllInternal({ silent: false }).catch(() => {
      setLoading(false)
    })
  }, [session, authLoading])

  useEffect(() => {
    if (authLoading) return
    if (!session) return

    const id = window.setInterval(() => {
      refreshAllInternal({ silent: true }).catch(() => {
        // ignore background refresh errors
      })
    }, 30_000)

    return () => window.clearInterval(id)
  }, [session, authLoading])

  async function saveSettings(next: AppSettings) {
    setSettings(next)
    const { error } = await supabase
      .from('app_settings')
      .upsert({ id: 'default', value: next }, { onConflict: 'id' })
    if (error) throw error
  }

  async function upsertStudent(student: Partial<Student> & { id?: string }) {
    const payload: any = {
      student_code: student.student_code ?? null,
      full_name: student.full_name,
      mobile: student.mobile ?? null,
      email: student.email ?? null,
      birth_date: student.birth_date ?? null,
      gender: student.gender ?? null,
      parent_contact: student.parent_contact ?? null,
      emergency_contact: student.emergency_contact ?? null,
      id_proof: student.id_proof ?? null,
      address: student.address ?? null,
      preparing_exam: student.preparing_exam ?? null,
      first_payment_receipt_no: student.first_payment_receipt_no ?? null,
      joining_date: student.joining_date ?? null,
      seat_number: student.seat_number ?? null,
      monthly_fee: Number(student.monthly_fee ?? 0),
      due_day: Number(student.due_day ?? 5),
      status: student.status ?? 'Active',
      notes: student.notes ?? null,
    }

    if(student.id){
      const { data, error } = await supabase
        .from('students')
        .update(payload)
        .eq('id', student.id)
        .select('*')
        .single()
      if (error) throw error
      setStudents((prev) => prev.map((s) => (s.id === student.id ? (data as any) : s)))
      return
    }

    const { data, error } = await supabase.from('students').insert(payload).select('*').single()
    if (error) throw error
    setStudents((prev) => [...prev, data as any])
  }

  async function setStudentStatus(studentId: string, status: 'Active' | 'Inactive') {
    const update: any = { status }
    if(status === 'Inactive') update.seat_number = null
    const { data, error } = await supabase.from('students').update(update).eq('id', studentId).select('*').single()
    if (error) throw error

    setStudents((prev) => prev.map((s) => (s.id === studentId ? (data as any) : s)))
  }

  async function ensureAdmissionLink(studentId: string): Promise<string> {
    const token = randomToken(24)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('students')
      .update({ admission_token: token, admission_token_expires_at: expiresAt } as any)
      .eq('id', studentId)
      .select('*')
      .single()

    if (error) throw error
    setStudents((prev) => prev.map((s) => (s.id === studentId ? (data as any) : s)))
    return token
  }

  async function addPayment(payment: Omit<Payment, 'id' | 'created_at'>) {
    const { data, error } = await supabase.from('payments').insert(payment as any).select('*').single()
    if (error) throw error
    setPayments((prev) => [...prev, data as any])
  }

  const value = useMemo<DataContextValue>(
    () => ({
      loading,
      settings,
      students,
      payments,
      refreshAll,
      refreshStudent,
      upsertStudent,
      setStudentStatus,
      ensureAdmissionLink,
      addPayment,
      saveSettings,
    }),
    [loading, settings, students, payments],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
