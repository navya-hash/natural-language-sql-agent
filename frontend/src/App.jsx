
import React, { useState } from 'react';
import {
  MessageSquare,
  Compass,
  Link2,
  LogOut,
  ShieldAlert,
} from 'lucide-react';

import {
  useAuth,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/react';

import ConnectionPanel from './components/ConnectionPanel';
import SchemaExplorer from './components/SchemaExplorer';
import ChatWorkspace from './components/ChatWorkspace';
import ConversationSidebar from './components/ConversationSidebar';

export default function App() {
  const { isLoaded, isSignedIn } = useAuth();

  const [activeTab, setActiveTab] = useState('chat');
  const [isConnected, setIsConnected] = useState(false);
  const [connectedDb, setConnectedDb] = useState(null);
  const [threadId, setThreadId] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const handleConnectionSuccess = (dbDetails) => {
    setIsConnected(true);
    setConnectedDb(dbDetails);
    setActiveTab('chat');
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setConnectedDb(null);
    setThreadId('');
    setSelectedConversation(null);
    setActiveTab('connect');
  };

  const handleNewConversation = () => {
    setThreadId('');
    setSelectedConversation(null);
    setActiveTab('chat');
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    setThreadId(conversation.thread_id);
    setActiveTab('chat');
  };

  const handleConversationLoaded = React.useCallback((convDetails) => {
    if (!convDetails) return;

    if (convDetails.is_connected) {
      setIsConnected((prev) => (prev ? prev : true));
      setConnectedDb((prev) => {
        if (
          prev &&
          prev.connection_id === convDetails.connection_id &&
          prev.name === convDetails.connection_name &&
          prev.type === convDetails.db_type &&
          !prev.needsReconnect
        ) {
          return prev;
        }
        return {
          connection_id: convDetails.connection_id,
          name: convDetails.connection_name || 'Connected Database',
          type: convDetails.db_type || 'database',
        };
      });
    } else {
      setIsConnected((prev) => (!prev ? prev : false));
      setConnectedDb((prev) => {
        if (
          prev &&
          prev.connection_id === convDetails.connection_id &&
          prev.name === convDetails.connection_name &&
          prev.type === convDetails.db_type &&
          prev.needsReconnect
        ) {
          return prev;
        }
        return {
          connection_id: convDetails.connection_id,
          name: convDetails.connection_name || 'Database',
          type: convDetails.db_type || 'unknown',
          needsReconnect: true,
        };
      });
    }
  }, []);

  const handleConversationCreated = (newThreadId) => {
    if (newThreadId) {
      setThreadId(newThreadId);
      setSelectedConversation((previous) =>
        previous?.thread_id === newThreadId ? previous : null
      );
      setHistoryRefreshKey((previous) => previous + 1);
    }
  };

  if (!isLoaded) {
    return (
      <div className="app-container" style={{ padding: '40px' }}>
        Loading authentication...
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--bg-color, #0f1117)',
          color: 'var(--text-color, #ffffff)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            textAlign: 'center',
            padding: '36px',
            border: '1px solid var(--border-color, #333)',
            borderRadius: '16px',
          }}
        >
          <div
            className="logo-icon"
            style={{ margin: '0 auto 20px', width: 'fit-content' }}
          >
            SQL
          </div>

          <h1>Natural Language SQL Agent</h1>

          <p style={{ color: 'var(--text-muted, #aaa)', lineHeight: 1.6 }}>
            Sign in to connect your database, ask questions in natural
            language, and explore your database schema.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '28px',
            }}
          >
            <SignInButton mode="modal">
              <button type="button" className="btn btn-primary">
                Sign in
              </button>
            </SignInButton>

            <SignUpButton mode="modal">
              <button type="button" className="btn btn-secondary">
                Create account
              </button>
            </SignUpButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">SQL</div>
          <span className="logo-text">Natural Language SQL Agent</span>
          <span className="logo-badge">v1.0.0</span>
        </div>

        <div
          className="header-actions"
          style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
        >
          {isConnected ? (
            <>
              <div
                className="status-indicator"
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                }}
              >
                <div className="status-dot active"></div>
                <span
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Connected:{' '}
                  <strong style={{ color: '#fff' }}>
                    {connectedDb?.name}
                  </strong>{' '}
                  ({connectedDb?.type?.toUpperCase()})
                </span>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDisconnect}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  gap: '6px',
                }}
              >
                <LogOut size={12} />
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <div
              className="status-indicator"
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
              }}
            >
              <div className="status-dot inactive"></div>
              <span
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                }}
              >
                No active connection
              </span>
            </div>
          )}

          <UserButton />
        </div>
      </header>

      <div className="app-container">
        <aside className="sidebar">
          <div>
            <h3 className="sidebar-section-title">Workspace</h3>

            <nav className="nav-tabs">
              <button
                type="button"
                className={`nav-tab ${
                  activeTab === 'connect' ? 'active' : ''
                }`}
                onClick={() => setActiveTab('connect')}
              >
                <Link2 size={16} />
                <span>Database Connection</span>
              </button>

              <button
                type="button"
                className={`nav-tab ${
                  activeTab === 'chat' ? 'active' : ''
                }`}
                onClick={() => setActiveTab('chat')}
              >
                <MessageSquare size={16} />
                <span>Chat Agent</span>
              </button>

              <button
                type="button"
                className={`nav-tab ${
                  activeTab === 'explorer' ? 'active' : ''
                }`}
                onClick={() => {
                  if (isConnected) setActiveTab('explorer');
                }}
                disabled={!isConnected}
                title={!isConnected ? 'Connect a database first' : ''}
                style={{ opacity: !isConnected ? 0.4 : 1 }}
              >
                <Compass size={16} />
                <span>Schema Explorer</span>
              </button>
            </nav>
          </div>

          <div
            style={{
              marginTop: 'auto',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '8px',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                alignItems: 'flex-start',
              }}
            >
              <ShieldAlert
                size={16}
                style={{
                  flexShrink: 0,
                  marginTop: '2px',
                  color: 'var(--warning)',
                }}
              />
              <span>
                Safety mode active: only SELECT queries are permitted.
                Modifying statements will be rejected.
              </span>
            </div>
          </div>
        </aside>

        <main className="workspace">
          {activeTab === 'connect' && (
            <ConnectionPanel
              onConnectionSuccess={handleConnectionSuccess}
              currentDbStatus={connectedDb}
            />
          )}

          {activeTab === 'chat' && (
            <div
              style={{
                display: 'flex',
                height: '100%',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <ConversationSidebar
                currentThreadId={threadId}
                onNewConversation={handleNewConversation}
                onSelectConversation={handleSelectConversation}
                refreshKey={historyRefreshKey}
              />

              <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
                <ChatWorkspace
                  isConnected={isConnected}
                  connectionId={connectedDb?.connection_id}
                  threadId={threadId}
                  setThreadId={handleConversationCreated}
                  selectedConversation={selectedConversation}
                  onConversationChanged={() =>
                    setHistoryRefreshKey((previous) => previous + 1)
                  }
                  onConversationLoaded={handleConversationLoaded}
                  onReconnectClick={() => setActiveTab('connect')}
                />
              </div>
            </div>
          )}

          {activeTab === 'explorer' && (
            <SchemaExplorer
              isConnected={isConnected}
              connectionId={connectedDb?.connection_id}
            />
          )}
        </main>
      </div>
    </>
  );
}


