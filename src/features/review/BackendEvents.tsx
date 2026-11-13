import { useState, type FormEvent } from 'react'
import { ApiError, backend, type CameraEvent, type EventMedia, type Review, type ReviewStatus } from '../../lib/backend-api'
import { coverageLabels, outcomes, sites, thaiDate, type Camera as MapCamera } from '../../lib/model'
import { CrossingMap } from '../map/CrossingMap'
import { Badge, Header, message, Result, ScrollTable, useLoad } from '../../lib/ui'

const statusLabels: Record<ReviewStatus, string> = {
  pending: 'รอตรวจ / ยังไม่แน่ใจ',
  confirmed: 'ยืนยันว่าพบสัตว์',
  rejected: 'ตรวจแล้วไม่พบสัตว์',
}

function StatusOptions() {
  return <>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</>
}

type DateRange = { from: string; to: string }

function inDateRange(event: CameraEvent, { from, to }: DateRange) {
  const start = from ? Date.parse(from + 'T00:00:00+07:00') : -Infinity
  const end = to ? Date.parse(to + 'T00:00:00+07:00') + 86_400_000 : Infinity
  return Date.parse(event.startTime) < end && Date.parse(event.endTime) >= start
}

function DateFilters({ range, onChange }: { range: DateRange; onChange: (range: DateRange) => void }) {
  return (
    <>
      <label>ตั้งแต่วันที่ (ไทย)
        <input type="date" value={range.from} max={range.to || undefined}
          onChange={(event) => onChange({ ...range, from: event.target.value })} />
      </label>
      <label>ถึงวันที่ (ไทย)
        <input type="date" value={range.to} min={range.from || undefined}
          onChange={(event) => onChange({ ...range, to: event.target.value })} />
      </label>
    </>
  )
}

function EventTable({ items }: { items: CameraEvent[] }) {
  if (!items.length) return <p>ไม่พบเหตุการณ์ตามตัวกรอง</p>
  return (
    <ScrollTable label="รายการเหตุการณ์">
      <table>
        <thead><tr><th>กล้อง</th><th>เวลาเริ่ม (ไทย)</th><th>สถานะกล้อง</th><th>สื่อ</th><th>สถานะ</th><th>ชนิดสัตว์</th><th>รายละเอียด</th></tr></thead>
        <tbody>{items.map((item) => (
          <tr key={item.id}>
            <td>{item.cameraCode}</td><td>{thaiDate(item.startTime)}</td>
            <td>
              {item.cameraStatus ? (
                <Badge tone={item.cameraStatus === 'active' ? 'green' : item.cameraStatus === 'offline' ? 'red' : 'neutral'}>
                  {coverageLabels[item.cameraStatus] ?? item.cameraStatus}
                </Badge>
              ) : (
                <span style={{ color: 'var(--muted)' }}>—</span>
              )}
            </td>
            <td>{item.mediaCount}</td>
            <td>{item.outcome === 'uncertain' ? outcomes.uncertain : statusLabels[item.reviewStatus]}</td><td>{item.speciesName || '—'}</td>
            <td><a href={'#/events/' + encodeURIComponent(item.id)}>เปิดเหตุการณ์</a></td>
          </tr>
        ))}</tbody>
      </table>
    </ScrollTable>
  )
}

export function EventList() {
  const [cameraId, setCameraId] = useState('')
  const [roundId, setRoundId] = useState('')
  const [reviewStatus, setReviewStatus] = useState('')
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const cameras = useLoad(backend.cameras, [])
  const rounds = useLoad(backend.rounds, [])
  const events = useLoad(() => backend.events({ cameraId, roundId, reviewStatus }), [cameraId, roundId, reviewStatus])
  return (
    <>
      <Header eyebrow="02 / เหตุการณ์" title="เหตุการณ์ทั้งหมด" icon="list">
        เลือกรอบสำรวจ กล้อง ช่วงวันที่ หรือสถานะตรวจเพื่อกรองรายการ
      </Header>
      <section className="panel grid three" aria-label="ตัวกรองเหตุการณ์">
        <Result result={rounds}>{(items) => (
          <label>รอบสำรวจ
            <select value={roundId} onChange={(event) => setRoundId(event.target.value)}>
              <option value="">ทุกรอบ</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}</Result>
        <Result result={cameras}>{(items) => (
          <label>กล้อง
            <select value={cameraId} onChange={(event) => setCameraId(event.target.value)}>
              <option value="">ทุกกล้อง</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name || item.code}</option>)}
            </select>
          </label>
        )}</Result>
        <label>สถานะตรวจ
          <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)}>
            <option value="">ทุกสถานะ</option>
            <StatusOptions />
          </select>
        </label>
        <DateFilters range={range} onChange={setRange} />
      </section>
      <Result result={events}>{(items) => <EventTable items={items.filter((item) => inDateRange(item, range))} />}</Result>
    </>
  )
}

