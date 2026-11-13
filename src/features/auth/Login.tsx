import { useState, type FormEvent } from 'react'
import { roleLabels, type Role } from '../../lib/model'
import './login.css'

const demoPassword = 'KhaoYai304!'
const demoAccounts: { role: Role; email: string }[] = [
  { role: 'field', email: 'field@khaoyai304.test' },
  { role: 'researcher', email: 'researcher@khaoyai304.test' },
  { role: 'road', email: 'road@khaoyai304.test' },
]

export function Login({
  onDemoSignIn,
  onSignIn,
  busy,
  error,
  timing,
}: {
  onDemoSignIn?: (role: Role) => void
  onSignIn?: (username: string, password: string) => void
  busy: boolean
  error?: string
  timing?: boolean
}) {
  const isDemo = !!onDemoSignIn
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const address = email.trim()
    if (!onDemoSignIn) {
      onSignIn?.(address, password)
      return
    }
    const account = demoAccounts.find((item) => item.email === address.toLowerCase())
    if (!account || password !== demoPassword) {
      setFormError('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      return
    }
    onDemoSignIn(account.role)
  }

  const feedback = formError || error
  return (
    <div className="login-shell">
      <section className="login-frame" aria-labelledby="login-title">
        <aside className="login-landscape" aria-label="โครงการเขาใหญ่ 304">
          <div className="login-brand">
            <span className="login-brand-mark" aria-hidden="true">304</span>
            <div><strong>เขาใหญ่ 304</strong><small>โครงการติดตามทางลอดสัตว์ป่า</small></div>
          </div>
          <div className="login-story">
            <p>เขาใหญ่–ทับลาน · ทางหลวงหมายเลข 304</p>
            <h2>ลอดช่องสัตว์ป่า<br />เขาใหญ่–ทับลาน</h2>
            <div className="login-crossings" aria-label="ทางลอด A, B และ C">
              <span>A</span><span>B</span><span>C</span>
            </div>
          </div>
        </aside>
        <div className="login-form-area">
          {isDemo && <span className="login-mode">{timing ? 'โหมดจับเวลา' : 'โหมดสาธิต'}</span>}
          <h1 id="login-title">เข้าสู่ระบบ</h1>
          <p className="login-intro">
            {isDemo
              ? 'กรอกอีเมลและรหัสผ่านของบัญชีทดสอบเพื่อเข้าหน้าทำงานตามบทบาท'
              : 'กรอกชื่อผู้ใช้และรหัสผ่านของบัญชีโครงการ'}
          </p>
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="login-email">{isDemo ? 'อีเมล' : 'ชื่อผู้ใช้'}</label>
            <input
              id="login-email"
              name="username"
              type={isDemo ? 'email' : 'text'}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={isDemo ? 'name@example.com' : 'กรอกชื่อผู้ใช้'}
              value={email}
              required
              aria-invalid={!!formError}
              aria-describedby={feedback ? 'login-error' : undefined}
              onChange={(event) => { setEmail(event.target.value); setFormError('') }}
            />
            <label htmlFor="login-password">รหัสผ่าน</label>
            <div className="login-password">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="กรอกรหัสผ่าน"
                value={password}
                required
                aria-invalid={!!formError}
                aria-describedby={feedback ? 'login-error' : undefined}
                onChange={(event) => { setPassword(event.target.value); setFormError('') }}
              />
              <button type="button" className="login-reveal" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? 'ซ่อน' : 'แสดง'}
              </button>
            </div>
            {feedback && <p id="login-error" className="login-error" role="alert">{feedback}</p>}
            <button type="submit" className="login-submit" disabled={busy}>
              {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
              {!busy && <span aria-hidden="true">→</span>}
            </button>
          </form>
          {isDemo && (
            <details className="login-demo">
              <summary>ดูบัญชีทดสอบทั้ง 3 บทบาท</summary>
              <dl>
                {demoAccounts.map(({ role, email }) => (
                  <div key={role}><dt>{roleLabels[role]}</dt><dd>{email}</dd></div>
                ))}
              </dl>
              <p>รหัสผ่านทดสอบทุกบัญชี <code>{demoPassword}</code></p>
              <small>ข้อมูลทดสอบจัดเก็บในเบราว์เซอร์นี้</small>
            </details>
          )}
        </div>
      </section>
    </div>
  )
}
