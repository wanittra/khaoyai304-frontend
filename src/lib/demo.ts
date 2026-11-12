import fixtures from '../data/fixtures.json'
import type {
  Batch,
  Camera,
  Coverage,
  Event,
  Filter,
  Profile,
  Report,
  Review,
  Site,
  Survey,
  UploadBatch,
  UploadRequest,
} from './model'
import { sites } from './model'

type Fixture = {
  fileName: string
  url: string
  siteId: Site
  cameraId: string
  surveyId: string
  capturedAt: string
  expectedEvent: string
}
const rows = fixtures as Fixture[]
export const emptyDemo = new URLSearchParams(location.search).get('empty') === '1'
const storagePrefix = emptyDemo ? 'khao304:empty:' : 'khao304:'
const cameras: Camera[] = sites.flatMap((siteId) => [
  { id: siteId + '-P1', siteId, kind: 'image', position: 'แนวทางเดินฝั่งเหนือ' },
  { id: siteId + '-P2', siteId, kind: 'image', position: 'แนวทางเดินฝั่งใต้' },
  { id: siteId + '-V1', siteId, kind: 'video', position: 'ปากทางฝั่งเหนือ' },
  { id: siteId + '-V2', siteId, kind: 'video', position: 'ปากทางฝั่งใต้' },
])
const surveys: Survey[] = [
  {
    id: 'ROUND-01',
    name: 'รอบสำรวจจำลอง 01',
    startsAt: '2026-11-01T00:00:00+07:00',
    endsAt: '2026-11-08T00:00:00+07:00',
  },
]
const sampleCoverage: Coverage[] = cameras.map((c) => ({
  cameraId: c.id,
  surveyId: surveys[0].id,
  startsAt: c.id === 'C-V2' ? '2026-11-03T18:00:00+07:00' : surveys[0].startsAt,
  endsAt: c.id === 'C-V2' ? '2026-11-04T06:00:00+07:00' : surveys[0].endsAt,
  status: c.id === 'C-V2' ? 'offline' : c.id === 'C-P2' ? 'unknown' : 'active',
}))
const urls = new Map<string, string>()
const exampleEvents = new Map<string, Event>()
rows.forEach((row, index) => {
  const id = 'sample-' + index
  urls.set(id, row.url)
  const event = exampleEvents.get(row.expectedEvent) ?? {
    id: row.expectedEvent,
    siteId: row.siteId,
    cameraId: row.cameraId,
    surveyId: row.surveyId,
    capturedAt: row.capturedAt,
    media: [],
  }
  event.media.push({
    id,
    fileName: row.fileName,
    kind: /\.mp4$/i.test(row.fileName) ? 'video' : 'image',
    capturedAt: row.capturedAt,
  })
  if (row.expectedEvent === 'B-V1-1')
    event.review = {
      outcome: 'wildlife',
      species: 'สัตว์ป่า (ตัวอย่าง)',
      count: 1,
      behavior: 'เคลื่อนผ่านเฟรม',
      notes: 'ผลจำลองสำหรับทดสอบการเปิดคลิปอ้างอิง',
      reviewer: 'นักวิจัยตัวอย่าง',
      reviewedAt: '2026-11-06T09:00:00+07:00',
    }
  exampleEvents.set(event.id, event)
})
const emptyFrame = 'scenario-c-empty-frame'
const emptyTime = '2026-11-03T19:30:00+07:00'
urls.set(emptyFrame, '/scenarios/c-empty.svg')
exampleEvents.set('scenario-c-empty', {
  id: 'scenario-c-empty',
  siteId: 'C',
  cameraId: 'C-P1',
  surveyId: surveys[0].id,
  capturedAt: emptyTime,
  media: [{ id: emptyFrame, fileName: 'กรณีจำลอง C-P1 · ทางเดินว่าง', kind: 'image', capturedAt: emptyTime }],
  review: {
    outcome: 'no_wildlife',
    species: '',
    count: null,
    behavior: '',
    notes: 'กรณีจำลอง ภาพทางเดินว่างสำหรับทดสอบรายงาน',
    reviewer: 'นักวิจัยตัวอย่าง',
    reviewedAt: '2026-11-06T10:00:00+07:00',
  },
})
function stored<T>(key: string, fallback: T): T {
  const data = localStorage.getItem(storagePrefix + key)
  return data ? (JSON.parse(data) as T) : fallback
}
function save(key: string, value: unknown) {
  localStorage.setItem(storagePrefix + key, JSON.stringify(value))
}
const events = () =>
  [...(emptyDemo ? [] : exampleEvents.values()), ...stored<Event[]>('uploads', [])].map((event) => {
    const review = stored<Record<string, Event['review']>>('reviews', {})[event.id] ?? event.review
    return { ...event, review }
  })
