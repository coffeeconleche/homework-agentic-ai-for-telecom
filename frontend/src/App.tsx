import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Coffee,
  Database,
  FileText,
  MessageSquare,
  Package,
  Plus,
  ReceiptText,
  Orbit,
  Store,
  Users,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api, ApiError } from './api'
import type { Conversation, Health, Turn } from './api'
import StockroomIllustration from './StockroomIllustration'
import TransactionCard from './TransactionCard'
import StudioWelcome from './StudioWelcome'

const STORAGE_KEY = 'stockai.conversation'
const APPEARANCE_KEY = 'stockai.appearance'
type Appearance = 'stockroom' | 'studio'
const suggestions = [
  {
    icon: Package,
    tag: 'CHECK THE SHELVES',
    title: 'What’s running low?',
    question: 'Which products are at or below their reorder point?',
  },
  {
    icon: BookOpen,
    tag: 'OPEN THE HANDBOOK',
    title: 'Know your shop rules.',
    question:
      'What is our replenishment policy, including rules for perishable products? Cite your sources.',
  },
  {
    icon: Users,
    tag: 'PLAN THE NEXT DELIVERY',
    title: 'Let’s plan a restock.',
    question:
      'Check low-stock products, research our replenishment policy, and calculate a reorder plan and estimated cost. Flag missing information.',
  },
]
const toolLabels: Record<string, string> = {
  query_inventory: 'Checked inventory',
  query_transactions: 'Queried transactions',
  calculate: 'Ran a calculation',
  ask_policy_agent: 'Consulted Policy researcher',
  search_knowledge: 'Searched knowledge base',
  prepare_transaction: 'Prepared a transaction for review',
}

function Activity({ turn }: { turn: Turn }) {
  if (!turn.steps.length && !turn.sources.length) return null
  const agents = new Set(turn.steps.map((step) => step.agent)).size
  return (
    <details className="activity">
      <summary>
        <ClipboardList size={13} /> {agents} {agents === 1 ? 'agent' : 'agents'}
        <span>·</span>
        {turn.steps.length}{' '}
        {turn.steps.length === 1 ? 'tool call' : 'tool calls'}
        {turn.sources.length > 0 && (
          <>
            <span>·</span>
            {turn.sources.length}{' '}
            {turn.sources.length === 1 ? 'source' : 'sources'}
          </>
        )}
        <ChevronRight size={13} className="details-chevron" />
      </summary>
      <div className="activity-content">
        {turn.steps.map((step, index) => (
          <div className="activity-step" key={index}>
            {step.status === 'error' ? (
              <CircleHelp size={14} />
            ) : (
              <Check size={14} />
            )}
            <span>{toolLabels[step.tool] || step.tool}</span>
            <small>{step.agent}</small>
          </div>
        ))}
        {turn.sources.length > 0 && (
          <div className="sources">
            <p className="eyebrow">FROM THE SHOP HANDBOOK</p>
            {turn.sources.map((source, index) => (
              <details key={index} className="source">
                <summary>
                  <FileText size={14} />
                  {source.source}
                  <span>{source.title}</span>
                </summary>
                <p>{source.content}</p>
              </details>
            ))}
          </div>
        )}
      </div>
    </details>
  )
}

