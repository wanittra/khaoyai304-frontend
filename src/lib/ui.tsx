import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
export const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
export function useLoad<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [result, setResult] = useState<{ data?: T; error?: string }>({})
  useEffect(() => {
    let current = true
    setResult({})
    loader().then(
      (data) => {
        if (current) setResult({ data })
      },
      (error) => {
        if (current) setResult({ error: message(error) })
      },
    )
    return () => {
      current = false
    }
  }, deps)
  return result
}
export function Result<T>({
  result,
  children,
}: {
  result: { data?: T; error?: string }
  children: (value: T) => ReactNode
}) {
  if (result.error)
    return (
      <p className="error" role="alert">
        {result.error}
      </p>
    )
  if (result.data === undefined) return <p role="status">กำลังโหลด…</p>
  return children(result.data)
}
export function Header({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow: string
  title: string
  icon?: IconName
  children: ReactNode
}) {
  return (
    <header className="page-head">
      <div className="eyebrow">{eyebrow}</div>
      <h1>
        {icon && (
          <span className="heading-icon">
            <Icon name={icon} size={27} />
          </span>
        )}
        {title}
      </h1>
      <p>{children}</p>
    </header>
  )
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>
}

export function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <p className="table-hint">เลื่อนตารางซ้าย–ขวาเพื่อดูข้อมูลทุกคอลัมน์</p>
      <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
    </>
  )
}
