export type CaptureSource = 'exif' | 'exif-local' | 'video' | 'ocr'
type CaptureMetadata = { date: string; source: CaptureSource }

const thaiOffsetMs = 7 * 60 * 60 * 1000
const quickTimeEpochMs = Date.UTC(1904, 0, 1)

function thaiInputDate(utcMs: number) {
  const date = new Date(utcMs + thaiOffsetMs)
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return undefined
  return date.toISOString().slice(0, 19)
}

async function imageCapture(file: File): Promise<CaptureMetadata | undefined> {
  const { load } = await import('exifreader')
  const { exif } = await load(file, {
    expanded: true,
    length: 'auto',
    includeOffsets: true,
    includeTags: { exif: ['DateTimeOriginal', 'OffsetTimeOriginal'] },
  })
  const original = exif?.DateTimeOriginal?.value[0]?.trim()
  if (!original || !/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(original)) return undefined

  const local = original.slice(0, 10).replace(/:/g, '-') + 'T' + original.slice(11)
  const utc = new Date(local + 'Z')
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 19) !== local) return undefined

  const offset = exif?.OffsetTimeOriginal?.value[0]?.trim()
  if (!offset) return { date: local, source: 'exif-local' }
  if (!/^[+-]\d{2}:\d{2}$/.test(offset)) return undefined

  const date = thaiInputDate(Date.parse(local + offset))
  return date ? { date, source: 'exif' } : undefined
}

function findAtom(view: DataView, type: string, start: number, end: number) {
  for (let offset = start; offset + 8 <= end;) {
    let size = view.getUint32(offset)
    const name = String.fromCharCode(
      view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7),
    )
    let headerSize = 8
    if (size === 1) {
      headerSize = 16
      if (offset + headerSize > end) return undefined
      size = Number(view.getBigUint64(offset + 8))
    } else if (size === 0) {
      size = end - offset
    }
    if (size < headerSize || size > end - offset) return undefined
    if (name === type) return { start: offset + headerSize, end: offset + size }
    offset += size
  }
  return undefined
}

async function videoCapture(file: File): Promise<CaptureMetadata | undefined> {
  if (!['video/mp4', 'video/quicktime', 'video/x-m4v'].includes(file.type) && !/\.(mp4|mov|m4v)$/i.test(file.name)) {
    return undefined
  }
  const view = new DataView(await file.arrayBuffer())
  const movie = findAtom(view, 'moov', 0, view.byteLength)
  if (!movie) return undefined
  const header = findAtom(view, 'mvhd', movie.start, movie.end)
  if (!header || header.start + 8 > header.end) return undefined

  const version = view.getUint8(header.start)
  const createdAt = header.start + 4
  const seconds = version === 0 ? view.getUint32(createdAt)
    : version === 1 && createdAt + 8 <= header.end ? Number(view.getBigUint64(createdAt))
    : 0
  if (!seconds) return undefined

  const date = thaiInputDate(quickTimeEpochMs + seconds * 1000)
  return date ? { date, source: 'video' } : undefined
}

export async function readCaptureMetadata(file: File): Promise<CaptureMetadata | undefined> {
  try {
    if (!file.type.startsWith('image/')) return await videoCapture(file)

    const exif = await imageCapture(file).catch(() => undefined)
    if (exif) return exif

    const { readImageStamp } = await import('./read-image-stamp')
    const date = await readImageStamp(file)
    return date ? { date, source: 'ocr' } : undefined
  } catch {
    return undefined
  }
}
