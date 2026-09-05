import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle, RefreshCw, Bot, User, ChevronDown, ChevronUp,
  Clock, ExternalLink, Sparkles
} from 'lucide-react';
import { PRComment } from '../types';

const api = window.tasklet;
const GITHUB_CONN = 'conn_8et0d5bx3yszdanafpnb';

/* ─── Markdown-lite renderer ──────────────────────────────── */
function renderBody(body: string): React.ReactNode {
  const lines = body.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="bg-base-300/50 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2 whitespace-pre-wrap">
            {codeLines.join('\n')}
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }
    if (line.trim() === '') {
      elements.push(<div key={`br-${i}`} className="h-2" />);
      continue;
    }
    // Quote lines
    if (line.startsWith('> ')) {
      elements.push(
        <div key={`q-${i}`} className="border-l-2 border-base-content/15 pl-3 my-1 text-base-content/45 italic text-[0.8125rem] leading-relaxed">
          {renderInline(line.slice(2))}
        </div>
      );
      continue;
    }
    // Headings
    if (line.startsWith('### ')) {
      elements.push(<h4 key={`h-${i}`} className="font-bold text-sm mt-2 mb-1">{renderInline(line.slice(4))}</h4>);
      continue;
    }
    // Horizontal rules
    if (line.match(/^---+$/)) {
      elements.push(<hr key={`hr-${i}`} className="border-base-content/10 my-2" />);
      continue;
    }
    // Normal line
    elements.push(
      <p key={`p-${i}`} className="text-[0.8125rem] leading-relaxed">{renderInline(line)}</p>
    );
  }
  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Process bold, inline code, links, and @mentions
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|@(\w[\w-]*))/g;
  let lastIndex = 0;
  let match;
  let ki = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={ki++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <code key={ki++} className="bg-base-300/60 px-1.5 py-0.5 rounded text-xs font-mono">
          {match[3]}
        </code>
      );
    } else if (match[4] && match[5]) {
      parts.push(
        <a key={ki++} href={match[5]} target="_blank" rel="noopener noreferrer"
           className="text-info hover:underline">{match[4]}</a>
      );
    } else if (match[6]) {
      const isJules = match[6].toLowerCase().includes('jules');
      parts.push(
        <span key={ki++} className={`inline-flex items-center gap-0.5 font-semibold ${
          isJules ? 'text-primary' : 'text-info'
        }`}>
          {isJules && <Sparkles size={10} />}@{match[6]}
        </span>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

/* ─── Time helpers ──────────────────────────────────────── */
function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatTimestamp(date: string): string {
  return new Date(date).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  });
}

/* ─── Author classification ─────────────────────────────── */
function classifyAuthor(author: string): 'jules' | 'bot' | 'human' {
  if (!author) return 'bot';
  const lower = author.toLowerCase();
  if (lower.includes('jules')) return 'jules';
  if (lower.includes('[bot]') || lower === 'github-actions[bot]') return 'bot';
  return 'human';
}

