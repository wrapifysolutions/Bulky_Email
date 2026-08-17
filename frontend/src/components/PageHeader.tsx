interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, action, eyebrow }: PageHeaderProps) {
  return (
    <div className="mb-7 flex flex-col gap-4 border-b border-ink-200/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 pt-8 lg:pt-0 animate-fade-up">
        {eyebrow && (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">
            {eyebrow}
          </p>
        )}
        <h1 className="page-title">{title}</h1>
        <div className="page-title-bar" />
        {description && (
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-500">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 animate-fade-up stagger-2">
          {action}
        </div>
      )}
    </div>
  );
}
