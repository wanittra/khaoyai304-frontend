import type { ReactNode } from 'react'
import { roleLabels, type Profile, type Role } from './model'
import { Icon, type IconName } from './Icon'
import './workspace.css'

export type WorkspaceLink = { route: string; title: string; icon: IconName }

const navigation: (WorkspaceLink & { role?: Role })[] = [
  { route: '/upload', title: 'อัปโหลดหลักฐาน', role: 'field', icon: 'upload' },
  { route: '/queue', title: 'เหตุการณ์ทั้งหมด', role: 'researcher', icon: 'list' },
  { route: '/review', title: 'รอตรวจและยืนยัน', role: 'researcher', icon: 'review' },
  { route: '/reports', title: 'รายงาน', role: 'road', icon: 'report' },
  { route: '/map', title: 'แผนที่ตำแหน่งกล้อง', icon: 'map' },
]

export function Workspace({
  children,
  profile,
  account,
  links,
  home,
  current,
  demoLabel,
  busy,
  onSignOut,
}: {
  children: ReactNode
  profile?: Profile | null | false
  account?: string
  links?: WorkspaceLink[]
  home: string
  current: string
  demoLabel?: string
  busy: boolean
  onSignOut: () => void
}) {
  const menu = links ?? (profile ? navigation.filter(({ role }) => role ? role === profile.role : profile.role !== 'road') : [])
  const accountLabel = account ?? (profile ? roleLabels[profile.role] ?? profile.name : '')

  return (
    <div className="workspace">
      <aside className="workspace-side">
        <a className="workspace-brand" href={'#' + home}>
          <img src="/wildlife-mark.svg" width="58" height="42" alt="" />
          <span>Khoa Yai 304</span>
        </a>
        {menu.length > 0 && (
          <nav className="workspace-nav" aria-label="เมนูหลัก">
            {menu.map(({ route, title, icon }) => {
                const active = route === current || current.startsWith(route + '/')
                const content = (
                  <>
                    <Icon name={icon} size={18} />
                    <span>{title}</span>
                  </>
                )
                return (
                  <a
                    key={route}
                    href={'#' + (active ? current : route)}
                    aria-current={active ? 'page' : undefined}
                  >
                    {content}
                  </a>
                )
              })}
          </nav>
        )}
        <p className="workspace-side-note">
          ทางหลวง 304
          <br />
          เขาใหญ่–ทับลาน
        </p>
      </aside>
      <div className="workspace-body">
        <header className="workspace-top">
          <span className="workspace-project">โครงการติดตามทางลอดสัตว์ป่า</span>
          {demoLabel && <span className="workspace-demo">{demoLabel}</span>}
          {accountLabel && (
            <div className="account">
              <span className="workspace-role">
                <Icon name="user" size={17} />
                {accountLabel}
              </span>
              <button className="workspace-signout secondary" disabled={busy} onClick={onSignOut}>
                <Icon name="logout" size={17} /> ออกจากระบบ
              </button>
            </div>
          )}
        </header>
        <main className="workspace-content">{children}</main>
        <footer className="workspace-content footer">เขาใหญ่–ทับลาน · โครงการติดตามทางลอดสัตว์ป่า</footer>
      </div>
    </div>
  )
}
