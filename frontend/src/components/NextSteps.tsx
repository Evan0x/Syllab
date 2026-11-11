type NextStepsProps = {
  label?: string
  items: { href: string; label: string }[]
}

export function NextSteps({ label = "Next", items }: NextStepsProps) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="inline-flex h-8 items-center rounded-md border border-hairline bg-surface px-3 text-[12px] text-ink hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}
