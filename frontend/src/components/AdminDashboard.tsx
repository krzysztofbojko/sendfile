import React, { useEffect, useState, useCallback } from 'react';
import { LogOut, Users, FolderPlus, UploadCloud, Plus, UserPlus, HardDrive, Trash2, Key, FileText, Download } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { apiFetch } from '../api';
import { AuditLogs } from './AuditLogs';

interface UserData {
  id: number;
  username: string;
  is_admin: boolean;
}

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

export const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [activeUser, setActiveUser] = useState<number | null>(null);
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [activeDir, setActiveDir] = useState<number | null>(null);
  const [files, setFiles] = useState<FileData[]>([]);
  
  const [newUsername, setNewUsername] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  
  const [newDirName, setNewDirName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadPercentage, setUploadPercentage] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [uploadStats, setUploadStats] = useState('');
  const [uploadEta, setUploadEta] = useState('');

  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [myId, setMyId] = useState<number | null>(null);

  const loadUsers = async () => {
    const res = await apiFetch('/api/admin/users');
    if (res.ok) {
      setUsers(await res.json());
    }
  };

  useEffect(() => {
    const fetchMe = async () => {
      const res = await apiFetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setMyId(data.id);
      }
    };
    fetchMe();
    loadUsers();
  }, []);

  const loadDirs = async (userId: number) => {
    const res = await apiFetch(`/api/admin/users/${userId}/directories`);
    if (res.ok) {
      setDirectories(await res.json());
    }
  };

  useEffect(() => {
    if (activeUser) {
      loadDirs(activeUser);
      setActiveDir(null);
      setFiles([]);
    } else {
      setDirectories([]);
      setFiles([]);
    }
  }, [activeUser]);

  const loadFiles = async (dirId: number) => {
    const res = await apiFetch(`/api/admin/directories/${dirId}/files`);
    if (res.ok) {
      setFiles(await res.json());
    }
  };

  useEffect(() => {
    if (activeDir) {
      loadFiles(activeDir);
    } else {
      setFiles([]);
    }
  }, [activeDir]);

  // -- USER ACTIONS --
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername, pin: newPin, is_admin: newIsAdmin })
    });
    if (res.ok) {
      setNewUsername('');
      setNewPin('');
      setNewIsAdmin(false);
      loadUsers();
    } else {
      const data = await res.json();
      alert(data.detail || "Błąd tworzenia użytkownika");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tego użytkownika? Wszystkie jego dane (katalogi, pliki, logi) zostaną trwale usunięte!")) return;
    const res = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    if (res.ok) {
      if (activeUser === userId) setActiveUser(null);
      loadUsers();
    } else {
      alert("Błąd podczas usuwania użytkownika");
    }
  };

  const handleChangePin = async (userId: number) => {
    const newPinInput = window.prompt("Podaj nowy kod PIN dla tego użytkownika:");
    if (!newPinInput) return;
    const res = await apiFetch(`/api/admin/users/${userId}/pin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: newPinInput })
    });
    if (res.ok) {
      alert("PIN został pomyślnie zmieniony.");
    } else {
      alert("Błąd podczas zmiany PINu.");
    }
  };

  // -- DIR ACTIONS --
  const handleCreateDir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser) return;
    const res = await apiFetch('/api/admin/directories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newDirName, owner_id: activeUser })
    });
    if (res.ok) {
      setNewDirName('');
      loadDirs(activeUser);
    }
  };

  const handleDeleteDir = async (dirId: number) => {
    if (!window.confirm("Usunąć ten katalog wraz ze wszystkimi plikami w środku?")) return;
    const res = await apiFetch(`/api/admin/directories/${dirId}`, { method: 'DELETE' });
    if (res.ok) {
      if (activeDir === dirId) setActiveDir(null);
      if (activeUser) loadDirs(activeUser);
    }
  };

  // -- FILE ACTIONS --
  const handleDeleteFile = async (fileId: number) => {
    if (!window.confirm("Usunąć ten plik trwale z dysku?")) return;
    const res = await apiFetch(`/api/admin/files/${fileId}`, { method: 'DELETE' });
    if (res.ok && activeDir) {
      loadFiles(activeDir);
    }
  };

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

  // -- UPLOAD LOGIC --
  const processUpload = async (filesToUpload: File[], currentDirId: number) => {
    if (uploading) return;
    const totalFiles = filesToUpload.length;
    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < totalFiles; i++) {
      const file = filesToUpload[i];
      setUploadProgress(`Wgrywanie ${i + 1} z ${totalFiles}...`);
      setUploadPercentage(0);
      setUploadSpeed('');
      setUploadStats('');
      setUploadEta('Obliczanie...');
      
      const formData = new FormData();
      formData.append('file', file);

      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/admin/directories/${currentDirId}/files`);
          
          const token = localStorage.getItem("token");
          if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          }

          let lastTime = Date.now();
          let lastLoaded = 0;

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const currentTime = Date.now();
              const elapsedSeconds = (currentTime - lastTime) / 1000;
              
              if (elapsedSeconds > 0.5) { // Update speed every 500ms
                const bytesSinceLast = event.loaded - lastLoaded;
                const speedBps = bytesSinceLast / elapsedSeconds;
                setUploadSpeed(`${formatSize(speedBps)}/s`);
                
                if (speedBps > 0) {
                  const bytesRemaining = event.total - event.loaded;
                  const secondsRemaining = Math.max(0, Math.ceil(bytesRemaining / speedBps));
                  if (secondsRemaining < 60) {
                    setUploadEta(`${secondsRemaining}s`);
                  } else {
                    const minutes = Math.floor(secondsRemaining / 60);
                    const seconds = secondsRemaining % 60;
                    setUploadEta(`${minutes}m ${seconds}s`);
                  }
                }

                lastTime = currentTime;
                lastLoaded = event.loaded;
              }

              const percentComplete = Math.round((event.loaded / event.total) * 100);
              setUploadPercentage(percentComplete);
              setUploadStats(`${formatSize(event.loaded)} / ${formatSize(event.total)}`);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              successCount++;
              resolve();
            } else {
              failCount++;
              reject(new Error(xhr.statusText));
            }
          };

          xhr.onerror = () => {
            failCount++;
            reject(new Error("Błąd sieciowy"));
          };

          xhr.send(formData);
        });
        
        if (activeDir === currentDirId) {
          loadFiles(currentDirId);
        }
      } catch (err) {
        console.error(err);
      }
    }
    
    setUploading(false);
    setUploadProgress('');
    setUploadPercentage(0);
    setUploadSpeed('');
    setUploadStats('');
    setUploadEta('');
    
    if (failCount > 0) {
      alert(`Wgrano ${successCount} plików, błąd dla ${failCount} plików.`);
    }
  };

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>, dirId: number) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files);
    e.target.value = '';
    processUpload(fileList, dirId);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (activeDir && acceptedFiles.length > 0) {
      processUpload(acceptedFiles, activeDir);
    }
  }, [activeDir, uploading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    noClick: true, 
    noKeyboard: true 
  });

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-blue-600 font-bold mb-4">
            <HardDrive className="w-5 h-5" />
            <span>Admin Panel</span>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'users' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              Użytkownicy
            </button>
            <button 
              onClick={() => setActiveTab('audit')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'audit' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
              Audyt
            </button>
          </div>
        </div>

        {activeTab === 'users' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Lista użytkowników</p>
            {users.map(u => (
              <div key={u.id} className={`w-full flex flex-col p-2 rounded-lg transition-colors border ${activeUser === u.id ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-100'}`}>
                <div 
                  className="flex items-center gap-3 cursor-pointer mb-2"
                  onClick={() => setActiveUser(u.id)}
                >
                  <Users className={`w-4 h-4 ${activeUser === u.id ? 'text-blue-500' : 'text-gray-400'}`} />
                  <span className={`truncate font-medium text-sm flex-1 ${activeUser === u.id ? 'text-blue-700' : 'text-gray-700'}`}>
                    {u.username}
                  </span>
                  {u.is_admin && (
                    <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">Admin</span>
                  )}
                </div>
                {activeUser === u.id && (
                  <div className="flex gap-2 pl-7 mt-1">
                    <button onClick={() => handleChangePin(u.id)} className="text-xs flex items-center gap-1 text-gray-500 hover:text-blue-600" title="Zmień PIN">
                      <Key className="w-3 h-3" /> PIN
                    </button>
                    {u.id !== myId && (
                      <button onClick={() => handleDeleteUser(u.id)} className="text-xs flex items-center gap-1 text-gray-500 hover:text-red-600" title="Usuń trwale">
                        <Trash2 className="w-3 h-3" /> Usuń
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {users.length === 0 && <p className="text-sm text-gray-500 px-3">Brak użytkowników</p>}
          </div>
        ) : (
          <div className="flex-1 p-4">
            <p className="text-sm text-gray-500">Przejdź do głównego widoku po prawej, aby przeanalizować dzienniki logów.</p>
          </div>
        )}
        
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

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'audit' ? (
          <div className="p-6 h-full overflow-y-auto">
            <AuditLogs />
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 h-full overflow-y-auto content-start">
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-min">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-500" />
              Dodaj użytkownika
            </h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Login</label>
                <input 
                  type="text" 
                  value={newUsername} 
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PIN (Hasło)</label>
                <input 
                  type="text" 
                  value={newPin} 
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div className="flex items-center mt-4">
                <input 
                  type="checkbox" 
                  id="isAdmin" 
                  checked={newIsAdmin} 
                  onChange={(e) => setNewIsAdmin(e.target.checked)} 
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" 
                />
                <label htmlFor="isAdmin" className="ml-2 block text-sm text-gray-900">
                  Konto Administratora
                </label>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Utwórz użytkownika
              </button>
            </form>
            </div>
            {activeUser ? (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-min flex flex-col">
                 <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-blue-500" />
                  Katalogi i pliki
                </h2>
                
                <form onSubmit={handleCreateDir} className="flex gap-2 mb-6">
                  <input 
                    type="text" 
                    placeholder="Nazwa katalogu (np. Jan Kowalski)" 
                    value={newDirName} 
                    onChange={(e) => setNewDirName(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
                  <button type="submit" className="bg-green-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-1 transition-colors">
                    <Plus className="w-4 h-4"/> Dodaj
                  </button>
                </form>

                <div className="space-y-4 flex-1">
                  <p className="text-sm font-semibold text-gray-500">Istniejące katalogi:</p>
                  {directories.map(d => (
                    <div key={d.id} className={`border rounded-lg overflow-hidden transition-colors ${activeDir === d.id ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200'}`}>
                      <div 
                        className={`p-4 flex flex-col md:flex-row items-center justify-between cursor-pointer ${activeDir === d.id ? 'bg-blue-50 border-b border-blue-100' : 'hover:bg-gray-50'}`}
                        onClick={() => setActiveDir(d.id)}
                      >
                        <span className="font-medium text-gray-900 mb-2 md:mb-0 flex items-center gap-2">
                          <FolderPlus className={`w-5 h-5 ${activeDir === d.id ? 'text-blue-500' : 'text-gray-400'}`} />
                          {d.name}
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {activeDir === d.id && (
                            <label className={`inline-flex items-center gap-2 px-3 py-1.5 font-medium text-sm rounded-lg transition-colors cursor-pointer ${uploading ? 'bg-gray-300 text-gray-700 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                              <UploadCloud className="w-4 h-4" />
                              Wgraj pliki
                              <input type="file" multiple className="hidden" onChange={(e) => handleManualUpload(e, d.id)} disabled={uploading} />
                            </label>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteDir(d.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Usuń katalog">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Dropzone & Files Area */}
                      {activeDir === d.id && (
                        <div {...getRootProps()} className={`p-4 relative min-h-[150px] transition-colors ${isDragActive ? 'bg-blue-100 border-2 border-dashed border-blue-400 m-2 rounded-xl' : ''}`}>
                          <input {...getInputProps()} />
                          
                          {uploading && (
                            <div className="mb-4 p-4 bg-white border border-blue-100 rounded-xl shadow-sm">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-semibold text-blue-700">{uploadProgress}</span>
                                <div className="flex gap-2 items-center">
                                  {uploadEta && <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded" title="Szacowany czas">~ {uploadEta}</span>}
                                  <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">{uploadSpeed}</span>
                                </div>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadPercentage}%` }}></div>
                              </div>
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>{uploadPercentage}%</span>
                                <span>{uploadStats}</span>
                              </div>
                            </div>
                          )}

                          {files.length > 0 ? (
                            <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-xl overflow-hidden relative z-10">
                              {files.map(f => (
                                <li key={f.id} className="px-4 py-3 flex justify-between items-center text-sm hover:bg-gray-50">
                                  <div className="flex items-center gap-3 overflow-hidden">
                                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <span className="text-gray-700 font-medium truncate">{f.name}</span>
                                  </div>
                                  <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                                    <span className="text-gray-500 whitespace-nowrap font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                      {formatSize(f.size_bytes)}
                                    </span>
                                    <a
                                      href={getDownloadUrl(f.id)}
                                      download
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-gray-400 hover:text-blue-600 p-1 transition-colors"
                                      title="Pobierz plik"
                                    >
                                      <Download className="w-4 h-4" />
                                    </a>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFile(f.id); }} className="text-gray-400 hover:text-red-600 p-1 transition-colors" title="Usuń plik">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            !uploading && (
                              <div className="flex flex-col items-center justify-center h-32 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                <UploadCloud className="w-8 h-8 mb-2 opacity-50" />
                                <span className="text-sm font-medium">Brak plików</span>
                                <span className="text-xs mt-1">Przeciągnij pliki tutaj lub użyj przycisku</span>
                              </div>
                            )
                          )}
                          
                          {/* Drop Overlay */}
                          {isDragActive && !uploading && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-blue-50/90 rounded-xl backdrop-blur-sm">
                              <div className="text-center text-blue-600">
                                <UploadCloud className="w-10 h-10 mx-auto mb-2 animate-bounce" />
                                <span className="font-bold text-lg">Upuść pliki, aby wgrać</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {directories.length === 0 && <p className="text-sm text-gray-500 bg-gray-50 p-4 rounded-xl border border-dashed border-gray-200 text-center">Brak katalogów. Utwórz pierwszy powyżej.</p>}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 border-dashed flex flex-col items-center justify-center text-gray-500 h-min min-h-[300px]">
                <Users className="w-12 h-12 mb-4 text-gray-300" />
                <p className="font-medium text-gray-600">Brak aktywnego kontekstu</p>
                <p className="text-sm mt-1 text-center max-w-xs">Wybierz użytkownika z listy po lewej stronie, aby zarządzać jego projektami i plikami.</p>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};
