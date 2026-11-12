import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, backend, type Batch } from '../../lib/backend-api'
import { thaiDate } from '../../lib/model'
import { Header, message, Result, useLoad } from '../../lib/ui'
import { readCaptureMetadata, type CaptureSource } from './capture-metadata'
import { CaptureTimeInput } from './CaptureTimeInput'
import { uploadPhotoBatch } from './upload-photo-batch'

type CaptureStatus = CaptureSource | 'reading' | 'missing' | 'manual'
type Photo = { id: number; file: File; date: string; captureStatus: CaptureStatus }

const captureNotes: Record<CaptureStatus, string> = {
  reading: 'กำลังอ่านวันเวลาจากไฟล์…',
  missing: 'อ่านวันเวลาจากไฟล์หรือจากตัวเลขบนรูปไม่ได้ กรุณากรอกเอง',
  exif: 'เติมจาก EXIF และแปลงเป็นเวลาไทยแล้ว',
  'exif-local': 'เติมจาก EXIF ตามนาฬิกากล้อง กรุณาตรวจว่าเป็นเวลาไทย',
  video: '',
  ocr: 'อ่านจากตัวเลขบนรูป กรุณาตรวจวันเวลา ระบบใช้เดือน/วัน/ปีเมื่อรูปแบบกำกวม',
  manual: '',
}

const maxFiles = 30
const maxBytes = 25 * 1024 * 1024

function readReceiptIds(key: string): string[] {
  let saved: string | null
  try {
    saved = sessionStorage.getItem(key)
  } catch {
    return []
  }
  if (!saved) return []

  try {
    const ids: unknown = JSON.parse(saved)
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && !!id) : []
  } catch {
    // Earlier sessions stored one batch ID as a plain string.
    return [saved]
  }
}

