"use client";

import { useState, useCallback } from "react";

export type DialogType = "create" | "rename" | "delete" | null;

/** Minimum shape required by the rename/delete dialogs */
export interface ProjectRef {
  id: string;
  name: string;
}

interface DialogState {
  type: DialogType;
  targetProject: ProjectRef | null;
}

export function useProjectDialogs() {
  const [state, setState] = useState<DialogState>({
    type: null,
    targetProject: null,
  });

  const openCreate = useCallback(() => {
    setState({ type: "create", targetProject: null });
  }, []);

  const openRename = useCallback((project: ProjectRef) => {
    setState({ type: "rename", targetProject: project });
  }, []);

  const openDelete = useCallback((project: ProjectRef) => {
    setState({ type: "delete", targetProject: project });
  }, []);

  const close = useCallback(() => {
    setState({ type: null, targetProject: null });
  }, []);

  return {
    dialogType: state.type,
    targetProject: state.targetProject,
    isOpen: state.type !== null,
    openCreate,
    openRename,
    openDelete,
    close,
  };
}
