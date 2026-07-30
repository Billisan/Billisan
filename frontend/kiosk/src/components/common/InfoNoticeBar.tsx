import type { ComponentType, SVGProps } from 'react'

interface InfoNoticeItem {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  subtitle: string
}

interface InfoNoticeBarProps {
  items: InfoNoticeItem[]
}

export function InfoNoticeBar({ items }: InfoNoticeBarProps) {
  return (
    <div className="border-disabled divide-disabled flex w-full divide-x overflow-hidden rounded-2xl border">
      {items.map(({ icon: Icon, title, subtitle }, index) => (
        <div key={index} className="flex flex-1 items-center gap-4 bg-white p-8">
          <Icon className="text-primary h-8 w-8 flex-shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="text-lg font-bold text-black">{title}</span>
            <span className="text-tertiary-text text-md">{subtitle}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
