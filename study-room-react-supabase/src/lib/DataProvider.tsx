import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from './supabase'
import type { AppSettings, Payment, Student } from './types'
import { randomToken } from './utils'

type DataContextValue = {
  loading: boolean
  tenantError: string | null
  settings: AppSettings
  students: Student[]
  refreshAll: () => Promise<void>

  refreshStudent: (studentId: string) => Promise<void>

  upsertStudent: (student: Partial<Student> & { id?: string }) => Promise<void>
  setStudentStatus: (studentId: string, status: 'Active' | 'Inactive') => Promise<void>

  ensureAdmissionLink: (studentId: string) => Promise<string>

  addPayment: (payment: Omit<Payment, 'id' | 'created_at'>) => Promise<Payment>

  listPaymentsByMonth: (month: string) => Promise<Payment[]>
  listPaymentsByStudent: (studentId: string) => Promise<Payment[]>

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

function isTransientNetworkError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string'
        ? err.message
        : ''

  return /failed to fetch|network request failed|networkerror|load failed/i.test(msg)
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [tenantError, setTenantError] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [students, setStudents] = useState<Student[]>([])

  const refreshAllInternal = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = !!opts?.silent
      if (!silent) setLoading(true)
      try {
        const userId = session?.user?.id
        if (!userId) {
          setTenantError(null)
          setSettings(DEFAULT_SETTINGS)
          setStudents([])
          return
        }

        // Multi-tenant: each user must have a profile mapping them to a tenant.
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('user_id', userId)
          .maybeSingle()

        if (profileErr) throw profileErr

        if (!profile?.tenant_id) {
          setTenantError('This user is not assigned to a Study Room yet. Ask the admin to add a row in public.profiles for your user.')
          setSettings(DEFAULT_SETTINGS)
          setStudents([])
          return
        }

        setTenantError(null)

        const [{ data: settingsRow }, { data: st, error: stErr }] = await Promise.all([
          supabase.from('app_settings').select('*').eq('id', 'default').maybeSingle(),
          supabase.from('students').select('*'),
        ])

        if (stErr) throw stErr

        setSettings((settingsRow as any)?.value ?? DEFAULT_SETTINGS)
        setStudents((st as any) ?? [])
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [session?.user?.id],
  )

  const refreshAll = useCallback(async () => refreshAllInternal({ silent: false }), [refreshAllInternal])

  const refreshStudent = useCallback(async (studentId: string) => {
    if (!studentId) return
    const { data, error } = await supabase.from('students').select('*').eq('id', studentId).single()
    if (error) throw error
    setStudents((prev) => prev.map((s) => (s.id === studentId ? (data as any) : s)))
  }, [])

  useEffect(() => {
    if(authLoading) return

    if(!session){
      setStudents([])
      setSettings(DEFAULT_SETTINGS)
      setTenantError(null)
      setLoading(false)
      return
    }

    refreshAllInternal({ silent: false }).catch(() => {
      setLoading(false)
    })
  }, [session, authLoading, refreshAllInternal])

  const saveSettings = useCallback(async (next: AppSettings) => {
    setSettings(next)
    const { error } = await supabase
      .from('app_settings')
      .upsert({ id: 'default', value: next }, { onConflict: 'tenant_id,id' })
    if (error) throw error
  }, [])

  const upsertStudent = useCallback(async (student: Partial<Student> & { id?: string }) => {
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
  }, [])

  const setStudentStatus = useCallback(async (studentId: string, status: 'Active' | 'Inactive') => {
    const update: any = { status }
    if(status === 'Inactive') update.seat_number = null
    const { data, error } = await supabase.from('students').update(update).eq('id', studentId).select('*').single()
    if (error) throw error

    setStudents((prev) => prev.map((s) => (s.id === studentId ? (data as any) : s)))
  }, [])

  const ensureAdmissionLink = useCallback(async (studentId: string): Promise<string> => {
    const token = randomToken(24)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    let lastError: unknown = null
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { data, error } = await supabase
        .from('students')
        .update({ admission_token: token, admission_token_expires_at: expiresAt } as any)
        .eq('id', studentId)
        .select('*')
        .single()

      if (!error) {
        setStudents((prev) => prev.map((s) => (s.id === studentId ? (data as any) : s)))
        return token
      }

      lastError = error
      if (!isTransientNetworkError(error)) break

      if (attempt < 3) {
        const waitMs = 250 * attempt
        await new Promise((resolve) => window.setTimeout(resolve, waitMs))
      }
    }

    throw lastError
  }, [])

  const addPayment = useCallback(async (payment: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> => {
    const { data, error } = await supabase.from('payments').insert(payment as any).select('*').single()
    if (error) throw error
    return data as any as Payment
  }, [])

  const listPaymentsByMonth = useCallback(async (month: string): Promise<Payment[]> => {
    if (!session) return []
    const pageSize = 1000
    const out: Payment[] = []
    for (let from = 0; ; from += pageSize) {
      const to = from + pageSize - 1
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('month', month)
        .order('payment_date', { ascending: false })
        .range(from, to)

      if (error) throw error
      const rows = (data as any as Payment[]) ?? []
      out.push(...rows)
      if (rows.length < pageSize) break
    }
    return out
  }, [session])

  const listPaymentsByStudent = useCallback(async (studentId: string): Promise<Payment[]> => {
    if (!session) return []
    const pageSize = 1000
    const out: Payment[] = []
    for (let from = 0; ; from += pageSize) {
      const to = from + pageSize - 1
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', studentId)
        .order('payment_date', { ascending: false })
        .range(from, to)

      if (error) throw error
      const rows = (data as any as Payment[]) ?? []
      out.push(...rows)
      if (rows.length < pageSize) break
    }
    return out
  }, [session])

  const value = useMemo<DataContextValue>(
    () => ({
      loading,
      tenantError,
      settings,
      students,
      refreshAll,
      refreshStudent,
      upsertStudent,
      setStudentStatus,
      ensureAdmissionLink,
      addPayment,
      listPaymentsByMonth,
      listPaymentsByStudent,
      saveSettings,
    }),
    [
      loading,
      tenantError,
      settings,
      students,
      refreshAll,
      refreshStudent,
      upsertStudent,
      setStudentStatus,
      ensureAdmissionLink,
      addPayment,
      listPaymentsByMonth,
      listPaymentsByStudent,
      saveSettings,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
