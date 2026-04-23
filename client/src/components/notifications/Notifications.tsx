import { useState, useEffect } from 'react'
import { notificationsAPI } from '../../services/api'
import {
  BellIcon, CheckIcon, ExclamationTriangleIcon,
  BellAlertIcon, WifiIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useSocket } from '../../hooks/useSocket'
import { useFarmStore } from '../../store/farmStore'

const SEVERITY_BG: Record<string, string> = {
  critical: 'bg-red-100 border-red-300',
  high:     'bg-orange-100 border-orange-300',
  medium:   'bg-yellow-100 border-yellow-200',
  low:      'bg-blue-100 border-blue-200',
}
const SEVERITY_TEXT: Record<string, string> = {
  critical: 'text-red-700',
  high:     'text-orange-700',
  medium:   'text-yellow-700',
  low:      'text-blue-700',
}
const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500 animate-ping',
  high:     'bg-orange-500',
  medium:   'bg-yellow-500',
  low:      'bg-blue-400',
}

function severityEmoji(s: string) {
  return ({ critical: '🚨', high: '⚠️', medium: 'ℹ️', low: '✅' } as Record<string,string>)[s] ?? '🔔'
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [isLoading, setIsLoading]         = useState(true)
  const [filter, setFilter]               = useState<'all' | 'unread' | 'live'>('all')

  const { selectedFarm } = useFarmStore()
  const { latestAlert, alertHistory, isConnected, notifPermission } = useSocket(selectedFarm?.id ?? null)

  // Show a toast whenever a live alert arrives
  useEffect(() => {
    if (!latestAlert) return
    const { alert } = latestAlert
    const isCritical = alert.severity === 'critical' || alert.severity === 'high'
    toast.custom(
      (t) => (
        <div
          className={clsx(
            'flex items-start gap-3 p-4 rounded-xl shadow-xl border max-w-sm w-full cursor-pointer',
            SEVERITY_BG[alert.severity] ?? 'bg-white border-gray-200'
          )}
          onClick={() => toast.dismiss(t.id)}
        >
          <span className="text-2xl leading-none">{severityEmoji(alert.severity)}</span>
          <div>
            <p className={clsx('font-semibold text-sm', SEVERITY_TEXT[alert.severity] ?? 'text-gray-800')}>
              {alert.title}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">{alert.message}</p>
          </div>
        </div>
      ),
      { duration: isCritical ? 10000 : 5000, position: 'top-right' }
    )
  }, [latestAlert])

  const fetchNotifications = async () => {
    try {
      const res = await notificationsAPI.getAll({ unreadOnly: filter === 'unread', limit: 50 })
      setNotifications(res.data.notifications)
      setUnreadCount(res.data.unreadCount)
    } catch {
      console.error('Failed to fetch notifications')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchNotifications() }, [filter])

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsAPI.markAsRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      setUnreadCount(c => Math.max(0, c - 1))
    } catch { toast.error('Failed to mark as read') }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch { toast.error('Failed to mark all as read') }
  }

  const priorityBg = (p: string) =>
    ({ critical: 'bg-red-100', high: 'bg-orange-100', medium: 'bg-blue-100', low: 'bg-gray-100' } as Record<string,string>)[p] ?? 'bg-gray-100'

  const priorityIcon = (p: string) => {
    const cls = clsx('w-5 h-5', p === 'critical' ? 'text-red-600' : p === 'high' ? 'text-orange-600' : 'text-blue-600')
    return (p === 'critical' || p === 'high')
      ? <ExclamationTriangleIcon className={cls} />
      : <BellIcon className={cls} />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    )
  }

  const liveItems = alertHistory.map((e, i) => ({ ...e.alert, id: `live-${i}`, createdAt: e.timestamp }))
  const displayList = filter === 'live' ? liveItems : notifications

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <span className={clsx('w-2 h-2 rounded-full', isConnected ? 'bg-green-500' : 'bg-gray-400')} />
            {isConnected ? 'Live connected' : 'Connecting…'}
            {unreadCount > 0 && ` · ${unreadCount} unread`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {notifPermission !== 'granted' && (
            <button onClick={() => Notification.requestPermission()} className="btn-secondary text-sm flex items-center gap-2">
              <BellAlertIcon className="w-4 h-4" /> Enable Push Alerts
            </button>
          )}
          {notifPermission === 'granted' && (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1">
              <WifiIcon className="w-3.5 h-3.5" /> Push alerts ON
            </span>
          )}
          {unreadCount > 0 && (
            <button onClick={handleMarkAllAsRead} className="btn-secondary flex items-center gap-2">
              <CheckIcon className="w-5 h-5" /> Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'unread', 'live'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium text-sm transition-colors capitalize',
              filter === f ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {f === 'live' ? `⚡ Live (${alertHistory.length})` : f === 'unread' ? `Unread (${unreadCount})` : 'All'}
          </button>
        ))}
      </div>

      {/* Live feed */}
      {filter === 'live' && alertHistory.length === 0 && (
        <div className="card text-center py-10 text-gray-400">
          <p>No live alerts yet — hardware sensor events will appear here instantly.</p>
        </div>
      )}
      {filter === 'live' && alertHistory.length > 0 && (
        <div className="space-y-3">
          {alertHistory.map((event, i) => (
            <div key={i} className={clsx('flex items-start gap-4 p-4 rounded-xl border', SEVERITY_BG[event.alert.severity] ?? 'bg-gray-50 border-gray-200')}>
              <span className="text-2xl">{severityEmoji(event.alert.severity)}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={clsx('w-2 h-2 rounded-full', SEVERITY_DOT[event.alert.severity])} />
                  <p className={clsx('font-semibold text-sm', SEVERITY_TEXT[event.alert.severity])}>{event.alert.title}</p>
                </div>
                <p className="text-xs text-gray-600 mt-1">{event.alert.message}</p>
                {event.alert.sensor && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.entries(event.alert.sensor).map(([k, v]) => (
                      <span key={k} className="text-xs bg-white/70 border rounded px-2 py-0.5 font-mono">{k}: {String(v)}</span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">{new Date(event.timestamp).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Standard notifications list */}
      {filter !== 'live' && displayList.length > 0 && (
        <div className="space-y-3">
          {displayList.map((n: any) => (
            <div
              key={n.id}
              className={clsx('card cursor-pointer transition-colors', !n.readAt && 'bg-primary-50 border-primary-100')}
              onClick={() => !n.readAt && handleMarkAsRead(n.id)}
            >
              <div className="flex items-start">
                <div className={clsx('p-2 rounded-lg flex-shrink-0', priorityBg(n.priority))}>
                  {priorityIcon(n.priority)}
                </div>
                <div className="ml-4 flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className={clsx('font-medium', n.readAt ? 'text-gray-700' : 'text-gray-900')}>{n.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{n.message}</p>
                    </div>
                    {!n.readAt && <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-2" />}
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-400 flex-wrap">
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded">{n.type}</span>
                    {n.channels?.includes('sms')   && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded">📱 SMS Sent</span>}
                    {n.channels?.includes('email') && <span className="px-2 py-0.5 bg-blue-100  text-blue-700  rounded">📧 Email Sent</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filter !== 'live' && displayList.length === 0 && (
        <div className="card text-center py-12">
          <BellIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
          <p className="text-gray-500">
            {filter === 'unread' ? 'All notifications have been read' : 'You have no notifications yet'}
          </p>
        </div>
      )}

    </div>
  )
}
