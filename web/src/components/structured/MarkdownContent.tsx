import { memo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  text?: string;
  showRaw: boolean;
  imageUrl?: string;
  isBase64Image?: boolean;
  fileName?: string;
  fileType?: string;
}

export const MarkdownContent = memo(function MarkdownContent({
  text, showRaw, imageUrl, isBase64Image, fileName, fileType,
}: MarkdownContentProps) {
  // Image rendering
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt="Image"
        className="rounded-lg max-w-full h-auto max-h-96 object-contain"
      />
    );
  }
  if (isBase64Image) {
    return (
      <div className="rounded-lg bg-[var(--color-surface-raised)] border border-border p-4 text-center">
        <span className="text-[var(--color-text-secondary)] text-sm font-mono">[image — base64 data not displayed]</span>
      </div>
    );
  }

  // File rendering
  if (fileName) {
    return (
      <div className="rounded-lg bg-[var(--color-surface-raised)] border border-border p-3 flex items-center gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">{fileName}</div>
          {fileType && (
            <div className="text-xs text-[var(--color-text-tertiary)]">{fileType}</div>
          )}
        </div>
      </div>
    );
  }

  if (!text) return null;

  // Raw mode
  if (showRaw) {
    // Try to prettify JSON
    let display = text;
    try {
      const parsed = JSON.parse(text);
      display = JSON.stringify(parsed, null, 2);
    } catch {
      // not JSON, use as-is
    }
    return (
      <pre className="overflow-x-auto rounded-lg bg-[var(--color-surface-raised)] p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">
        <code className="text-foreground">{display}</code>
      </pre>
    );
  }

  // Markdown mode — custom CSS (not Tailwind prose)
  return (
    <div className="md-content">
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  );
});
