import React, { useState } from 'react';
import { Database, Upload, Server, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function ConnectionPanel({ onConnectionSuccess, currentDbStatus }) {
  const [dbType, setDbType] = useState('sqlite');
  const [file, setFile] = useState(null);
  
  // Connection state for MySQL/PostgreSQL
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [databaseName, setDatabaseName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleDbTypeChange = (type) => {
    setDbType(type);
    setErrorMsg('');
    setSuccessMsg('');
    if (type === 'mysql' && !port) setPort('3306');
    if (type === 'postgres' && !port) setPort('5432');
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.sqlite') && !selectedFile.name.endsWith('.db')) {
        setErrorMsg('Please select a valid .sqlite or .db file.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setErrorMsg('');
      setSuccessMsg('');
    }
  };

  const handleSqliteSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('Please select a database file first.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/upload-sqlite`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setSuccessMsg(data.message || 'SQLite Database connected successfully.');
        onConnectionSuccess({
          type: 'sqlite',
          name: file.name,
        });
      } else {
        setErrorMsg(data.message || 'Failed to upload and connect.');
      }
    } catch (err) {
      setErrorMsg('Network error. Is the backend API running at localhost:8000?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleNetworkDbSubmit = async (e) => {
    e.preventDefault();
    if (!host || !username || !databaseName) {
      setErrorMsg('Host, Username, and Database Name are required.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          db_type: dbType,
          host,
          port: port ? parseInt(port, 10) : null,
          username,
          password,
          database: databaseName,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuccessMsg(data.message || 'Database connected successfully.');
        onConnectionSuccess({
          type: dbType,
          name: databaseName,
          host,
        });
      } else {
        setErrorMsg(data.message || 'Failed to connect to database.');
      }
    } catch (err) {
      setErrorMsg('Network error. Is the backend API running at localhost:8000?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="connection-panel">
      <div>
        <h2 style={{ marginBottom: '8px' }}>Database Connection</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Connect to an existing SQLite, MySQL, or PostgreSQL database to begin asking natural language questions.
        </p>
      </div>

      <div className="card">
        <h3 className="sidebar-section-title">Select Database Type</h3>
        <div className="db-type-selector">
          <button 
            type="button"
            className={`db-type-btn ${dbType === 'sqlite' ? 'active' : ''}`}
            onClick={() => handleDbTypeChange('sqlite')}
          >
            <Upload />
            <span>SQLite File</span>
          </button>
          <button 
            type="button"
            className={`db-type-btn ${dbType === 'mysql' ? 'active' : ''}`}
            onClick={() => handleDbTypeChange('mysql')}
          >
            <Database />
            <span>MySQL</span>
          </button>
          <button 
            type="button"
            className={`db-type-btn ${dbType === 'postgres' ? 'active' : ''}`}
            onClick={() => handleDbTypeChange('postgres')}
          >
            <Server />
            <span>PostgreSQL</span>
          </button>
        </div>
      </div>

      {dbType === 'sqlite' ? (
        <form onSubmit={handleSqliteSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>SQLite File Upload</h3>
          
          <label className="upload-area">
            <input 
              type="file" 
              accept=".sqlite,.db" 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
            <div className="upload-icon">
              <Upload size={24} />
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                {file ? file.name : 'Choose file or drag here'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Supports .sqlite or .db file formats
              </p>
            </div>
          </label>

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading || !file}
          >
            {loading ? (
              <>
                <Loader className="loading-dot" size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Connecting...</span>
              </>
            ) : (
              'Connect SQLite Database'
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleNetworkDbSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>
            {dbType === 'mysql' ? 'MySQL' : 'PostgreSQL'} Connection Details
          </h3>

          <div className="form-grid">
            <div className="form-group">
              <label>Host</label>
              <input 
                type="text" 
                className="input-field" 
                value={host} 
                onChange={(e) => setHost(e.target.value)} 
                placeholder="e.g. localhost"
                required
              />
            </div>
            <div className="form-group">
              <label>Port</label>
              <input 
                type="number" 
                className="input-field" 
                value={port} 
                onChange={(e) => setPort(e.target.value)} 
                placeholder={dbType === 'mysql' ? '3306' : '5432'}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Database Name</label>
            <input 
              type="text" 
              className="input-field" 
              value={databaseName} 
              onChange={(e) => setDatabaseName(e.target.value)} 
              placeholder="e.g. ecommerce_db"
              required
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Username</label>
              <input 
                type="text" 
                className="input-field" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="e.g. root"
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="Database password"
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: '12px' }}
          >
            {loading ? (
              <>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Testing Connection...</span>
              </>
            ) : (
              `Connect to ${dbType === 'mysql' ? 'MySQL' : 'PostgreSQL'}`
            )}
          </button>
        </form>
      )}

      {errorMsg && (
        <div className="alert alert-danger">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle size={18} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {currentDbStatus && (
        <div className="status-indicator">
          <div className="status-dot active"></div>
          <span>
            Connected: <strong style={{ color: '#fff' }}>{currentDbStatus.name}</strong> ({currentDbStatus.type.toUpperCase()})
          </span>
        </div>
      )}
    </div>
  );
}
