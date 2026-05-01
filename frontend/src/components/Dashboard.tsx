import React, { useEffect, useState } from 'react';
import { LogOut, Folder, File, Download, HardDrive } from 'lucide-react';
import { apiFetch } from '../api';

interface Directory {
  id: number;
  name: string;
}

interface FileData {
  id: number;
  name: string;
  size_bytes: number;
  created_at: string;
}

export const Dashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [files, setFiles] = useState<FileData[]>([]);
  const [activeDir, setActiveDir] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDirs = async () => {
      const res = await apiFetch('/api/directories');
      if (res.ok) {
        const data = await res.json();
        setDirectories(data);
        if (data.length > 0) {
          setActiveDir(data[0].id);
        }
      }
    };
    fetchDirs();
  }, []);

  useEffect(() => {
    if (activeDir === null) return;
    
    const fetchFiles = async () => {
      setLoading(true);
      const res = await apiFetch(`/api/directories/${activeDir}/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
      }
      setLoading(false);
    };
    fetchFiles();
  }, [activeDir]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDownloadUrl = (fileId: number) => {
    const token = localStorage.getItem('token');
    return `/api/download/${fileId}?token=${token}`;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 font-bold">
            <HardDrive className="w-5 h-5" />
            <span>SendFile</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Twoje foldery</p>
          {directories.map(dir => (
            <button
              key={dir.id}
              onClick={() => setActiveDir(dir.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeDir === dir.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Folder className={`w-4 h-4 ${activeDir === dir.id ? 'text-blue-500' : 'text-gray-400'}`} />
              <span className="truncate">{dir.name}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Wyloguj się
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 p-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            {directories.find(d => d.id === activeDir)?.name || 'Wybierz folder'}
          </h1>
        </header>
        
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-gray-500 py-10">Ładowanie...</div>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <Folder className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Brak plików w tym folderze</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Nazwa pliku</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Rozmiar</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">Dodano</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Akcja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {files.map(file => (
                    <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <File className="w-5 h-5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{file.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-500">{formatSize(file.size_bytes)}</td>
                      <td className="py-4 px-4 text-sm text-gray-500">
                        {new Date(file.created_at).toLocaleDateString('pl-PL', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <a
                          href={getDownloadUrl(file.id)}
                          download
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium text-sm rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Pobierz
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
