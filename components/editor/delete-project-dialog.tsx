"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";
interface DeleteProjectDialogProps {
  open: boolean;
  project: { id: string; name: string } | null;
  onClose: () => void;
  onDelete: (id: string) => void | Promise<void>;
}

export function DeleteProjectDialog({
  open,
  project,
  onClose,
  onDelete,
}: DeleteProjectDialogProps) {
  function handleDelete() {
    if (!project) return;
    onDelete(project.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--state-error)]/10">
            <TriangleAlert className="h-5 w-5 text-[var(--state-error)]" />
          </div>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>
            This will permanently delete{" "}
            <strong>{project?.name}</strong> and all its data. This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
          >
            Delete Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
