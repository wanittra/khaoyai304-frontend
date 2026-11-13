import type { CoverageState, Outcome } from './model'

const base = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

export const hasBackend = !!base
export const sessionExpired = 'khao304:session-expired'

export class ApiError extends Error {
  constructor(readonly status: number, text: string) {
    super(text)
  }
}

const statusMessages: Partial<Record<number, string>> = {
  400: 'ข้อมูลที่ส่งไม่ถูกต้อง',
  401: 'กรุณาเข้าสู่ระบบอีกครั้ง',
  403: 'บัญชีนี้ไม่มีสิทธิ์ทำรายการ',
  404: 'ไม่พบข้อมูลที่ขอ',
  409: 'รหัสชุดอัปโหลดซ้ำ กรุณาลองส่งใหม่',
  413: 'ไฟล์รวมเกิน 25 MiB',
  415: 'รูปแบบการอัปโหลดไม่ถูกต้อง',
}

const loginErrors: Partial<Record<number, string>> = {
  401: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
  403: 'บัญชีนี้ไม่ได้รับอนุญาตให้เข้าสู่ระบบ',
  404: 'ไม่พบ API สำหรับเข้าสู่ระบบ (HTTP 404)',
  405: 'API เข้าสู่ระบบไม่รองรับคำขอนี้ (HTTP 405)',
  429: 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ (HTTP 429)',
  502: 'เซิร์ฟเวอร์ตัวกลางส่งคำขอเข้าสู่ระบบไปยัง Backend ไม่สำเร็จ (HTTP 502)',
  503: 'ระบบเข้าสู่ระบบยังไม่พร้อมให้บริการ (HTTP 503)',
  504: 'Backend ใช้เวลาตอบกลับนานเกินไป (HTTP 504)',
}

const sessionCheckTimeout = 8_000
const sessionCheckError = 'ตรวจสอบเซสชันเดิมไม่สำเร็จ'
const sessionTimeoutMessage = sessionCheckError + ' เพราะ API ไม่ตอบภายใน ' + (sessionCheckTimeout / 1000) + ' วินาที'
const sessionCheckErrors: Partial<Record<number, string>> = {
  403: 'เซิร์ฟเวอร์ปฏิเสธการตรวจสอบเซสชัน',
  404: 'ไม่พบ API สำหรับตรวจสอบเซสชัน',
  500: 'ระบบตรวจสอบเซสชันฝั่ง Backend ขัดข้อง',
  502: 'เซิร์ฟเวอร์ตัวกลางติดต่อ Backend ไม่สำเร็จ',
  503: 'Backend ยังไม่พร้อมให้บริการ',
  504: 'เซิร์ฟเวอร์ตัวกลางรอคำตอบจาก Backend เกินกำหนด',
}

async function request<T>(path: string, options: RequestInit = {}, checkSession = true): Promise<T> {
  const isLogin = path === '/auth/login'
  const isSessionCheck = path === '/auth/me'
  let response: Response
  try {
    response = await fetch(base + path, { ...options, credentials: 'include' })
  } catch {
    if (isSessionCheck) {
      throw new Error(options.signal?.aborted
        ? sessionTimeoutMessage
        : sessionCheckError + ' เพราะเชื่อมต่อ API ไม่ได้')
    }
    throw new Error(isLogin
      ? 'เชื่อมต่อระบบเข้าสู่ระบบไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่'
      : 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่')
  }

  const body = response.status === 204 ? null : await response.json().catch(() => null)
  if (isSessionCheck && options.signal?.aborted) {
    throw new Error(sessionTimeoutMessage)
  }
  if (!response.ok) {
    if (isSessionCheck && response.status !== 401) {
      const reason = sessionCheckErrors[response.status] ?? 'API ส่งสถานะข้อผิดพลาด'
      throw new ApiError(response.status, sessionCheckError + ' เพราะ' + reason + ' (HTTP ' + response.status + ')')
    }
    if (response.status === 401 && checkSession) window.dispatchEvent(new Event(sessionExpired))
    const fallback = statusMessages[response.status] ?? 'ระบบทำรายการไม่สำเร็จ กรุณาลองใหม่'
    const loginError = isLogin && (loginErrors[response.status] ?? (
      response.status >= 500 ? 'เซิร์ฟเวอร์เข้าสู่ระบบขัดข้อง (HTTP ' + response.status + ')' : undefined
    ))
    const detail = response.status < 500 && typeof body?.error === 'string' ? body.error : fallback
    throw new ApiError(response.status, loginError || detail)
  }
  if (isSessionCheck && (response.status !== 200 || !body?.user)) {
    throw new Error(sessionCheckError + ' เพราะ API ส่งข้อมูลเซสชันไม่ครบ (HTTP ' + response.status + ')')
  }
  if (isLogin && (response.status !== 200 || !body?.user)) {
    throw new Error('เซิร์ฟเวอร์ส่งข้อมูลเข้าสู่ระบบไม่ครบ (HTTP ' + response.status + ')')
  }
  if (path === '/uploadApi' && response.status !== 202) {
    throw new Error('Backend ยังไม่ยืนยันการรับไฟล์ (HTTP ' + response.status + ')')
  }
  if (body === null && response.status !== 204) throw new Error('ระบบตอบกลับในรูปแบบที่ไม่ถูกต้อง')
  return body
}

function json(method: string, value: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }
}

