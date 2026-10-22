import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Search,
  Plus,
  Download,
  Users,
  Trash2,
  Lock,
  Shield,
  FileCheck,
  Clock,
  Key,
  Copy,
  Check
} from 'lucide-react';
import PermissionModal from './PermissionModal';
import UploadModal from './UploadModal';

export default function DocumentsView({ onRefreshAudit }) {
  const { user, token } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState('all'); // 'all', 'owned', 'shared', 'admin_all'
  const [selectedDocForPerms, setSelectedDocForPerms] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [copiedHash, setCopiedHash] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchDocuments = async () => {
    try {
      let url = `/api/documents?q=${encodeURIComponent(searchQuery)}`;
      if (selectedCategory) url += `&category=${selectedCategory}`;
      if (viewMode === 'admin_all') url += `&viewMode=admin_all`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [searchQuery, selectedCategory, viewMode, token]);

  const handleDownload = async (docId, fileName) => {
    setDownloadingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        if (onRefreshAudit) onRefreshAudit();
      } else {
        const err = await res.json();
        alert(`Download Denied: ${err.message || 'Access Forbidden'}`);
        if (onRefreshAudit) onRefreshAudit();
      }
    } catch (err) {
      alert('Network error downloading document.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (docId, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? All access grants will be revoked immediately.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        fetchDocuments();
        if (onRefreshAudit) onRefreshAudit();
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to delete document.');
      }
    } catch (err) {
      alert('Network error deleting document.');
    }
  };

  const copyHash = (hash, id) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const getClassificationBadge = (classification) => {
    switch (classification) {
      case 'strictly_restricted':
        return { label: 'Strictly Restricted', bg: 'rgba(244, 63, 94, 0.15)', text: '#FDA4AF', border: 'rgba(244, 63, 94, 0.3)' };
      case 'confidential':
        return { label: 'Confidential', bg: 'rgba(245, 158, 11, 0.15)', text: '#FBBF24', border: 'rgba(245, 158, 11, 0.3)' };
      default:
        return { label: 'Internal', bg: 'rgba(6, 182, 212, 0.15)', text: '#38BDF8', border: 'rgba(6, 182, 212, 0.3)' };
    }
  };

  // Client-side view filtering
  const displayedDocs = documents.filter(doc => {
    if (viewMode === 'owned') return doc.owner_id === user?.id;
    if (viewMode === 'shared') return doc.owner_id !== user?.id;
    return true;
  });

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 24px' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#FFF', letterSpacing: '-0.5px' }}>Cryptographic Document Vault</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Encrypted files at rest (AES-256-GCM) with real-time server-side access control.
          </p>
        </div>

        {user?.role !== 'viewer' && (
          <button
            id="btn-upload-document"
            onClick={() => setUploadModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFF',
              fontWeight: '600',
              fontSize: '13px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)'
            }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            Upload New Document
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        marginBottom: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{
            flex: 1,
            minWidth: '280px',
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Search style={{ width: '16px', height: '16px', color: 'var(--text-dim)', position: 'absolute', left: '12px' }} />
            <input
              id="input-doc-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by title or description (Unpermitted files remain 100% invisible)..."
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-medium)',
                color: '#FFF',
                fontSize: '13px'
              }}
            />
          </div>

          {/* Scope Filters */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setViewMode('all')}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                background: viewMode === 'all' ? 'var(--bg-card-hover)' : 'transparent',
                color: viewMode === 'all' ? '#FFF' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: viewMode === 'all' ? '600' : '400',
                border: '1px solid var(--border-subtle)'
              }}
            >
              All Permitted
            </button>
            <button
              onClick={() => setViewMode('owned')}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                background: viewMode === 'owned' ? 'var(--bg-card-hover)' : 'transparent',
                color: viewMode === 'owned' ? '#FFF' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: viewMode === 'owned' ? '600' : '400',
                border: '1px solid var(--border-subtle)'
              }}
            >
              Owned by Me
            </button>
            <button
              onClick={() => setViewMode('shared')}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                background: viewMode === 'shared' ? 'var(--bg-card-hover)' : 'transparent',
                color: viewMode === 'shared' ? '#FFF' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: viewMode === 'shared' ? '600' : '400',
                border: '1px solid var(--border-subtle)'
              }}
            >
              Shared with Me
            </button>

            {user?.role === 'admin' && (
              <button
                onClick={() => setViewMode('admin_all')}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: viewMode === 'admin_all' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                  color: viewMode === 'admin_all' ? '#C4B5FD' : 'var(--text-dim)',
                  fontSize: '12px',
                  fontWeight: viewMode === 'admin_all' ? '600' : '400',
                  border: '1px solid rgba(139, 92, 246, 0.3)'
                }}
              >
                All Vault Inventory (Admin Compliance View)
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category:</span>
          {['', 'financial', 'legal', 'human_resources', 'audit_compliance', 'engineering'].map((cat) => (
            <button
              key={cat || 'all'}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '4px 10px',
                borderRadius: '16px',
                background: selectedCategory === cat ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                color: selectedCategory === cat ? '#34D399' : 'var(--text-dim)',
                border: `1px solid ${selectedCategory === cat ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                fontSize: '11px',
                textTransform: 'capitalize'
              }}
            >
              {cat ? cat.replace('_', ' ') : 'All Categories'}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-dim)' }}>
          Loading cryptographic vault documents...
        </div>
      ) : displayedDocs.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px dashed var(--border-medium)'
        }}>
          <Lock style={{ width: '40px', height: '40px', color: 'var(--text-dim)', margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#FFF' }}>No Documents Accessible</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '440px', margin: '8px auto 0' }}>
            Zero unpermitted documents are returned. Only files explicitly owned by you or granted to your identity appear in search.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '20px'
        }}>
          {displayedDocs.map((doc) => {
            const classBadge = getClassificationBadge(doc.classification);
            const isOwner = doc.owner_id === user?.id;

            return (
              <div
                key={doc.id}
                id={`doc-card-${doc.id}`}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-card)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div>
                  {/* Top Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: classBadge.bg,
                      color: classBadge.text,
                      border: `1px solid ${classBadge.border}`,
                      fontWeight: '600'
                    }}>
                      {classBadge.label}
                    </span>

                    <span style={{
                      fontSize: '11px',
                      color: isOwner ? '#34D399' : 'var(--cyan-light)',
                      fontFamily: 'var(--font-mono)',
                      background: isOwner ? 'rgba(16, 185, 129, 0.1)' : 'rgba(6, 182, 212, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>
                      {isOwner ? 'OWNER' : (doc.user_permission ? doc.user_permission.toUpperCase() : 'SHARED')}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#FFF', lineHeight: '1.3', marginBottom: '6px' }}>
                    {doc.title}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '14px', minHeight: '34px' }}>
                    {doc.description || 'No description provided.'}
                  </p>

                  {/* Metadata Row */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    fontSize: '11px',
                    color: 'var(--text-dim)',
                    background: 'var(--bg-card)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Owner:</span>
                      <strong style={{ color: '#FFF' }}>{doc.owner_name}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Format / Size:</span>
                      <span>{doc.mime_type?.split('/')[1]?.toUpperCase()} • {(doc.file_size / 1024).toFixed(1)} KB</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>SHA-256 Hash:</span>
                      <div
                        onClick={() => copyHash(doc.content_hash, doc.id)}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: copiedHash === doc.id ? '#34D399' : 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        <span>{doc.content_hash?.slice(0, 10)}...</span>
                        {copiedHash === doc.id ? <Check style={{ width: '11px', height: '11px' }} /> : <Copy style={{ width: '11px', height: '11px' }} />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                  <button
                    id={`btn-download-${doc.id}`}
                    onClick={() => handleDownload(doc.id, doc.file_name)}
                    disabled={downloadingId === doc.id}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#34D399',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  >
                    <Download style={{ width: '14px', height: '14px' }} />
                    {downloadingId === doc.id ? 'Decrypting...' : 'Download'}
                  </button>

                  {isOwner && (
                    <button
                      id={`btn-manage-access-${doc.id}`}
                      onClick={() => setSelectedDocForPerms(doc)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-medium)',
                        color: '#FFF',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                    >
                      <Users style={{ width: '14px', height: '14px' }} />
                      Access ({doc.active_grants_count || 0})
                    </button>
                  )}

                  {isOwner && (
                    <button
                      id={`btn-delete-${doc.id}`}
                      onClick={() => handleDelete(doc.id, doc.title)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(244, 63, 94, 0.1)',
                        border: '1px solid rgba(244, 63, 94, 0.25)',
                        color: '#F43F5E'
                      }}
                    >
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Permission Manager Modal */}
      {selectedDocForPerms && (
        <PermissionModal
          document={selectedDocForPerms}
          onClose={() => setSelectedDocForPerms(null)}
          onRefresh={() => {
            fetchDocuments();
            if (onRefreshAudit) onRefreshAudit();
          }}
        />
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <UploadModal
          onClose={() => setUploadModalOpen(false)}
          onSuccess={() => {
            fetchDocuments();
            if (onRefreshAudit) onRefreshAudit();
          }}
        />
      )}
    </div>
  );
}
