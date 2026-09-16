import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/lib/i18n";

function CodeBlock({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const pre = event.currentTarget.parentElement?.querySelector("pre");
    const text = pre?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="group/code relative">
      <button
        type="button"
        onClick={copy}
        aria-label={t("msg.copy")}
        className="absolute end-2 top-2 z-10 rounded-md border border-border bg-elevated/90 p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/code:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre dir="ltr">{children}</pre>
    </div>
  );
}

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="xv-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