// // Show Sign in and Create account when the user is signed out.
// // Show your existing SQL Agent workspace after sign-in.

// import React, { useState } from 'react';
// import {
//   Database,
//   MessageSquare,
//   Compass,
//   Link2,
//   LogOut,
//   ShieldAlert,
// } from 'lucide-react';

// import {
//   useAuth,
//   SignInButton,
//   SignUpButton,
//   UserButton,
// } from '@clerk/react';

// import ConnectionPanel from './components/ConnectionPanel';
// import SchemaExplorer from './components/SchemaExplorer';
// import ChatWorkspace from './components/ChatWorkspace';

// export default function App() {
//   const { isLoaded, isSignedIn } = useAuth();

//   const [activeTab, setActiveTab] = useState('connect');
//   const [isConnected, setIsConnected] = useState(false);
//   const [connectedDb, setConnectedDb] = useState(null);
//   const [threadId, setThreadId] = useState('');

//   const handleConnectionSuccess = (dbDetails) => {
//     setIsConnected(true);
//     setConnectedDb(dbDetails);
//     setActiveTab('chat');
//   };

//   const handleDisconnect = () => {
//     setIsConnected(false);
//     setConnectedDb(null);
//     setThreadId('');
//     setActiveTab('connect');
//   };

//   // Wait for Clerk to determine the current session.
//   if (!isLoaded) {
//     return (
//       <div className="app-container" style={{ padding: '40px' }}>
//         Loading authentication...
//       </div>
//     );
//   }

//   // Show authentication options to signed-out users.
//   if (!isSignedIn) {
//     return (
//       <div
//         style={{
//           minHeight: '100vh',
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'center',
//           padding: '24px',
//           background: 'var(--bg-color, #0f1117)',
//           color: 'var(--text-color, #ffffff)',
//         }}
//       >
//         <div
//           style={{
//             width: '100%',
//             maxWidth: '440px',
//             textAlign: 'center',
//             padding: '36px',
//             border: '1px solid var(--border-color, #333)',
//             borderRadius: '16px',
//           }}
//         >
//           <div
//             className="logo-icon"
//             style={{ margin: '0 auto 20px', width: 'fit-content' }}
//           >
//             SQL
//           </div>

//           <h1>Natural Language SQL Agent</h1>

//           <p style={{ color: 'var(--text-muted, #aaa)', lineHeight: 1.6 }}>
//             Sign in to connect your database, ask questions in natural
//             language, and explore your database schema.
//           </p>

//           <div
//             style={{
//               display: 'flex',
//               flexDirection: 'column',
//               gap: '12px',
//               marginTop: '28px',
//             }}
//           >
//             <SignInButton mode="modal">
//               <button type="button" className="btn btn-primary">
//                 Sign in
//               </button>
//             </SignInButton>

