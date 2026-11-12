import { useState } from 'react'
import { isDemo } from '../auth/entra'
import { CrossingMap } from '../map/CrossingMap'
import { Evidence } from '../review/Evidence'
import { api } from '../../lib/api-client'
import { Icon, type IconName } from '../../lib/Icon'
import {
  coverageLabels,
  outcomes,
  thaiDate,
  type Coverage,
  type Event,
  type Profile,
  type Report,
} from '../../lib/model'
import { Badge, Header, ScrollTable, Result, useLoad } from '../../lib/ui'
import './report.css'

const tabs = {
  overview: 'ภาพรวม',
  events: 'เหตุการณ์ยืนยัน',
  cameras: 'ข้อมูลกล้อง',
  gaps: 'ช่วงข้อมูลที่ขาด',
}
type Tab = keyof typeof tabs
type ConfirmedEvent = Event & { review: NonNullable<Event['review']> }

function exportReport(events: ConfirmedEvent[], coverage: Coverage[]) {
  const rows = [
    [
      'ประเภท',
      'ทางลอด',
      'กล้อง',
      'เริ่มหรือเวลาบันทึก',
      'สิ้นสุด',
      'ผลตรวจหรือสถานะ',
      'ชนิดสัตว์',
      'จำนวน',
      'พฤติกรรม',
      'หมายเหตุ',
    ],
    ...events.map(({ siteId, cameraId, capturedAt, review }) => [
      'เหตุการณ์',
      siteId,
      cameraId,
      capturedAt,
      '',
      outcomes[review.outcome],
      review.species,
      review.count ?? '',
      review.behavior,
      review.notes,
    ]),
    ...coverage.map((entry) => [
      'ช่วงทำงานกล้อง',
      entry.cameraId.split('-')[0],
      entry.cameraId,
      entry.startsAt,
      entry.endsAt,
      coverageLabels[entry.status],
      '',
      '',
      '',
      '',
    ]),
  ]
  const escaped = (value: string | number) => {
    const text = String(value)
    return '"' + (/^[=+@\-\t\r\n]/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"'
  }
  const csv = rows.map((row) => row.map(escaped).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'khao-yai-304-report.csv'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Reports({ profile }: { profile: Profile }) {
  const [site, setSite] = useState('')
  const [camera, setCamera] = useState('')
  const [surveyId, setSurvey] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const surveys = useLoad(api.surveys, [])
  const permittedSites = profile.siteIds.join(',')
  const cameras = useLoad(
    async () => (await Promise.all(profile.siteIds.map((id) => api.cameras(id)))).flat(),
    [permittedSites],
  )
  const invalid = !!from && !!to && from > to
  const reports = useLoad<Report>(
    () =>
      invalid
        ? Promise.resolve({ events: [], coverage: [] })
        : api.report({
            siteId: site,
            surveyId,
            from: from ? from + 'T00:00:00+07:00' : undefined,
            to: to ? new Date(Date.parse(to + 'T00:00:00+07:00') + 86_400_000).toISOString() : undefined,
          }),
    [site, surveyId, from, to],
  )
  const events = (reports.data?.events ?? []).filter(
    (event): event is ConfirmedEvent =>
      !!event.review && event.review.outcome !== 'uncertain' && (!camera || camera === event.cameraId),
  )
  const coverage = (reports.data?.coverage ?? []).filter((entry) => !camera || camera === entry.cameraId)
  const gaps = coverage
    .filter((entry) => entry.status !== 'active')
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))

  const latestCoverage = new Map<string, Coverage>()
  for (const entry of invalid ? [] : reports.data?.coverage ?? []) {
    const previous = latestCoverage.get(entry.cameraId)
    if (!previous || Date.parse(entry.endsAt) >= Date.parse(previous.endsAt)) {
      latestCoverage.set(entry.cameraId, entry)
    }
  }
  const mapCameras = (cameras.data ?? []).map((item) => ({
    ...item,
    coverageStatus: latestCoverage.get(item.id)?.status ?? item.coverageStatus,
  }))

  const scopedCameraIds = cameras.data
    ?.filter((item) => (!site || item.siteId === site) && (!camera || item.id === camera))
    .map((item) => item.id)

  function selectSite(id: string) {
    setSite(id)
    setCamera('')
  }

  return (
    <>
      <div className="report-toolbar">
        <Header eyebrow="04 / หน่วยงานดูแลถนน" title="รายงานและแผนที่" icon="layers">
          ดูผลยืนยันและช่วงทำงานของกล้อง พร้อมเปิดหลักฐานอ้างอิง
        </Header>
        <button
          type="button"
          className="report-export"
          disabled={invalid || !reports.data}
          onClick={() => exportReport(events, coverage)}
        >
          <Icon name="export" size={18} /> ส่งออกรายงาน CSV
        </button>
      </div>
      <section className="panel grid report-filters" aria-label="ตัวกรองรายงาน">
        <label>
          รอบสำรวจ
          <Result result={surveys}>
            {(data) => (
              <select value={surveyId} onChange={(e) => setSurvey(e.target.value)}>
                <option value="">ทุกรอบ</option>
                {data.map((survey) => (
                  <option key={survey.id} value={survey.id}>
                    {survey.name}
                  </option>
                ))}
              </select>
            )}
          </Result>
        </label>
        <label>
          ตั้งแต่ (เวลาไทย)
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          ถึง (เวลาไทย)
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          ทางลอด
          <select value={site} onChange={(event) => selectSite(event.target.value)}>
            <option value="">ทุกทางลอด</option>
            {profile.siteIds.map((id) => (
              <option key={id} value={id}>
                ทางลอด {id}
              </option>
            ))}
          </select>
        </label>
        <label>
          กล้อง
          <select
            value={camera}
            disabled={!site || !cameras.data}
            onChange={(event) => setCamera(event.target.value)}
          >
            <option value="">ทุกกล้อง</option>
            {cameras.data
              ?.filter((item) => item.siteId === site)
              .map(({ id }) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
          </select>
          {site && cameras.error && (
            <small className="error" role="alert">
              {cameras.error}
            </small>
          )}
        </label>
      </section>
      <div className="report-tabs" role="group" aria-label="ส่วนของรายงาน">
        {(Object.keys(tabs) as Tab[]).map((key) => (
          <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>
            {tabs[key]}
          </button>
        ))}
      </div>
      {tab === 'overview' && (
        <>
          {!invalid && reports.data && (
            <ReportMetrics events={events} coverage={coverage} gaps={gaps} cameraIds={scopedCameraIds} />
          )}
          <div className="report-overview">
            <CrossingMap
              siteIds={profile.siteIds}
              site={site}
              onChange={selectSite}
              cameras={mapCameras}
              cameraId={camera}
              onCamera={setCamera}
            />
            {!invalid && reports.data && <ReportBreakdown events={events} gaps={gaps} />}
          </div>
        </>
      )}
      {isDemo && (
        <p className="report-source-note">
          ทางลอด ตำแหน่งกล้อง เวลา และผลตัวอย่างเป็นข้อมูลจำลอง ภาพและคลิปมาจากนามิเบีย{' '}
          <a
            href="https://lila.science/datasets/desert-lion-conservation-camera-traps/"
            target="_blank"
            rel="noreferrer"
          >
            Desert Lion Conservation Camera Traps
          </a>
        </p>
      )}
      {invalid ? (
        <p className="error" role="alert">
          วันสิ้นสุดต้องอยู่ในวันเดียวกันหรือหลังวันเริ่มต้น
        </p>
      ) : (
        <Result result={reports}>
          {() => {
            if (tab === 'overview') return null
            if (tab === 'events') {
              return (
                <ConfirmedEvents
                  events={events}
                  siteIds={profile.siteIds.filter((id) => !site || id === site)}
                />
              )
            }
            return <CoverageTable coverage={tab === 'gaps' ? gaps : coverage} gapsOnly={tab === 'gaps'} />
          }}
        </Result>
      )}
    </>
  )
}

function percent(value: number, total: number) {
  return new Intl.NumberFormat('th-TH', { style: 'percent', maximumFractionDigits: 1 }).format(value / total)
}

function ReportMetrics({
  events,
  coverage,
  gaps,
  cameraIds,
}: {
  events: ConfirmedEvent[]
  coverage: Coverage[]
  gaps: Coverage[]
  cameraIds?: string[]
}) {
  const activeIds = new Set(coverage.filter(({ status }) => status === 'active').map(({ cameraId }) => cameraId))
  const activeCount = cameraIds?.filter((id) => activeIds.has(id)).length ?? activeIds.size
  const wildlifeCount = events.filter(({ review }) => review.outcome === 'wildlife').length
  const metrics: { label: string; value: string | number; unit?: string; note: string; icon: IconName }[] = [
    { label: 'เหตุการณ์ยืนยัน', value: events.length, unit: 'ครั้ง', note: 'ในช่วงที่เลือก', icon: 'paw' },
    { label: 'พบสัตว์ (เหตุการณ์)', value: wildlifeCount, unit: 'ครั้ง',
      note: events.length ? percent(wildlifeCount, events.length) + ' ของเหตุการณ์ยืนยัน' : 'ในช่วงที่เลือก', icon: 'wildlife' },
    { label: 'กล้องที่มีช่วงทำงาน', value: cameraIds?.length ? activeCount + ' / ' + cameraIds.length : activeCount,
      note: cameraIds?.length ? '(' + percent(activeCount, cameraIds.length) + ')' : 'ตามข้อมูลช่วงทำงาน', icon: 'camera' },
    { label: 'ข้อมูลที่ขาดหาย', value: gaps.length, unit: 'ช่วง',
      note: 'จาก ' + new Set(gaps.map(({ cameraId }) => cameraId)).size + ' กล้อง', icon: 'warning' },
  ]

  return (
    <div className="report-metrics">
      {metrics.map(({ label, value, unit, note, icon }) => (
        <div className="panel report-metric" key={label}>
          <span className={'report-metric-icon ' + (icon === 'warning' ? 'warning' : '')}><Icon name={icon} size={24} /></span>
          <div>
            <span className="report-metric-label">{label}</span>
            <strong>{value}{unit && <small>{unit}</small>}</strong>
            <span className="report-metric-note">{note}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ReportBreakdown({ events, gaps }: { events: ConfirmedEvent[]; gaps: Coverage[] }) {
  const wildlife = events.filter(({ review }) => review.outcome === 'wildlife')
  const species = new Map<string, number>()
  for (const { review } of wildlife) {
    const label = review.species || 'ไม่ระบุชนิด'
    species.set(label, (species.get(label) ?? 0) + 1)
  }
  return (
    <div className="report-side">
      <section className="panel">
        <h2>สรุปเหตุการณ์ยืนยัน</h2>
        {species.size ? (
          <ul className="report-breakdown">
            {[...species]
              .sort((a, b) => b[1] - a[1])
              .map(([name, count]) => (
                <li key={name}>
                  <span>{name}</span>
                  <progress aria-label={name} value={count} max={wildlife.length} />
                  <strong>{count} ครั้ง <small>({percent(count, wildlife.length)})</small></strong>
                </li>
              ))}
          </ul>
        ) : (
          <p>ไม่มีเหตุการณ์พบสัตว์ในช่วงที่เลือก</p>
        )}
      </section>
      <section className="panel">
        <h2>ข้อมูลที่ขาดหาย (ล่าสุด)</h2>
        {gaps.length ? (
          <ul className="report-gaps">
            {gaps.slice(0, 3).map((entry, index) => (
              <li key={index}>
                <Icon name="warning" size={16} />
                <strong>{entry.cameraId}</strong>
                <span className="report-gap-status">{coverageLabels[entry.status]}</span>
                <span className="report-gap-time">{thaiDate(entry.startsAt)} – {thaiDate(entry.endsAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>ไม่พบรายการช่วงข้อมูลขาดในผลที่เลือก</p>
        )}
      </section>
    </div>
  )
}

function ConfirmedEvents({ events, siteIds }: { events: ConfirmedEvent[]; siteIds: Profile['siteIds'] }) {
  return (
    <section className="panel">
      <h2>ผลที่ยืนยันแล้ว</h2>
      <div className="grid three">
        {siteIds.map((id) => {
          const list = events.filter((event) => event.siteId === id)
          const wildlife = list.filter(({ review }) => review.outcome === 'wildlife').length
          return (
            <div className="stat" key={id}>
              <span>ทางลอด {id}</span>
              <strong>{list.length} เหตุการณ์</strong>
              <small>
                พบสัตว์ {wildlife} · ตรวจแล้วไม่พบสัตว์ {list.length - wildlife}
              </small>
            </div>
          )
        })}
      </div>
      {events.length ? (
        events.map(({ id, cameraId, capturedAt, review, media }) => (
          <details key={id}>
            <summary>
              {cameraId} · {thaiDate(capturedAt)} · {outcomes[review.outcome]} · {media.length} ไฟล์
            </summary>
            <p>
              {[
                review.species,
                review.count === null ? '' : review.count + ' ตัว',
                review.behavior,
                review.notes,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <Evidence media={media} />
          </details>
        ))
      ) : (
        <p>ไม่มีผลยืนยันในช่วงที่เลือก</p>
      )}
    </section>
  )
}

function CoverageTable({ coverage, gapsOnly }: { coverage: Coverage[]; gapsOnly: boolean }) {
  const title = gapsOnly ? 'ช่วงข้อมูลที่ขาด' : 'ช่วงการทำงานของกล้อง'
  return (
    <section className="panel">
      <h2>{title}</h2>
      {coverage.length ? (
        <ScrollTable label={'ตาราง' + title}>
          <table>
            <thead>
              <tr>
                {['กล้อง', 'เริ่ม', 'สิ้นสุด', 'สถานะ'].map((label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coverage.map((item, index) => (
                <tr key={index}>
                  <td>{item.cameraId}</td>
                  <td>{thaiDate(item.startsAt)}</td>
                  <td>{thaiDate(item.endsAt)}</td>
                  <td>
                    <Badge
                      tone={
                        item.status === 'offline' ? 'red' : item.status === 'active' ? 'green' : 'neutral'
                      }
                    >
                      {coverageLabels[item.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      ) : (
        <p>{gapsOnly ? 'ไม่พบรายการช่วงข้อมูลขาดในผลที่เลือก' : 'ยังไม่มีข้อมูลยืนยัน'}</p>
      )}
    </section>
  )
}
