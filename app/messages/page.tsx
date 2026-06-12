'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { Message, MessageReply } from '@/lib/types';
import { messageStore } from '@/lib/storage';
import Navbar from '@/components/Navbar';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const SEVERITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  urgent:  { bg: '#FEE2E2', color: '#E30613', label: 'Urgent' },
  warning: { bg: '#FEF9C3', color: '#854D0E', label: 'Action Required' },
  info:    { bg: '#DBEAFE', color: '#0033A0', label: 'Info' },
};

export default function MessagesPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  function load() {
    if (!user) return;
    const msgs = messageStore.getForUser(user.id);
    setMessages(msgs);
    if (selected) {
      const updated = msgs.find((m) => m.id === selected.id);
      if (updated) setSelected(updated);
    }
  }

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    load();
  }, [user, isLoading, router]);

  function openMessage(msg: Message) {
    if (!msg.isRead) {
      messageStore.markRead(msg.id);
    }
    setSelected(msg);
    setReplyText('');
    load();
  }

  function sendReply() {
    if (!selected || !replyText.trim() || !user) return;
    setSending(true);
    const reply: MessageReply = {
      id: uid(),
      fromUserId: user.id,
      fromName: user.name,
      body: replyText.trim(),
      sentAt: new Date().toISOString(),
    };
    messageStore.addReply(selected.id, reply);
    setReplyText('');
    setSending(false);
    load();
  }

  const unread = messages.filter((m) => !m.isRead).length;

  if (isLoading) return null;

  // ── Thread view ────────────────────────────────────────────────────────
  if (selected) {
    const sev = SEVERITY_STYLES[selected.severity ?? 'info'];
    return (
      <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
        <Navbar />
        <main className="max-w-2xl md:max-w-3xl mx-auto px-4 md:px-6 py-5 md:py-8 pb-24">
          <button
            onClick={() => setSelected(null)}
            className="text-sm font-medium mb-4 flex items-center gap-1"
            style={{ color: '#0033A0' }}
          >
            ← Back to Inbox
          </button>

          {/* Message header */}
          <div className="rounded-2xl p-5 mb-4" style={{ background: 'white', border: '1.5px solid #E5E7EB' }}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="font-black text-base" style={{ color: '#111827' }}>{selected.subject}</h2>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  From <strong>{selected.fromName}</strong> ({selected.fromRole}) ·{' '}
                  {new Date(selected.sentAt).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {selected.severity && (
                <span
                  className="text-xs font-bold px-2 py-1 rounded-full shrink-0"
                  style={{ background: sev.bg, color: sev.color }}
                >
                  {sev.label}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{selected.body}</p>
            {selected.requiredResponseDate && (
              <div
                className="mt-3 text-xs font-semibold px-3 py-2 rounded-xl"
                style={{ background: '#FEE2E2', color: '#E30613' }}
              >
                Response required by: {new Date(selected.requiredResponseDate).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            )}
          </div>

          {/* Replies */}
          {(selected.replies ?? []).length > 0 && (
            <div className="flex flex-col gap-3 mb-4">
              {selected.replies!.map((r) => (
                <div
                  key={r.id}
                  className="rounded-2xl p-4"
                  style={{
                    background: r.fromUserId === user?.id ? '#EFF6FF' : 'white',
                    border: '1.5px solid #E5E7EB',
                    marginLeft: r.fromUserId === user?.id ? 24 : 0,
                    marginRight: r.fromUserId === user?.id ? 0 : 24,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold" style={{ color: '#0033A0' }}>{r.fromName}</p>
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>
                      {new Date(r.sentAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="text-sm" style={{ color: '#374151' }}>{r.body}</p>
                </div>
              ))}
            </div>
          )}

          {/* Reply box */}
          <div
            className="fixed bottom-0 left-0 right-0 p-4"
            style={{ background: 'white', borderTop: '1px solid #E5E7EB' }}
          >
            <div className="max-w-2xl md:max-w-3xl mx-auto flex gap-3">
              <textarea
                className="flex-1 rounded-xl px-4 py-3 text-sm resize-none"
                style={{ border: '1.5px solid #D1D5DB', background: '#F9FAFB', minHeight: 56, maxHeight: 120 }}
                placeholder="Type your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
              />
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || sending}
                className="px-5 py-2 rounded-xl font-bold text-sm text-white self-end shrink-0"
                style={{ background: replyText.trim() ? '#0033A0' : '#9CA3AF' }}
              >
                Send
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Inbox list ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />
      <main className="max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto px-4 md:px-6 py-5 md:py-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => router.back()} style={{ color: '#0033A0' }} className="text-sm font-medium">
            ←
          </button>
          <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>Messages</h1>
          {unread > 0 && (
            <span
              className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
              style={{ background: '#E30613', color: 'white' }}
            >
              {unread}
            </span>
          )}
        </div>

        {messages.length === 0 ? (
          <div className="text-center py-20 rounded-2xl" style={{ background: 'white' }}>
            <p className="text-4xl mb-3">✉️</p>
            <p className="font-semibold" style={{ color: '#374151' }}>No messages yet</p>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>Messages from your school and district will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            {messages.map((msg) => {
              const sev = SEVERITY_STYLES[msg.severity ?? 'info'];
              return (
                <button
                  key={msg.id}
                  onClick={() => openMessage(msg)}
                  className="w-full text-left p-4 rounded-2xl transition-all"
                  style={{
                    background: 'white',
                    border: `1.5px solid ${!msg.isRead ? '#BFDBFE' : '#E5E7EB'}`,
                    boxShadow: !msg.isRead ? '0 0 0 2px rgba(0,51,160,0.06)' : 'none',
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Unread dot */}
                    <div className="pt-1 shrink-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: !msg.isRead ? '#0033A0' : 'transparent' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-sm truncate" style={{ color: '#111827' }}>
                          {msg.subject}
                        </p>
                        {msg.severity && msg.severity !== 'info' && (
                          <span
                            className="text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ background: sev.bg, color: sev.color }}
                          >
                            {sev.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs mb-1" style={{ color: '#6B7280' }}>
                        {msg.fromName} · {msg.fromRole}
                      </p>
                      <p className="text-xs leading-relaxed truncate" style={{ color: '#9CA3AF' }}>
                        {msg.body}
                      </p>
                    </div>
                    <div className="text-xs shrink-0 mt-0.5" style={{ color: '#9CA3AF' }}>
                      {new Date(msg.sentAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  {(msg.replies ?? []).length > 0 && (
                    <p className="text-xs mt-2 ml-5" style={{ color: '#6B7280' }}>
                      {(msg.replies ?? []).length} {(msg.replies ?? []).length === 1 ? 'reply' : 'replies'} ↩
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