//             <SignUpButton mode="modal">
//               <button type="button" className="btn btn-secondary">
//                 Create account
//               </button>
//             </SignUpButton>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   // Existing SQL Agent workspace for authenticated users.
//   return (
//     <>
//       <header className="app-header">
//         <div className="logo-container">
//           <div className="logo-icon">SQL</div>
//           <span className="logo-text">Natural Language SQL Agent</span>
//           <span className="logo-badge">v1.0.0</span>
//         </div>

//         <div
//           className="header-actions"
//           style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
//         >
//           {isConnected ? (
//             <>
//               <div
//                 className="status-indicator"
//                 style={{
//                   border: 'none',
//                   background: 'transparent',
//                   padding: 0,
//                 }}
//               >
//                 <div className="status-dot active"></div>
//                 <span
//                   style={{
//                     fontSize: '0.8rem',
//                     color: 'var(--text-muted)',
//                   }}
//                 >
//                   Connected:{' '}
//                   <strong style={{ color: '#fff' }}>
//                     {connectedDb.name}
//                   </strong>{' '}
//                   ({connectedDb.type.toUpperCase()})
//                 </span>
//               </div>

//               <button
//                 type="button"
//                 className="btn btn-secondary"
//                 onClick={handleDisconnect}
//                 style={{
//                   padding: '6px 12px',
//                   fontSize: '0.8rem',
//                   display: 'flex',
//                   gap: '6px',
//                 }}
//               >
//                 <LogOut size={12} />
//                 <span>Disconnect</span>
//               </button>
//             </>
//           ) : (
//             <div
//               className="status-indicator"
//               style={{
//                 border: 'none',
//                 background: 'transparent',
//                 padding: 0,
//               }}
//             >
//               <div className="status-dot inactive"></div>
//               <span
//                 style={{
//                   fontSize: '0.8rem',
//                   color: 'var(--text-muted)',
//                 }}
//               >
//                 No active connection
//               </span>
//             </div>
//           )}

//           <UserButton />
//         </div>
//       </header>

//       <div className="app-container">
//         <aside className="sidebar">
//           <div>
//             <h3 className="sidebar-section-title">Workspace</h3>

//             <nav className="nav-tabs">
//               <button
//                 type="button"
//                 className={`nav-tab ${
//                   activeTab === 'connect' ? 'active' : ''
//                 }`}
//                 onClick={() => setActiveTab('connect')}
//               >
//                 <Link2 size={16} />
//                 <span>Database Connection</span>
//               </button>

//               <button
//                 type="button"
//                 className={`nav-tab ${
//                   activeTab === 'chat' ? 'active' : ''
//                 }`}
//                 onClick={() => {
//                   if (isConnected) setActiveTab('chat');
//                 }}
//                 disabled={!isConnected}
//                 title={!isConnected ? 'Connect a database first' : ''}
//                 style={{ opacity: !isConnected ? 0.4 : 1 }}
//               >
//                 <MessageSquare size={16} />
//                 <span>Chat Agent</span>
//               </button>

//               <button
//                 type="button"
//                 className={`nav-tab ${
//                   activeTab === 'explorer' ? 'active' : ''
//                 }`}
//                 onClick={() => {
//                   if (isConnected) setActiveTab('explorer');
//                 }}
//                 disabled={!isConnected}
//                 title={!isConnected ? 'Connect a database first' : ''}
//                 style={{ opacity: !isConnected ? 0.4 : 1 }}
//               >
//                 <Compass size={16} />
//                 <span>Schema Explorer</span>
//               </button>
//             </nav>
//           </div>

//           <div
//             style={{
//               marginTop: 'auto',
//               borderTop: '1px solid var(--border-color)',
//               paddingTop: '16px',
//             }}
//           >
//             <div
//               style={{
//                 display: 'flex',
//                 gap: '8px',
//                 color: 'var(--text-muted)',
//                 fontSize: '0.75rem',
//                 alignItems: 'flex-start',
//               }}
//             >
//               <ShieldAlert
//                 size={16}
//                 style={{
//                   flexShrink: 0,
//                   marginTop: '2px',
//                   color: 'var(--warning)',
//                 }}
//               />
//               <span>
//                 Safety mode active: only SELECT queries are permitted.
//                 Modifying statements will be rejected.
//               </span>
//             </div>
//           </div>
//         </aside>

//         <main className="workspace">
//           {activeTab === 'connect' && (
//             <ConnectionPanel
//               onConnectionSuccess={handleConnectionSuccess}
//               currentDbStatus={connectedDb}
//             />
//           )}

//           {activeTab === 'chat' && (
//             <ChatWorkspace
//               isConnected={isConnected}
//               threadId={threadId}
//               setThreadId={setThreadId}
//             />
//           )}

//           {activeTab === 'explorer' && (
//             <SchemaExplorer isConnected={isConnected} />
//           )}
//         </main>
//       </div>
//     </>
//   );
// }

