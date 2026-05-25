"use client";

const EVENT_NAME = "spi:open-create-project";

/** Dispatch event to open create project dialog */
export function dispatchCreateProject() {
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/** Listen for create project events */
export function useCreateProjectListener(callback: () => void) {
  if (typeof window === "undefined") return;

  const handler = () => callback();
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
