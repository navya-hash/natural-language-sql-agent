import React, { useState, useEffect, useRef } from 'react';
import { Send, Terminal, Database, Sparkles, ChevronDown, ChevronUp, Copy, Check, Info, Loader } from 'lucide-react';
import ChartRenderer from './ChartRenderer';

const API_BASE = 'http://localhost:8000';

const SUGGESTIONS = [
  "How many albums are in the database?",
  "List the top 5 artists with the most albums.",
  "Which countries have the most customers?",
  "Show the total invoice sales by billing country.",
  "What is the average track length in minutes by genre?"
];

export default function ChatWorkspace({ isConnected, threadId, setThreadId }) {
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedSqlIdx, setCopiedSqlIdx] = useState(null);
  const [expandedSqlIdxs, setExpandedSqlIdxs] = useState({});
  const [expandedTableIdxs, setExpandedTableIdxs] = useState({});
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    // Scroll to bottom on new messages
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text) => {
    if (!text.trim() || loading) return;

    // Append user message
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInputVal('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: text,
          thread_id: threadId || null,
        }),
      });

      const data = await response.json();
      
      // Update thread ID in parent if not set
      if (data.thread_id && !threadId) {
        setThreadId(data.thread_id);
      }

      // Append bot response
      setMessages([
        ...newMessages,
        {
          role: 'agent',
          content: data.answer || "I couldn't fetch an answer.",
          sql: data.sql,
          result: data.result,
          chart: data.chart && Object.keys(data.chart).length > 0 ? data.chart : null,
          insights: data.insights,
        }
      ]);
    } catch (err) {
      console.error(err);
      setMessages([
        ...newMessages,
        {
          role: 'agent',
          content: "Sorry, I encountered an error connecting to the backend SQL Agent service. Please ensure the backend is running.",
          isError: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopySql = (sqlText, idx) => {
    navigator.clipboard.writeText(sqlText);
    setCopiedSqlIdx(idx);
    setTimeout(() => setCopiedSqlIdx(null), 2000);
  };

  const toggleSqlExpand = (idx) => {
    setExpandedSqlIdxs(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const toggleTableExpand = (idx) => {
    setExpandedTableIdxs(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const parseInsights = (insightsText) => {
    if (!insightsText) return [];
    
    // Split by lines, clean up bullet decorators like *, -, 1.
    return insightsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Remove bullets
        return line.replace(/^[\*\-\d\.\s]+/, '').trim();
      })
      .filter(line => line.length > 0);
  };

  if (!isConnected) {
    return (
      <div className="welcome-workspace" style={{ justifyContent: 'center', height: '100%' }}>
        <div className="welcome-logo">🤖</div>
        <h2>Connect Database to Chat</h2>
        <p className="welcome-subtitle">
          Please connect to a database in the sidebar first. Once connected, you can ask questions in natural language and receive queries, interactive tables, charts, and insights.
        </p>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* Chat History Panel */}
      <div className="chat-history">
        {messages.length === 0 ? (
          <div className="welcome-workspace">
            <div className="welcome-logo">⚡</div>
            <h2>Natural Language SQL Assistant</h2>
            <p className="welcome-subtitle">
              Ask questions about the connected database using everyday English. The agent will generate optimal SQL, execute it, and provide answers, charts, and insights.
            </p>
            <div style={{ marginTop: '10px', width: '100%' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '0.05em' }}>
                Example Prompts
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                {SUGGESTIONS.map((suggestion, idx) => (
                  <button 
                    key={idx}
                    type="button" 
                    className="suggestion-chip"
                    onClick={() => handleSend(suggestion)}
                    style={{ fontSize: '0.85rem', width: '100%', maxWidth: '420px', padding: '10px 14px', borderRadius: '8px' }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className="chat-bubble-wrapper">
              <div className={`chat-bubble ${msg.role}`}>
                <div className={`chat-avatar ${msg.role}`}>
                  {msg.role === 'user' ? 'U' : 'AI'}
                </div>
                
                <div className="chat-content-stack">
                  {/* Natural Language Response */}
                  <div style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>

                  {/* SQL Section */}
                  {msg.sql && (
                    <div className="sql-wrapper">
                      <div className="sql-header">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Terminal size={12} />
                          Generated SQL Query
                        </span>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button 
                            type="button" 
                            className="copy-btn"
                            onClick={() => handleCopySql(msg.sql, idx)}
                          >
                            {copiedSqlIdx === idx ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                            <span>{copiedSqlIdx === idx ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button 
                            type="button" 
                            className="copy-btn"
                            onClick={() => toggleSqlExpand(idx)}
                          >
                            {expandedSqlIdxs[idx] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            <span>{expandedSqlIdxs[idx] ? 'Collapse' : 'Expand'}</span>
                          </button>
                        </div>
                      </div>
                      {expandedSqlIdxs[idx] && (
                        <pre className="sql-code">
                          <code>{msg.sql}</code>
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Visual Chart visualization */}
                  {msg.chart && (
                    <ChartRenderer chartConfig={msg.chart} />
                  )}

                  {/* Executed Data Table results */}
                  {msg.result && msg.result.length > 0 && (
                    <div className="sql-wrapper" style={{ background: 'transparent' }}>
                      <div className="sql-header" style={{ borderBottom: expandedTableIdxs[idx] ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Database size={12} />
                          Query Result ({msg.result.length} rows)
                        </span>
                        <button 
                          type="button" 
                          className="copy-btn"
                          onClick={() => toggleTableExpand(idx)}
                        >
                          {expandedTableIdxs[idx] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          <span>{expandedTableIdxs[idx] ? 'Collapse Table' : 'Show Table'}</span>
                        </button>
                      </div>
                      {expandedTableIdxs[idx] && (
                        <div className="preview-grid-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                          <table className="data-table">
                            <thead>
                              <tr>
                                {Object.keys(msg.result[0]).map((key) => (
                                  <th key={key}>{key}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {msg.result.slice(0, 50).map((row, rowIdx) => (
                                <tr key={rowIdx}>
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
                          {msg.result.length > 50 && (
                            <div style={{ padding: '8px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.1)' }}>
                              Showing first 50 rows.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Business Insights Panel */}
                  {msg.insights && (
                    <div className="insights-container">
                      <div className="insights-title">
                        <Sparkles size={14} />
                        Business Insights
                      </div>
                      <ul className="insights-list">
                        {parseInsights(msg.insights).map((insight, insightIdx) => (
                          <li key={insightIdx} className="insight-item">
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Loading / Writing State */}
        {loading && (
          <div className="chat-bubble-wrapper">
            <div className="chat-bubble agent">
              <div className="chat-avatar agent">AI</div>
              <div className="chat-content-stack" style={{ gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Agent is executing workflow (generating SQL, validating, analyzing result)...</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '200px' }}>
                  <div className="shimmer-text" style={{ width: '100%' }}></div>
                  <div className="shimmer-text" style={{ width: '80%' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestion Chips (when messages exist) */}
      {messages.length > 0 && !loading && (
        <div className="chat-suggestions">
          {SUGGESTIONS.slice(0, 3).map((suggestion, idx) => (
            <button 
              key={idx}
              type="button" 
              className="suggestion-chip"
              onClick={() => handleSend(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input Text Box */}
      <div className="chat-input-bar">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputVal);
          }}
          className="chat-input-wrapper"
        >
          <input 
            type="text" 
            className="chat-input"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={threadId ? "Ask a follow-up question..." : "Ask a question about database..."}
            disabled={loading}
          />
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading || !inputVal.trim()}
            style={{ padding: '12px 16px', borderRadius: '10px' }}
          >
            <Send size={18} />
          </button>
        </form>
        {threadId && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            <span>Active Thread: <strong>{threadId}</strong></span>
            <button 
              type="button" 
              style={{ background: 'transparent', border: 'none', color: 'var(--primary-accent)', cursor: 'pointer', fontSize: '0.7rem' }}
              onClick={() => {
                setMessages([]);
                setThreadId('');
              }}
            >
              Start New Thread
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
