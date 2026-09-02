import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import type { TokenStatus } from '../types';

// Secret lives OUTSIDE the app directory so it is never included when the
// app folder is synced to the public monorepo.
const SECRET_DIR = '/tasklet/agent/home/.secrets';
const SECRET_FILE = `${SECRET_DIR}/github-merge-token`;
const STATUS_FILE = `${SECRET_DIR}/github-merge-token.status.json`;

interface TokenPanelProps {
  status: TokenStatus;
  onStatusChange: (status: TokenStatus) => void;
  onClose: () => void;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; login: string };

const MARKER = '__HTTP__';

export const TokenPanel: React.FC<TokenPanelProps> = ({ status, onStatusChange, onClose }) => {
  const [token, setToken] = useState('');
  const [reveal, setReveal] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [removing, setRemoving] = useState(false);

  async function testAndSave() {
    const t = token.trim();
    if (!t) {
      setPhase({ kind: 'error', message: 'Paste a token first.' });
      return;
    }
    if (t.includes("'")) {
      setPhase({ kind: 'error', message: 'That does not look like a valid token (contains a quote).' });
      return;
    }
    setPhase({ kind: 'testing' });
    try {
      // Validate the token against the GitHub API. The token is passed via an
      // env var so it never appears in the returned command log.
      const cmd =
        `GH_TOKEN='${t}' bash -c 'curl -s -w "\\n${MARKER}%{http_code}" ` +
        `-H "Authorization: Bearer $GH_TOKEN" ` +
        `-H "Accept: application/vnd.github+json" ` +
        `-H "X-GitHub-Api-Version: 2022-11-28" ` +
        `-H "User-Agent: pr-health-dashboard" ` +
        `https://api.github.com/user'`;
      const res = await window.tasklet.runCommand(cmd, 30);
      const idx = res.log.lastIndexOf(MARKER);
      if (idx < 0) {
        throw new Error('No response from GitHub. Check network and try again.');
      }
      const code = res.log.slice(idx + MARKER.length).trim();
      const body = res.log.slice(0, idx).trim();

      if (code !== '200') {
        let msg = `GitHub rejected the token (HTTP ${code}).`;
        try {
          const parsed = JSON.parse(body);
          if (parsed?.message) msg = `GitHub: ${parsed.message} (HTTP ${code}).`;
        } catch {
          /* keep default */
        }
        if (code === '401') msg = 'Token is invalid, expired, or revoked (401). Generate a fresh one.';
        setPhase({ kind: 'error', message: msg });
        return;
      }

      const login = (() => {
        try {
          return String(JSON.parse(body).login ?? 'unknown');
        } catch {
          return 'unknown';
        }
      })();

      // Persist the secret and a token-free status file for display.
      await window.tasklet.runCommand(`mkdir -p '${SECRET_DIR}'`, 15);
      await window.tasklet.writeFileToDisk(SECRET_FILE, t);
      await window.tasklet.runCommand(`chmod 600 '${SECRET_FILE}' 2>/dev/null || true`, 15);

      const newStatus: TokenStatus = {
        configured: true,
        login,
        last4: t.slice(-4),
        savedAt: new Date().toISOString(),
      };
      await window.tasklet.writeFileToDisk(STATUS_FILE, JSON.stringify(newStatus, null, 2));

      onStatusChange(newStatus);
      setToken('');
      setPhase({ kind: 'success', login });
    } catch (err) {
      console.error('Token test/save failed:', err);
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong while validating.',
      });
    }
  }

  async function removeToken() {
    setRemoving(true);
    try {
      await window.tasklet.runCommand(`rm -f '${SECRET_FILE}' '${STATUS_FILE}'`, 15);
      onStatusChange({ configured: false });
      setPhase({ kind: 'idle' });
    } catch (err) {
      console.error('Token removal failed:', err);
      setPhase({ kind: 'error', message: 'Could not remove the token. Try again.' });
    } finally {
      setRemoving(false);
    }
  }

  const testing = phase.kind === 'testing';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-base-100 rounded-xl shadow-xl max-w-md w-full max-h-[85vh] flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-base-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-primary" />
            <h2 className="text-sm font-bold">Merge token</h2>
            {status.configured ? (
              <span className="badge badge-sm badge-success gap-1">
                <ShieldCheck size={11} /> Active
              </span>
            ) : (
              <span className="badge badge-sm badge-ghost gap-1">
                <ShieldAlert size={11} /> Not set
              </span>
            )}
          </div>
          <button className="btn btn-xs btn-ghost btn-square" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex-1 flex flex-col gap-4">
          {/* Current status */}
          {status.configured ? (
            <div className="rounded-lg bg-success/10 border border-success/20 px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-success">
                <ShieldCheck size={13} /> Token active
              </div>
              <div className="mt-1.5 text-[11px] text-base-content/60 leading-relaxed">
                Authenticated as <span className="font-mono font-medium">{status.login}</span>
                {status.last4 && (
                  <> · ending <span className="font-mono">…{status.last4}</span></>
                )}
                {status.savedAt && (
                  <> · saved {new Date(status.savedAt).toLocaleDateString()}</>
                )}
              </div>
              <div className="mt-1 text-[10px] text-base-content/40">
                Merges and monorepo sync will use this token.
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-warning/10 border border-warning/20 px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-warning">
                <ShieldAlert size={13} /> No merge token
              </div>
              <div className="mt-1 text-[11px] text-base-content/60 leading-relaxed">
                Bot PRs get queued but can't be auto-merged, and the monorepo sync is blocked.
                Paste a fine-grained PAT below to unblock both.
              </div>
            </div>
          )}

          {/* Paste field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-base-content/70">
              {status.configured ? 'Replace token' : 'Paste token'}
            </label>
            <label className="input input-bordered input-sm flex items-center gap-2">
              <KeyRound size={13} className="opacity-50" />
              <input
                type={reveal ? 'text' : 'password'}
                className="grow font-mono text-xs"
                placeholder="github_pat_… or ghp_…"
                value={token}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  setToken(e.target.value);
                  if (phase.kind !== 'idle') setPhase({ kind: 'idle' });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !testing) testAndSave();
                }}
              />
              <button
                type="button"
                className="opacity-50 hover:opacity-100 transition-opacity"
                onClick={() => setReveal((r) => !r)}
                title={reveal ? 'Hide' : 'Reveal'}
              >
                {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </label>
            <p className="text-[10px] text-base-content/40 leading-snug">
              Needs <span className="font-medium">Contents</span> +{' '}
              <span className="font-medium">Pull requests</span>: read/write on the monitored repos.
              The token is stored privately and never synced to the public repo.
            </p>
          </div>

          {/* Feedback */}
          {phase.kind === 'error' && (
            <div className="alert alert-error py-2 px-3 text-xs">
              <AlertTriangle size={14} />
              <span>{phase.message}</span>
            </div>
          )}
          {phase.kind === 'success' && (
            <div className="alert alert-success py-2 px-3 text-xs">
              <CheckCircle2 size={14} />
              <span>Verified & saved — authenticated as {phase.login}.</span>
            </div>
          )}

          {/* Help link */}
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-primary hover:underline flex items-center gap-1 w-fit"
          >
            Generate a fine-grained token <ExternalLink size={10} />
          </a>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-base-200 flex items-center justify-between gap-2">
          {status.configured ? (
            <button
              className="btn btn-xs btn-ghost text-error gap-1"
              onClick={removeToken}
              disabled={removing || testing}
              title="Delete the stored token"
            >
              {removing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Remove
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button className="btn btn-xs btn-ghost" onClick={onClose} disabled={testing}>
              Cancel
            </button>
            <button className="btn btn-xs btn-primary gap-1" onClick={testAndSave} disabled={testing}>
              {testing ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Verifying…
                </>
              ) : (
                <>
                  <ShieldCheck size={12} /> Test &amp; save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
