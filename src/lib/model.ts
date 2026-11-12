export type Role = 'field' | 'researcher' | 'road'
export type Site = 'A' | 'B' | 'C'
export type Kind = 'image' | 'video'
export type Outcome = 'wildlife' | 'no_wildlife' | 'uncertain'
export type CoverageState = 'active' | 'offline' | 'unknown'
export type Profile = { name: string; role: Role; siteIds: Site[] }
export type Survey = { id: string; name: string; startsAt: string; endsAt: string }
export type Camera = {
  id: string
  siteId: Site
  kind: Kind
  position: string
  coverageStatus?: CoverageState
  latitude?: number | null
  longitude?: number | null
  underpassName?: string | null
}
export type Media = { id: string; fileName: string; kind: Kind; capturedAt: string }
export type Review = {
  outcome: Outcome
  species: string
  count: number | null
  behavior: string
  notes: string
}
export type Event = {
  id: string
  siteId: Site
  cameraId: string
  surveyId: string
  capturedAt: string
  media: Media[]
  overlapWarning?: boolean
  review?: Review & { reviewedAt: string; reviewer: string }
}
export type Coverage = {
  cameraId: string
  surveyId: string
  startsAt: string
  endsAt: string
  status: CoverageState
}
export type BatchState = 'draft' | 'queued' | 'processing' | 'complete' | 'failed'
export type Batch = { batchId: string; status: BatchState }
export type UploadRequest = {
  surveyId: string
  cameraId: string
  files: { fileName: string; contentType: string; size: number; capturedAt: string }[]
}
export type UploadBatch = Batch & { uploads: { fileId: string; url: string }[] }
export type Filter = { siteId?: string; surveyId?: string; status?: string; from?: string; to?: string }
export type Report = { events: Event[]; coverage: Coverage[] }
export const sites: Site[] = ['A', 'B', 'C']
export function cameraCrossing(code: string): Site | undefined {
  return /^(?:CAM-)?([ABC])-[PV]\d+$/i.exec(code)?.[1].toUpperCase() as Site | undefined
}
export const outcomes: Record<Outcome, string> = {
  wildlife: 'พบสัตว์',
  no_wildlife: 'ตรวจแล้วไม่พบสัตว์',
  uncertain: 'ยังไม่แน่ใจ',
}
export const coverageLabels: Record<CoverageState, string> = {
  active: 'กล้องทำงาน',
  offline: 'กล้องขัดข้อง',
  unknown: 'ยังไม่มีข้อมูลยืนยัน',
}
export const roleLabels: Record<Role, string> = {
  field: 'ทีมภาคสนาม',
  researcher: 'นักวิจัย',
  road: 'ทีมดูแลถนน',
}
export const batchLabels: Record<BatchState, string> = {
  draft: 'รอยืนยันส่งชุด',
  queued: 'รอจัดกลุ่ม',
  processing: 'กำลังจัดกลุ่ม',
  complete: 'จัดกลุ่มแล้ว',
  failed: 'จัดกลุ่มไม่สำเร็จ',
}
export const thaiDate = (value: string, timeStyle: 'short' | 'medium' = 'short') =>
  new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle,
    timeZone: 'Asia/Bangkok',
    calendar: 'gregory',
  }).format(new Date(value))