export function PhotoUpload({ userId }: { userId: string | number }) {
  const receiptKey = 'khao304:upload-receipt:' + userId
  const rounds = useLoad(backend.rounds, [])
  const [roundId, setRoundId] = useState('')
  const cameras = useLoad(backend.cameras, [])
  const [site, setSite] = useState('')
  const [cameraId, setCameraId] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [openFile, setOpenFile] = useState<File | null>(null)
  const nextPhotoId = useRef(0)
  const [attemptId, setAttemptId] = useState('')
  const [receiptIds, setReceiptIds] = useState(() => readReceiptIds(receiptKey))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const locked = busy || !!attemptId

  function updateCapture(id: number, date: string) {
    setPhotos((current) => current.map((photo) => (
      photo.id === id ? { ...photo, date, captureStatus: 'manual' } : photo
    )))
  }

  function addMedia(files: File[]) {
    const media = files.filter((file) => /^(image|video)\//.test(file.type) && file.size > 0)
    const totalSize = [...photos.map(({ file }) => file), ...media].reduce((size, file) => size + file.size, 0)
    if (photos.length + media.length > maxFiles || totalSize > maxBytes) {
      setError('เลือกได้ไม่เกิน 30 ไฟล์ และขนาดรวมไม่เกิน 25 MiB ต่อชุด')
      return
    }

    const added = media.map((file): Photo => ({
      id: nextPhotoId.current++, file, date: '', captureStatus: 'reading',
    }))
    setError(media.length === files.length ? '' : 'ข้ามไฟล์ว่างหรือไฟล์ที่ไม่ใช่ภาพหรือวิดีโอ')
    setPhotos((current) => [...current, ...added])
    for (const { id, file } of added) {
      void readCaptureMetadata(file).then((capture) => {
        setPhotos((current) => current.map((photo) => (
          photo.id === id && photo.captureStatus === 'reading'
            ? { ...photo, date: capture?.date ?? '', captureStatus: capture?.source ?? 'missing' }
            : photo
        )))
      })
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !roundId || !cameraId || !photos.length || photos.some(({ date }) => !date)) return

    const batchId = attemptId || crypto.randomUUID()
    setAttemptId(batchId)
    setBusy(true)
    setError('')
    try {
      const receipt = await uploadPhotoBatch({
        batchId,
        roundId,
        cameraId,
        photos: photos.map(({ file, date }) => ({
          file,
          capturedAt: (date.length === 16 ? date + ':00' : date) + '+07:00',
        })),
      })
      const nextReceipts = [...new Set([receipt.batchId, ...readReceiptIds(receiptKey), ...receiptIds])]
      setReceiptIds(nextReceipts)
      setAttemptId('')
      setPhotos([])
      try {
        sessionStorage.setItem(receiptKey, JSON.stringify(nextReceipts))
      } catch {
        // The accepted batch remains visible even when browser storage is unavailable.
      }
    } catch (failure) {
      if (failure instanceof ApiError && failure.status >= 400 && failure.status < 500) setAttemptId('')
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }

  function clearBatch() {
    setAttemptId('')
    setPhotos([])
    setError('')
  }

  return (
    <>
      <Header eyebrow="01 / ภาคสนาม" title="อัปโหลดหลักฐานจากกล้อง" icon="upload">
        เลือกรอบสำรวจ ทางลอด และกล้อง จากนั้นแนบไฟล์และตรวจวันเวลาถ่ายตามเวลาไทยก่อนอัปโหลด
      </Header>
      <form className="upload-workflow" aria-label="อัปโหลดหลักฐาน" onSubmit={submit}>
        <div className="grid three upload-fields">
          <Result result={rounds}>{(items) => (
            <label>
              รอบสำรวจ
              <select value={roundId} required disabled={locked} onChange={(event) => {
                setRoundId(event.target.value)
                setSite('')
                setCameraId('')
              }}>
                <option value="">เลือกรอบสำรวจ</option>
                {items.filter((item) => item.isOpen).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          )}</Result>
          <Result result={cameras}>{(items) => {
            const group = (camera: (typeof items)[number]) => camera.underpassCode || 'other'
            const crossings = new Map(items.map((camera) => [
              group(camera), camera.underpassName || (camera.underpassCode ? 'ทางลอด ' + camera.underpassCode : 'ไม่ระบุทางลอด'),
            ]))
            return (
              <>
                <label>
                  ทางลอด
                  <select value={site} required disabled={locked || !roundId} onChange={(event) => {
                    setSite(event.target.value)
                    setCameraId('')
                  }}>
                    <option value="">เลือกทางลอด</option>
                    {[...crossings].map(([crossing, label]) => <option key={crossing} value={crossing}>{label}</option>)}
                  </select>
                </label>
                <label>
                  กล้อง
                  <select value={cameraId} required disabled={locked || !site} onChange={(event) => setCameraId(event.target.value)}>
                    <option value="">เลือกกล้อง</option>
                    {items.filter((item) => group(item) === site).map((item) => (
                      <option key={item.id} value={item.id}>{item.name || item.code}</option>
                    ))}
                  </select>
                </label>
              </>
            )
          }}</Result>
        </div>
        <label>
          เลือกภาพหรือวิดีโอ
          <input type="file" accept="image/*,video/*" multiple disabled={locked} onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            addMedia(files)
          }} />
          <small className="upload-note">เลือกแล้ว {photos.length} / 30 ไฟล์ · ขนาดรวมสูงสุด 25 MiB</small>
        </label>
        {photos.map(({ id, file, date, captureStatus }) => (
          <div className="file-row photo-upload-row" key={id}>
            <div className="upload-file-preview">
              {file.type.startsWith('image/') && <ImagePreview file={file} onOpen={() => setOpenFile(file)} />}
              <strong>{file.name}</strong>
              {file.type.startsWith('video/') && <VideoPreview file={file} onOpen={() => setOpenFile(file)} />}
            </div>
            <div>
              <CaptureTimeInput
                value={date}
                disabled={locked}
                required
                onChange={(next) => updateCapture(id, next)}
              />
              {captureNotes[captureStatus] && <p className="upload-note">{captureNotes[captureStatus]}</p>}
            </div>
            <button type="button" className="secondary" disabled={locked}
              onClick={() => setPhotos((current) => current.filter((photo) => photo.id !== id))}>
              นำออก
            </button>
          </div>
        ))}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="actions">
          <button disabled={busy || !photos.length || !roundId || !cameraId}>
            {busy ? 'กำลังอัปโหลด…' : attemptId ? 'ลองส่งชุดเดิม' : 'อัปโหลดไฟล์'}
          </button>
          <button type="button" className="secondary" disabled={busy || (!attemptId && !photos.length)}
            onClick={clearBatch}>
            ล้างไฟล์ในชุดนี้
          </button>
        </div>
      </form>
      {openFile && <MediaPreviewDialog file={openFile} onClose={() => setOpenFile(null)} />}
      {receiptIds.length > 0 && (
        <section aria-label="ชุดที่อัปโหลดแล้ว">
          <h2>สถานะชุดที่อัปโหลดแล้ว</h2>
          {receiptIds.map((id) => <BatchProgress key={id} id={id} />)}
        </section>
      )}
    </>
  )
}


function MediaPreviewDialog({ file, onClose }: { file: File; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <dialog ref={dialog} className="upload-media-dialog" aria-label={file.name} onClose={onClose}>
      <div className="upload-media-dialog-header">
        <strong>{file.name}</strong>
        <button type="button" className="secondary" onClick={() => dialog.current?.close()}>ปิด</button>
      </div>
      {failed ? (
        <p role="alert">เปิดไฟล์นี้ในเบราว์เซอร์ไม่ได้</p>
      ) : url && (file.type.startsWith('video/') ? (
        <video src={url} controls playsInline onError={() => setFailed(true)} />
      ) : (
        <img src={url} alt={file.name} onError={() => setFailed(true)} />
      ))}
    </dialog>
  )
}


function ImagePreview({ file, onOpen }: { file: File; onOpen: () => void }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  return url ? (
    <button type="button" className="upload-preview-button" aria-label={'เปิดรูป ' + file.name} onClick={onOpen}>
      <img className="upload-image-preview" src={url} alt="" onError={() => setUrl('')} />
    </button>
  ) : (
    <button type="button" className="secondary" onClick={onOpen}>เปิดรูป</button>
  )
}

function VideoPreview({ file, onOpen }: { file: File; onOpen: () => void }) {
  const [preview, setPreview] = useState<{ file: File; seconds: number | null; url: string }>()
  const [seconds, setSeconds] = useState<{ file: File; value: number }>()

  useEffect(() => {
    const video = document.createElement('video')
    const objectUrl = URL.createObjectURL(file)
    video.preload = 'auto'

    function release() {
      video.onloadedmetadata = null
      video.onloadeddata = null
      video.onerror = null
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(objectUrl)
    }

    function finish(url = '') {
      setPreview({ file, seconds: Number.isFinite(video.duration) ? video.duration : null, url })
      release()
    }

    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration)) setSeconds({ file, value: video.duration })
    }
    video.onloadeddata = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 384 / Math.max(video.videoWidth, video.videoHeight))
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      const context = canvas.getContext('2d')
      if (!context || !canvas.width || !canvas.height) {
        finish()
        return
      }

      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        finish(canvas.toDataURL('image/jpeg', 0.85))
      } catch {
        finish()
      }
    }
    video.onerror = () => finish()
    video.src = objectUrl
    return release
  }, [file])

  const result = preview?.file === file ? preview : undefined
  const duration = (seconds?.file === file ? seconds.value : null) ?? result?.seconds
  const total = duration == null ? null : Math.round(duration)
  const length = total === null ? null : [
    Math.floor(total / 3600) && `${Math.floor(total / 3600)} ชั่วโมง`,
    `${Math.floor(total / 60) % 60} นาที`,
    `${total % 60} วินาที`,
  ].filter(Boolean).join(' ')

  return (
    <>
      {length && <small className="upload-note">ความยาว {length}</small>}
      {!length && result && <small className="upload-note">อ่านความยาวคลิปไม่ได้</small>}
      {result?.url ? (
        <button type="button" className="upload-preview-button" aria-label={'เปิดวิดีโอ ' + file.name} onClick={onOpen}>
          <img className="upload-image-preview" src={result.url} alt="" />
        </button>
      ) : result ? (
        <button type="button" className="secondary" onClick={onOpen}>เปิดวิดีโอ</button>
      ) : (
        <small className="upload-note" role="status">กำลังโหลดภาพตัวอย่าง…</small>
      )}
    </>
  )
}

