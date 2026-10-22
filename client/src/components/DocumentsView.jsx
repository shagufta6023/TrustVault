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
  Check,
  Folder,
  ChevronDown,
  Building,
  UserCheck,
  AlertTriangle,
  MoreHorizontal
} from 'lucide-react';
import PermissionModal from './PermissionModal';
import UploadModal from './UploadModal';

export default function DocumentsView({ onRefreshAudit }) {
  const { user, availableUsers, switchPersona, logout, token } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState('all'); // 'all', 'owned', 'shared', 'admin_all'
  const [selectedDocForPerms, setSelectedDocForPerms] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [copiedHash, setCopiedHash] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const [activeMenuDocId, setActiveMenuDocId] = useState(null);

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
        alert(`Delete Failed: ${err.message || 'Unauthorized action'}`);
      }
    } catch (err) {
      alert('Network error deleting document.');
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Classification Badge styling
  const getClassificationBadge = (classification) => {
    switch (classification) {
      case 'strictly_restricted':
        return {
          label: 'Strictly Restricted',
          bg: '#FFF1F2',
          border: '#FECDD3',
          text: '#E11D48',
          icon: '🔒'
        };
      case 'confidential':
        return {
          label: 'Confidential',
          bg: '#EFF6FF',
          border: '#BFDBFE',
          text: '#2563EB',
          icon: '🛡️'
        };
      default:
        return {
          label: 'Internal Use Only',
          bg: '#F5F3FF',
          border: '#DDD6FE',
          text: '#7C3AED',
          icon: '👥'
        };
    }
  };

  // Category Pills definition
  const CATEGORIES = [
    { id: '', label: 'All Categories', icon: '' },
    { id: 'financial', label: 'Financial', icon: '🏛️', bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' },
    { id: 'legal', label: 'Legal', icon: '⚖️', bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
    { id: 'human_resources', label: 'Human Resources', icon: '👥', bg: '#FFEDD5', text: '#C2410C', border: '#FED7AA' },
    { id: 'audit_compliance', label: 'Audit Compliance', icon: '🛡️', bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
    { id: 'engineering', label: 'Engineering', icon: '⚙️', bg: '#E0E7FF', text: '#4338CA', border: '#C7D2FE' }
  ];

  const getCategoryTheme = (category) => {
    switch (category) {
      case 'human_resources':
        return { color: '#EA580C', icon: '📁' };
      case 'legal':
        return { color: '#16A34A', icon: '📁' };
      case 'financial':
        return { color: '#7C3AED', icon: '📁' };
      case 'audit_compliance':
        return { color: '#0284C7', icon: '📁' };
      case 'engineering':
        return { color: '#4F46E5', icon: '📁' };
      default:
        return { color: '#64748B', icon: '📁' };
    }
  };

  // Stats calculation
  const totalDocsCount = documents.length;
  const restrictedDocsCount = documents.filter(d => d.classification === 'strictly_restricted').length;
  const ownedDocsCount = documents.filter(d => d.owner_id === user?.id || d.user_permission === 'owner').length;

  const userInitial = user?.name ? user.name[0].toUpperCase() : 'U';

  const viewModeLabels = {
    all: 'All Files ▾',
    owned: 'Owned by Me ▾',
    shared: 'Shared with Me ▾',
    admin_all: 'All Vault Inventory ▾'
  };

  return (
    <div style={{
      maxWidth: '1440px',
      margin: '0 auto',
      padding: '28px 32px',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) 340px',
      gap: '28px',
      alignItems: 'start'
    }}>
      {/* ================= LEFT MAIN CONTENT ================= */}
      <div>
        {/* Title & Actions Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '800',
              letterSpacing: '-0.7px',
              color: '#0F172A',
              margin: '0 0 6px 0',
              lineHeight: 1.2
            }}>
              Cryptographic <span style={{ color: '#2563EB' }}>Document</span> <span style={{ color: '#7C3AED' }}>Vault</span>
            </h1>
            <p style={{ color: '#64748B', fontSize: '14px', margin: 0, fontWeight: '400' }}>
              Encrypted files at rest (AES-256-GCM) with real-time server-side access control.
            </p>
          </div>

          {(user?.role === 'owner' || user?.role === 'admin') && (
            <button
              id="btn-open-upload-modal"
              onClick={() => setUploadModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 20px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#FFF',
                fontWeight: '700',
                fontSize: '14px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                cursor: 'pointer'
              }}
            >
              <Plus style={{ width: '18px', height: '18px' }} />
              Upload New Document
            </button>
          )}
        </div>

        {/* Search & Scope Dropdown Bar */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          padding: '8px 12px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
        }}>
          {/* Search Input */}
          <div style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center'
          }}>
            <Search style={{ width: '18px', height: '18px', color: '#94A3B8', position: 'absolute', left: '10px' }} />
            <input
              id="input-doc-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by title or description (Unpermitted files remain 100% invisible)..."
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                borderRadius: '10px',
                background: 'transparent',
                border: 'none',
                color: '#0F172A',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          {/* Scope Dropdown Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setScopeDropdownOpen(!scopeDropdownOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '10px',
                background: '#2563EB',
                color: '#FFFFFF',
                fontWeight: '600',
                fontSize: '13px',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                cursor: 'pointer'
              }}
            >
              <span>{viewModeLabels[viewMode] || 'All Files ▾'}</span>
            </button>

            {scopeDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '210px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                padding: '6px',
                zIndex: 40
              }}>
                <button
                  onClick={() => { setViewMode('all'); setScopeDropdownOpen(false); }}
                  style={{
                    width: '100%', padding: '8px 12px', textAlign: 'left',
                    borderRadius: '8px', fontSize: '13px',
                    fontWeight: viewMode === 'all' ? '700' : '500',
                    background: viewMode === 'all' ? '#EFF6FF' : 'transparent',
                    color: viewMode === 'all' ? '#2563EB' : '#334155'
                  }}
                >
                  All Permitted
                </button>
                <button
                  onClick={() => { setViewMode('owned'); setScopeDropdownOpen(false); }}
                  style={{
                    width: '100%', padding: '8px 12px', textAlign: 'left',
                    borderRadius: '8px', fontSize: '13px',
                    fontWeight: viewMode === 'owned' ? '700' : '500',
                    background: viewMode === 'owned' ? '#EFF6FF' : 'transparent',
                    color: viewMode === 'owned' ? '#2563EB' : '#334155'
                  }}
                >
                  Owned by Me
                </button>
                <button
                  onClick={() => { setViewMode('shared'); setScopeDropdownOpen(false); }}
                  style={{
                    width: '100%', padding: '8px 12px', textAlign: 'left',
                    borderRadius: '8px', fontSize: '13px',
                    fontWeight: viewMode === 'shared' ? '700' : '500',
                    background: viewMode === 'shared' ? '#EFF6FF' : 'transparent',
                    color: viewMode === 'shared' ? '#2563EB' : '#334155'
                  }}
                >
                  Shared with Me
                </button>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => { setViewMode('admin_all'); setScopeDropdownOpen(false); }}
                    style={{
                      width: '100%', padding: '8px 12px', textAlign: 'left',
                      borderRadius: '8px', fontSize: '13px',
                      fontWeight: viewMode === 'admin_all' ? '700' : '500',
                      background: viewMode === 'admin_all' ? '#F5F3FF' : 'transparent',
                      color: viewMode === 'admin_all' ? '#7C3AED' : '#334155'
                    }}
                  >
                    All Vault Inventory (Admin)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Category Filter Row (Pills) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '24px'
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '800',
            color: '#64748B',
            letterSpacing: '0.6px',
            marginRight: '2px'
          }}>
            CATEGORY:
          </span>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: isSelected ? '700' : '600',
                  background: isSelected
                    ? '#2563EB'
                    : (cat.bg || '#FFFFFF'),
                  color: isSelected
                    ? '#FFFFFF'
                    : (cat.text || '#475569'),
                  border: isSelected
                    ? '1px solid #2563EB'
                    : `1px solid ${cat.border || '#E2E8F0'}`,
                  boxShadow: isSelected ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat.icon && <span>{cat.icon}</span>}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* ================= DOCUMENT CARDS GRID (2 Columns) ================= */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 14px' }} />
            <p style={{ fontSize: '14px', margin: 0 }}>Decryption verification & access evaluation...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : documents.length === 0 ? (
          /* Empty / Isolated State */
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '20px',
            padding: '60px 32px',
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: '#F1F5F9',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748B',
              marginBottom: '16px'
            }}>
              <Lock style={{ width: '32px', height: '32px' }} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', marginBottom: '8px' }}>
              No Documents Accessible
            </h2>
            <p style={{ color: '#64748B', fontSize: '13px', maxWidth: '440px', margin: '0 auto 20px', lineHeight: '1.5' }}>
              Zero unpermitted documents are returned. Only files explicitly owned by you or granted to your identity appear in search.
            </p>
            {(user?.role === 'owner' || user?.role === 'admin') && (
              <button
                onClick={() => setUploadModalOpen(true)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  background: '#2563EB',
                  color: '#FFF',
                  fontWeight: '600',
                  fontSize: '13px'
                }}
              >
                Upload First Document
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '18px'
          }}>
            {documents.map((doc) => {
              const isOwner = doc.owner_id === user?.id || doc.user_permission === 'owner';
              const classBadge = getClassificationBadge(doc.classification);
              const catTheme = getCategoryTheme(doc.category);
              const formattedDate = new Date(doc.updated_at || doc.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <div
                  key={doc.id}
                  id={`doc-card-${doc.id}`}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '18px',
                    padding: '22px 24px',
                    boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '210px',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#BFDBFE';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(37, 99, 235, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#E2E8F0';
                    e.currentTarget.style.boxShadow = '0 4px 18px rgba(15, 23, 42, 0.04)';
                  }}
                >
                  {/* Top Badges Row */}
                  <div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '14px',
                      gap: '8px'
                    }}>
                      {/* Classification Badge (Left) */}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: classBadge.bg,
                        border: `1px solid ${classBadge.border}`,
                        color: classBadge.text,
                        fontSize: '11px',
                        fontWeight: '700',
                        letterSpacing: '0.2px'
                      }}>
                        <span>{classBadge.icon}</span>
                        <span>{classBadge.label}</span>
                      </span>

                      {/* Permission Badge (Right - OWNER solid green capsule, matching image) */}
                      {isOwner && (
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '20px',
                          background: '#10B981',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: '800',
                          letterSpacing: '0.4px',
                          textTransform: 'uppercase',
                          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)'
                        }}>
                          OWNER
                        </span>
                      )}
                    </div>

                    {/* Document Title */}
                    <h3
                      onClick={() => handleDownload(doc.id, doc.file_name)}
                      style={{
                        fontSize: '16px',
                        fontWeight: '800',
                        color: '#0F172A',
                        lineHeight: '1.4',
                        marginBottom: '8px',
                        letterSpacing: '-0.3px',
                        cursor: 'pointer'
                      }}
                      title="Click to Download Encrypted File"
                    >
                      {doc.title}
                    </h3>

                    {/* Description */}
                    <p style={{
                      color: '#64748B',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      marginBottom: '18px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {doc.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Bottom Meta & Actions Row */}
                  <div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#64748B',
                      paddingTop: '14px',
                      borderTop: '1px solid #F1F5F9',
                      position: 'relative'
                    }}>
                      {/* Left: Category folder icon and colored text */}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: catTheme.color,
                        fontWeight: '600'
                      }}>
                        <span>{catTheme.icon}</span>
                        <span style={{ textTransform: 'capitalize' }}>{doc.category.replace('_', ' ')}</span>
                      </span>

                      {/* Middle: Updated Date */}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        color: '#64748B'
                      }}>
                        <span>📅</span>
                        <span>Updated: {formattedDate}</span>
                      </span>

                      {/* Right: ••• Action Button */}
                      <div style={{ position: 'relative' }}>
                        <button
                          id={`btn-menu-${doc.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id);
                          }}
                          style={{
                            background: activeMenuDocId === doc.id ? '#EFF6FF' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            color: '#64748B',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                          title="Actions"
                        >
                          <MoreHorizontal style={{ width: '18px', height: '18px' }} />
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuDocId === doc.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 8px)',
                              right: 0,
                              width: '210px',
                              background: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              borderRadius: '12px',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                              padding: '6px',
                              zIndex: 40
                            }}
                          >
                            <button
                              id={`btn-download-${doc.id}`}
                              onClick={() => {
                                setActiveMenuDocId(null);
                                handleDownload(doc.id, doc.file_name);
                              }}
                              disabled={downloadingId === doc.id}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                background: 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#2563EB',
                                textAlign: 'left'
                              }}
                            >
                              <Download style={{ width: '15px', height: '15px' }} />
                              <span>{downloadingId === doc.id ? 'Decrypting...' : 'Download File'}</span>
                            </button>

                            {isOwner && (
                              <button
                                id={`btn-manage-access-${doc.id}`}
                                onClick={() => {
                                  setActiveMenuDocId(null);
                                  setSelectedDocForPerms(doc);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  background: 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#334155',
                                  textAlign: 'left'
                                }}
                              >
                                <Users style={{ width: '15px', height: '15px' }} />
                                <span>Manage Access</span>
                              </button>
                            )}

                            {isOwner && (
                              <button
                                id={`btn-delete-${doc.id}`}
                                onClick={() => {
                                  setActiveMenuDocId(null);
                                  handleDelete(doc.id, doc.title);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  background: 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#E11D48',
                                  textAlign: 'left'
                                }}
                              >
                                <Trash2 style={{ width: '15px', height: '15px' }} />
                                <span>Revoke & Delete</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= RIGHT SIDEBAR ================= */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        position: 'sticky',
        top: '76px'
      }}>
        {/* 1. User Profile Gradient Banner Card */}
        <div style={{
          background: 'linear-gradient(135deg, #0284C7 0%, #2563EB 50%, #7C3AED 100%)',
          borderRadius: '20px',
          padding: '24px',
          color: '#FFFFFF',
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.22)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          {/* Avatar Circle */}
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.2)',
            border: '2px solid rgba(255, 255, 255, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: '800',
            color: '#FFFFFF',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            {userInitial}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '800',
              color: '#FFFFFF',
              margin: '0 0 2px 0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {user?.name}
            </h2>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.85)',
              margin: '0 0 6px 0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {user?.email}
            </div>
            <div style={{
              fontSize: '10px',
              fontWeight: '800',
              letterSpacing: '0.6px',
              color: '#38BDF8',
              textTransform: 'uppercase'
            }}>
              {user?.role} • {user?.department}
            </div>
          </div>
        </div>

        {/* 2. Active Profile Details & Zero-Trust Notice */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '20px',
          padding: '22px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)'
        }}>
          <h3 style={{
            fontSize: '15px',
            fontWeight: '800',
            color: '#0F172A',
            margin: '0 0 16px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: '#7C3AED' }}>👤</span>
            <span>Your Active Profile</span>
          </h3>

          <div style={{
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Role:</span>
              <span style={{ color: '#059669', fontWeight: '800', textTransform: 'capitalize' }}>
                {user?.role}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Department:</span>
              <span style={{ color: '#0F172A', fontWeight: '600' }}>
                {user?.department || 'General'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748B' }}>Vault Status:</span>
              <span style={{ color: '#059669', fontWeight: '800' }}>
                Active & Isolated
              </span>
            </div>
          </div>

          {/* Zero-Trust Notice */}
          <div style={{
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '11px',
            color: '#B45309',
            lineHeight: '1.45',
            marginBottom: '16px',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start'
          }}>
            <span>🔒</span>
            <span>
              <strong>Zero-Trust Security:</strong> Persona system restricted to Administrators.
            </span>
          </div>

          {/* If Admin: Quick Switch Persona embedded right in the sidebar */}
          {user?.role === 'admin' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#2563EB', textTransform: 'uppercase', marginBottom: '8px' }}>
                ⚡ Quick Switch Persona:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {availableUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => switchPersona(u.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      background: user?.id === u.id ? '#EFF6FF' : '#F8FAFC',
                      border: user?.id === u.id ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                      fontSize: '12px',
                      fontWeight: user?.id === u.id ? '700' : '500',
                      color: user?.id === u.id ? '#2563EB' : '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    <span>{u.name}</span>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748B' }}>{u.role}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sign Out Button */}
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              background: '#F5F3FF',
              border: '1px solid #DDD6FE',
              color: '#6D28D9',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>

        {/* 3. Quick Stats Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '20px',
          padding: '22px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)'
        }}>
          <h3 style={{
            fontSize: '15px',
            fontWeight: '800',
            color: '#0F172A',
            margin: '0 0 16px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: '#2563EB' }}>👥</span>
            <span>Quick Stats</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Stat 1: Total Docs */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563EB'
                }}>
                  <Folder style={{ width: '16px', height: '16px' }} />
                </div>
                <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>
                  Total Documents
                </span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#2563EB' }}>
                {totalDocsCount}
              </span>
            </div>

            {/* Stat 2: Restricted Files */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#FFF1F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#E11D48'
                }}>
                  <Lock style={{ width: '16px', height: '16px' }} />
                </div>
                <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>
                  Restricted Files
                </span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#E11D48' }}>
                {restrictedDocsCount}
              </span>
            </div>

            {/* Stat 3: Owned Files */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#ECFDF5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#059669'
                }}>
                  <Shield style={{ width: '16px', height: '16px' }} />
                </div>
                <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>
                  Owned by You
                </span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#059669' }}>
                {ownedDocsCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Permission Grant Modal */}
      {selectedDocForPerms && (
        <PermissionModal
          document={selectedDocForPerms}
          onClose={() => setSelectedDocForPerms(null)}
          onPermissionsChanged={() => {
            fetchDocuments();
            if (onRefreshAudit) onRefreshAudit();
          }}
        />
      )}

      {/* Upload Document Modal */}
      {uploadModalOpen && (
        <UploadModal
          onClose={() => setUploadModalOpen(false)}
          onUploadSuccess={() => {
            fetchDocuments();
            if (onRefreshAudit) onRefreshAudit();
          }}
        />
      )}
    </div>
  );
}
