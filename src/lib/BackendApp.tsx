import { RoadRequests } from '../features/reports/RoadRequests'
import { useEffect, useState } from 'react'
import { Login } from '../features/auth/Login'
import { CameraCoveragePage } from '../features/uploads/CameraCoveragePage'
import { PhotoUpload } from '../features/uploads/PhotoUpload'
import { EventDetails, EventList, ReportSummary } from '../features/review/BackendEvents'
import { ApiError, backend, sessionExpired, type BackendRole, type User } from './backend-api'
import { Workspace, type WorkspaceLink } from './Workspace'
import { message } from './ui'

const labels: Record<BackendRole, string> = {
  field_team: 'ทีมภาคสนาม',
  reviewer: 'ผู้ตรวจสอบ',
  researcher: 'นักวิจัย',
  road: 'เจ้าหน้าที่แขวงทางหลวง',
  admin: 'ผู้ดูแลระบบ',
}
const uploadLink: WorkspaceLink = { route: '/upload', title: 'อัปโหลดหลักฐาน', icon: 'upload' }
const coverageLink: WorkspaceLink = { route: '/coverage', title: 'บันทึกสถานะกล้อง', icon: 'camera' }
const reportLink: WorkspaceLink = { route: '/reports', title: 'แผนที่และรายงาน', icon: 'report' }
const eventLinks: WorkspaceLink[] = [
  { route: '/events', title: 'เหตุการณ์ทั้งหมด', icon: 'list' },
  reportLink,
]
const linksByRole: Record<BackendRole, WorkspaceLink[]> = {
  field_team: [uploadLink, coverageLink],
  reviewer: eventLinks,
  researcher: [...eventLinks, { route: '/road-requests', title: 'คำขอจากทางหลวง', icon: 'list' }],
  road: [reportLink, { route: '/road-requests', title: 'ขอข้อมูลสำรวจ', icon: 'list' }],
  admin: [uploadLink, ...eventLinks],
}

export function BackendApp() {
  const [user, setUser] = useState<User | null>()
  const [path, setPath] = useState(() => location.hash.slice(1))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const navigate = () => {
      setPath(location.hash.slice(1))
      window.scrollTo(0, 0)
    }
    const expire = () => {
      setUser(null)
      setError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง')
    }
    window.addEventListener('hashchange', navigate)
    window.addEventListener(sessionExpired, expire)
    backend.me().then(
      ({ user }) => { if (active) setUser(user) },
      (failure) => {
        if (!active) return
        setUser(null)
        if (!(failure instanceof ApiError && failure.status === 401)) setError(message(failure))
      },
    )
    return () => {
      active = false
      window.removeEventListener('hashchange', navigate)
      window.removeEventListener(sessionExpired, expire)
    }
  }, [])

  async function authenticate(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (failure) {
      setError(message(failure))
    } finally {
      setBusy(false)
    }
  }

  if (user === undefined) return <main role="status">กำลังตรวจสอบการเข้าสู่ระบบ…</main>
  if (!user) return (
    <main>
      <Login busy={busy} error={error} onSignIn={(username, password) => {
        void authenticate(async () => setUser((await backend.login(username, password)).user))
      }} />
    </main>
  )

  const links = linksByRole[user.role] ?? []
  const home = links[0]?.route ?? '/'
  const current = !path || path === '/' || path === '/login' ? home : path
  const isRoad = user.role === 'road'
  const allowed = links.some(({ route }) => current === route || (route === '/events' && current.startsWith('/events/')))
    || (isRoad && current.startsWith('/events/'))
  const canReview = user.role === 'researcher' || user.role === 'reviewer' || user.role === 'admin'
  const eventId = current.slice('/events/'.length)

  return (
    <Workspace home={home} current={current} links={links} account={user.displayName + ' · ' + labels[user.role]}
      busy={busy} onSignOut={() => void authenticate(async () => {
        await backend.logout()
        setUser(null)
        history.replaceState(null, '', '#/login')
        setPath('/login')
      })}>
      {error && <p role="alert" className="error">{error}</p>}
      {!allowed ? <p role="alert" className="error">บัญชีนี้ไม่มีสิทธิ์เปิดหน้านี้</p>
        : current === '/upload' ? <PhotoUpload key={user.id} userId={user.id} />
        : current === '/coverage' ? <CameraCoveragePage key={user.id} />
        : current === '/reports' ? <ReportSummary readOnly={isRoad} />
        : current === '/road-requests' ? <RoadRequests key={user.id} isRoad={isRoad} />
        : current === '/events' ? <EventList />
        : <EventDetails key={eventId} id={eventId} canReview={canReview} backTo={isRoad ? '/reports' : '/events'} />}
    </Workspace>
  )
}
