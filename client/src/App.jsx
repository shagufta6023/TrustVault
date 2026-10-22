import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import DocumentsView from './components/DocumentsView';
import AuditTrailView from './components/AuditTrailView';
import AdminDashboardView from './components/AdminDashboardView';
import SecurityPlaygroundModal from './components/SecurityPlaygroundModal';

function MainApp() {
  const { user, token, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('documents');
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [auditStatus, setAuditStatus] = useState({ isValid: true });

  const refreshAuditStatus = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/audit/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditStatus(data.report);
      }
    } catch (err) {
      console.error('Error refreshing audit status:', err);
    }
  };

  useEffect(() => {
    refreshAuditStatus();
  }, [token]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)',
        color: 'var(--text-dim)'
      }}>
        Initializing Cryptographic TrustVault...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPlayground={() => setPlaygroundOpen(true)}
        auditStatus={auditStatus}
      />

      <main style={{ flex: 1 }}>
        {activeTab === 'documents' && <DocumentsView onRefreshAudit={refreshAuditStatus} />}
        {activeTab === 'audit' && <AuditTrailView onChainVerified={setAuditStatus} />}
        {activeTab === 'admin' && user?.role === 'admin' && <AdminDashboardView />}
      </main>

      {/* Security Attack Playground Modal for Judge Testing */}
      {playgroundOpen && (
        <SecurityPlaygroundModal
          onClose={() => setPlaygroundOpen(false)}
          onRefreshAudit={refreshAuditStatus}
        />
      )}

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        padding: '16px 28px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-dim)',
        background: 'var(--bg-sidebar)'
      }}>
        TrustVault Platform • Zero-Trust Cryptographic Document Storage • Verified Tamper-Evident Hash Chain
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
