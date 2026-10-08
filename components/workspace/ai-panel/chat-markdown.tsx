"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ChatMarkdown({ children }: { children: string }) {
  return (
    <div className="break-words text-sm leading-[1.65] text-[var(--text-primary)] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
        h1: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold">{children}</h3>,
        h2: ({ children }) => <h3 className="mb-2 mt-5 text-base font-semibold">{children}</h3>,
        h3: ({ children }) => <h4 className="mb-2 mt-4 text-sm font-semibold">{children}</h4>,
        p: ({ children }) => <p className="mb-3">{children}</p>,
        ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
        a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2">{children}</a>,
        pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-md bg-[var(--bg-base)] p-3 text-xs">{children}</pre>,
        code: ({ children }) => <code className="rounded bg-[var(--bg-base)] px-1 font-mono text-[0.9em]">{children}</code>,
        blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-[var(--border-subtle)] pl-3 text-[var(--text-secondary)]">{children}</blockquote>,
        table: ({ children }) => <div className="my-3 overflow-x-auto"><table className="w-full border-collapse text-xs">{children}</table></div>,
        th: ({ children }) => <th className="border border-[var(--border-default)] bg-[var(--bg-surface-raised)] p-2 text-left font-medium">{children}</th>,
        td: ({ children }) => <td className="border border-[var(--border-default)] p-2 align-top">{children}</td>,
        img: () => null,
      }}>{children}</Markdown>
    </div>
  );
}
