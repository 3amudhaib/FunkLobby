import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, AlertTriangle, RefreshCw, Wrench, Loader2 } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

interface DiagnosticCheck {
  check: string;
  status: 'ok' | 'warn' | 'fail';
  message: string;
}

export function DiagnosticsPage() {
  const { t } = useTranslation();
  const [results, setResults] = useState<DiagnosticCheck[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [repairResults, setRepairResults] = useState<string[] | null>(null);
  const [repairing, setRepairing] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    setResults(null);
    setRepairResults(null);
    try {
      const res = await window.electronAPI.runDiagnostics();
      setResults(res);
    } catch (err) {
      setResults([{ check: 'Diagnostics Engine', status: 'fail', message: String(err) }]);
    }
    setLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairResults(null);
    try {
      const res = await window.electronAPI.repairInstallation();
      setRepairResults(res);
      // Re-run diagnostics after repair
      const diag = await window.electronAPI.runDiagnostics();
      setResults(diag);
    } catch (err) {
      setRepairResults([`Repair failed: ${String(err)}`]);
    }
    setRepairing(false);
  };

  const iconForStatus = (status: string) => {
    if (status === 'ok') return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    return <AlertCircle className="w-4 h-4 text-red-400" />;
  };

  const countByStatus = (status: string) => results?.filter(r => r.status === status).length || 0;

  return (
    <div className="page-container pt-14">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Diagnostics</h1>
          <p className="text-sm text-surface-400 mt-1">Verify application health and repair issues</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost text-sm flex items-center gap-1.5"
            onClick={runDiagnostics}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            className="btn-primary text-sm flex items-center gap-1.5"
            onClick={handleRepair}
            disabled={repairing}
          >
            <Wrench className={`w-4 h-4 ${repairing ? 'animate-spin' : ''}`} />
            {repairing ? 'Repairing...' : 'Repair Installation'}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {results && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Passed', status: 'ok', count: countByStatus('ok'), color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
            { label: 'Warnings', status: 'warn', count: countByStatus('warn'), color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
            { label: 'Failed', status: 'fail', count: countByStatus('fail'), color: 'text-red-400 bg-red-500/10 border-red-500/20' },
          ].map(s => (
            <div key={s.status} className={`rounded-xl border p-4 ${s.color}`}>
              <div className="text-2xl font-bold">{s.count}</div>
              <div className="text-xs mt-1 opacity-80">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Diagnostics results */}
      <div className="space-y-1.5">
        {loading && (
          <div className="flex items-center justify-center py-12 text-surface-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Running diagnostics...
          </div>
        )}
        {results && results.length === 0 && !loading && (
          <div className="text-center py-12 text-surface-400">No results returned</div>
        )}
        {results?.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.02 }}
            className={`flex items-start gap-3 p-3 rounded-xl text-sm ${
              r.status === 'ok' ? 'bg-emerald-500/5' :
              r.status === 'warn' ? 'bg-amber-500/5' : 'bg-red-500/5'
            }`}
          >
            <div className="mt-0.5 flex-shrink-0">{iconForStatus(r.status)}</div>
            <div className="min-w-0 flex-1">
              <div className={`font-medium ${
                r.status === 'ok' ? 'text-emerald-300' :
                r.status === 'warn' ? 'text-amber-300' : 'text-red-300'
              }`}>{r.check}</div>
              <div className="text-surface-400 text-xs mt-0.5 break-all">{r.message}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Repair results */}
      {repairResults && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary-400" />
            Repair Results
          </h2>
          <div className="space-y-1">
            {repairResults.map((msg, i) => (
              <div key={i} className="text-sm text-surface-300 p-2.5 rounded-xl bg-surface-800/50">
                {msg}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}