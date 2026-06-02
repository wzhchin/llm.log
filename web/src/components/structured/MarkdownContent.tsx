import { memo, useMemo } from 'react';

interface MarkdownContentProps {
  text?: string;
  imageUrl?: string;
  isBase64Image?: boolean;
  fileName?: string;
  fileType?: string;
}

/** Raw-mode inline formatter: preserves ALL symbols, adds visual styling only. */
function formatRawInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let key = 0;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];

    // Code fence detection — show fences as dim text, content in pre
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // Flush code content as pre block
        if (codeBlockLines.length > 0) {
          nodes.push(
            <pre key={key++} className="md-pre-raw">
              <code>{codeBlockLines.join('\n')}</code>
            </pre>
          );
          codeBlockLines = [];
        }
        // Show closing ``` as visible dim text
        nodes.push(
          <span key={key++} className="block text-[var(--text-3)] font-mono text-[12px]">
            {'```'}
          </span>
        );
        inCodeBlock = false;
      } else {
        // Show opening ``` (with lang tag) as visible dim text
        if (li > 0) nodes.push(<br key={key++} />);
        nodes.push(
          <span key={key++} className="block text-[var(--text-3)] font-mono text-[12px]">
            {line}
          </span>
        );
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Normal line: apply inline formatting
    if (li > 0) {
      nodes.push(<br key={key++} />);
    }

    // Check for heading prefix
    const headingMatch = line.match(/^(#{1,4})\s/);
    if (headingMatch) {
      const prefix = headingMatch[1];
      const level = prefix.length;
      const sizeClass = level === 1 ? 'text-[1.25em]' : level === 2 ? 'text-[1.1em]' : level === 3 ? 'text-[1em]' : 'text-[0.95em]';
      nodes.push(
        <span key={key++} className={`block font-semibold ${sizeClass} mt-2 mb-0.5`}>
          {formatInlineTokens(line, key, (k) => { key = k; })}
        </span>
      );
      continue;
    }

    // Regular line with inline formatting
    nodes.push(...formatInlineTokens(line, key, (k) => { key = k; }));
  }

  // Close unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    nodes.push(
      <pre key={key++} className="md-pre-raw">
        <code>{codeBlockLines.join('\n')}</code>
      </pre>
    );
  }

  return nodes;
}

/** Process inline tokens within a single line. */
function formatInlineTokens(
  text: string,
  startKey: number,
  consumeKey: (k: number) => void,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let key = startKey;

  // Order: code > bold+italic > bold > italic > strikethrough > xml tags
  const tokenRe = /(`+)([^`]+)\1|(\*\*\*)(.+?)\*\*\*|(\*\*)(.+?)\*\*|(\*)(.+?)\*(?!\*)|(~~)(.+?)~~|(<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^>]*)?\/?>)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Inline code: `code`
      const marker = match[1];
      const content = match[2];
      result.push(
        <code key={key++} className="md-code-raw">
          {marker}{content}{marker}
        </code>
      );
    } else if (match[3]) {
      const content = match[4];
      result.push(
        <span key={key++} className="font-semibold italic text-[var(--c-cyan)]">
          ***{content}***
        </span>
      );
    } else if (match[5]) {
      const content = match[6];
      result.push(
        <strong key={key++} className="font-semibold">
          **{content}**
        </strong>
      );
    } else if (match[7]) {
      const content = match[8];
      result.push(
        <em key={key++} className="italic text-[var(--c-cyan)]">
          *{content}*
        </em>
      );
    } else if (match[9]) {
      const content = match[10];
      result.push(
        <del key={key++} className="line-through opacity-60">
          ~~{content}~~
        </del>
      );
    } else if (match[11]) {
      // XML tag: <tag> or </tag>
      const tag = match[11];
      result.push(
        <span key={key++} className="text-[var(--c-blue)]">
          {tag}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  consumeKey(key);
  return result;
}

export const MarkdownContent = memo(function MarkdownContent({
  text, imageUrl, isBase64Image, fileName, fileType,
}: MarkdownContentProps) {
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
      <div className="rounded-lg bg-[var(--bg-1)] border border-[var(--border-0)] p-4 text-center">
        <span className="text-[var(--text-1)] text-sm font-mono">[image — base64 data not displayed]</span>
      </div>
    );
  }

  if (fileName) {
    return (
      <div className="rounded-lg bg-[var(--bg-1)] border border-[var(--border-0)] p-3 flex items-center gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">{fileName}</div>
          {fileType && (
            <div className="text-xs text-[var(--text-2)]">{fileType}</div>
          )}
        </div>
      </div>
    );
  }

  if (!text) return null;

  const formatted = useMemo(() => {
    // Try to prettify JSON
    let display = text;
    try {
      const parsed = JSON.parse(text);
      display = JSON.stringify(parsed, null, 2);
      return { type: 'json' as const, content: display };
    } catch {
      // Not JSON — use inline formatting
    }
    return { type: 'text' as const, nodes: formatRawInline(display) };
  }, [text]);

  if (formatted.type === 'json') {
    return (
      <pre className="overflow-x-auto rounded bg-[var(--bg-input)] p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all border border-[var(--border-0)]">
        <code className="text-foreground">{formatted.content}</code>
      </pre>
    );
  }

  return (
    <div className="text-[13px] leading-[1.7] font-mono whitespace-pre-wrap break-words">
      {formatted.nodes}
    </div>
  );
});
