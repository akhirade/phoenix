import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Locale = 'en' | 'mr'

type I18nContextValue = {
  locale: Locale
  setLocale: (next: Locale) => void
  toggleLocale: () => void
  t: (key: keyof typeof MESSAGES['en'], vars?: Record<string, string | number | null | undefined>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = 'phoenix-study-room-locale'

const MESSAGES = {
  en: {
    appName: 'Phoenix Study Room',

    close: 'Close',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
    view: 'View',
    edit: 'Edit',
    new: 'New',
    status: 'Status',
    seat: 'Seat',
    seatNumber: 'Seat Number',
    noSeat: '(No seat)',
    requiredWhenActive: 'Required when Status is Active.',
    notes: 'Notes',

    active: 'Active',
    inactive: 'Inactive',
    markInactive: 'Mark Inactive',
    markActive: 'Mark Active',

    monthInput: 'Month (YYYY-MM)',
    monthColumn: 'Month',
    date: 'Date',
    amount: 'Amount',
    amountPaid: 'Amount Paid',
    mode: 'Mode',
    txn: 'Txn',
    transactionId: 'ट्रान्झॅक्शन आयडी',
    remarks: 'Remarks',
    paid: 'Paid',
    due: 'Due',
    fee: 'Fee',
    pending: 'Pending',
    occupied: 'Occupied',
    available: 'Available',
    partialPaid: 'Partial Paid',
    paidStatus: 'Paid',

    seatLabel: 'Seat {{n}}',
    dueAmountLabel: 'Due: ₹{{amount}}',

    fullName: 'Full Name',
    mobileNumber: 'Mobile Number',
    mobile: 'Mobile',
    parentContact: 'Parent Contact',
    parent: 'Parent',
    idProof: 'Aadhaar/ID Proof (optional)',
    address: 'Address',
    joiningDate: 'Joining Date',
    monthlyFee: 'Monthly Fee',
    dueDay: 'Due Day (1-28)',

    dashboardTitle: 'Dashboard',
    dashboardMonth: 'Month: {{month}}',
    statTotalSeats: 'Total Seats',
    statOccupied: 'Occupied',
    statAvailable: 'Available',
    statActiveStudents: 'Active Students',
    statMonthlyCollection: 'Monthly Collection',
    statPendingPayments: 'Pending Payments',
    loading: 'Loading…',

    studentsTitle: 'Students',
    studentsSubtitle: 'Add/edit students, allocate seats, mark inactive.',
    search: 'Search',
    searchPlaceholder: 'Name, mobile, parent, ID',
    phonePlaceholder10: '10-digit',
    filter: 'Filter',
    filterAll: 'All',
    tableStudent: 'Student',
    tableSeat: 'Seat',
    tableStatus: 'Status',
    noStudents: 'No students.',
    totalSeatsEnforced: 'Total seats: {{n}}. Active seat allocation is enforced.',
    addStudent: 'Add Student',
    editStudent: 'Edit Student',
    existingStudentPlaceholder: 'Type to add or select…',
    existingStudentHint: 'Start typing to select an existing student, or enter a new name.',
    moveSeatWarning: 'This will move the student from Seat {{from}} to Seat {{to}}.',
    seatClearedWhenInactive: 'Seat is cleared automatically when inactive.',
    editing: 'Editing',
    student: 'Student',
    addStudentButton: 'Add Student',
    saveChanges: 'Save Changes',
    studentAdded: 'Student added.',
    studentUpdated: 'Student updated',

    seatsTitle: 'Seats',
    seatsLegend: 'Green = Available • Red = Occupied • Yellow = Payment Pending (month {{month}})',
    clickToAssign: 'Click to assign',
    clickToView: 'Click to view',
    addManageStudents: 'Add / Manage Students',

    paymentsTitle: 'Payments',
    paymentsSubtitle: 'Record monthly fee collection (history preserved).',
    unpaidPartial: 'Unpaid / Partial',
    paymentRecords: 'Payment Records',
    noPendingDues: 'No pending dues for {{month}}.',
    noPaymentsForMonth: 'No payments for {{month}}.',
    addPayment: 'Add Payment',
    select: 'Select',
    paymentDate: 'Payment Date',
    savePayment: 'Save Payment',
    paymentRecorded: 'Payment recorded.',
    errSelectStudent: 'Select a student',
    errAmountGtZero: 'Amount must be > 0',
    errCouldNotAddPayment: 'Could not add payment',

    reportsTitle: 'Reports',
    reportsSubtitle: 'Monthly collection and occupancy summary.',
    statCollected: 'Collected',
    statPending: 'Pending',
    statPaidStudents: 'Paid Students',
    statVacant: 'Vacant',
    statSeats: 'Seats',
    reportsNote: 'Exports (PDF/Excel) can be added next; for now you can export from Supabase or add CSV export in-app.',

    settingsTitle: 'Settings',
    settingsSubtitle: 'Defaults stored in Supabase.',
    defaultMonthlyFee: 'Default Monthly Fee',
    defaultDueDay: 'Default Due Day (1-28)',
    settingsSaved: 'Settings saved.',
    saved: 'Saved.',
    saveFailed: 'Save failed',
    securityTip: 'Security tip: In Supabase Auth settings, disable public signups and invite only your 2–3 users.',
    errDueDayRange: 'Due day must be between 1 and 28',

    studentProfile: 'Student Profile',
    studentNotFound: 'Student not found.',
    studentId: 'Student ID',
    currentMonth: 'Current Month ({{month}})',
    recordPayment: 'Record Payment',
    changeSeat: 'Change Seat',
    paymentHistory: 'Payment History',
    noPaymentsYet: 'No payments recorded yet.',

    modeCash: 'Cash',
    modeUpi: 'UPI',
    modeBank: 'Bank',

    errSeatNumberMissing: 'Seat number missing.',
    errSeatOccupiedBy: 'Seat {{seat}} is already occupied by {{name}}.',
    errFullNameRequired: 'Full name is required',
    errMobileRequired: 'Mobile number is required',
    errMobile10Digits: 'Mobile number must be 10 digits',
    errParent10Digits: 'Parent contact must be 10 digits',
    errDueDayRange28: 'Due day must be between 1 and 28',
    errSeatRequiredActive: 'Seat number is required for active student',
    errSeatAlreadyOccupied: 'Seat {{seat}} is already occupied by {{name}}.',
    errFailedUpdateStudent: 'Failed to update student',

    headerSharedSignedInAs: 'Shared (Supabase) • Signed in as {{email}}',
    logout: 'Logout',

    themeLight: 'Light',
    themeDark: 'Dark',

    langEnglish: 'EN',
    langMarathi: 'MR',

    navDashboard: 'Dashboard',
    navStudents: 'Students',
    navSeats: 'Seats',
    navPayments: 'Payments',
    navReports: 'Reports',
    navSettings: 'Settings',

    loginTitle: 'Admin Login',
    loginSubtitle: 'Shared + secure (Supabase Auth)',
    email: 'Email',
    password: 'Password',
    login: 'Login',
    signingIn: 'Signing in…',
    tipInviteOnly: 'Tip: In Supabase Auth settings, disable public signups and invite only your staff.',
  },
  mr: {
    appName: 'Phoenix Study Room',

    close: 'बंद करा',
    cancel: 'रद्द करा',
    save: 'सेव्ह',
    saving: 'सेव्ह होत आहे…',
    view: 'पहा',
    edit: 'संपादन',
    new: 'नवीन',
    status: 'स्थिती',
    seat: 'सीट',
    seatNumber: 'सीट नंबर',
    noSeat: '(सीट नाही)',
    requiredWhenActive: 'स्थिती सक्रिय असल्यास सीट आवश्यक आहे.',
    notes: 'नोंदी',

    active: 'सक्रिय',
    inactive: 'निष्क्रिय',
    markInactive: 'निष्क्रिय करा',
    markActive: 'सक्रिय करा',

    monthInput: 'महिना (YYYY-MM)',
    monthColumn: 'महिना',
    date: 'तारीख',
    amount: 'रक्कम',
    amountPaid: 'भरलेली रक्कम',
    mode: 'पद्धत',
    txn: 'Txn',
    transactionId: 'ट्रान्झॅक्शन आयडी',
    remarks: 'नोंद',
    paid: 'भरले',
    due: 'बाकी',
    fee: 'फी',
    pending: 'बाकी',
    occupied: 'व्यवस्थित',
    available: 'उपलब्ध',
    partialPaid: 'अंशतः भरले',
    paidStatus: 'भरले',

    seatLabel: 'सीट {{n}}',
    dueAmountLabel: 'बाकी: ₹{{amount}}',

    fullName: 'पूर्ण नाव',
    mobileNumber: 'मोबाइल नंबर',
    mobile: 'मोबाइल',
    parentContact: 'पालक संपर्क',
    parent: 'पालक',
    idProof: 'आधार/आयडी (ऐच्छिक)',
    address: 'पत्ता',
    joiningDate: 'अॅडमिशन तारीख',
    monthlyFee: 'मासिक फी',
    dueDay: 'देय दिनांक (1-28)',

    dashboardTitle: 'डॅशबोर्ड',
    dashboardMonth: 'महिना: {{month}}',
    statTotalSeats: 'एकूण सीट्स',
    statOccupied: 'व्यवस्थित',
    statAvailable: 'उपलब्ध',
    statActiveStudents: 'सक्रिय विद्यार्थी',
    statMonthlyCollection: 'मासिक जमा',
    statPendingPayments: 'बाकी पेमेंट्स',
    loading: 'लोड होत आहे…',

    studentsTitle: 'विद्यार्थी',
    studentsSubtitle: 'विद्यार्थी जोडा/संपादन करा, सीट द्या, निष्क्रिय करा.',
    search: 'शोध',
    searchPlaceholder: 'नाव, मोबाइल, पालक, ID',
    phonePlaceholder10: '10-अंकी',
    filter: 'फिल्टर',
    filterAll: 'सर्व',
    tableStudent: 'विद्यार्थी',
    tableSeat: 'सीट',
    tableStatus: 'स्थिती',
    noStudents: 'विद्यार्थी नाहीत.',
    totalSeatsEnforced: 'एकूण सीट्स: {{n}}. सक्रिय सीट allocation enforce आहे.',
    addStudent: 'विद्यार्थी जोडा',
    editStudent: 'विद्यार्थी संपादन',
    existingStudentPlaceholder: 'नाव टाइप करून निवडा/नवीन जोडा…',
    existingStudentHint: 'विद्यमान विद्यार्थी निवडण्यासाठी टाइप करा किंवा नवीन नाव लिहा.',
    moveSeatWarning: 'हा विद्यार्थी सीट {{from}} वरून सीट {{to}} वर हलवला जाईल.',
    seatClearedWhenInactive: 'निष्क्रिय केल्यावर सीट आपोआप काढली जाते.',
    editing: 'संपादन',
    student: 'विद्यार्थी',
    addStudentButton: 'विद्यार्थी जोडा',
    saveChanges: 'बदल सेव्ह करा',
    studentAdded: 'विद्यार्थी जोडला.',
    studentUpdated: 'विद्यार्थी अपडेट झाला',

    seatsTitle: 'सीट्स',
    seatsLegend: 'हिरवा = उपलब्ध • लाल = भरलेली • पिवळा = पेमेंट बाकी (महिना {{month}})',
    clickToAssign: 'असाइन करण्यासाठी क्लिक करा',
    clickToView: 'पहा',
    addManageStudents: 'विद्यार्थी जोडा / व्यवस्थापन',

    paymentsTitle: 'पेमेंट्स',
    paymentsSubtitle: 'मासिक फी पेमेंट नोंदवा (हिस्टरी सेव्ह राहते).',
    unpaidPartial: 'बाकी / अंशतः भरले',
    paymentRecords: 'पेमेंट रेकॉर्ड्स',
    noPendingDues: '{{month}} साठी कोणतीही बाकी नाही.',
    noPaymentsForMonth: '{{month}} साठी पेमेंट नाही.',
    addPayment: 'पेमेंट जोडा',
    select: 'निवडा',
    paymentDate: 'पेमेंट तारीख',
    savePayment: 'पेमेंट सेव्ह करा',
    paymentRecorded: 'पेमेंट नोंदले.',
    errSelectStudent: 'विद्यार्थी निवडा',
    errAmountGtZero: 'रक्कम 0 पेक्षा जास्त असावी',
    errCouldNotAddPayment: 'पेमेंट जोडता आले नाही',

    reportsTitle: 'अहवाल',
    reportsSubtitle: 'मासिक जमा आणि सीट-स्थिती (occupancy) सारांश.',
    statCollected: 'जमा',
    statPending: 'बाकी',
    statPaidStudents: 'भरलेले विद्यार्थी',
    statVacant: 'रिक्त',
    statSeats: 'सीट्स',
    reportsNote: 'PDF/Excel export पुढे जोडू शकतो; आत्ता Supabase मधून export किंवा app मध्ये CSV export जोडू शकतो.',

    settingsTitle: 'सेटिंग्ज',
    settingsSubtitle: 'डीफॉल्ट सेटिंग्ज Supabase मध्ये सेव्ह होतात.',
    defaultMonthlyFee: 'डीफॉल्ट मासिक फी',
    defaultDueDay: 'डीफॉल्ट देय दिनांक (1-28)',
    settingsSaved: 'सेटिंग्ज सेव्ह झाली.',
    saved: 'सेव्ह झाले.',
    saveFailed: 'सेव्ह अयशस्वी',
    securityTip: 'टीप: Supabase Auth मध्ये public signups बंद करा आणि फक्त 2–3 users invite करा.',
    errDueDayRange: 'देय दिनांक 1 ते 28 दरम्यान असावा',

    studentProfile: 'विद्यार्थी प्रोफाइल',
    studentNotFound: 'विद्यार्थी सापडला नाही.',
    studentId: 'विद्यार्थी ID',
    currentMonth: 'सध्याचा महिना ({{month}})',
    recordPayment: 'पेमेंट नोंदवा',
    changeSeat: 'सीट बदला',
    paymentHistory: 'पेमेंट हिस्टरी',
    noPaymentsYet: 'अजून पेमेंट नोंद नाही.',

    modeCash: 'कॅश',
    modeUpi: 'UPI',
    modeBank: 'बँक',

    errSeatNumberMissing: 'सीट नंबर नाही.',
    errSeatOccupiedBy: 'सीट {{seat}} आधीच {{name}} कडे आहे.',
    errFullNameRequired: 'पूर्ण नाव आवश्यक आहे',
    errMobileRequired: 'मोबाइल नंबर आवश्यक आहे',
    errMobile10Digits: 'मोबाइल नंबर 10 अंकी असावा',
    errParent10Digits: 'पालक संपर्क 10 अंकी असावा',
    errDueDayRange28: 'देय दिनांक 1 ते 28 दरम्यान असावा',
    errSeatRequiredActive: 'सक्रिय विद्यार्थ्यासाठी सीट आवश्यक आहे',
    errSeatAlreadyOccupied: 'सीट {{seat}} आधीच {{name}} कडे आहे.',
    errFailedUpdateStudent: 'विद्यार्थी अपडेट होऊ शकला नाही',

    headerSharedSignedInAs: 'Shared (Supabase) • {{email}} ने साइन इन केले',
    logout: 'लॉगआउट',

    themeLight: 'लाइट',
    themeDark: 'डार्क',

    langEnglish: 'EN',
    langMarathi: 'MR',

    navDashboard: 'डॅशबोर्ड',
    navStudents: 'विद्यार्थी',
    navSeats: 'सीट्स',
    navPayments: 'पेमेंट्स',
    navReports: 'अहवाल',
    navSettings: 'सेटिंग्ज',

    loginTitle: 'अॅडमिन लॉगिन',
    loginSubtitle: 'Shared + secure (Supabase Auth)',
    email: 'ईमेल',
    password: 'पासवर्ड',
    login: 'लॉगिन',
    signingIn: 'साइन इन होत आहे…',
    tipInviteOnly: 'टीप: Supabase Auth सेटिंग्जमध्ये public signups बंद करा आणि फक्त तुमच्या स्टाफला invite करा.',
  },
} as const

function safeReadLocale(): Locale {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'mr' ? 'mr' : 'en'
}

function applyLocaleToDocument(locale: Locale) {
  document.documentElement.lang = locale
}

function interpolate(template: string, vars?: Record<string, string | number | null | undefined>) {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_m, k) => {
    const v = vars[k]
    return v === null || v === undefined ? '' : String(v)
  })
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      return safeReadLocale()
    } catch {
      return 'en'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // ignore
    }
    applyLocaleToDocument(locale)
  }, [locale])

  const value = useMemo<I18nContextValue>(() => {
    const t: I18nContextValue['t'] = (key, vars) => {
      const msg = (MESSAGES as any)[locale]?.[key] ?? (MESSAGES as any).en[key] ?? String(key)
      return interpolate(String(msg), vars)
    }

    return {
      locale,
      setLocale: setLocaleState,
      toggleLocale: () => setLocaleState((l) => (l === 'en' ? 'mr' : 'en')),
      t,
    }
  }, [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
