import { useState, type FormEvent } from 'react'
import { backend, type CameraCoverage } from '../../lib/backend-api'
import { coverageLabels, type CoverageState } from '../../lib/model'
import { Header, message, Result, useLoad } from '../../lib/ui'

export function CameraCoveragePage() {
  const [roundId, setRoundId] = useState('')
  const [cameraId, setCameraId] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const rounds = useLoad(backend.rounds, [])
  const cameras = useLoad(backend.cameras, [])

  return (
    <>
      <Header eyebrow="01 / ภาคสนาม" title="บันทึกสถานะกล้อง" icon="camera">
        เลือกรอบสำรวจ กล้องที่ได้รับมอบหมาย และวันที่ตรวจเพื่อดูหรือแก้ไขสถานะของวันนั้น
      </Header>
      <section className="panel grid three" aria-label="เลือกกล้องและวันที่ตรวจ">
        <Result result={rounds}>{(items) => (
          <label>รอบสำรวจ
            <select value={roundId} disabled={busy} onChange={(event) => {
              setRoundId(event.target.value)
              setCameraId('')
            }}>
              <option value="">เลือกรอบสำรวจ</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}</Result>
        <Result result={cameras}>{(items) => (
          <label>กล้อง
            <select value={cameraId} disabled={busy || !roundId || !items.length}
              onChange={(event) => setCameraId(event.target.value)}>
              <option value="">{roundId && !items.length ? 'ไม่มีกล้องที่ได้รับมอบหมาย' : 'เลือกกล้อง'}</option>
              {items.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {[camera.underpassName, camera.name || camera.code].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          </label>
        )}</Result>
        <label>วันที่ตรวจ (ไทย)
          <input type="date" value={date} disabled={busy} onChange={(event) => setDate(event.target.value)} />
        </label>
      </section>
      {roundId && cameraId && date && (
        <CoverageRecord key={[roundId, cameraId, date].join(':')}
          recordKey={{ roundId, cameraId, date }} busy={busy} setBusy={setBusy} />
      )}
    </>
  )
}

type RecordKey = Parameters<typeof backend.coverage>[0]
type RecordProps = { recordKey: RecordKey; busy: boolean; setBusy: (busy: boolean) => void }

function CoverageRecord(props: RecordProps) {
  const result = useLoad(() => backend.coverage(props.recordKey), [])
  return <Result result={result}>{(record) => <CoverageForm {...props} record={record} />}</Result>
}

function CoverageForm({ recordKey, record, busy, setBusy }: RecordProps & { record: CameraCoverage | null }) {
  const [status, setStatus] = useState<CoverageState>(record?.status ?? 'unknown')
  const [note, setNote] = useState(record?.note ?? '')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setFeedback('')
    setError('')
    try {
      const saved = await backend.saveCoverage(recordKey, { status, note: note.trim() || null })
      setStatus(saved.status)
      setNote(saved.note ?? '')
      setFeedback('บันทึกสถานะกล้องแล้ว')
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel" aria-label="สถานะกล้อง" onSubmit={submit}>
      <label>สถานะกล้อง
        <select value={status} disabled={busy} onChange={(event) => setStatus(event.target.value as CoverageState)}>
          {Object.entries(coverageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>หมายเหตุ
        <textarea value={note} maxLength={1000} disabled={busy} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกสถานะกล้อง'}</button>
      {feedback && <p role="status">{feedback}</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </form>
  )
}