type Draft = { request: UploadRequest; batch: UploadBatch }
const drafts = new Map<string, Draft>()
function mediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(emptyDemo ? 'khao304-empty-media' : 'khao304-media', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('files')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function mediaRecord(id: string, file?: File): Promise<File | undefined> {
  const db = await mediaDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('files', file ? 'readwrite' : 'readonly')
      const store = tx.objectStore('files')
      const request = file ? store.put(file, id) : store.get(id)
      tx.oncomplete = () => resolve(file ?? request.result)
      tx.onerror = tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
const getEvent = (id: string) => {
  const event = events().find((item) => item.id === id)
  if (!event) throw new Error('ไม่พบเหตุการณ์')
  return event
}
function matching(event: Event, filter: Filter) {
  return (
    (!filter.siteId || filter.siteId === event.siteId) &&
    (!filter.surveyId || filter.surveyId === event.surveyId) &&
    (!filter.from || Date.parse(event.capturedAt) >= Date.parse(filter.from)) &&
    (!filter.to || Date.parse(event.capturedAt) < Date.parse(filter.to)) &&
    (!filter.status || filter.status === (event.review?.outcome ?? 'pending'))
  )
}
export const demo = {
  me: async (): Promise<Profile> => ({ name: 'ผู้ใช้ตัวอย่าง', role: 'field', siteIds: sites }),
  surveys: async () => surveys,
  cameras: async (siteId: string) => cameras.filter((c) => c.siteId === siteId),
  map: async (): Promise<Camera[]> => {
    const coverage = [...(emptyDemo ? [] : sampleCoverage), ...stored<Coverage[]>('coverage', [])]
    return cameras.map((camera) => ({
      ...camera,
      coverageStatus: coverage
        .filter((entry) => entry.cameraId === camera.id)
        .sort(
          (a, b) =>
            Date.parse(b.endsAt) - Date.parse(a.endsAt) || Date.parse(b.startsAt) - Date.parse(a.startsAt),
        )[0]?.status,
    }))
  },
  createBatch: async (request: UploadRequest): Promise<UploadBatch> => {
    const batchId = crypto.randomUUID()
    const batch: UploadBatch = {
      batchId,
      status: 'draft',
      uploads: request.files.map((_, index) => {
        const fileId = batchId + '-' + index
        return { fileId, url: fileId }
      }),
    }
    drafts.set(batchId, { request, batch })
    return batch
  },
  upload: async (id: string, file: File, _contentType: string, progress: (n: number) => void) => {
    await mediaRecord(id, file)
    progress(100)
  },
  batch: async (id: string): Promise<Batch> => ({
    batchId: id,
    status:
      drafts.get(id)?.batch.status ?? stored<Record<string, Batch['status']>>('batches', {})[id] ?? 'draft',
  }),
  submit: async (id: string): Promise<Batch> => {
    const draft = drafts.get(id)
    if (!draft) throw new Error('ไม่พบชุดอัปโหลด')
    const { request, batch } = draft
    if (batch.status === 'complete') return batch
    const files = await Promise.all(batch.uploads.map((item) => mediaRecord(item.fileId)))
    if (files.some((file) => !file)) throw new Error('อัปโหลดไฟล์ให้ครบก่อนส่งชุด')
    const camera = cameras.find((c) => c.id === request.cameraId)!
    const media = request.files
      .map((file, index) => ({
        id: batch.uploads[index].fileId,
        fileName: file.fileName,
        capturedAt: file.capturedAt,
        kind: camera.kind,
      }))
      .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt))
    const groups: Event[] = []
    for (const item of media) {
      const previous = groups.at(-1)
      const last = previous?.media.at(-1)
      if (
        camera.kind === 'image' &&
        previous &&
        last &&
        Date.parse(item.capturedAt) - Date.parse(last.capturedAt) <= 60_000
      )
        previous.media.push(item)
      else
        groups.push({
          id: id + '-' + groups.length,
          siteId: camera.siteId,
          cameraId: camera.id,
          surveyId: request.surveyId,
          capturedAt: item.capturedAt,
          media: [item],
        })
    }
    save('uploads', [
      ...stored<Event[]>('uploads', []).filter((event) => !event.id.startsWith(id + '-')),
      ...groups,
    ])
    batch.status = 'complete'
    save('batches', { ...stored('batches', {}), [id]: 'complete' })
    return batch
  },
  coverage: async (body: Coverage) => {
    const key = (item: Coverage) => [item.cameraId, item.surveyId, item.startsAt, item.endsAt].join('|')
    save('coverage', [...stored<Coverage[]>('coverage', []).filter((item) => key(item) !== key(body)), body])
    return body
  },
  events: async (filter: Filter) =>
    events()
      .filter((event) => matching(event, filter))
      .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt)),
  event: async (id: string) => getEvent(id),
  review: async (id: string, body: Review) => {
    getEvent(id)
    save('reviews', {
      ...stored('reviews', {}),
      [id]: { ...body, reviewer: 'นักวิจัยตัวอย่าง', reviewedAt: new Date().toISOString() },
    })
    return getEvent(id)
  },
  view: async (id: string) => {
    const url = urls.get(id)
    if (url) return { url }
    const file = await mediaRecord(id)
    if (!file) throw new Error('ไม่พบไฟล์หลักฐาน')
    return { url: URL.createObjectURL(file) }
  },
  report: async (filter: Filter): Promise<Report> => ({
    events: events().filter(
      (event) => event.review && event.review.outcome !== 'uncertain' && matching(event, filter),
    ),
    coverage: [...(emptyDemo ? [] : sampleCoverage), ...stored<Coverage[]>('coverage', [])].filter(
      (item) =>
        (!filter.siteId || item.cameraId.startsWith(filter.siteId + '-')) &&
        (!filter.surveyId || item.surveyId === filter.surveyId) &&
        (!filter.from || Date.parse(item.endsAt) > Date.parse(filter.from)) &&
        (!filter.to || Date.parse(item.startsAt) < Date.parse(filter.to)),
    ),
  }),
}