export default function App() {
  const [appearance, setAppearance] = useState<Appearance>(() => {
    try {
      return localStorage.getItem(APPEARANCE_KEY) === 'studio'
        ? 'studio'
        : 'stockroom'
    } catch {
      return 'stockroom'
    }
  })
  const [health, setHealth] = useState<Health | null>(null)
  const [conversation, setConversation] = useState<string | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [initializing, setInitializing] = useState(true)
  const [decisionPending, setDecisionPending] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sendingRef = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(APPEARANCE_KEY, appearance)
    } catch {
      /* Preference remains usable when storage is unavailable. */
    }
    document.title =
      appearance === 'studio' ? 'StockAI · Studio' : 'StockAI · The stockroom'
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', appearance === 'studio' ? '#f8f9fb' : '#2c3e34')
  }, [appearance])

  useEffect(() => {
    let active = true
    async function initialize() {
      try {
        const status = await api<Health>('/health')
        const stored = localStorage.getItem(STORAGE_KEY)
        let current: Conversation | null = null
        if (stored) {
          try {
            current = await api(`/conversations/${stored}`)
          } catch (err) {
            if (!(err instanceof ApiError && [404, 422].includes(err.status)))
              throw err
          }
        }
        if (!current) {
          const created = await api<{ id: string }>('/conversations', {})
          current = { ...created, turns: [] }
        }
        if (!active) return
        localStorage.setItem(STORAGE_KEY, current.id)
        setHealth(status)
        setConversation(current.id)
        setTurns(current.turns)
      } catch (err) {
        if (active)
          setError(
            err instanceof Error
              ? err.message
              : 'Could not initialize the chat.',
          )
      } finally {
        if (active) setInitializing(false)
      }
    }
    void initialize()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (turns.length || pending || error) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else {
      chatRef.current?.scrollTo({ top: 0 })
    }
  }, [turns, pending, error])

  async function newChat() {
    if (sendingRef.current) return
    setError('')
    setInitializing(true)
    try {
      const created = await api<{ id: string }>('/conversations', {})
      localStorage.setItem(STORAGE_KEY, created.id)
      setConversation(created.id)
      setTurns([])
      setDraft('')
      inputRef.current?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a chat.')
    } finally {
      setInitializing(false)
    }
  }

  async function send(question: string) {
    if (
      !question.trim() ||
      !conversation ||
      sendingRef.current ||
      initializing ||
      !health?.llm_configured
    )
      return
    sendingRef.current = true
    setError('')
    setPending(question.trim())
    setDraft('')
    try {
      const turn = await api<Turn>('/chat', {
        conversation_id: conversation,
        message: question.trim(),
      })
      setTurns((previous) => [...previous, turn])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.',
      )
      setDraft(question)
    } finally {
      setPending(null)
      sendingRef.current = false
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  async function decideTransaction(id: string, decision: 'confirm' | 'cancel') {
    if (!conversation || sendingRef.current || initializing) return
    sendingRef.current = true
    setDecisionPending(id)
    setError('')
    try {
      const updated = await api<Conversation>(
        `/conversations/${conversation}/transactions/${id}`,
        { decision },
      )
      setTurns(updated.turns)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not save your decision. Please retry.',
      )
    } finally {
      sendingRef.current = false
      setDecisionPending(null)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void send(draft)
  }
  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      void send(draft)
    }
  }
  const ready = !initializing && !!health?.llm_configured && !!conversation
  const empty = turns.length === 0 && !pending

  return (
    <div className="app-shell" data-appearance={appearance}>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="StockAI home">
          <span className="brand-mark">
            {appearance === 'studio' ? (
              <Orbit size={26} strokeWidth={1.5} />
            ) : (
              <Store size={26} strokeWidth={1.5} />
            )}
          </span>
          <span className="brand-name">
            stockai<span className="brand-dot">.</span>
          </span>
        </a>
        <p className="brand-caption">
          {appearance === 'studio'
            ? 'THE INVENTORY WORKSPACE'
            : 'YOUR DIGITAL STOCKROOM'}
        </p>
        <div className="workspace">
          <span className="workspace-avatar">
            <Coffee size={17} />
          </span>
          <div>
            {appearance === 'studio'
              ? 'Inventory workspace'
              : 'The neighborhood shop'}
            <small>Sample inventory</small>
          </div>
        </div>
        <button
          className="new-chat"
          onClick={() => void newChat()}
          disabled={!!pending || !!decisionPending || initializing || !health}
        >
          <Plus size={17} />
          New conversation
        </button>
        <div className="nav-label">BEHIND THE COUNTER</div>
        <div className="nav-item active">
          <MessageSquare size={17} />
          {appearance === 'studio' ? 'Assistant' : 'The stockroom'}
          <span className="nav-dot" />
        </div>
        <div className="sidebar-section">
          <div className="nav-label">
            YOUR EXTRA PAIR OF HANDS <span>02</span>
          </div>
          <div className="team-person">
            <span className="agent-icon inventory-icon">
              <Package size={16} />
            </span>
            <div>
              Inventory agent<small>Stock, transactions & calculations</small>
            </div>
          </div>
          <div className="team-person">
            <span className="agent-icon policy-icon">
              <BookOpen size={16} />
            </span>
            <div>
              Policy researcher<small>Knowledge & business rules</small>
            </div>
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="demo-note">
            <Database size={16} />
            <div>
              A practice shop, all yours.
              <p>
                Explore with sample goods.
                <br />
                Confirm changes to sample stock.
              </p>
            </div>
          </div>
          <div className="profile">
            <span className="profile-avatar">
              <Store size={16} />
            </span>
            <div>
              Made for small business
              <small>A little help behind the counter.</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="breadcrumb-root">
              {appearance === 'studio' ? 'WORKSPACE' : 'YOUR SHOP'}
            </span>
            <ChevronRight size={14} />
            <span>
              {appearance === 'studio' ? 'Assistant' : 'The stockroom'}
            </span>
          </div>
          <div className="ui-switch" role="group" aria-label="Interface style">
            <button
              type="button"
              aria-pressed={appearance === 'stockroom'}
              onClick={() => setAppearance('stockroom')}
            >
              <Store size={13} />
              <span>Stockroom</span>
            </button>
            <button
              type="button"
              aria-pressed={appearance === 'studio'}
              onClick={() => setAppearance('studio')}
            >
              <Orbit size={13} />
              <span>Studio</span>
            </button>
          </div>
        </header>
        <div className="chat-heading">
          <div>
            <h1>
              {appearance === 'studio'
                ? 'Your inventory assistant'
                : 'The stockroom'}
            </h1>
            <p>
              {appearance === 'studio'
                ? 'One conversation. A clearer view of your business.'
                : 'Your everyday inventory, with a little extra know-how.'}
            </p>
          </div>
        </div>

        <div ref={chatRef} className={`chat-scroll ${empty ? 'is-empty' : ''}`}>
          {empty && (
            <section className="welcome">
              {appearance === 'studio' ? (
                <StudioWelcome />
              ) : (
                <div className="welcome-hero">
                  <div className="welcome-intro">
                    <div className="eyebrow welcome-eyebrow">
                      <span /> A LITTLE ORDER. A LOT LESS GUESSWORK.
                    </div>
                    <h2>
                      Good things
                      <br />
                      come <em>in stock.</em>
                    </h2>
                    <p className="welcome-copy">
                      From the last bag of coffee to your next delivery. Let’s
                      see what your shop needs.
                    </p>
                    <p className="welcome-signoff">
                      Your shop. Your questions. We’ll check the shelves.
                    </p>
                  </div>
                  <StockroomIllustration />
                </div>
              )}
              <div className="shelf-divider">
                <span>WHERE SHALL WE START?</span>
                <span>NO SPREADSHEET REQUIRED</span>
              </div>
              <div className="suggestions">
                {suggestions.map(
                  ({ icon: Icon, tag, title, question }, index) => (
                    <button
                      key={tag}
                      className="suggestion"
                      onClick={() => void send(question)}
                      disabled={!ready}
                    >
                      <span className="suggestion-top">
                        <Icon size={19} strokeWidth={1.6} />
                        <span className="suggestion-number">0{index + 1}</span>
                      </span>
                      <span className="eyebrow">{tag}</span>
                      <strong>
                        {title}
                        <ArrowRight size={16} />
                      </strong>
                    </button>
                  ),
                )}
              </div>
              <p className="welcome-footnote">
                <BookOpen size={13} />
                Stock counts, shop rules, and restock plans. All in one
                conversation.
              </p>
              <button
                className="try-transaction"
                disabled={!ready || !!decisionPending}
                onClick={() =>
                  void send('Record a sale of 2 coffee bags for PEN 50 total.')
                }
              >
                <ReceiptText size={14} />
                Try recording a sale
                <ArrowRight size={13} />
              </button>
            </section>
          )}

          <div className="messages" aria-live="polite" aria-busy={!!pending}>
            {turns.map((turn, index) => (
              <div className="turn" key={index}>
                <div className="user-message">{turn.question}</div>
                <div className="assistant-message">
                  <span className="assistant-avatar">
                    <Store size={18} />
                  </span>
                  <div className="assistant-body">
                    <div className="message-label">
                      StockAI<span>BEHIND THE COUNTER</span>
                    </div>
                    <div className="markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {turn.answer}
                      </ReactMarkdown>
                    </div>
                    <Activity turn={turn} />
                    {(turn.transactions ?? []).map((transaction) => (
                      <TransactionCard
                        key={transaction.id}
                        draft={transaction}
                        busy={!!pending || !!decisionPending || initializing}
                        deciding={decisionPending === transaction.id}
                        onDecide={(id, decision) =>
                          void decideTransaction(id, decision)
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {pending && (
              <div className="turn">
                <div className="user-message">{pending}</div>
                <div className="assistant-message">
                  <span className="assistant-avatar">
                    <Store size={18} />
                  </span>
                  <div className="assistant-body">
                    <div className="message-label">
                      StockAI<span>BEHIND THE COUNTER</span>
                    </div>
                    <div className="thinking">
                      <span className="thinking-dots">
                        <i />
                        <i />
                        <i />
                      </span>
                      Checking the shelves and the books…
                    </div>
                    <p className="thinking-note">
                      A careful answer can take a moment.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="error-message" role="alert">
                <CircleHelp size={17} />
                <div>
                  {error}
                  {!health && (
                    <button onClick={() => window.location.reload()}>
                      Reconnect
                    </button>
                  )}
                </div>
              </div>
            )}
            {!initializing && health && !health.llm_configured && (
              <div className="error-message" role="alert">
                <CircleHelp size={17} />
                <div>
                  Add your DeepSeek key to the root .env, restart the backend,
                  then reload this page.
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <footer className="composer-area">
          <form className="composer" onSubmit={submit}>
            <label className="sr-only" htmlFor="message">
              Message StockAI
            </label>
            <textarea
              id="message"
              ref={inputRef}
              placeholder="What’s happening in your shop?"
              value={draft}
              maxLength={4000}
              rows={2}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKey}
              disabled={!ready || !!pending || !!decisionPending}
            />
            <div className="composer-bottom">
              <span>
                <ClipboardList size={13} />
                Your stockroom assistant
                <span className="composer-divider" />
                Here to help
              </span>
              <button
                type="submit"
                className="send-button"
                aria-label="Send message"
                disabled={
                  !draft.trim() || !ready || !!pending || !!decisionPending
                }
              >
                <ArrowUp size={19} />
              </button>
            </div>
          </form>
          <div className="composer-caption">
            <span>
              Sample goods. Real possibilities. Changes need your confirmation.
            </span>
            <span>
              Enter to send
              <ArrowDown size={10} className="enter-arrow" />
              Shift + Enter for a new line
            </span>
          </div>
          {appearance === 'studio' && (
            <div className="studio-credit">
              Orb adapted from{' '}
              <a
                href="https://rareui.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Rare UI
                <ArrowUp size={9} />
              </a>
            </div>
          )}
        </footer>
      </main>
    </div>
  )
}
