import React, { useState } from 'react';
import { Database, MessageSquare, Compass, Link2, LogOut, ShieldAlert } from 'lucide-react';
import ConnectionPanel from './components/ConnectionPanel';
import SchemaExplorer from './components/SchemaExplorer';
import ChatWorkspace from './components/ChatWorkspace';

export default function App() {
  const [activeTab, setActiveTab] = useState('connect');
  const [isConnected, setIsConnected] = useState(false);
  const [connectedDb, setConnectedDb] = useState(null);
  const [threadId, setThreadId] = useState('');

  const handleConnectionSuccess = (dbDetails) => {
    setIsConnected(true);
    setConnectedDb(dbDetails);
    setActiveTab('chat'); // Automatically switch to chat tab on successful connection
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setConnectedDb(null);
    setThreadId('');
    setActiveTab('connect');
  };

  return (
    <>
      {/* Header Bar */}
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">SQL</div>
          <span className="logo-text">Natural Language SQL Agent</span>
          <span className="logo-badge">v1.0.0</span>
        </div>
        
        <div className="header-actions">
          {isConnected ? (
            <>
              <div className="status-indicator" style={{ border: 'none', background: 'transparent', padding: 0 }}>
                <div className="status-dot active"></div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Connected: <strong style={{ color: '#fff' }}>{connectedDb.name}</strong> ({connectedDb.type.toUpperCase()})
                </span>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleDisconnect}
                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', gap: '6px' }}
              >
                <LogOut size={12} />
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <div className="status-indicator" style={{ border: 'none', background: 'transparent', padding: 0 }}>
              <div className="status-dot inactive"></div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                No active connection
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Grid Workspace */}
      <div className="app-container">
        {/* Navigation Sidebar */}
        <aside className="sidebar">
          <div>
            <h3 className="sidebar-section-title">Workspace</h3>
            <nav className="nav-tabs">
              <button
                type="button"
                className={`nav-tab ${activeTab === 'connect' ? 'active' : ''}`}
                onClick={() => setActiveTab('connect')}
              >
                <Link2 size={16} />
                <span>Database Connection</span>
              </button>
              
              <button
                type="button"
                className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => {
                  if (isConnected) {
                    setActiveTab('chat');
                  }
                }}
                disabled={!isConnected}
                title={!isConnected ? "Connect a database first" : ""}
                style={{ opacity: !isConnected ? 0.4 : 1 }}
              >
                <MessageSquare size={16} />
                <span>Chat Agent</span>
              </button>

              <button
                type="button"
                className={`nav-tab ${activeTab === 'explorer' ? 'active' : ''}`}
                onClick={() => {
                  if (isConnected) {
                    setActiveTab('explorer');
                  }
                }}
                disabled={!isConnected}
                title={!isConnected ? "Connect a database first" : ""}
                style={{ opacity: !isConnected ? 0.4 : 1 }}
              >
                <Compass size={16} />
                <span>Schema Explorer</span>
              </button>
            </nav>
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', alignItems: 'flex-start' }}>
              <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--warning)' }} />
              <span>
                Safety mode active: only SELECT queries are permitted. Modifying statements will be rejected.
              </span>
            </div>
          </div>
        </aside>

        {/* Content Panel Area */}
        <main className="workspace">
          {activeTab === 'connect' && (
            <ConnectionPanel 
              onConnectionSuccess={handleConnectionSuccess}
              currentDbStatus={connectedDb}
            />
          )}
          
          {activeTab === 'chat' && (
            <ChatWorkspace 
              isConnected={isConnected} 
              threadId={threadId}
              setThreadId={setThreadId}
            />
          )}

          {activeTab === 'explorer' && (
            <SchemaExplorer isConnected={isConnected} />
          )}
        </main>
      </div>
    </>
  );
}
