import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/react';
import { Table, Layers, Eye, HelpCircle, AlertCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function SchemaExplorer({ isConnected, connectionId }) {
  const { getToken } = useAuth();
  const [tables, setTables] = useState([]);
  const [schemaDict, setSchemaDict] = useState({});
  const [selectedTable, setSelectedTable] = useState('');
  const [previewRows, setPreviewRows] = useState([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchWithAuth = useCallback(async (path) => {
    const token = await getToken();
    if (!token) {
      throw new Error('Please sign in again.');
    }
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        data.detail || data.message || `Request failed (${response.status})`
      );
    }
    return data;
  }, [getToken]);

  const fetchSchema = useCallback(async () => {
    if (!connectionId) return;
    setLoadingSchema(true);
    setErrorMsg('');

    try {
      const tablesData = await fetchWithAuth(
        `/tables?connection_id=${encodeURIComponent(connectionId)}`
      );
      const schemaData = await fetchWithAuth(
        `/schema?connection_id=${encodeURIComponent(connectionId)}`
      );

      if (tablesData.success && schemaData.success) {
        setTables(tablesData.tables);
        setSchemaDict(schemaData.schema);

        if (tablesData.tables.length > 0) {
          setSelectedTable(tablesData.tables[0]);
        } else {
          setSelectedTable('');
          setPreviewRows([]);
        }
      } else {
        setErrorMsg('Failed to load database schema from backend.');
      }
    } catch (err) {
      console.error('Failed to fetch database schema:', err);
      setErrorMsg(err.message || 'Failed to load database schema.');
    } finally {
      setLoadingSchema(false);
    }
  }, [connectionId, fetchWithAuth]);

  const fetchPreview = useCallback(async (tableName) => {
    if (!connectionId || !tableName) return;
    setLoadingPreview(true);

    try {
      const data = await fetchWithAuth(
        `/preview/${encodeURIComponent(tableName)}?connection_id=${encodeURIComponent(connectionId)}`
      );

      if (data.success) {
        setPreviewRows(data.rows);
      } else {
        setPreviewRows([]);
        setErrorMsg(data.message || 'Failed to load table preview.');
      }
    } catch (err) {
      console.error('Failed to fetch table preview:', err);
      setPreviewRows([]);
      setErrorMsg(err.message || 'Failed to fetch table preview.');
    } finally {
      setLoadingPreview(false);
    }
  }, [connectionId, fetchWithAuth]);

  // Fetch tables and schema dictionary on load or change in connection
  useEffect(() => {
    if (isConnected && connectionId) {
      fetchSchema();
    } else {
      setTables([]);
      setSchemaDict({});
      setSelectedTable('');
      setPreviewRows([]);
    }
  }, [isConnected, connectionId, fetchSchema]);

  // Fetch preview when selectedTable changes
  useEffect(() => {
    if (selectedTable && connectionId) {
      fetchPreview(selectedTable);
    }
  }, [selectedTable, connectionId, fetchPreview]);

  if (!isConnected) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center', margin: '0 auto', maxWidth: '500px' }}>
        <HelpCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.5 }} />
        <h3>No Database Connected</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>
          Please go to the <strong>Connection Panel</strong> in the sidebar to upload a SQLite file or specify connection credentials first.
        </p>
      </div>
    );
  }

  const columns = schemaDict[selectedTable] || [];

  return (
    <div className="explorer-container">
      {/* Tables Sidebar */}
      <div className="explorer-sidebar">
        <h3 className="sidebar-section-title">Database Tables</h3>
        {errorMsg && (
          <div style={{ display: 'flex', gap: '6px', color: 'var(--error, #ef4444)', fontSize: '0.8rem', marginBottom: '8px' }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}
        {loadingSchema ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading schema...</div>
        ) : (
          <div className="explorer-list">
            {tables.map((table) => (
              <div 
                key={table} 
                className={`explorer-item ${selectedTable === table ? 'active' : ''}`}
                onClick={() => setSelectedTable(table)}
              >
                <Table size={14} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{table}</span>
              </div>
            ))}
            {tables.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '10px' }}>
                No tables found.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Preview Workspace */}
      <div className="explorer-content">
        {selectedTable ? (
          <>
            {/* Table Metadata Summary */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Table size={20} style={{ color: 'var(--secondary-accent)' }} />
                  {selectedTable}
                </h2>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total Columns: <strong style={{ color: '#fff' }}>{columns.length}</strong>
                </div>
              </div>
              
              {/* Columns types tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                {columns.map((col) => (
                  <span 
                    key={col.name} 
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Layers size={10} style={{ color: 'var(--primary-accent)' }} />
                    <span style={{ fontWeight: 600, color: '#fff' }}>{col.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({col.type})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Preview Grid */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
              <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={16} style={{ color: 'var(--primary-accent)' }} />
                Data Preview (First 10 Rows)
              </h3>
              
              {loadingPreview ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '20px 0' }}>
                  <div className="shimmer-text" style={{ width: '100%' }}></div>
                  <div className="shimmer-text" style={{ width: '90%' }}></div>
                  <div className="shimmer-text" style={{ width: '95%' }}></div>
                </div>
              ) : previewRows.length > 0 ? (
                <div className="preview-grid-container" style={{ flex: 1, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        {Object.keys(previewRows[0]).map((key) => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => (
                        <tr key={idx}>
                          {Object.values(row).map((val, cellIdx) => (
                            <td key={cellIdx} title={String(val ?? '')}>
                              {val === null ? (
                                <span style={{ color: 'rgba(255,255,255,0.15)', fontStyle: 'italic' }}>NULL</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
                  No records found in this table or query failed.
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
            Select a table to browse its structure and view preview data.
          </div>
        )}
      </div>
    </div>
  );
}