const query = (filters: Record<string, string>) => {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
  return params.size ? '?' + params : ''
}

export type BackendRole = 'field_team' | 'reviewer' | 'researcher' | 'road' | 'admin'
export type User = { id: string; username: string; displayName: string; role: BackendRole }
export type Camera = {
  id: number
  code: string
  name: string
  cameraType: string
  latitude: number | null
  longitude: number | null
  underpassCode: string | null
  underpassName: string | null
  underpassLatitude: number | null
  underpassLongitude: number | null
}
type CoverageKey = { roundId: string; cameraId: string; date: string }
export type CameraCoverage = { status: CoverageState; note: string | null }
export type Round = { id: number; name: string; isOpen: boolean; startsOn: string; endsOn: string }
export type Batch = {
  batchId: string
  status: 'queued' | 'completed' | 'failed'
  createdAt: string
  failedAt: string | null
  mediaCount: number
  eventCount: number
}
export type ReviewStatus = 'pending' | 'confirmed' | 'rejected'
export type Review = { outcome?: Outcome | null; reviewStatus: ReviewStatus; speciesName: string | null; behavior: string | null; reviewNote: string | null }
type ReviewVersion = Review & {
  versionId: string
  reviewerId: string
  reviewerName: string
  reviewedAt: string
  isCurrent: boolean
}
export type CameraEvent = Review & {
  id: string
  batchId: string
  cameraId: number
  cameraCode: string
  roundId: number
  startTime: string
  endTime: string
  mediaCount: number
  cameraStatus?: CoverageState | null
  cameraCoverageNote?: string | null
}
export type EventMedia = { id: string; fileName: string; capturedAt: string }
type ReportRow = {
  roundId: number
  roundName: string
  cameraId: number
  cameraCode: string
  underpassCode: string | null
  eventCount: number
  confirmedCount: number
  pendingCount: number
  speciesCount: number
}

export type RoadDataRequest = {
  id: string
  roundId: number
  roundName: string
  startsOn: string
  endsOn: string
  underpassId: number
  underpassCode: string
  underpassName: string
  reason: string
  requestedAt: string
  status: 'pending' | 'shared'
  requesterName: string
}
type RoadDataEvent = Pick<CameraEvent, 'id' | 'cameraCode' | 'startTime' | 'endTime' | 'mediaCount' | 'speciesName' | 'behavior'>

export const backend = {
  login: (username: string, password: string) =>
    request<{ user: User }>('/auth/login', json('POST', { username, password }), false),
  me: () => request<{ user: User }>('/auth/me', { signal: AbortSignal.timeout(sessionCheckTimeout) }, false),
  logout: () => request<null>('/auth/logout', { method: 'POST' }),
  cameras: async () =>
    (await request<{ cameras: Camera[] }>('/catalog/cameras')).cameras,
  coverage: async (key: CoverageKey) =>
    (await request<{ coverage: CameraCoverage | null }>('/coverage' + query(key))).coverage,
  saveCoverage: async (key: CoverageKey, value: CameraCoverage) =>
    (await request<{ coverage: CameraCoverage }>('/coverage', json('PUT', { ...key, ...value }))).coverage,
  rounds: async () => (await request<{ rounds: Round[] }>('/catalog/rounds')).rounds,
  upload: (body: FormData) => request<{ batchId: string; status: 'queued' }>('/uploadApi', { method: 'POST', body }),
  batch: (id: string) => request<Batch>('/batches/' + encodeURIComponent(id)),
  events: async (filters: Record<string, string>) =>
    (await request<{ events: CameraEvent[] }>('/events' + query(filters))).events,
  event: (id: string) => request<CameraEvent & { media: EventMedia[]; reviewedBy?: string | null; reviewedAt?: string | null }>('/events/' + encodeURIComponent(id)),
  reviewHistory: (id: string) => request<{ versions: ReviewVersion[] }>('/events/' + encodeURIComponent(id) + '/review-history'),
  review: (id: string, value: Review) => request<Review>('/events/' + encodeURIComponent(id), json('PATCH', value)),
  media: (id: string) => request<{ url: string; contentType: string; expiresAt: string }>('/media/' + encodeURIComponent(id)),
  roadRequestUnderpasses: () => request<{ underpasses: { id: number; code: string; name: string }[] }>('/road-data-request-underpasses'),
  roadRequests: () => request<{ requests: RoadDataRequest[] }>('/road-data-requests'),
  roadRequest: (id: string) => request<RoadDataRequest & { events: RoadDataEvent[] }>('/road-data-requests/' + encodeURIComponent(id)),
  createRoadRequest: (value: { roundId: number; underpassId: number; reason: string }) =>
    request<Pick<RoadDataRequest, 'id' | 'status'>>('/road-data-requests', json('POST', value)),
  shareRoadRequest: (id: string, eventIds: string[]) =>
    request<Pick<RoadDataRequest, 'id' | 'status'>>('/road-data-requests/' + encodeURIComponent(id) + '/share', json('POST', { eventIds })),

  reports: async (roundId: string) => (await request<{ rows: ReportRow[] }>('/reports/summary' + query({ roundId }))).rows,
}
