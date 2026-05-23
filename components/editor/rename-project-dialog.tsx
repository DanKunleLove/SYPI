"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { slugify, type Project } from "@/lib/mock-projects";

interface RenameProjectDialogProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onRename: (id: string, newName: string) => void | Promise<void>;
}

export function RenameProjectDialog({
  open,
  project,
  onClose,
  onRename,
}: RenameProjectDialogProps) {
  // Use project id as key so form resets when target changes
  const formKey = project?.id ?? "none";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {project && (
          <RenameProjectForm
            key={formKey}
            project={project}
            onClose={onClose}
            onRename={onRename}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameProjectForm({
  project,
  onClose,
  onRename,
}: {
  project: Project;
  onClose: () => void;
  onRename: (id: string, newName: string) => void | Promise<void>;
}) {
  const [name, setName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const slug = slugify(name);
  const canSubmit = name.trim().length > 0 && name.trim() !== project.name;

  function handleSubmit() {
    if (!canSubmit) return;
    onRename(project.id, name.trim());
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rename project</DialogTitle>
        <DialogDescription>
          Rename <strong>{project.name}</strong>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="rename-input">Project name</Label>
        <Input
          ref={inputRef}
          id="rename-input"
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

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          Rename
        </Button>
      </DialogFooter>
    </>
  );
}