function BatchProgress({ id }: { id: string }) {
  const [batch, setBatch] = useState<Batch>()
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    let timer: number | undefined
    async function poll() {
      try {
        const data = await backend.batch(id)
        if (!active) return
        setBatch(data)
        if (data.status === 'queued') timer = window.setTimeout(poll, 3000)
      } catch (failure) {
        if (active) setError(message(failure))
      }
    }
    void poll()
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [id, retry])

  return (
    <section className="panel" aria-label="สถานะชุดอัปโหลด">
      <small>ชุด {id}</small>
      {error ? (
        <>
          <p role="alert" className="error">{error}</p>
          <button type="button" className="secondary" onClick={() => {
            setError('')
            setRetry((current) => current + 1)
          }}>ตรวจสถานะอีกครั้ง</button>
        </>
      ) : batch?.status === 'completed' ? (
        <p role="status">ประมวลผลแล้ว · {batch.mediaCount} ไฟล์ → {batch.eventCount} เหตุการณ์</p>
      ) : batch?.status === 'failed' ? (
        <p role="alert" className="error">ประมวลผลไม่สำเร็จ{batch.failedAt ? ' (' + thaiDate(batch.failedAt) + ')' : ''}</p>
      ) : (
        <p role="status">รับไฟล์แล้ว กำลังประมวลผล</p>
      )}
    </section>
  )
}
