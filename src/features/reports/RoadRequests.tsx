import { useState, type FormEvent } from 'react'
import { backend, type RoadDataRequest } from '../../lib/backend-api'
import { thaiDate } from '../../lib/model'
import { Badge, Header, message, Result, useLoad } from '../../lib/ui'

const statusLabels = { pending: 'รอพิจารณา', shared: 'ได้รับข้อมูลแล้ว' }

function roundLabel(name: string, start?: string | null, end?: string | null) {
  const date = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' })
  return start && end ? name + ' · ' + date.format(new Date(start)) + ' – ' + date.format(new Date(end)) : name
}

export function RoadRequests({ isRoad }: { isRoad: boolean }) {
  const [revision, setRevision] = useState(0)
  const [selected, setSelected] = useState('')
  const requests = useLoad(backend.roadRequests, [revision])

  function reload(id: string) {
    setSelected(id)
    setRevision((current) => current + 1)
  }

  return (
    <>
      <Header eyebrow="ข้อมูลสำรวจ" title={isRoad ? 'ขอข้อมูลสำรวจ' : 'คำขอจากทางหลวง'} icon="report">{null}</Header>
      {isRoad && <RequestForm onCreated={reload} />}
      <section className="panel">
        <h2>{isRoad ? 'คำขอของฉัน' : 'รายการคำขอ'}</h2>
        <Result result={requests}>{({ requests: items }) => items.length ? (
          <ul className="saved-review-list">
            {items.map((item) => (
              <li key={item.id}>
                <div className="split">
                  <strong>{item.roundName} · {item.underpassName}</strong>
                  <Badge>{statusLabels[item.status]}</Badge>
                </div>
                <p>{!isRoad && item.requesterName + ' · '}{thaiDate(item.requestedAt)}</p>
                <p>{item.reason}</p>
                <button type="button" className="secondary" aria-expanded={selected === item.id}
                  onClick={() => setSelected(selected === item.id ? '' : item.id)}>
                  {selected === item.id ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                </button>
                {selected === item.id && <RequestDetails key={item.id + ':' + revision} item={item}
                  isRoad={isRoad} onShared={() => reload(item.id)} />}
              </li>
            ))}
          </ul>
        ) : <p>ยังไม่มีคำขอข้อมูลสำรวจ</p>}</Result>
      </section>
    </>
  )
}

function RequestForm({ onCreated }: { onCreated: (id: string) => void }) {
  const rounds = useLoad(backend.rounds, [])
  const underpasses = useLoad(backend.roadRequestUnderpasses, [])
  const [roundId, setRoundId] = useState('')
  const [underpassId, setUnderpassId] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !roundId || !underpassId || !reason.trim()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const request = await backend.createRoadRequest({ roundId: Number(roundId), underpassId: Number(underpassId), reason })
      setReason('')
      setNotice('ส่งคำขอแล้ว')
      onCreated(request.id)
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="panel" onSubmit={submit} aria-label="ส่งคำขอข้อมูลสำรวจ">
      <div className="grid report-round-filter">
        <Result result={rounds}>{(items) => (
          <label>รอบสำรวจ
            <select required disabled={busy} value={roundId} onChange={(event) => setRoundId(event.target.value)}>
              <option value="">เลือกรอบสำรวจ</option>
              {items.map((item) => <option key={item.id} value={item.id}>{roundLabel(item.name, item.startsOn, item.endsOn)}</option>)}
            </select>
          </label>
        )}</Result>
        <Result result={underpasses}>{({ underpasses: items }) => (
          <label>ทางลอด
            <select required disabled={busy} value={underpassId} onChange={(event) => setUnderpassId(event.target.value)}>
              <option value="">เลือกทางลอด</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
          </label>
        )}</Result>
      </div>
      <label>เหตุผลที่ขอ
        <textarea required rows={2} maxLength={1000} disabled={busy} value={reason}
          placeholder="เช่น ขอคลิปประกอบแผนลงตรวจปากทางลอด B" onChange={(event) => setReason(event.target.value)} />
      </label>
      <button disabled={busy || !roundId || !underpassId || !reason.trim()}>{busy ? 'กำลังส่ง…' : 'ส่งคำขอ'}</button>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert" className="error">{error}</p>}
    </form>
  )
}

function RequestDetails({ item, isRoad, onShared }: {
  item: RoadDataRequest
  isRoad: boolean
  onShared: () => void
}) {
  const result = useLoad(() => backend.roadRequest(item.id), [item.id])
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function share(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !selected.length) return
    setBusy(true)
    setError('')
    try {
      await backend.shareRoadRequest(item.id, selected)
      onShared()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Result result={result}>{(detail) => {
      const canShare = !isRoad && detail.status === 'pending'
      return (
        <form onSubmit={share} className="road-request-details" aria-label="หลักฐานในคำขอ">
          <h3>{canShare ? 'เลือกหลักฐานที่ยืนยันแล้ว' : 'หลักฐานที่แชร์'}</h3>
          <p>{roundLabel(detail.roundName, detail.startsOn, detail.endsOn)} · {detail.underpassName}</p>
          {detail.events.length ? (
            <ul className="saved-review-list">
              {detail.events.map((event) => (
                <li key={event.id}>
                  <div className="road-evidence-choice">
                    {canShare && <input type="checkbox" aria-label={'เลือก ' + event.cameraCode + ' ' + thaiDate(event.startTime)}
                      checked={selected.includes(event.id)} disabled={busy}
                      onChange={(change) => setSelected((current) => change.target.checked
                        ? [...current, event.id] : current.filter((id) => id !== event.id))} />}
                    <strong>{event.cameraCode} · {event.speciesName || 'ไม่ระบุชนิดสัตว์'}</strong>
                  </div>
                  <p>{thaiDate(event.startTime)} – {thaiDate(event.endTime)} · {event.mediaCount} ไฟล์</p>
                  {event.behavior && <p>{event.behavior}</p>}
                  <a href={'#/events/' + encodeURIComponent(event.id)}>เปิดเหตุการณ์</a>
                </li>
              ))}
            </ul>
          ) : <p>{detail.status === 'pending' && isRoad ? 'ยังไม่ได้รับหลักฐาน' : 'ไม่มีหลักฐานที่ตรงกับคำขอ'}</p>}
          {canShare && <div className="actions">
            <button disabled={busy || !selected.length}>{busy ? 'กำลังแชร์…' : 'แชร์ให้ทางหลวง'}</button>
            {selected.length > 0 && <span>เลือกแล้ว {selected.length} เหตุการณ์</span>}
          </div>}
          {error && <p role="alert" className="error">{error}</p>}
        </form>
      )
    }}</Result>
  )
}
