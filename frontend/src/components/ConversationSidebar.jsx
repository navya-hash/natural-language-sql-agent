
import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Loader,
  AlertCircle,
} from 'lucide-react';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function ConversationSidebar({
  currentThreadId,
  onNewConversation,
  onSelectConversation,
  refreshKey = 0,
}) {
  const { getToken } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [busyThreadId, setBusyThreadId] = useState(null);

  const authenticatedRequest = useCallback(
    async (path, options = {}) => {
      const token = await getToken();

      if (!token) {
        throw new Error('Please sign in again.');
      }

      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          ...(options.body
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...options.headers,
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
    },
    [getToken]
  );

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const data = await authenticatedRequest('/conversations?limit=100');

      setConversations(data.conversations || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setErrorMsg(err.message || 'Could not load conversation history.');
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations, refreshKey, currentThreadId]);

  const handleRename = async (conversation) => {
    const newTitle = window.prompt(
      'Enter a new conversation title:',
      conversation.title || ''
    );

    if (newTitle === null) return;

    const title = newTitle.trim();

    if (!title) {
      setErrorMsg('Conversation title cannot be empty.');
      return;
    }

    setBusyThreadId(conversation.thread_id);
    setErrorMsg('');

    try {
      await authenticatedRequest(
        `/conversations/${encodeURIComponent(conversation.thread_id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ title }),
        }
      );

      await loadConversations();
    } catch (err) {
      setErrorMsg(err.message || 'Could not rename conversation.');
    } finally {
      setBusyThreadId(null);
    }
  };

  const handleDelete = async (conversation) => {
    const confirmed = window.confirm(
      `Delete "${conversation.title || 'Untitled conversation'}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setBusyThreadId(conversation.thread_id);
    setErrorMsg('');

    try {
      await authenticatedRequest(
        `/conversations/${encodeURIComponent(conversation.thread_id)}`,
        { method: 'DELETE' }
      );

      setConversations((previous) =>
        previous.filter(
          (item) => item.thread_id !== conversation.thread_id
        )
      );

      if (currentThreadId === conversation.thread_id) {
        onNewConversation();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Could not delete conversation.');
    } finally {
      setBusyThreadId(null);
    }
  };

  return (
    <aside
      className="conversation-sidebar"
      style={{
        width: '260px',
        minWidth: '220px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        borderRight: '1px solid var(--border-color)',
        overflowY: 'auto',
      }}
    >
      <button
        type="button"
        className="btn btn-primary"
        onClick={onNewConversation}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '10px',
        }}
      >
        <Plus size={16} />
        New conversation
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3 style={{ fontSize: '0.9rem', margin: 0 }}>
          Recent conversations
        </h3>

        <button
          type="button"
          title="Refresh history"
          onClick={loadConversations}
          disabled={loading}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <RefreshCw
            size={15}
            style={loading ? { animation: 'spin 1s linear infinite' } : {}}
          />
        </button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          style={{
            display: 'flex',
            gap: '6px',
            color: 'var(--error, #ef4444)',
            fontSize: '0.8rem',
            overflowWrap: 'anywhere',
          }}
        >
          <AlertCircle size={15} />
          {errorMsg}
        </div>
      )}

      {loading && conversations.length === 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
          }}
        >
          <Loader size={15} />
          Loading conversations...
        </div>
      ) : conversations.length === 0 ? (
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            lineHeight: 1.5,
          }}
        >
          No saved conversations yet. Ask your first question to create one.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {conversations.map((conversation) => {
            const isActive =
              conversation.thread_id === currentThreadId;
            const isBusy =
              busyThreadId === conversation.thread_id;

            return (
              <div
                key={conversation.thread_id}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  background: isActive
                    ? 'rgba(139, 92, 246, 0.15)'
                    : 'transparent',
                  border: isActive
                    ? '1px solid var(--primary-accent)'
                    : '1px solid transparent',
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectConversation(conversation)}
                  disabled={isBusy}
                  title={conversation.title}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-color, #fff)',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                >
                  <MessageSquare
                    size={15}
                    style={{ flexShrink: 0, marginTop: '3px' }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '0.85rem',
                        overflowWrap: 'anywhere',
                        lineHeight: 1.4,
                        display: 'block',
                      }}
                    >
                      {conversation.title || 'Untitled conversation'}
                    </span>
                    {conversation.connection_name && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                          display: 'block',
                          marginTop: '2px',
                        }}
                      >
                        {conversation.connection_name}
                      </span>
                    )}
                  </div>
                </button>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px',
                    marginTop: '8px',
                  }}
                >
                  <button
                    type="button"
                    title="Rename conversation"
                    aria-label="Rename conversation"
                    disabled={isBusy}
                    onClick={() => handleRename(conversation)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    type="button"
                    title="Delete conversation"
                    aria-label="Delete conversation"
                    disabled={isBusy}
                    onClick={() => handleDelete(conversation)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
