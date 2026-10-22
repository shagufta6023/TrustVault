import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('trustvault_token'));
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch current user details
  useEffect(() => {
    async function loadMe() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          localStorage.removeItem('trustvault_token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Error fetching current user:', err);
      } finally {
        setLoading(false);
      }
    }

    loadMe();
  }, [token]);

  // Fetch available users for persona switcher
  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch('/api/auth/users', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableUsers(data.users || []);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    }

    if (token) {
      loadUsers();
    }
  }, [token]);

  const switchPersona = async (userId) => {
    try {
      const res = await fetch('/api/auth/switch-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('trustvault_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      console.error('Failed to switch persona:', err);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('trustvault_token');
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, availableUsers, switchPersona, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
