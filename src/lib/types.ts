export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'IN_REVIEW' | 'TESTING' | 'COMPLETED' | 'BLOCKED';

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
  createdAt: string;
  updatedAt: string;
  comments: { id: string; content: string; createdAt: string }[];
  history: { id: string; fromStatus: TaskStatus | null; toStatus: TaskStatus; note: string | null; createdAt: string }[];
};