export function EventDetails({ id, canReview, backTo }: { id: string; canReview: boolean; backTo: '/events' | '/reports' }) {
  const result = useLoad(async () => {
    try {
      return await backend.event(id)
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) {
        throw new Error('Backend ไม่พบรายละเอียดเหตุการณ์นี้ (HTTP 404)')
      }
      throw failure
    }
  }, [id])
  return (
    <>
      <Header eyebrow="02 / เหตุการณ์" title="รายละเอียดเหตุการณ์" icon="review">
        <a href={'#' + backTo}>{backTo === '/reports' ? 'กลับไปยังแผนที่และรายงาน' : 'กลับไปยังรายการเหตุการณ์'}</a>
      </Header>
      <Result result={result}>{(event) => (
        <div className={canReview ? undefined : 'event-detail-columns'}>
          <section className="panel">
            <h2>
              {event.cameraCode}
              {event.cameraStatus && (
                <>
                  {' '}
                  <Badge tone={event.cameraStatus === 'active' ? 'green' : event.cameraStatus === 'offline' ? 'red' : 'neutral'}>
                    {coverageLabels[event.cameraStatus] ?? event.cameraStatus}
                  </Badge>
                </>
              )}
            </h2>
            <p>{thaiDate(event.startTime)} – {thaiDate(event.endTime)} · {event.mediaCount} ไฟล์</p>
            {event.cameraCoverageNote && (
              <p><small style={{ color: 'var(--muted)' }}>สถานะกล้องจากภาคสนาม: {event.cameraCoverageNote}</small></p>
            )}
            {canReview && <EventEvidence items={event.media} compact />}
            <EventReview event={event} canReview={canReview} />
          </section>
          {!canReview && <EventEvidence items={event.media} />}
        </div>
      )}</Result>
    </>
  )
}

