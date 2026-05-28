export type AppSettings = {
  defaultMonthlyFee: number
  defaultDueDay: number
}

export type StudentStatus = 'Active' | 'Inactive'

export type Student = {
  id: string
  student_code: string | null
  full_name: string
  mobile: string | null
  parent_contact: string | null
  id_proof: string | null
  address: string | null
  joining_date: string | null // YYYY-MM-DD
  seat_number: number | null
  monthly_fee: number
  due_day: number
  status: StudentStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type PaymentMode = 'Cash' | 'UPI' | 'Bank'

export type Payment = {
  id: string
  student_id: string | null
  student_name: string
  seat_number: number | null
  month: string // YYYY-MM
  amount_paid: number
  payment_date: string // YYYY-MM-DD
  payment_mode: PaymentMode
  transaction_id: string | null
  remarks: string | null
  status: string | null
  created_at: string
}
