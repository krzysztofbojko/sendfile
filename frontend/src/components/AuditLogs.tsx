import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';

interface AuditLogData {
  id: number;
  username: string;
  action: string;
  resource: string;
  timestamp: string;
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      const res = await apiFetch('/api/admin/audit_logs');
      if (res.ok) {
        setLogs(await res.json());
      }
      setLoading(false);
    };
    fetchLogs();
  }, []);

  if (loading) return <div className="p-6 text-gray-500">Ładowanie logów...</div>;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <h2 className="text-lg font-bold mb-4">Logi systemowe (Audyt)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Data</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Użytkownik</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Akcja</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Zasób</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString('pl-PL')}
                </td>
                <td className="py-3 px-4 text-sm font-medium text-gray-900">{log.username}</td>
                <td className="py-3 px-4 text-sm text-blue-600 font-semibold">{log.action}</td>
                <td className="py-3 px-4 text-sm text-gray-500 truncate max-w-xs">{log.resource}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">Brak logów audytowych</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
