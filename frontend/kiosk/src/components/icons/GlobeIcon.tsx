import type { SVGProps } from 'react'

export function GlobeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 21 21"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M1.75 10.5C1.75 5.66751 5.66751 1.75 10.5 1.75M1.75 10.5C1.75 15.3325 5.66751 19.25 10.5 19.25M1.75 10.5H19.25M10.5 1.75C15.3325 1.75 19.25 5.66751 19.25 10.5M10.5 1.75C8.31138 4.14606 7.06759 7.25553 7 10.5C7.06759 13.7445 8.31138 16.8539 10.5 19.25M10.5 1.75C12.6886 4.14606 13.9324 7.25553 14 10.5C13.9324 13.7445 12.6886 16.8539 10.5 19.25M19.25 10.5C19.25 15.3325 15.3325 19.25 10.5 19.25" />
    </svg>
  )
}
