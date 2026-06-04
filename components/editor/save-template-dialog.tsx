"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Globe, Lock } from "lucide-react";
import type { SpiSchema } from "@/lib/export";

const CATEGORIES = ["web", "data", "infra", "mobile", "custom"] as const;

interface SaveTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  schema: SpiSchema;
  onSaved?: () => void;
}

export function SaveTemplateDialog({ open, onClose, schema, onSaved }: SaveTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("custom");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, category, isPublic, schema }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save template");
      }
      onSaved?.();
      onClose();
      setName("");
      setDescription("");
      setCategory("custom");
      setIsPublic(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm bg-[var(--bg-surface)] border-[var(--border-default)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">Save as template</DialogTitle>
          <DialogDescription className="text-[var(--text-secondary)]">
            {schema.nodes.length} component{schema.nodes.length !== 1 ? "s" : ""} ·{" "}
            {schema.edges.length} connection{schema.edges.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="tmpl-name" className="text-xs text-[var(--text-secondary)]">
              Template name *
            </Label>
            <Input
              id="tmpl-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="E-Commerce Microservices"
              maxLength={80}
              className="mt-1 bg-[var(--bg-base)] border-[var(--border-default)] text-[var(--text-primary)]"
            />
          </div>

          <div>
            <Label htmlFor="tmpl-desc" className="text-xs text-[var(--text-secondary)]">
              Description
            </Label>
            <Input
              id="tmpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              maxLength={200}
              className="mt-1 bg-[var(--bg-base)] border-[var(--border-default)] text-[var(--text-primary)]"
            />
          </div>

          <div>
            <Label className="text-xs text-[var(--text-secondary)]">Category</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                    category === c
                      ? "bg-[var(--accent-primary)] text-white"
                      : "bg-[var(--bg-surface-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-[var(--text-secondary)]">Visibility</Label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  !isPublic
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                    : "border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <Lock className="h-3 w-3" />
                Private
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                  isPublic
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                    : "border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <Globe className="h-3 w-3" />
                Public
              </button>
            </div>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
              {isPublic
                ? "Anyone can use this template from the template picker."
                : "Only you can see and use this template."}
            </p>
          </div>

          {error && (
            <p className="text-xs text-[var(--state-error)]">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
