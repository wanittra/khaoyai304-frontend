import { useEffect, useState } from 'react'
import { CaptureTimeInput } from './CaptureTimeInput'
import { api } from '../../lib/api-client'
import { isDemo } from '../auth/entra'
import fixtures from '../../data/fixtures.json'
import {
  batchLabels,
  coverageLabels,
  type Batch,
  type Camera,
  type CoverageState,
  type Profile,
  type UploadBatch,
} from '../../lib/model'
import { Badge, Header, message, Result, useLoad } from '../../lib/ui'
import { Icon } from '../../lib/Icon'

type Item = { file: File; date: string; progress: number; done?: boolean; error?: string }
const localDate = (time: number) => new Date(time + 7 * 3600_000).toISOString().slice(0, 19)
const timestamp = (time: string) => (time.length === 16 ? time + ':00+07:00' : time + '+07:00')

export function Upload({ profile }: { profile: Profile }) {
  const surveys = useLoad(api.surveys, [])
  const [survey, setSurvey] = useState('')
  const [site, setSite] = useState('')
  const cameras = useLoad(() => (site ? api.cameras(site) : Promise.resolve([])), [site])
  const [cameraId, setCamera] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [draft, setDraft] = useState<UploadBatch>()
  const [batch, setBatch] = useState<Batch>()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const camera = cameras.data?.find((c) => c.id === cameraId)
  useEffect(() => {
    if (!batch || !['queued', 'processing'].includes(batch.status)) return
    const timer = window.setTimeout(() => {
      api.batch(batch.batchId).then(setBatch, (error) => {
        setError(message(error))
        setBatch({ ...batch })
      })
    }, 3000)
    return () => clearTimeout(timer)
  }, [batch])
  function clear() {
    setItems([])
    setDraft(undefined)
    setBatch(undefined)
    setError('')
    setNotice('')
  }
  function update(index: number, values: Partial<Item>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...values } : item)))
  }
  async function upload() {
    if (!camera || !survey || !items.length || busy || items.some((item) => !item.date)) return
    setBusy(true)
    setError('')
    try {
      const contentType = camera.kind === 'image' ? 'image/jpeg' : 'video/mp4'
      const current =
        draft ??
        (await api.createBatch({
          surveyId: survey,
          cameraId: camera.id,
          files: items.map((item) => ({
            fileName: item.file.name,
            contentType,
            size: item.file.size,
            capturedAt: timestamp(item.date),
          })),
        }))
      setDraft(current)
      if (current.uploads.length !== items.length) throw new Error('จำนวนลิงก์อัปโหลดไม่ตรงกับจำนวนไฟล์')
      for (const [index, item] of items.entries()) {
        if (item.done) continue
        update(index, { error: undefined, progress: 0 })
        try {
          await api.upload(current.uploads[index].url, item.file, contentType, (progress) =>
            update(index, { progress }),
          )
          update(index, { done: true, progress: 100 })
        } catch (error) {
          update(index, { error: message(error) })
        }
      }
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
    }
  }
  async function submit() {
    if (!draft || busy) return
    setBusy(true)
    setError('')
    try {
      setBatch(await api.submit(draft.batchId))
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
    }
  }
  const [dragging, setDragging] = useState(false)
  const canPick = !!camera && !!survey && !draft && !busy
  const succeeded = items.filter((item) => item.done).length
  const failures = items.filter((item) => item.error).length
  const overall = items.length
    ? Math.round(items.reduce((sum, item) => sum + item.progress, 0) / items.length)
    : 0

  function addFiles(files: File[]) {
    if (!canPick) return
    const pattern = camera?.kind === 'video' ? /\.mp4$/i : /\.jpe?g$/i
    setItems((current) => [
      ...current,
      ...files
        .filter((file) => pattern.test(file.name) && file.size > 0)
        .map((file) => {
          const fixture = isDemo
            ? fixtures.find(
                (row) => row.fileName === file.name && row.cameraId === camera?.id && row.surveyId === survey,
              )
            : undefined
          return {
            file,
            date: fixture ? fixture.capturedAt.slice(0, 19) : localDate(file.lastModified),
            progress: 0,
          }
        }),
    ])
    setNotice(
      files.some((file) => !pattern.test(file.name) || !file.size)
        ? 'ข้ามไฟล์ที่ว่างหรือชนิดไม่ตรงกับกล้อง'
        : '',
    )
  }

  return (
    <>
      <Header eyebrow="01 / ภาคสนาม" title="อัปโหลดหลักฐานจากกล้อง" icon="upload">
        เลือกกล้องและแนบไฟล์จากการ์ด จากนั้นยืนยันส่งชุดเพื่อจัดกลุ่มเหตุการณ์
      </Header>
      <section className="upload-workflow" aria-label="อัปโหลดหลักฐาน">
        <div className="grid three upload-fields">
          <label>
            รอบสำรวจ
            <Result result={surveys}>
              {(data) => (
                <select value={survey} disabled={!!draft || busy} onChange={(e) => setSurvey(e.target.value)}>
                  <option value="">เลือกรอบสำรวจ</option>
                  {data.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </Result>
          </label>
          <label>
            ทางลอด
            <select
              aria-label="ทางลอด"
              value={site}
              disabled={!!draft || busy}
              onChange={(e) => {
                setSite(e.target.value)
                setCamera('')
                clear()
              }}
            >
              <option value="">เลือกทางลอด</option>
              {profile.siteIds.map((s) => (
                <option key={s} value={s}>
                  ทางลอด {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            กล้อง
            <Result result={cameras}>
              {(data) => (
                <select
                  aria-label="กล้อง"
                  value={cameraId}
                  disabled={!site || !!draft || busy}
                  onChange={(e) => {
                    setCamera(e.target.value)
                    clear()
                  }}
                >
                  <option value="">เลือกกล้อง</option>
                  {data.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} · {c.position} ({c.kind === 'image' ? 'JPG' : 'MP4'})
                    </option>
                  ))}
                </select>
              )}
            </Result>
          </label>
        </div>
        {camera && (
          <p className="upload-camera-info">
            <Badge tone="green">{camera.kind === 'image' ? 'ภาพนิ่ง · JPG' : 'วิดีโอ · MP4'}</Badge>{' '}
            {camera.position}
          </p>
        )}
        <label
          className="drop upload-picker"
          data-dragging={dragging}
          onDragOver={(event) => {
            event.preventDefault()
            if (canPick) setDragging(true)
          }}
          onDragLeave={(event) => {
            if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget))
              setDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            addFiles(Array.from(event.dataTransfer.files))
          }}
        >
          <Icon name="cloud" size={36} />
          <strong>
            ลากไฟล์มาวางที่นี่ หรือ <span>คลิกเพื่อเลือกไฟล์</span>
          </strong>
          <small>
            {draft
              ? 'ชุดนี้ลงทะเบียนไฟล์แล้ว เลือกเริ่มชุดใหม่เพื่อแนบไฟล์เพิ่ม'
              : canPick
                ? camera?.kind === 'video'
                  ? 'รองรับไฟล์ MP4'
                  : 'รองรับไฟล์ JPG และ JPEG'
                : 'เลือกรอบสำรวจ ทางลอด และกล้องก่อนแนบไฟล์'}
          </small>
          <input
            type="file"
            multiple
            accept={camera?.kind === 'video' ? '.mp4' : '.jpg,.jpeg'}
            disabled={!canPick}
            aria-label="เลือกไฟล์หลักฐาน"
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
        </label>
        <small className="upload-note">
          ตรวจเวลาในกล้องก่อนส่ง เวลาแสดงตามเวลาไทย ไฟล์ตัวอย่างใช้เวลาตามตารางกำกับ
          ส่วนไฟล์อื่นเริ่มจากเวลาที่แก้ไขล่าสุด
        </small>
        {notice && <p role="status">{notice}</p>}
        {items.length > 0 && (
          <section className="upload-batch-summary" aria-label="สถานะชุดอัปโหลด">
            <div className="split">
              <strong>
                <Icon name="layers" size={18} /> ชุดอัปโหลดปัจจุบัน ({items.length} ไฟล์)
              </strong>
              <span>{overall}%</span>
            </div>
            <progress aria-label="ความคืบหน้ารวม" value={overall} max={100} />
            <div className="upload-totals">
              <Badge tone="green">สำเร็จ {succeeded}</Badge>
              <Badge>รอหรือกำลังอัปโหลด {items.length - succeeded - failures}</Badge>
              <Badge tone={failures ? 'red' : 'neutral'}>ล้มเหลว {failures}</Badge>
            </div>
          </section>
        )}
        {items.map((item, index) => (
          <div className="file-row" key={index}>
            <strong>{item.file.name}</strong>
            <CaptureTimeInput
              value={item.date}
              disabled={!!draft || busy}
              onChange={(date) => update(index, { date })}
            />
            <span>
              {item.error ? (
                <span className="error">{item.error}</span>
              ) : item.done ? (
                <Badge tone="green">ส่งสำเร็จ</Badge>
              ) : busy ? (
                <progress max={100} value={item.progress} />
              ) : (
                'พร้อมอัปโหลด'
              )}
            </span>
            {!draft && (
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
              >
                นำออก
              </button>
            )}
          </div>
        ))}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {draft && (
          <p role="status">
            ชุด {draft.batchId} · {batchLabels[batch?.status ?? 'draft']}
          </p>
        )}
        <div className="actions">
          <button
            disabled={
              busy || !items.length || items.some((item) => !item.date) || items.every((item) => item.done)
            }
            onClick={upload}
          >
            {draft ? 'ลองส่งไฟล์ที่เหลือ' : 'อัปโหลดไฟล์'}
          </button>
          <button
            disabled={
              busy || !draft || !items.every((item) => item.done) || (!!batch && batch.status !== 'failed')
            }
            onClick={submit}
          >
            {batch?.status === 'failed' ? 'ลองส่งชุดเดิม' : 'ยืนยันส่งชุด'}
          </button>
          <button className="secondary" disabled={busy || (!items.length && !draft)} onClick={clear}>
            เริ่มชุดใหม่
          </button>
        </div>
      </section>
      {camera && survey && <CoverageForm key={camera.id + survey} camera={camera} surveyId={survey} />}
    </>
  )
}
function CoverageForm({ camera, surveyId }: { camera: Camera; surveyId: string }) {
  const [status, setStatus] = useState<CoverageState>('active')
  const [result, setResult] = useState('')
  const [saving, setSaving] = useState(false)
  return (
    <section className="panel">
      <h2>บันทึกช่วงทำงานของ {camera.id}</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          const startsAt = timestamp(String(data.get('start')))
          const endsAt = timestamp(String(data.get('end')))
          if (Date.parse(endsAt) <= Date.parse(startsAt)) {
            setResult('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม')
            return
          }
          setSaving(true)
          try {
            await api.coverage({ cameraId: camera.id, surveyId, startsAt, endsAt, status })
            setResult('บันทึกช่วงเวลาแล้ว')
          } catch (error) {
            setResult(message(error))
          } finally {
            setSaving(false)
          }
        }}
      >
        <div className="grid three">
          <label>
            เริ่ม (เวลาไทย)
            <input name="start" type="datetime-local" required />
          </label>
          <label>
            สิ้นสุด (เวลาไทย)
            <input name="end" type="datetime-local" required />
          </label>
          <label>
            สถานะ
            <select value={status} onChange={(e) => setStatus(e.target.value as CoverageState)}>
              {Object.entries(coverageLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p role="status">{result}</p>
        <button disabled={saving}>บันทึกช่วงเวลา</button>
      </form>
    </section>
  )
}
