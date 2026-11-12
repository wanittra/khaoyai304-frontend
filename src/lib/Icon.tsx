import type { ReactNode } from 'react'

const shapes = {
  paw: (
    <>
      <path fill="currentColor" stroke="none" d="M7 13c2-3 3-4 5-4s3 1 5 4c2 2 3 3 2 5s-3 2-5 1c-1-.5-3-.5-4 0-2 1-4 1-5-1s0-3 2-5Z" />
      <ellipse cx="4" cy="8" rx="1.5" ry="2.2" transform="rotate(-30 4 8)" />
      <ellipse cx="9" cy="5" rx="1.4" ry="2.2" />
      <ellipse cx="15" cy="5" rx="1.4" ry="2.2" />
      <ellipse cx="20" cy="8" rx="1.5" ry="2.2" transform="rotate(30 20 8)" />
    </>
  ),
  wildlife: (
    <path d="m3 20 2-5-1-4 2 1 7 1 3-5 1-2 4 1v2l-3 1-1 5 2 5m-4 0-1-5-6 1-1 4M17 6l-2-2V2m3 4 1-3 2-1" />
  ),
  map: (
    <>
      <path d="M12 22s7-6 7-13a7 7 0 1 0-14 0c0 7 7 13 7 13Z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" />
    </>
  ),
  list: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h10M7 13h10m-10 4h6" />
    </>
  ),
  review: (
    <>
      <path d="M12 22s8-4 8-11V6l-8-4-8 4v5c0 7 8 11 8 11Z" />
      <path d="m8.5 12 2.5 2.5 5-5" />
    </>
  ),
  report: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 15v-3m4 3V8m4 7v-5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 4 9 5 9-5" />
    </>
  ),
  camera: (
    <>
      <path d="M4 7h4l2-3h4l2 3h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
    </>
  ),
  logout: (
    <>
      <path d="M11 4H4v16h7m4-4 4-4-4-4m4 4H9" />
    </>
  ),
  cloud: (
    <>
      <path d="M7 17H6a4 4 0 0 1-.4-8 6 6 0 0 1 11.5-1A4.5 4.5 0 0 1 18.5 17H17m-5 4v-9m-3 3 3-3 3 3" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 5 5" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3 2 21h20L12 3Zm0 6v5m0 3v1" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof shapes
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name]}
    </svg>
  )
}
