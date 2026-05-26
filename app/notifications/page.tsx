'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { Notification } from '@/lib/types';
import { notificationStore } from '@/lib/storage';
import Navbar from '@/components/Navbar';

const TYPE_STYLE: Record<string, { bg: string; color: string; icon: string; label: string; cta: string }> = {
  nudge:        { bg: '#EFF6FF', color: '#0033A0', icon: '💬', label: 'Nudge',        cta: 'Log diary →'          },
  query:        { bg: '#FEF9C3', color: '#854D0E', icon: '❓', label: 'Query',        cta: 'Review compliance →'  },
  hotspot:      { bg: '#FEE2E2', color: '#E30613', icon: '🔥', label: 'Alert',        cta: 'View details →'       },
  intervention: { bg: '#DCFCE7', color: '#008751', icon: '🎯', label: 'Intervention', cta: 'View tasks →'         },
  report:       { bg: '#F3E8FF', color: '#7C3AED', icon: '📊', label: 'Report',       cta: 'Open report →'        },
};

export default function NotificationsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    setNotifications(notificationStore.getByUser(user.id));
  }, [user, isLoading, router]);

  function markAllRead() {
    notifications.forEach((n) => {
      if (!n.isRead) notificationStore.markRead(n.id);
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  function openNotification(n: Notification) {
    if (!n.isRead) {
      notificationStore.markRead(n.id);
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
    }
    if (n.deepLink) router.push(n.deepLink);
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-5 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-bold" style={{ color: '#9CA3AF' }}>Inbox</p>
            <h1 className="text-xl font-black" style={{ color: '#0033A0' }}>Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs px-3 py-1.5 rounded-xl font-bold"
              style={{ background: '#EFF6FF', color: '#0033A0', border: '1.5px solid #BFDBFE' }}
            >
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔔</p>
            <p className="font-bold" style={{ color: '#374151' }}>All clear</p>
            <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>No notifications yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((n) => {
              const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.nudge;
              return (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className="flex items-start gap-3 p-4 rounded-2xl w-full text-left transition-opacity"
                  style={{
                    background: n.isRead ? 'white' : '#EFF6FF',
                    border: `1.5px solid ${n.isRead ? '#E5E7EB' : '#BFDBFE'}`,
                    opacity: n.isRead ? 0.8 : 1,
                  }}
                >
                  {/* Unread dot */}
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: style.bg }}>
                      {style.icon}
                    </div>
                    {!n.isRead && (
                      <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                        style={{ background: '#E30613', border: '2px solid white' }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: style.bg, color: style.color }}>
                        {style.label}
                      </span>
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>
                        {new Date(n.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: '#111827' }}>{n.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{n.body}</p>
                    {n.deepLink && (
                      <p className="text-xs mt-1 font-semibold" style={{ color: style.color }}>
                        {style.cta}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
