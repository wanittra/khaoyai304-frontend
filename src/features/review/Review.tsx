import { Fragment, useState } from 'react'
import { api } from '../../lib/api-client'
import { outcomes, thaiDate, type Event, type Outcome, type Profile, type Review } from '../../lib/model'
import { Badge, Header, ScrollTable, message, Result, useLoad } from '../../lib/ui'
import { EvidenceGallery, EvidenceThumbnail } from './Evidence'
import './review.css'

export function Queue({ profile }: { profile: Profile }) {
  const [siteId, setSite] = useState('')
  const [surveyId, setSurvey] = useState('')
  const [status, setStatus] = useState('')
  const [camera, setCamera] = useState('')
  const [day, setDay] = useState('')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const surveys = useLoad(api.surveys, [])
  const events = useLoad(() => api.events({ siteId, surveyId, status }), [siteId, surveyId, status])
  return (
    <>
      <Header eyebrow="02 / งานนักวิจัย" title="เหตุการณ์ทั้งหมด" icon="list">
        ตรวจกลุ่มหลักฐานตามทางลอด รอบสำรวจ และสถานะผลตรวจ
      </Header>
      <section className="grid queue-filters" aria-label="ตัวกรอง">
        <label>
          ทางลอด
          <select
            value={siteId}
            onChange={(e) => {
              setSite(e.target.value)
              setCamera('')
            }}
          >
            <option value="">ทุกทางลอด</option>
            {profile.siteIds.map((site) => (
              <option key={site} value={site}>
                ทางลอด {site}
              </option>
            ))}
          </select>
        </label>
        <label>
          รอบสำรวจ
          <Result result={surveys}>
            {(data) => (
              <select value={surveyId} onChange={(e) => setSurvey(e.target.value)}>
                <option value="">ทุกรอบ</option>
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
          กล้อง
          <select value={camera} onChange={(e) => setCamera(e.target.value)}>
            <option value="">ทุกกล้อง</option>
            {[...new Set(events.data?.map((event) => event.cameraId))].sort().map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>
        <label>
          วันที่บันทึก (ไทย)
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label>
          ค้นหาเหตุการณ์
          <input
            type="search"
            placeholder="เช่น B-P1 หรือชนิดสัตว์"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          สถานะ
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">ทั้งหมด</option>
            <option value="pending">รอตรวจ</option>
            {Object.entries(outcomes).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="queue-results" aria-label="กลุ่มหลักฐาน">
        <Result result={events}>
          {(data) => {
            const term = search.trim().toLowerCase()
            const from = day ? Date.parse(day + 'T00:00:00+07:00') : 0
            const filtered = data.filter(
              (event) =>
                (!camera || event.cameraId === camera) &&
                (!day ||
                  (Date.parse(event.capturedAt) >= from &&
                    Date.parse(event.capturedAt) < from + 86_400_000)) &&
                (!term ||
                  [event.id, event.cameraId, event.review?.species].some((value) =>
                    value?.toLowerCase().includes(term),
                  )),
            )
            const opened = expanded ?? filtered.find((event) => event.media.length > 1)?.id
            return filtered.length ? (
              <ScrollTable label="ตารางรายการเหตุการณ์">
                <table className="queue-table">
                  <thead>
                    <tr>
                      {[
                        'ภาพ',
                        'เหตุการณ์',
                        'กล้อง / ทางลอด',
                        'วันที่และเวลา',
                        'จำนวนไฟล์',
                        'สถานะ',
                        'ดำเนินการ',
                      ].map((label) => (
                        <th key={label} scope="col">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((event) => (
                      <Fragment key={event.id}>
                        <tr>
                          <td>
                            <button
                              type="button"
                              className="secondary queue-toggle"
                              aria-label={(opened === event.id ? 'ซ่อน' : 'แสดง') + 'ภาพตัวอย่าง ' + event.id}
                              aria-expanded={opened === event.id}
                              onClick={() => setExpanded(opened === event.id ? '' : event.id)}
                            >
                              {opened === event.id ? '⌃' : '⌄'}
                            </button>
                          </td>
                          <td className="event-cell">
                            <strong>#{event.id}</strong>
                            <small>{event.surveyId}</small>
                          </td>
                          <td>
                            {event.cameraId}
                            <br />
                            <small>ทางลอด {event.siteId}</small>
                          </td>
                          <td>{thaiDate(event.capturedAt)}</td>
                          <td>{event.media.length} ไฟล์</td>
                          <td>
                            <Badge tone={event.review ? 'green' : 'amber'}>
                              {event.review ? outcomes[event.review.outcome] : 'รอตรวจ'}
                            </Badge>
                            {event.overlapWarning && <Badge tone="red">ช่วงเวลาซ้อนกัน</Badge>}
                          </td>
                          <td>
                            <a
                              className="queue-open"
                              href={'#/review/' + encodeURIComponent(event.id)}
                            >
                              ตรวจ
                            </a>
                          </td>
                        </tr>
                        {opened === event.id && (
                          <tr className="queue-preview">
                            <td colSpan={7}>
                              <div className="evidence-strip">
                                {event.media.slice(0, 8).map((file) => (
                                  <EvidenceThumbnail key={file.id} file={file} />
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </ScrollTable>
            ) : (
              <p>ไม่พบเหตุการณ์ตามตัวกรอง</p>
            )
          }}
        </Result>
      </section>
    </>
  )
}
export function ReviewStart() {
  const pending = useLoad(() => api.events({ status: 'pending' }), [])
  return (
    <Result result={pending}>
      {(events) =>
        events.length ? (
          <ReviewPage id={events[0].id} />
        ) : (
          <>
            <Header eyebrow="03 / งานนักวิจัย" title="รอตรวจและยืนยันเหตุการณ์" icon="review">
              เลือกเหตุการณ์จากรายการ
            </Header>
            <section className="panel">
              <p>ไม่มีเหตุการณ์รอตรวจ</p>
              <a href="#/queue">กลับไปยังเหตุการณ์ทั้งหมด</a>
            </section>
          </>
        )
      }
    </Result>
  )
}

export function ReviewPage({ id }: { id: string }) {
  const event = useLoad(() => api.event(id), [id])
  const eventList = useLoad(() => api.events({}), [])
  return (
    <>
      <a className="back" href="#/queue">
        ← เหตุการณ์ทั้งหมด
      </a>
      <Header eyebrow="03 / งานนักวิจัย" title="รอตรวจและยืนยันเหตุการณ์" icon="review">
        เปิดหลักฐานและบันทึกสิ่งที่เห็นในเฟรม
      </Header>
      <Result result={event}>
        {(data) => <EventReview key={data.id} event={data} eventList={eventList.data ?? []} />}
      </Result>
    </>
  )
}
const empty: Review = { outcome: 'wildlife', species: '', count: null, behavior: '', notes: '' }
function EventReview({ event, eventList }: { event: Event; eventList: Event[] }) {
  const [review, setReview] = useState<Review>(event.review ?? empty)
  const [record, setRecord] = useState(event.review)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const set = <K extends keyof Review>(key: K, value: Review[K]) =>
    setReview((current) => ({ ...current, [key]: value }))
  return (
    <div className="review-layout">
      <section className="review-evidence">
        <div className="split review-evidence-heading">
          <h2>เหตุการณ์ #{event.id}</h2>
          <ReviewEventNav id={event.id} events={eventList} />
        </div>
        <p>
          {event.surveyId} · {thaiDate(event.capturedAt)}
        </p>
        {event.overlapWarning && (
          <p className="notice">
            ช่วงเวลาของอีกชุดจากกล้องเดียวกันซ้อนกับเหตุการณ์นี้ กรุณาตรวจหลักฐานก่อนบันทึก
          </p>
        )}
        <EvidenceGallery media={event.media} cameraLabel={event.cameraId + ' | ทางลอด ' + event.siteId} />
      </section>
      <div className="review-side">
        <section className="panel">
          <h2>ข้อมูลเหตุการณ์</h2>
          <dl className="review-info">
            <dt>เหตุการณ์</dt>
            <dd>#{event.id}</dd>
            <dt>กล้อง</dt>
            <dd>
              {event.cameraId} · ทางลอด {event.siteId}
            </dd>
            <dt>วันและเวลา</dt>
            <dd>{thaiDate(event.capturedAt)}</dd>
            <dt>จำนวนไฟล์</dt>
            <dd>{event.media.length} ไฟล์</dd>
          </dl>
        </section>
        <section className="panel">
          <h2>ผลตรวจ</h2>
          {record && (
            <p>
              ผลล่าสุด {outcomes[record.outcome]} · {record.reviewer} · {thaiDate(record.reviewedAt)}
            </p>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (
                review.outcome === 'wildlife' &&
                (!review.species.trim() || !review.count || review.count < 1)
              ) {
                setError('กรุณาระบุชนิดและจำนวนสัตว์')
                return
              }
              setSaving(true)
              setError('')
              setStatus('')
              try {
                const { outcome, species, count, behavior, notes } = review
                const body =
                  outcome === 'no_wildlife'
                    ? { outcome, species: '', count: null, behavior: '', notes }
                    : { outcome, species: species.trim(), count, behavior, notes }
                const saved = await api.review(event.id, body)
                setRecord(saved.review)
                setStatus('บันทึกผลตรวจแล้ว')
              } catch (error) {
                setError(message(error))
              } finally {
                setSaving(false)
              }
            }}
          >
            <div className="grid three">
              <label>
                ผลตรวจ
                <select value={review.outcome} onChange={(e) => set('outcome', e.target.value as Outcome)}>
                  {Object.entries(outcomes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ชนิดสัตว์
                <input
                  value={review.species}
                  disabled={review.outcome === 'no_wildlife'}
                  required={review.outcome === 'wildlife'}
                  onChange={(e) => set('species', e.target.value)}
                />
              </label>
              <label>
                จำนวนที่เห็นพร้อมกัน
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={review.count ?? ''}
                  disabled={review.outcome === 'no_wildlife'}
                  required={review.outcome === 'wildlife'}
                  onChange={(e) => set('count', e.target.value === '' ? null : Number(e.target.value))}
                />
              </label>
            </div>
            <label>
              พฤติกรรม
              <select
                value={review.behavior}
                disabled={review.outcome === 'no_wildlife'}
                onChange={(e) => set('behavior', e.target.value)}
              >
                <option value="">เลือกพฤติกรรม</option>
                {['เดินเข้า', 'เดินออก', 'วกกลับ', 'เคลื่อนผ่านเฟรม', 'ยังยืนยันทิศทางไม่ได้'].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              หมายเหตุ
              <textarea rows={3} value={review.notes} onChange={(e) => set('notes', e.target.value)} />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {status && <p role="status">{status}</p>}
            <button disabled={saving}>บันทึกผลตรวจ</button>
          </form>
        </section>
      </div>
    </div>
  )
}

function ReviewEventNav({ id, events }: { id: string; events: Event[] }) {
  const index = events.findIndex((event) => event.id === id)
  if (index < 0) return null
  const previous = events[index - 1]
  const next = events[index + 1]
  return (
    <nav className="review-event-nav" aria-label="เลื่อนเหตุการณ์">
      {previous ? (
        <a href={'#/review/' + encodeURIComponent(previous.id)}>‹ ก่อนหน้า</a>
      ) : (
        <button type="button" className="secondary" disabled>
          ‹ ก่อนหน้า
        </button>
      )}
      <span>
        {index + 1} / {events.length}
      </span>
      {next ? (
        <a href={'#/review/' + encodeURIComponent(next.id)}>ถัดไป ›</a>
      ) : (
        <button type="button" className="secondary" disabled>
          ถัดไป ›
        </button>
      )}
    </nav>
  )
}
