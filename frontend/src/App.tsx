import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { apiFetch } from './api';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      try {
        const res = await apiFetch('/api/me');
        if (res.ok) {
          const data = await res.json();
          setIsAuthenticated(true);
          setIsAdmin(data.is_admin);
        } else {
          setIsAuthenticated(false);
          localStorage.removeItem('token');
        }
      } catch {
        setIsAuthenticated(false);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };
    verifyToken();
  }, [token]);

  const handleLogin = async (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setIsAuthenticated(true);
    
    // Check if admin right after login
    try {
      const res = await fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${newToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(data.is_admin);
      }
    } catch(e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Weryfikacja sesji...</div>;
  }

  return isAuthenticated ? (
    isAdmin ? <AdminDashboard onLogout={handleLogout} /> : <Dashboard onLogout={handleLogout} />
  ) : (
    <Login onSuccess={handleLogin} />
  );
}

export default App;
