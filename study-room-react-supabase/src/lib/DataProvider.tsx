import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from './supabase'
import type { AppSettings, Payment, Student } from './types'

type DataContextValue = {
  loading: boolean
  settings: AppSettings
  students: Student[]
  payments: Payment[]
  refreshAll: () => Promise<void>

  upsertStudent: (student: Partial<Student> & { id?: string }) => Promise<void>
  setStudentStatus: (studentId: string, status: 'Active' | 'Inactive') => Promise<void>

  addPayment: (payment: Omit<Payment, 'id' | 'created_at'>) => Promise<void>

  saveSettings: (next: AppSettings) => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

const DEFAULT_SETTINGS: AppSettings = { defaultMonthlyFee: 1500, defaultDueDay: 5 }

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [students, setStudents] = useState<Student[]>([])
  const [payments, setPayments] = useState<Payment[]>([])

  async function refreshAll() {
    setLoading(true)
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
      setLoading(false)
    }
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

    refreshAll().catch(() => {
      setLoading(false)
    })
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
      parent_contact: student.parent_contact ?? null,
      id_proof: student.id_proof ?? null,
      address: student.address ?? null,
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
      upsertStudent,
      setStudentStatus,
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
