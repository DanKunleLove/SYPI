"use client";

import { useState, useCallback } from "react";
import type { Project } from "@/lib/mock-projects";

export type DialogType = "create" | "rename" | "delete" | null;

interface DialogState {
  type: DialogType;
  targetProject: Project | null;
}

export function useProjectDialogs() {
  const [state, setState] = useState<DialogState>({
    type: null,
    targetProject: null,
  });

  const openCreate = useCallback(() => {
    setState({ type: "create", targetProject: null });
  }, []);

  const openRename = useCallback((project: Project) => {
    setState({ type: "rename", targetProject: project });
  }, []);

  const openDelete = useCallback((project: Project) => {
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