function EventReview({ event, canReview }: { event: CameraEvent & { reviewedAt?: string | null }; canReview: boolean }) {
  const [savedReview, setSavedReview] = useState<Review | null>(() =>
    event.reviewedAt || event.outcome || event.reviewStatus !== 'pending' ? event : null,
  )
  const [editing, setEditing] = useState(false)
  const [reviewStatus, setReviewStatus] = useState(event.reviewStatus)
  const [species, setSpecies] = useState(event.speciesName ?? '')
  const [behavior, setBehavior] = useState(event.behavior ?? '')
  const [note, setNote] = useState(event.reviewNote ?? '')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  async function submit(submission: FormEvent<HTMLFormElement>) {
    submission.preventDefault()
    setBusy(true)
    setFeedback('')
    setError('')
    try {
      const saved = await backend.review(event.id, {
        reviewStatus, speciesName: species.trim() || null, behavior: behavior.trim() || null, reviewNote: note.trim() || null,
      })
      setReviewStatus(saved.reviewStatus)
      setSavedReview(saved)
      setEditing(false)
      setSpecies(saved.speciesName ?? '')
      setBehavior(saved.behavior ?? '')
      setNote(saved.reviewNote ?? '')
      setFeedback(savedReview ? 'อัปเดตผลตรวจแล้ว' : 'บันทึกผลตรวจแล้ว')
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }

  if (!canReview || (savedReview && !editing)) return (
    <>
      <Badge>{savedReview?.outcome === 'uncertain' ? outcomes.uncertain : statusLabels[reviewStatus]}</Badge>
      {species && <p>ชนิดสัตว์ {species}</p>}
      {behavior && <p>พฤติกรรม {behavior}</p>}
      {note && <p>หมายเหตุ {note}</p>}
      {canReview && <button type="button" className="secondary" onClick={() => {
        setFeedback('')
        setEditing(true)
      }}>แก้ไขผลตรวจ</button>}
      {feedback && <p role="status">{feedback}</p>}
      {canReview && savedReview && <ReviewHistory eventId={event.id} />}
    </>
  )
  return (
    <form className="event-review-form" onSubmit={submit} aria-label="ผลตรวจเหตุการณ์">
      <label>สถานะตรวจ
        <select value={reviewStatus} disabled={busy} onChange={(change) => setReviewStatus(change.target.value as ReviewStatus)}>
          <StatusOptions />
        </select>
      </label>
      <label>ชนิดสัตว์<input value={species} maxLength={200} disabled={busy} onChange={(change) => setSpecies(change.target.value)} /></label>
      <label>พฤติกรรม<input value={behavior} maxLength={500} disabled={busy} onChange={(change) => setBehavior(change.target.value)} /></label>
      <label className="event-review-note">หมายเหตุ (ถ้ามี)
        <small id="event-review-note-help">ระบุข้อสังเกตเพิ่มเติมจากภาพหรือวิดีโอ เช่น ภาพไม่ชัด หรือนับจำนวนสัตว์ไม่ได้</small>
        <textarea rows={2} aria-describedby="event-review-note-help" value={note} maxLength={1000} disabled={busy} onChange={(change) => setNote(change.target.value)} />
      </label>
      <div className="actions">
        <button type="submit" disabled={busy}>{savedReview ? 'อัปเดตผลตรวจ' : 'บันทึกผลตรวจ'}</button>
        {savedReview && (
          <button type="button" className="secondary" disabled={busy} onClick={() => {
            setReviewStatus(savedReview.reviewStatus)
            setSpecies(savedReview.speciesName ?? '')
            setBehavior(savedReview.behavior ?? '')
            setNote(savedReview.reviewNote ?? '')
            setError('')
            setEditing(false)
          }}>ยกเลิก</button>
        )}
      </div>
      {error && <p role="alert" className="error">{error}</p>}
    </form>
  )
}

function ReviewHistory({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button type="button" className="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'ซ่อนประวัติการแก้ไข' : 'ดูประวัติการแก้ไข'}
      </button>
      {open && <ReviewHistoryVersions eventId={eventId} />}
    </div>
  )
}

function ReviewHistoryVersions({ eventId }: { eventId: string }) {
  const history = useLoad(() => backend.reviewHistory(eventId), [eventId])

  return (
    <section aria-label="ประวัติการแก้ไข">
      <Result result={history}>{({ versions }) => versions.length ? (
        versions.map((version) => (
          <article className="panel" key={version.versionId}>
            <Badge>{version.isCurrent ? 'ผลล่าสุด' : 'ผลก่อนแก้'}</Badge>
            <p>{version.reviewerName} · <time dateTime={version.reviewedAt}>{thaiDate(version.reviewedAt, 'medium')} (เวลาไทย)</time></p>
            <dl>
              <dt>สถานะตรวจ</dt><dd>{statusLabels[version.reviewStatus]}</dd>
              <dt>ชนิดสัตว์</dt><dd>{version.speciesName || '—'}</dd>
              <dt>พฤติกรรม</dt><dd>{version.behavior || '—'}</dd>
              <dt>หมายเหตุ</dt><dd>{version.reviewNote || '—'}</dd>
            </dl>
          </article>
        ))
      ) : <p>ยังไม่มีผลตรวจที่บันทึกไว้</p>}</Result>
    </section>
  )
}


function EventEvidence({ items, compact = false }: { items: EventMedia[]; compact?: boolean }) {
  return (
    <section className={compact ? 'event-evidence-compact' : 'panel'}>
      <h2>ภาพและวิดีโอ</h2>
      {items.length ? (
        <div className="event-evidence-grid">
          {items.map((item) => <Evidence key={item.id} item={item} />)}
        </div>
      ) : <p>ไม่มีไฟล์ในเหตุการณ์นี้</p>}
    </section>
  )
}


function Evidence({ item }: { item: EventMedia }) {
  const [attempt, setAttempt] = useState(0)
  const [playbackFailed, setPlaybackFailed] = useState(false)
  const result = useLoad(() => backend.media(item.id), [item.id, attempt])
  const media = result.data
  const error = result.error ?? (playbackFailed ? 'โหลดไฟล์ไม่ได้' : '')

  return (
    <article className="panel">
      <strong>{item.fileName}</strong>
      <p>{thaiDate(item.capturedAt)}</p>
      {error ? (
        <>
          <p role="alert" className="error">{error}</p>
          <button type="button" className="secondary" onClick={() => {
            setPlaybackFailed(false)
            setAttempt((current) => current + 1)
          }}>ลองโหลดอีกครั้ง</button>
        </>
      ) : !media ? (
        <p role="status">กำลังโหลดไฟล์…</p>
      ) : media.contentType.startsWith('video/') ? (
        <video controls playsInline preload="metadata" src={media.url}
          onError={() => setPlaybackFailed(true)} style={{ maxWidth: '100%' }} />
      ) : (
        <img src={media.url} alt={item.fileName}
          onError={() => setPlaybackFailed(true)} style={{ maxWidth: '100%' }} />
      )}
    </article>
  )
}


function SavedReviewList({ items }: { items: CameraEvent[] }) {
  if (!items.length) return <p>ไม่พบผลตรวจที่บันทึกตามตัวกรอง</p>

  return (
    <ul className="saved-review-list">
      {items.map((item) => (
        <li key={item.id}>
          <div className="split">
            <h3>{item.cameraCode} · {item.speciesName || 'ไม่ระบุชนิดสัตว์'}</h3>
            <Badge>{item.outcome === 'uncertain' ? outcomes.uncertain : statusLabels[item.reviewStatus]}</Badge>
          </div>
          <p>{thaiDate(item.startTime)} · {item.mediaCount} ไฟล์</p>
          {item.behavior && <p><strong>พฤติกรรม</strong> {item.behavior}</p>}
          {item.reviewNote && <p><strong>หมายเหตุ</strong> {item.reviewNote}</p>}
          <a href={'#/events/' + encodeURIComponent(item.id)}>เปิดเหตุการณ์</a>
        </li>
      ))}
    </ul>
  )
}


export function ReportSummary({ readOnly }: { readOnly: boolean }) {
  const [roundId, setRoundId] = useState('')
  const [site, setSite] = useState('')
  const [cameraCode, setCameraCode] = useState('')
  const [range, setRange] = useState<DateRange>({ from: '', to: '' })
  const [species, setSpecies] = useState('')
  const rounds = useLoad(backend.rounds, [])
  const cameras = useLoad(backend.cameras, [])
  const cameraId = cameras.data?.find((camera) => camera.code === cameraCode)?.id
  const siteCameraIds = new Set(cameras.data?.filter((camera) => camera.underpassCode === site).map((camera) => camera.id))
  const reports = useLoad(async () => {
    try {
      return await backend.reports(roundId)
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) {
        throw new Error('Backend ยังไม่พบเส้นทางรายงานสรุป (HTTP 404)')
      }
      throw failure
    }
  }, [roundId])
  const history = useLoad(
    () => site
      ? backend.events({ cameraId: cameraId === undefined ? '' : String(cameraId), roundId, reviewStatus: readOnly ? 'confirmed' : '' })
      : Promise.resolve([]),
    [site, cameraId, roundId, readOnly],
  )

  const mapCameras = (cameras.data ?? []).flatMap((camera): MapCamera[] => {
    const siteId = sites.find((id) => id === camera.underpassCode)
    return siteId ? [{
      id: camera.code,
      siteId,
      kind: /video/i.test(camera.cameraType ?? '') || /-V\d+$/i.test(camera.code) ? 'video' : 'image',
      position: camera.name && camera.name !== camera.code ? camera.name : (camera.underpassName || 'ทางลอด ' + siteId),
      latitude: camera.latitude,
      longitude: camera.longitude,
      underpassName: camera.underpassName,
    }] : []
  })
  const siteIds = [...new Set(mapCameras.map((camera) => camera.siteId))]
  const hasSavedReview = (item: CameraEvent) =>
    readOnly ? item.reviewStatus === 'confirmed' : item.outcome != null || item.reviewStatus !== 'pending'
  const reviewedCameraIds = new Set([
    ...(reports.data ?? []).filter((row) => row.confirmedCount > 0).map((row) => row.cameraCode),
    ...(history.data ?? []).filter(hasSavedReview).map((item) => item.cameraCode),
  ])

  function selectSite(next: string) {
    setSite(next)
    setCameraCode('')
  }


  return (
    <>
      <Header eyebrow="03 / รายงาน" title="สรุปเหตุการณ์และหลักฐาน" icon="report">
        เลือกทางลอดเพื่อดูผลที่นักวิจัยบันทึกไว้ หรือเลือกกล้องเพื่อกรองตามจุดติดตั้ง
      </Header>
      <section className="panel report-round-filter">
        <Result result={rounds}>{(items) => (
          <label>รอบสำรวจ
            <select value={roundId} onChange={(event) => setRoundId(event.target.value)}>
              <option value="">ทุกรอบ</option>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}</Result>
        <label>ทางลอด
          <select value={site} onChange={(event) => selectSite(event.target.value)} disabled={!siteIds.length}>
            <option value="">ทุกทางลอด</option>
            {siteIds.map((id) => <option key={id} value={id}>ทางลอด {id}</option>)}
          </select>
        </label>
      </section>
      <div className="backend-report-overview">
        <Result result={cameras}>{() => mapCameras.length ? (
          <CrossingMap
            siteIds={siteIds}
            site={site}
            cameras={mapCameras}
            cameraId={cameraCode}
            onChange={selectSite}
            onCamera={setCameraCode}
            reviewedCameraIds={reviewedCameraIds}
          />
        ) : <p>ไม่พบกล้องที่ระบุทางลอดได้</p>}</Result>

        {site ? (
          <section className="panel">
            <h2>ผลตรวจที่บันทึก · {cameraCode || `ทางลอด ${site}`}</h2>
            <div className="grid saved-review-filters">
              <DateFilters range={range} onChange={setRange} />
              <label>ชนิดสัตว์
                <input value={species} onChange={(event) => setSpecies(event.target.value)} />
              </label>
            </div>
            <Result result={history}>{(items) => (
              <SavedReviewList items={items.filter((item) =>
                hasSavedReview(item)
                && siteCameraIds.has(item.cameraId)
                && (cameraId === undefined || item.cameraId === cameraId)
                && inDateRange(item, range)
                && (!species.trim() || item.speciesName?.toLocaleLowerCase().includes(species.trim().toLocaleLowerCase())),
              )} />
            )}</Result>
          </section>
        ) : (
          <section className="panel">
            <h2>รายงานสรุปตามรอบสำรวจ</h2>
            <Result result={reports}>{(rows) => rows.length ? (
                <ScrollTable label="รายงานสรุปเหตุการณ์">
                  <table>
                    <thead><tr><th>รอบสำรวจ</th><th>กล้อง</th><th>เหตุการณ์</th><th>ยืนยันแล้ว</th>{!readOnly && <th>รอตรวจ</th>}<th>ชนิดสัตว์</th></tr></thead>
                    <tbody>{rows.map((row) => (
                      <tr key={row.roundId + ':' + row.cameraId}>
                        <td>{row.roundName}</td><td>{row.cameraCode}</td><td>{row.eventCount}</td>
                        <td>{row.confirmedCount}</td>{!readOnly && <td>{row.pendingCount}</td>}<td>{row.speciesCount}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </ScrollTable>
              ) : <p>ไม่มีข้อมูลรายงานตามตัวกรอง</p>
            }</Result>
          </section>
        )}
      </div>
    </>
  )
}
