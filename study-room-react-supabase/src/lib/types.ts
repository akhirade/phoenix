export type AppSettings = {
  defaultMonthlyFee: number
  defaultDueDay: number

  totalSeats?: number

  centerName?: string
  centerAddress?: string
  centerPhone?: string
  admissionTerms?: string
}

export type StudentStatus = 'Active' | 'Inactive'

export type Student = {
  id: string
  student_code: string | null
  full_name: string
  mobile: string | null
  email: string | null
  birth_date: string | null // YYYY-MM-DD
  gender: string | null
  parent_contact: string | null
  emergency_contact: string | null
  id_proof: string | null
  address: string | null
  preparing_exam: string | null
  first_payment_receipt_no: string | null
  joining_date: string | null // YYYY-MM-DD
  seat_number: number | null
  monthly_fee: number
  due_day: number
  status: StudentStatus
  notes: string | null

  admission_token: string | null
  admission_token_expires_at: string | null
  admission_signature_name: string | null
  admission_terms_accepted_at: string | null
  admission_submitted_at: string | null
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
