import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { hasBackend } from './lib/backend-api'
import { BackendApp } from './lib/BackendApp'
import { demo, emptyDemo } from './lib/demo'
import { roleLabels, type Role } from './lib/model'
import { useLoad } from './lib/ui'
import { Login } from './features/auth/Login'
import { Upload } from './features/uploads/Upload'
import { Queue, ReviewPage, ReviewStart } from './features/review/Review'
import { Reports } from './features/reports/Reports'
import { MapPage } from './features/map/CrossingMap'
import { Workspace } from './lib/Workspace'
import './style.css'

const paths = { field: '/upload', researcher: '/queue', road: '/reports' } as const
const labels = { field: 'อัปโหลดหลักฐาน', researcher: 'เหตุการณ์ทั้งหมด', road: 'รายงาน' }
const sessionKey = 'khao304:demo-login'
const currentPath = () => location.hash.slice(1)

function eventId(path: string) {
  try {
    return decodeURIComponent(path.slice('/review/'.length))
  } catch {
    return ''
  }
}

function DemoApp() {
  const [path, setPath] = useState(currentPath)
  const [role, setRole] = useState<Role | null>(() => {
    const saved = sessionStorage.getItem(sessionKey)
    return saved && Object.hasOwn(paths, saved) ? saved as Role : null
  })
  const me = useLoad(() => role ? demo.me() : Promise.resolve(null), [role])
  const profile = role && me.data ? { ...me.data, role } : null
  const current = role && (!path || path === '/login' || path === '/') ? paths[role] : path

  useEffect(() => {
    const update = () => {
      setPath(currentPath())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  function replaceRoute(next: string) {
    history.replaceState(null, '', '#' + next)
    setPath(next)
    window.scrollTo(0, 0)
  }

  if (!role) return (
    <main>
      <Login busy={false} timing={emptyDemo} onDemoSignIn={(next) => {
        sessionStorage.setItem(sessionKey, next)
        setRole(next)
        replaceRoute(paths[next])
      }} />
    </main>
  )

  return (
    <Workspace profile={profile} home={paths[role]} current={current}
      demoLabel={emptyDemo ? 'โหมดจับเวลา' : 'โหมดสาธิต'} busy={false}
      onSignOut={() => {
        sessionStorage.removeItem(sessionKey)
        setRole(null)
        replaceRoute('/login')
      }}>
      {me.error && <p className="error" role="alert">{me.error}</p>}
      {!me.error && !profile && <p role="status">กำลังโหลดบัญชีผู้ใช้…</p>}
      {profile && (
        role !== 'road' && current === '/map' ? <MapPage profile={profile} />
        : role === 'field' && current === '/upload' ? <Upload profile={profile} />
        : role === 'researcher' && current === '/queue' ? <Queue profile={profile} />
        : role === 'researcher' && current === '/review' ? <ReviewStart />
        : role === 'researcher' && current.startsWith('/review/') ? <ReviewPage id={eventId(current)} />
        : role === 'road' && current === '/reports' ? <Reports profile={profile} />
        : <section className="panel">
            <h1>เปิดหน้านี้ไม่ได้</h1>
            <p>หน้านี้อยู่นอกสิทธิ์ของบทบาท{roleLabels[role]}</p>
            <a href={'#' + paths[role]}>ไปหน้า{labels[role]}</a>
          </section>
      )}
    </Workspace>
  )
}

createRoot(document.getElementById('root')!).render(hasBackend ? <BackendApp /> : <DemoApp />)
