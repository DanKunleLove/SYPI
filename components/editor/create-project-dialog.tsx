"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { slugify, TEMPLATES, type TemplateId } from "@/lib/mock-projects";
import {
  FileText,
  Boxes,
  Cloud,
  Zap,
  Globe,
} from "lucide-react";

const TEMPLATE_ICONS: Record<string, typeof FileText> = {
  FileText,
  Boxes,
  Cloud,
  Zap,
  Globe,
};

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; description: string; template: TemplateId }) => void | Promise<void>;
}

export function CreateProjectDialog({
  open,
  onClose,
  onCreate,
}: CreateProjectDialogProps) {
  // Key resets form state each time dialog opens
  const [formKey, setFormKey] = useState(0);

  const handleClose = useCallback(() => {
    onClose();
    setFormKey((k) => k + 1);
  }, [onClose]);

  const handleCreate = useCallback(
    (data: { name: string; description: string; template: TemplateId }) => {
      onCreate(data);
      handleClose();
    },
    [onCreate, handleClose]
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <CreateProjectForm key={formKey} onCreate={handleCreate} onClose={handleClose} />
      </DialogContent>
    </Dialog>
  );
}

function CreateProjectForm({
  onCreate,
  onClose,
}: {
  onCreate: (data: { name: string; description: string; template: TemplateId }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("blank");
  const inputRef = useRef<HTMLInputElement>(null);

  const slug = slugify(name);
  const canSubmit = name.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onCreate({
      name: name.trim(),
      description: description.trim(),
      template: selectedTemplate,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create new project</DialogTitle>
        <DialogDescription>
          Set up a new architecture workspace.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* Name input */}
        <div className="space-y-2">
          <Label htmlFor="project-name">Project name</Label>
          <Input
            ref={inputRef}
            id="project-name"
            placeholder="My Awesome System"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            autoFocus
          />
          {name.trim() && (
            <p className="text-xs text-[var(--text-muted)]">
              <span className="text-[var(--text-secondary)]">Slug:</span>{" "}
              <code className="rounded bg-[var(--bg-surface-raised)] px-1.5 py-0.5 font-mono">
                {slug || "..."}
              </code>
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="project-description">
            Description{" "}
            <span className="text-[var(--text-muted)]">(optional)</span>
          </Label>
          <Textarea
            id="project-description"
            placeholder="Brief description of your system..."
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="resize-none"
          />
        </div>

        {/* Template picker */}
        <div className="space-y-2">
          <Label>Start from</Label>
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map((tmpl) => {
              const Icon = TEMPLATE_ICONS[tmpl.icon];
              const isSelected = selectedTemplate === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tmpl.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs transition-colors",
                    isSelected
                      ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                      : "border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tmpl.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          Create Project
        </Button>
      </DialogFooter>
    </>
  );
}
