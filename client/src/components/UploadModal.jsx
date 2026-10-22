import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X,
  UploadCloud,
  FileCheck,
  AlertTriangle,
  Lock,
  FileText
} from 'lucide-react';

export default function UploadModal({ onClose, onSuccess }) {
  const { token } = useAuth();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('financial');
  const [classification, setClassification] = useState('confidential');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('classification', classification);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(data.message || 'Upload failed validation check.');
      }
    } catch (err) {
      setError('Network error during document upload.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 7, 12, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '580px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(15, 21, 35, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UploadCloud style={{ width: '20px', height: '20px', color: 'var(--emerald)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#FFF' }}>Secure Document Upload</h2>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              color: '#FDA4AF',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertTriangle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* File Picker Zone */}
          <div style={{
            border: '2px dashed var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            textAlign: 'center',
            background: 'var(--bg-card)',
            cursor: 'pointer',
            marginBottom: '16px',
            position: 'relative'
          }}>
            <input
              id="file-upload-input"
              type="file"
              onChange={handleFileChange}
              required
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer'
              }}
            />
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <FileCheck style={{ width: '28px', height: '28px', color: 'var(--emerald)' }} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#FFF' }}>{file.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
            ) : (
              <div>
                <UploadCloud style={{ width: '36px', height: '36px', color: 'var(--text-dim)', margin: '0 auto 8px' }} />
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#FFF' }}>Choose a document or drag & drop</div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  PDF, DOCX, XLSX, TXT, CSV (Magic bytes validated on upload)
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Document Title</label>
            <input
              id="upload-doc-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Statutory Compliance Report"
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                color: '#FFF',
                fontSize: '13px'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Category</label>
              <select
                id="upload-doc-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: '#FFF',
                  fontSize: '13px'
                }}
              >
                <option value="financial">Financial</option>
                <option value="legal">Legal</option>
                <option value="human_resources">Human Resources</option>
                <option value="audit_compliance">Audit Compliance</option>
                <option value="engineering">Engineering</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Classification</label>
              <select
                id="upload-doc-classification"
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: '#FFF',
                  fontSize: '13px'
                }}
              >
                <option value="internal">Internal</option>
                <option value="confidential">Confidential</option>
                <option value="strictly_restricted">Strictly Restricted</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Description (Optional)</label>
            <textarea
              id="upload-doc-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context or purpose of this document..."
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                color: '#FFF',
                fontSize: '13px',
                resize: 'none'
              }}
            />
          </div>

          <button
            id="btn-submit-upload"
            type="submit"
            disabled={loading || !file}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              color: '#FFF',
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Lock style={{ width: '15px', height: '15px' }} />
            {loading ? 'Validating & Encrypting...' : 'Encrypt with AES-256-GCM & Upload'}
          </button>
        </form>
      </div>
    </div>
  );
}
