import * as React from 'react';
import { Avatar } from './avatar';
import { Badge } from './badge';
import { Kanban, type KanbanColumn } from './kanban';

interface Task {
  id: string;
  title: string;
  tag: string;
  owner: string;
  due: string;
}

const columns: KanbanColumn[] = [
  { id: 'todo', title: 'To do', tone: 'default' },
  { id: 'doing', title: 'In progress', tone: 'info' },
  { id: 'review', title: 'In review', tone: 'warning' },
  { id: 'done', title: 'Done', tone: 'success' },
];

const tagTone = {
  Bug: 'danger',
  Feature: 'info',
  Chore: 'default',
  Design: 'warning',
} as const;

export default function KanbanDemo() {
  const [board, setBoard] = React.useState<Record<string, Task[]>>({
    todo: [
      { id: 't1', title: 'Onboarding checklist for new hires', tag: 'Feature', owner: 'Isha Nair', due: '14 Oct' },
      { id: 't2', title: 'Fix payslip PDF margins', tag: 'Bug', owner: 'Rohan Das', due: '12 Oct' },
      { id: 't3', title: 'Archive 2023 attendance logs', tag: 'Chore', owner: 'Meera Iyer', due: '30 Oct' },
    ],
    doing: [
      { id: 't4', title: 'Leave balance widget', tag: 'Feature', owner: 'Aarav Mehta', due: '16 Oct' },
      { id: 't5', title: 'Refresh login screen', tag: 'Design', owner: 'Diya Rao', due: '15 Oct' },
    ],
    review: [{ id: 't6', title: 'Holiday calendar import', tag: 'Feature', owner: 'Kabir Shah', due: '11 Oct' }],
    done: [
      { id: 't7', title: 'Dark mode for dashboards', tag: 'Design', owner: 'Diya Rao', due: '03 Oct' },
      { id: 't8', title: 'Duplicate employee IDs', tag: 'Bug', owner: 'Vikram Joshi', due: '05 Oct' },
    ],
  });

  return (
    <Kanban
      columns={columns}
      value={board}
      onChange={setBoard}
      renderCard={(t) => (
        <div className="grid gap-2">
          <p className="font-medium leading-snug">{t.title}</p>
          <div className="flex items-center justify-between gap-2">
            <Badge variant={tagTone[t.tag as keyof typeof tagTone]}>{t.tag}</Badge>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {t.due}
              <Avatar name={t.owner} size="xs" />
            </span>
          </div>
        </div>
      )}
    />
  );
}
