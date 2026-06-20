"use client";

import { useSyncExternalStore } from "react";
import { subscribeTasks, getTasksSnapshot, getTask, type Task } from "@/lib/tasks";

/** Danh sách tác vụ nền (live). */
export function useTasks(): Task[] {
  return useSyncExternalStore(subscribeTasks, getTasksSnapshot, getTasksSnapshot);
}

/** Một tác vụ theo id (live), undefined nếu không tồn tại. */
export function useTask(id: string | null | undefined): Task | undefined {
  return useSyncExternalStore(
    subscribeTasks,
    () => (id ? getTask(id) : undefined),
    () => undefined
  );
}
