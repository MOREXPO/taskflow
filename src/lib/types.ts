export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'IN_REVIEW' | 'TESTING' | 'DOCUMENTING' | 'COMPLETED' | 'BLOCKED';

export type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string | null;
  status: TaskStatus;
  tags: string;
  requester: string | null;
  internalNotes: string | null;
  estimatedMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  comments: { id: string; content: string; createdAt: string }[];
  history: { id: string; fromStatus: TaskStatus | null; toStatus: TaskStatus; note: string | null; createdAt: string }[];
  subtasks: { id: string; title: string; estimatedMinutes: number | null; completed: boolean; timeEntries?: { id: string; date: string; minutes: number; note: string | null }[] }[];
  timeEntries: { id: string; date: string; minutes: number; note: string | null; subtaskId: string | null }[];
};
