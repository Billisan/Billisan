import type { SVGProps } from 'react'

export function UmbrellaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 12a9 9 0 0 1 18 0" />
      <path d="M3 12h18" />
      <path d="M12 12v7" />
      <path d="M12 19a2 2 0 0 0 4 0" />
    </svg>
  )
}
