import { useEffect, useRef, useState } from 'react'
import { API } from '../api'
import { displayPersonName } from '../userDisplay'
import { getRagConfigForRole } from '../data/ragPrompts'
import './CurivaAIChat.css'

function userInitials(user) {
  const name = displayPersonName(user)
  const parts = name.replace(/^Dr\.?\s*/i, '').trim().split(/\s+/)
  const a = parts[0]?.[0] || ''
  const b = parts[1]?.[0] || ''
  return (a + b).toUpperCase() || name.slice(0, 2).toUpperCase()
}

export default function CurivaAIChat({ user, onToast, compact = false }) {
  const config = getRagConfigForRole(user?.role)
  const [messages, setMessages] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const hasConversation = messages.length > 0

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const sendQuery = async (raw) => {
    const text = (raw ?? query).trim()
    if (!text || loading) return

    setMessages((m) => [...m, { role: 'user', text }])
    setQuery('')
    setLoading(true)

    try {
      const res = await API.ragQuery(text)
      setMessages((m) => [
        ...m,
        { role: 'bot', text: res.answer, citations: res.citations || [], query: text },
      ])
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'bot',
          text: 'I could not reach the Curiva knowledge service. Please ensure the backend is running and try again.',
          query: text,
        },
      ])
      onToast?.('Curiva is temporarily unavailable.', 'error')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      onToast?.('Copied to clipboard.', 'success')
    } catch {
      onToast?.('Could not copy text.', 'error')
    }
  }

  const speakText = (text) => {
    if (!window.speechSynthesis) {
      onToast?.('Text-to-speech is not supported in this browser.', 'info')
      return
    }
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 0.95
    window.speechSynthesis.speak(utter)
  }

  const regenerate = async (botIndex) => {
    const prior = messages[botIndex - 1]
    if (prior?.role !== 'user' || loading) return
    const text = prior.text
    setMessages((m) => m.slice(0, botIndex))
    setLoading(true)
    try {
      const res = await API.ragQuery(text)
      setMessages((m) => [
        ...m,
        { role: 'bot', text: res.answer, citations: res.citations || [], query: text },
      ])
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'bot',
          text: 'I could not reach the Curiva knowledge service. Please try again.',
          query: text,
        },
      ])
      onToast?.('Curiva is temporarily unavailable.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    sendQuery()
  }

  return (
    <div className={`mfai-chat ${compact ? 'mfai-chat--compact' : ''}${!hasConversation && !loading ? ' mfai-chat--idle' : ''}`}>
      <header className="mfai-chat-topbar">
        <div className="mfai-chat-column mfai-chat-topbar-inner">
          <span className="mfai-chat-brand">
            <span className="mfai-chat-brand-icon" aria-hidden>💬</span>
            Ask Curiva AI
          </span>
          <div className="mfai-chat-avatar" title={displayPersonName(user)}>
            {userInitials(user)}
          </div>
        </div>
      </header>

      <div className="mfai-chat-body" ref={scrollRef}>
        <div className="mfai-chat-column mfai-chat-body-inner">
          {!hasConversation && !loading ? (
            <div className="mfai-chat-empty">
              <h1 className="mfai-chat-greeting">{config.greeting}</h1>
              {!compact && <p className="mfai-chat-subtitle">{config.subtitle}</p>}
            </div>
          ) : (
            <div className="mfai-chat-thread">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="mfai-bubble-row mfai-bubble-row--user">
                  <div className="mfai-bubble mfai-bubble--user">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="mfai-bubble-row mfai-bubble-row--bot">
                  <div className="mfai-bubble mfai-bubble--bot">
                    <div className="mfai-bubble-text">{m.text}</div>
                    {m.citations?.length > 0 && (
                      <div className="mfai-bubble-sources">
                        Sources:{' '}
                        {m.citations.map((c, j) => (
                          <span key={j}>
                            {c.source}
                            {c.relevance ? ` (${c.relevance})` : ''}
                            {j < m.citations.length - 1 ? ' · ' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mfai-msg-actions" aria-label="Message actions">
                    <button type="button" className="mfai-action-btn" title="Copy" onClick={() => copyText(m.text)}>
                      ⧉
                    </button>
                    <button type="button" className="mfai-action-btn" title="Helpful" onClick={() => onToast?.('Thanks for your feedback.', 'success')}>
                      👍
                    </button>
                    <button type="button" className="mfai-action-btn" title="Not helpful" onClick={() => onToast?.('Feedback noted.', 'info')}>
                      👎
                    </button>
                    <button type="button" className="mfai-action-btn" title="Read aloud" onClick={() => speakText(m.text)}>
                      🔊
                    </button>
                    <button type="button" className="mfai-action-btn" title="Regenerate" onClick={() => regenerate(i)} disabled={loading}>
                      ↻
                    </button>
                  </div>
                </div>
              ),
            )}
            {loading && (
              <div className="mfai-bubble-row mfai-bubble-row--bot">
                <div className="mfai-bubble mfai-bubble--bot mfai-bubble--typing">
                  <span className="mfai-typing-dot" />
                  <span className="mfai-typing-dot" />
                  <span className="mfai-typing-dot" />
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      <footer className="mfai-chat-footer">
        <div className="mfai-chat-column mfai-chat-footer-inner">
        {!hasConversation && !loading && (
          <div className="mfai-suggestions">
            {config.suggestions.map((s) => (
              <button key={s} type="button" className="mfai-suggestion-chip" onClick={() => sendQuery(s)} disabled={loading}>
                {s}
              </button>
            ))}
          </div>
        )}

        <form className="mfai-composer" onSubmit={onSubmit}>
          <div className="mfai-composer-box">
            <textarea
              ref={inputRef}
              className="mfai-composer-input"
              placeholder="Ask anything"
              rows={1}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendQuery()
                }
              }}
              disabled={loading}
            />
            <div className="mfai-composer-toolbar">
              <div className="mfai-composer-tools">
                <button type="button" className="mfai-tool-btn" title="Attach file (demo)" onClick={() => onToast?.('File attach is demo-only.', 'info')}>
                  📎
                </button>
                <button type="button" className="mfai-tool-btn" title="Search knowledge base" onClick={() => onToast?.('Searching clinical knowledge base…', 'info')}>
                  🌐
                </button>
                <button type="button" className="mfai-tool-btn" title="Suggested prompts" onClick={() => inputRef.current?.focus()}>
                  💡
                </button>
                <button type="button" className="mfai-tool-btn" title="More options" onClick={() => onToast?.('More options coming soon.', 'info')}>
                  ⋯
                </button>
              </div>
              <button type="submit" className="mfai-send-btn" disabled={loading || !query.trim()} aria-label="Send message">
                ↑
              </button>
            </div>
          </div>
        </form>

        <p className="mfai-disclaimer">AI can make mistakes. Please double-check responses.</p>
        </div>
      </footer>
    </div>
  )
}
