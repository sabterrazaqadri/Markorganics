import { waNumber } from "@/lib/phone";
import { Card, DateCell } from "./ui";

export interface ThreadMessage {
  id: string;
  direction: string;
  body: string;
  templateName: string;
  status: string;
  error: string | null;
  dryRun: boolean;
  isRead: boolean;
  createdAt: string;
}

/**
 * A read-only WhatsApp thread on the customer's profile.
 *
 * Deliberately not an inbox: replying happens in WhatsApp itself, through the
 * link at the bottom. Building a half-working chat client is how a support
 * conversation ends up split across two places, and neither is complete.
 */
export function WhatsappThread({ phone, messages }: { phone: string; messages: ThreadMessage[] }) {
  const unread = messages.filter((m) => m.direction === "inbound" && !m.isRead).length;

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          WhatsApp
          {unread > 0 ? <span className="a-badge a-badge-warn">{unread} unread</span> : null}
        </span>
      }
      actions={
        <a href={`https://wa.me/${waNumber(phone)}`} target="_blank" rel="noopener" className="a-btn-link">
          Reply in WhatsApp &nearr;
        </a>
      }
    >
      {messages.length === 0 ? (
        <p className="p-3 text-[12px] text-[var(--a-soft)]">
          Nothing sent to or received from this number yet.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--a-border)]">
          {messages.map((message) => {
            const inbound = message.direction === "inbound";
            return (
              <li key={message.id} className={`px-3 py-2 text-[12.5px] ${inbound ? "" : "bg-[var(--a-info-bg)]"}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--a-soft)]">
                    {inbound ? "Customer" : "MARK"}
                    {message.templateName ? ` · ${message.templateName}` : ""}
                    {message.dryRun ? " · dry run" : ""}
                  </span>
                  <DateCell value={message.createdAt} />
                </div>
                <p className="mt-0.5 whitespace-pre-wrap">{message.body}</p>
                {message.error ? (
                  <p className="mt-0.5 text-[11px] text-[var(--a-danger)]">
                    {message.status}: {message.error}
                  </p>
                ) : !inbound ? (
                  <p className="mt-0.5 text-[11px] text-[var(--a-soft)]">{message.status}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
