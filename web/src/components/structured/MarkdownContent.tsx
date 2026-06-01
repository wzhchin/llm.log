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
        <span className="text-[var(--color-text-secondary)] text-sm">🖼️ Image (base64 data not displayed)</span>
      </div>
    );
  }

  // File rendering
  if (fileName) {
    return (
      <div className="rounded-lg bg-[var(--color-surface-raised)] border border-border p-3 flex items-center gap-3">
        <span className="text-lg">📎</span>
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

  // Markdown mode
  return (
    <div className="prose prose-invert prose-sm max-w-none
      prose-p:my-1 prose-pre:my-2 prose-pre:bg-[var(--color-surface-raised)] prose-pre:p-3 prose-pre:rounded-lg
      prose-code:text-emerald-400 prose-code:before:content-none prose-code:after:content-none
      prose-headings:text-foreground prose-a:text-emerald-400
      prose-strong:text-foreground prose-code:font-mono prose-code:text-xs
      prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1">
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  );
});