/* ─── Message bubble ────────────────────────────────────── */
const MessageBubble: React.FC<{ comment: PRComment; isLast: boolean }> = ({ comment, isLast }) => {
  const authorType = comment.author_type || classifyAuthor(comment.author);
  const isJules = authorType === 'jules';
  const isBot = authorType === 'bot';

  // Skip noisy bot messages (Qodo, Codex connector, etc)
  const body = comment.body || '';
  if (isBot && body.length < 200 && (
    body.includes('paused for this user') ||
    body.includes('usage limits') ||
    body.includes('reached your')
  )) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 opacity-40 text-xs">
        <Bot size={10} />
        <span className="italic">{comment.author}: notification skipped</span>
      </div>
    );
  }

  const avatarContent = isJules ? (
    <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
      <Sparkles size={13} className="text-primary" />
    </div>
  ) : isBot ? (
    <div className="w-7 h-7 rounded-full bg-info/10 flex items-center justify-center shrink-0 ring-1 ring-info/15">
      <Bot size={13} className="text-info/70" />
    </div>
  ) : (
    <div className="w-7 h-7 rounded-full bg-secondary/10 flex items-center justify-center shrink-0 ring-1 ring-secondary/15">
      <span className="text-[10px] font-bold text-secondary">
        {(comment.author || '?')[0].toUpperCase()}
      </span>
    </div>
  );

  return (
    <div className={`flex gap-2.5 py-2.5 ${isLast ? '' : 'border-b border-base-200/30'} animate-fade-in`}>
      <div className="pt-0.5">{avatarContent}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold ${
            isJules ? 'text-primary' : isBot ? 'text-info/60' : 'text-secondary'
          }`}>
            {isJules ? 'Jules' : comment.author || 'Unknown'}
          </span>
          {isJules && (
            <span className="badge badge-xs bg-primary/10 text-primary border-primary/20 gap-0.5">
              <Sparkles size={7} /> AI
            </span>
          )}
          <span className="text-[10px] text-base-content/25 ml-auto tabular-nums" title={comment.created_at}>
            {formatTimestamp(comment.created_at)}
          </span>
        </div>
        <div className={`rounded-xl px-3.5 py-2.5 text-base-content/80 ${
          isJules ? 'bg-primary/5 border border-primary/10' :
          isBot ? 'bg-base-200/30 border border-base-200/40' :
          'bg-secondary/5 border border-secondary/10'
        }`}>
          {renderBody(body)}
        </div>
      </div>
    </div>
  );
};

/* ─── Main panel ────────────────────────────────────────── */
interface ConversationPanelProps {
  prNumber: number;
  repo: string;
  prUrl: string;
  agentBusy: boolean;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  prNumber, repo, prUrl, agentBusy
}) => {
  const [comments, setComments] = useState<PRComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ensure table exists, then load cached comments
  useEffect(() => {
    (async () => {
      try {
        await api.sqlExec(`
          CREATE TABLE IF NOT EXISTS jules_pr_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pr_number INTEGER NOT NULL,
            repo TEXT NOT NULL,
            github_comment_id INTEGER UNIQUE,
            author TEXT,
            author_type TEXT DEFAULT 'human',
            body TEXT,
            created_at TEXT,
            updated_at TEXT,
            fetched_at TEXT DEFAULT (datetime('now'))
          )
        `);
      } catch {}
      loadCachedComments();
    })();
  }, [prNumber, repo]);

  const loadCachedComments = async () => {
    setLoading(true);
    try {
      const rows = await api.sqlQuery(
        `SELECT * FROM jules_pr_comments WHERE pr_number = ${prNumber} AND repo = '${repo}' ORDER BY created_at ASC`
      );
      setComments(Array.isArray(rows) ? rows as unknown as PRComment[] : []);
    } catch {
      setComments([]);
    }
    setLoading(false);
  };

  const fetchConversation = async () => {
    setFetching(true);
    setError(null);
    try {
      // Fetch comments directly from GitHub via the connection tool
      const [owner, repoName] = repo.includes('/') ? repo.split('/') : ['guitarbeat', repo];
      const result = await api.invokeTool({
        toolName: 'github_get_issue',
        connectionId: GITHUB_CONN,
        args: { owner, repo: repoName, issue_number: prNumber }
      }) as any;

      const ghComments: any[] = result?.comments || [];
      if (ghComments.length === 0) {
        setError('No comments found on this PR');
        setFetching(false);
        return;
      }

      // Clear old entries for this PR
      await api.sqlExec(
        `DELETE FROM jules_pr_comments WHERE pr_number = ${prNumber} AND repo = '${repo}'`
      );

      // Insert each comment
      for (const c of ghComments) {
        const author = c.user || 'unknown';
        const authorType = classifyAuthor(author);
        const body = (c.body || '').replace(/'/g, "''");
        const createdAt = c.createdAt || '';
        const updatedAt = c.updatedAt || '';
        const ghId = c.id || 0;

        await api.sqlExec(
          `INSERT OR REPLACE INTO jules_pr_comments (pr_number, repo, github_comment_id, author, author_type, body, created_at, updated_at, fetched_at)
           VALUES (${prNumber}, '${repo}', ${ghId}, '${author.replace(/'/g, "''")}', '${authorType}', '${body}', '${createdAt}', '${updatedAt}', datetime('now'))`
        );
      }

      // Reload from DB
      await loadCachedComments();
    } catch (e: any) {
      console.error('Failed to fetch conversation:', e);
      setError(`Failed to fetch: ${e.message || 'unknown error'}`);
    }
    setFetching(false);
  };

  // Auto-fetch if no cached comments
  useEffect(() => {
    if (!loading && comments.length === 0 && !fetching) {
      fetchConversation();
    }
  }, [loading]);

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    if (scrollRef.current && comments.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  const julesCount = comments.filter(c => (c.author_type || classifyAuthor(c.author)) === 'jules').length;
  const humanCount = comments.filter(c => (c.author_type || classifyAuthor(c.author)) === 'human').length;
  const botCount = comments.filter(c => (c.author_type || classifyAuthor(c.author)) === 'bot').length;

  return (
    <div className="border-t border-info/10">
      {/* Header — always visible */}
      <button
        className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-base-200/20 transition-colors cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
        aria-label={expanded ? 'Collapse conversation' : 'Expand conversation'}
      >
        <div className="w-8 h-8 rounded-lg bg-base-200/60 flex items-center justify-center shrink-0">
          <MessageCircle size={15} className="text-base-content/40" />
        </div>
        <div className="flex-1 text-left">
          <span className="text-sm font-semibold">Conversation</span>
          {comments.length > 0 && (
            <span className="text-xs text-base-content/35 ml-2">
              {comments.length} message{comments.length !== 1 ? 's' : ''}
              {julesCount > 0 && (
                <span className="text-primary ml-1">· {julesCount} from Jules</span>
              )}
            </span>
          )}
          {fetching && (
            <span className="text-xs text-info ml-2 animate-pulse">fetching…</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {comments.length === 0 && !loading && !fetching && (
            <span className="text-[10px] text-base-content/25 italic">No messages</span>
          )}
          {expanded ? <ChevronUp size={14} className="text-base-content/30" /> : <ChevronDown size={14} className="text-base-content/30" />}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-4 animate-fade-in">
          {/* Fetch controls */}
          <div className="flex items-center gap-2 mb-4">
            <button
              className="btn btn-sm btn-outline btn-primary gap-1.5 rounded-lg"
              onClick={fetchConversation}
              disabled={fetching || agentBusy}
              aria-label="Refresh conversation"
            >
              {fetching ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <RefreshCw size={13} />
              )}
              {comments.length === 0 ? 'Load Conversation' : 'Refresh'}
            </button>
            <a
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-ghost gap-1 rounded-lg text-base-content/40 hover:text-base-content"
            >
              <ExternalLink size={12} />
              View on GitHub
            </a>
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-error text-xs mb-3 py-2" role="alert">
              {error}
            </div>
          )}

          {/* Loading state */}
          {(loading || (fetching && comments.length === 0)) ? (
            <div className="flex flex-col gap-3 py-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-2.5 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-base-200/40 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-base-200/30 rounded w-24" />
                    <div className="h-16 bg-base-200/20 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-base-300 py-8 text-center">
              <MessageCircle size={24} className="mx-auto text-base-content/15 mb-2" />
              <p className="text-sm text-base-content/30 font-medium">No conversation found</p>
              <p className="text-xs text-base-content/20 mt-1 max-w-[18rem] mx-auto leading-relaxed">
                This PR may not have any comments yet
              </p>
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="max-h-[28rem] overflow-y-auto pr-1 custom-scrollbar"
            >
              {comments.map((c, i) => (
                <MessageBubble key={c.id || i} comment={c} isLast={i === comments.length - 1} />
              ))}
            </div>
          )}

          {/* Summary footer */}
          {comments.length > 0 && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-base-200/40 text-[11px] text-base-content/30">
              <span className="flex items-center gap-1">
                <User size={10} /> {humanCount} human
              </span>
              <span className="flex items-center gap-1">
                <Sparkles size={10} className="text-primary" /> {julesCount} Jules
              </span>
              <span className="flex items-center gap-1">
                <Bot size={10} /> {botCount} bot
              </span>
              <span className="ml-auto flex items-center gap-1">
                <Clock size={9} />
                Last: {comments.length > 0 ? timeAgo(comments[comments.length - 1].created_at) : '—'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
