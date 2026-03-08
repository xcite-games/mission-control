'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Clock, Play, RefreshCw, CheckCircle, XCircle, Filter } from 'lucide-react';
import { Header } from '@/components/Header';

interface CronEntry {
  cron_id: string;
  module: string;
  args: string[];
  description: string;
  owner: string;
  output_channel: string | null;
  schedule: string | null;
  last_run: string | null;
  last_status: string | null;
  last_duration_ms: number | null;
}

function formatSchedule(schedule: string | null): string {
  if (!schedule) return '—';
  // Common cron patterns
  if (schedule === '*/5 * * * *') return 'Every 5 min';
  if (schedule === '*/30 * * * *') return 'Every 30 min';
  const parts = schedule.split(' ');
  if (parts.length !== 5) return schedule;
  const [min, hour, dom, , dow] = parts;
  const dayNames: Record<string, string> = { '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '0': 'Sun' };
  if (dom !== '*' && dom === '1') {
    return `Monthly 1st @ ${hour}:${min.padStart(2, '0')}`;
  }
  if (dom !== '*' && dom === '15') {
    return `Monthly 15th @ ${hour}:${min.padStart(2, '0')}`;
  }
  if (dow !== '*') {
    const days = dow.split(',').map(d => dayNames[d] || d).join(',');
    if (dow === '1-5') return `Weekdays @ ${hour}:${min.padStart(2, '0')}`;
    return `${days} @ ${hour}:${min.padStart(2, '0')}`;
  }
  if (hour !== '*') {
    return `Daily @ ${hour}:${min.padStart(2, '0')}`;
  }
  return schedule;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SchedulesPage() {
  const [crons, setCrons] = useState<CronEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [triggering, setTriggering] = useState<string | null>(null);

  const loadCrons = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (ownerFilter) params.set('owner', ownerFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/crons?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCrons(data.crons || []);
      }
    } catch (err) {
      console.error('Failed to load crons:', err);
    } finally {
      setLoading(false);
    }
  }, [ownerFilter, statusFilter]);

  useEffect(() => {
    loadCrons();
    const interval = setInterval(loadCrons, 30000);
    return () => clearInterval(interval);
  }, [loadCrons]);

  const handleTrigger = async (cronId: string) => {
    if (!confirm(`Manually trigger "${cronId}"?`)) return;
    setTriggering(cronId);
    try {
      await fetch(`/api/crons/${cronId}/trigger`, { method: 'POST' });
      setTimeout(loadCrons, 2000);
    } catch (err) {
      console.error('Trigger failed:', err);
    } finally {
      setTriggering(null);
    }
  };

  const owners = Array.from(new Set(crons.map(c => c.owner))).sort();
  const successCount = crons.filter(c => c.last_status === 'success').length;
  const errorCount = crons.filter(c => c.last_status === 'error').length;
  const unknownCount = crons.filter(c => !c.last_status).length;

  return (
    <div className="min-h-screen bg-mc-bg">
      <Header />

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-mc-text-secondary">
          <Link href="/" className="hover:text-mc-text flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Workspaces
          </Link>
          <span>/</span>
          <span className="text-mc-text flex items-center gap-1">
            <Clock className="w-4 h-4" /> Schedules
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-mc-bg-secondary border border-mc-border rounded-lg px-4 py-3">
            <div className="text-2xl font-bold text-mc-accent-cyan">{crons.length}</div>
            <div className="text-xs text-mc-text-secondary uppercase">Total Crons</div>
          </div>
          <div className="bg-mc-bg-secondary border border-mc-border rounded-lg px-4 py-3">
            <div className="text-2xl font-bold text-mc-accent-green">{successCount}</div>
            <div className="text-xs text-mc-text-secondary uppercase">Healthy</div>
          </div>
          <div className="bg-mc-bg-secondary border border-mc-border rounded-lg px-4 py-3">
            <div className="text-2xl font-bold text-mc-accent-red">{errorCount}</div>
            <div className="text-xs text-mc-text-secondary uppercase">Errors</div>
          </div>
          <div className="bg-mc-bg-secondary border border-mc-border rounded-lg px-4 py-3">
            <div className="text-2xl font-bold text-mc-text-secondary">{unknownCount}</div>
            <div className="text-xs text-mc-text-secondary uppercase">No Data</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-mc-text-secondary" />
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="bg-mc-bg-secondary border border-mc-border rounded px-3 py-1.5 text-sm text-mc-text"
          >
            <option value="">All Owners</option>
            {owners.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-mc-bg-secondary border border-mc-border rounded px-3 py-1.5 text-sm text-mc-text"
          >
            <option value="">All Statuses</option>
            <option value="success">Healthy</option>
            <option value="error">Error</option>
          </select>
          <button
            onClick={loadCrons}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm text-mc-text-secondary hover:text-mc-text bg-mc-bg-secondary border border-mc-border rounded"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Table */}
        <div className="bg-mc-bg-secondary border border-mc-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-mc-text-secondary">Loading crons...</div>
          ) : crons.length === 0 ? (
            <div className="p-8 text-center text-mc-text-secondary">
              No crons found. Generate the manifest first:<br />
              <code className="text-xs mt-2 block">python3 -m Services.Integrations.mission_control.generate_cron_manifest</code>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mc-border text-mc-text-secondary text-xs uppercase">
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Cron ID</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">Description</th>
                    <th className="px-4 py-3 text-left">Schedule</th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">Owner</th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">Last Run</th>
                    <th className="px-4 py-3 text-left hidden xl:table-cell">Duration</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {crons.map((cron) => (
                    <tr key={cron.cron_id} className="border-b border-mc-border/50 hover:bg-mc-bg-tertiary transition-colors">
                      <td className="px-4 py-2.5">
                        {cron.last_status === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-mc-accent-green" />
                        ) : cron.last_status === 'error' ? (
                          <XCircle className="w-4 h-4 text-mc-accent-red" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-mc-border" />
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{cron.cron_id}</td>
                      <td className="px-4 py-2.5 text-mc-text-secondary hidden md:table-cell max-w-xs truncate">{cron.description}</td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className="px-2 py-0.5 bg-mc-bg-tertiary rounded">{formatSchedule(cron.schedule)}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-mc-text-secondary hidden lg:table-cell">{cron.owner}</td>
                      <td className="px-4 py-2.5 text-xs text-mc-text-secondary hidden lg:table-cell">{timeAgo(cron.last_run)}</td>
                      <td className="px-4 py-2.5 text-xs text-mc-text-secondary hidden xl:table-cell">{formatDuration(cron.last_duration_ms)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => handleTrigger(cron.cron_id)}
                          disabled={triggering === cron.cron_id}
                          className="p-1.5 hover:bg-mc-accent-cyan/20 rounded text-mc-text-secondary hover:text-mc-accent-cyan disabled:opacity-50 transition-colors"
                          title="Trigger manually"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
