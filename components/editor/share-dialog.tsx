"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordEvent } from "@/lib/events";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Copy,
  Check,
  UserPlus,
  X,
  Loader2,
  Globe,
  Link2,
} from "lucide-react";

interface Collaborator {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  hasAccount: boolean;
  role: string;
  title: string | null;
}

function roleLabel(role: string): string {
  return role === "VIEWER" ? "Viewer" : "Editor";
}

interface Owner {
  userId: string;
  name: string | null;
  imageUrl: string | null;
  email: string | null;
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

export function ShareDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ShareDialogProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  const fetchCollaborators = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/collaborators`);
      if (res.ok) {
        const data = await res.json();
        setCollaborators(data.collaborators);
        setOwner(data.owner);
        setIsOwner(data.isOwner);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      fetchCollaborators();
      setInviteEmail("");
      setInviteError(null);
      setConfirmRemoveId(null);
    }
  }, [open, fetchCollaborators]);

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("Enter a valid email");
      return;
    }

    setInviteError(null);
    setInviting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        const data = await res.json();
        setCollaborators((prev) => [...prev, data.collaborator]);
        setInviteEmail("");
        recordEvent("share_invited");
      } else {
        const data = await res.json();
        setInviteError(data.error || "Failed to invite");
      }
    } catch {
      setInviteError("Network error — try again");
    } finally {
      setInviting(false);
    }
  };

  const patchCollaborator = useCallback(
    async (id: string, data: { title?: string | null; role?: string }) => {
      try {
        await fetch(`/api/projects/${projectId}/collaborators/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } catch {
        // best-effort; the optimistic value stays until next fetch
      }
    },
    [projectId]
  );

  const handleTitleChange = (id: string, value: string) => {
    setCollaborators((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: value } : c))
    );
  };

  const saveTitle = (id: string) => {
    const c = collaborators.find((x) => x.id === id);
    patchCollaborator(id, { title: c?.title ?? "" });
  };

  const handleRoleChange = (id: string, role: string) => {
    setCollaborators((prev) =>
      prev.map((c) => (c.id === id ? { ...c, role } : c))
    );
    patchCollaborator(id, { role });
  };

  const handleRemove = async (collaboratorId: string) => {
    if (confirmRemoveId !== collaboratorId) {
      setConfirmRemoveId(collaboratorId);
      return;
    }

    setRemovingId(collaboratorId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/collaborators/${collaboratorId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId));
      }
    } finally {
      setRemovingId(null);
      setConfirmRemoveId(null);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/${projectId}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const handleGenerateShareLink = async () => {
    setGeneratingToken(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setShareToken(data.token);
      }
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setShareLinkCopied(true);
    setTimeout(() => setShareLinkCopied(false), 2000);
  };

  const getInitial = (name: string | null, email: string) => {
    if (name) return name.charAt(0).toUpperCase();
    return email.charAt(0).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">
            Share &ldquo;{projectName}&rdquo;
          </DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            Manage who has access to this project.
          </DialogDescription>
        </DialogHeader>

        {/* Invite input — owner only */}
        {isOwner && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Invite by email..."
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setInviteError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleInvite();
                  }
                }}
                className="flex-1 bg-[var(--bg-base)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                disabled={inviting}
              />
              <Button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="shrink-0 bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)]"
                size="sm"
              >
                {inviting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
              </Button>
            </div>
            {inviteError && (
              <p className="text-xs text-[var(--state-error)]">{inviteError}</p>
            )}
          </div>
        )}

        {/* Collaborator list */}
        <ScrollArea className="max-h-[280px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : (
            <div className="space-y-1">
              {/* Owner row */}
              {owner && (
                <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                  {owner.imageUrl ? (
                    <img
                      src={owner.imageUrl}
                      alt={owner.name ?? "Owner"}
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)] text-xs font-medium text-white">
                      {getInitial(owner.name, owner.email ?? "O")}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {owner.name ?? owner.email ?? "Project owner"}
                    </p>
                    {owner.name && owner.email && (
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {owner.email}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className="shrink-0 bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border-none text-[10px]"
                  >
                    Owner
                  </Badge>
                </div>
              )}

              {/* Collaborator rows */}
              {collaborators.map((c) => (
                <div
                  key={c.id}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--bg-surface-raised)]/50"
                >
                  {c.imageUrl ? (
                    <img
                      src={c.imageUrl}
                      alt={c.name ?? c.email}
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)]">
                      {getInitial(c.name, c.email)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {c.name ?? c.email}
                    </p>
                    {c.name && (
                      <p className="truncate text-xs text-[var(--text-muted)]">
                        {c.email}
                      </p>
                    )}
                  </div>

                  {/* Role / title */}
                  {isOwner ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <input
                        value={c.title ?? ""}
                        onChange={(e) => handleTitleChange(c.id, e.target.value)}
                        onBlur={() => saveTitle(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        placeholder="Add role…"
                        maxLength={60}
                        aria-label={`Role for ${c.name ?? c.email}`}
                        className="h-7 w-24 rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--border-subtle)]"
                      />
                      {c.hasAccount && (
                        <select
                          value={c.role}
                          onChange={(e) => handleRoleChange(c.id, e.target.value)}
                          aria-label={`Access for ${c.name ?? c.email}`}
                          className="h-7 rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-subtle)]"
                        >
                          <option value="EDITOR">Editor</option>
                          <option value="VIEWER">Viewer</option>
                        </select>
                      )}
                    </div>
                  ) : (
                    <Badge
                      variant={c.hasAccount ? "secondary" : "outline"}
                      className={
                        c.hasAccount
                          ? "shrink-0 border-none bg-[var(--bg-surface-raised)] text-[var(--text-secondary)] text-[10px]"
                          : "shrink-0 border-[var(--border-subtle)] text-[var(--text-muted)] text-[10px]"
                      }
                    >
                      {c.title || (c.hasAccount ? roleLabel(c.role) : "Invited")}
                    </Badge>
                  )}

                  {/* Remove button — owner only */}
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--state-error)]"
                      onClick={() => handleRemove(c.id)}
                      disabled={removingId === c.id}
                      aria-label={
                        confirmRemoveId === c.id
                          ? `Confirm remove ${c.name ?? c.email}`
                          : `Remove ${c.name ?? c.email}`
                      }
                      title={
                        confirmRemoveId === c.id
                          ? "Click again to confirm removal"
                          : `Remove ${c.name ?? c.email}`
                      }
                    >
                      {removingId === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : confirmRemoveId === c.id ? (
                        <X className="h-3.5 w-3.5 text-[var(--state-error)]" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              ))}

              {/* Empty state */}
              {collaborators.length === 0 && !loading && (
                <div className="py-6 text-center">
                  <p className="text-sm text-[var(--text-muted)]">
                    No collaborators yet
                  </p>
                  {isOwner && (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Invite someone to start collaborating
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Public share link (view-only, no auth) */}
        {isOwner && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-[var(--accent-ai)]" />
              <span className="text-xs font-medium text-[var(--text-primary)]">
                Public share link
              </span>
              <span className="ml-auto rounded-full bg-[var(--bg-surface-raised)] px-1.5 py-0.5 text-[9px] text-[var(--text-muted)]">
                View only · no login required
              </span>
            </div>
            {shareToken ? (
              <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2">
                <span className="flex-1 truncate text-xs text-[var(--text-muted)]">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/share/${shareToken}`
                    : `/share/${shareToken}`}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={handleCopyShareLink}
                  aria-label="Copy share link"
                >
                  {shareLinkCopied ? (
                    <Check className="h-3.5 w-3.5 text-[var(--state-success)]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  )}
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                disabled={generatingToken}
                onClick={handleGenerateShareLink}
                className="w-full gap-2 border border-dashed border-[var(--border-subtle)] text-xs text-[var(--text-muted)] hover:border-[var(--accent-ai)]/40 hover:text-[var(--accent-ai)]"
              >
                {generatingToken ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                Generate share link
              </Button>
            )}
          </div>
        )}

        {/* Copy collaborator link */}
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2">
          <span className="flex-1 truncate text-xs text-[var(--text-muted)]">
            {typeof window !== "undefined"
              ? `${window.location.origin}/${projectId}`
              : `/${projectId}`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            onClick={handleCopyLink}
            aria-label="Copy project link"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[var(--state-success)]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
