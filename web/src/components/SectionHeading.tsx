interface SectionHeadingProps {
  children: React.ReactNode;
  as?: 'h2' | 'h3';
}

export function SectionHeading({ children, as: Tag = 'h3' }: SectionHeadingProps) {
  return (
    <Tag className="flex items-center gap-2 text-[var(--text-heading-2)] font-semibold text-foreground mb-4">
      <span
        className="section-dot"
        style={{
          backgroundColor: 'var(--c-amber)',
          boxShadow: '0 0 5px rgba(212,168,83,0.35)',
        }}
      />
      <span className="font-mono text-xs uppercase tracking-wider text-[var(--text-1)]">
        {children}
      </span>
    </Tag>
  );
}
