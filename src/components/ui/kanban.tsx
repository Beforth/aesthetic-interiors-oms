'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

export interface KanbanColumn {
  id: string;
  title: string;
  tone?: 'default' | 'info' | 'warning' | 'success' | 'danger';
}

const columnToneStyles: Record<string, { topBorder: string; badge: string; dropRing: string }> = {
  default: {
    topBorder: 'border-t-slate-400',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    dropRing: 'ring-slate-400 bg-slate-50/60 dark:bg-slate-900/40',
  },
  info: {
    topBorder: 'border-t-sky-500',
    badge: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
    dropRing: 'ring-sky-400 bg-sky-50/60 dark:bg-sky-950/40',
  },
  warning: {
    topBorder: 'border-t-amber-500',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
    dropRing: 'ring-amber-400 bg-amber-50/60 dark:bg-amber-950/40',
  },
  success: {
    topBorder: 'border-t-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    dropRing: 'ring-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40',
  },
  danger: {
    topBorder: 'border-t-rose-500',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
    dropRing: 'ring-rose-400 bg-rose-50/60 dark:bg-rose-950/40',
  },
};

export interface KanbanProps<T extends { id: string }> {
  columns: KanbanColumn[];
  value: Record<string, T[]>;
  onChange?: (value: Record<string, T[]>) => void;
  renderCard: (item: T, columnId: string) => React.ReactNode;
  className?: string;
  onCardClick?: (item: T, columnId: string) => void;
  readOnly?: boolean;
  headerActions?: (column: KanbanColumn) => React.ReactNode;
}

export function Kanban<T extends { id: string }>({
  columns,
  value,
  onChange,
  renderCard,
  className,
  onCardClick,
  readOnly = false,
  headerActions,
}: KanbanProps<T>) {
  const [dragOverCol, setDragOverCol] = React.useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);

  const moveCard = React.useCallback(
    (itemId: string, sourceColId: string, targetColId: string) => {
      if (sourceColId === targetColId || !onChange) return;

      const sourceList = [...(value[sourceColId] || [])];
      const targetList = [...(value[targetColId] || [])];

      const itemIndex = sourceList.findIndex((it) => it.id === itemId);
      if (itemIndex === -1) return;

      const [item] = sourceList.splice(itemIndex, 1);
      targetList.push(item!);

      const nextBoard: Record<string, T[]> = {
        ...value,
        [sourceColId]: sourceList,
        [targetColId]: targetList,
      };

      onChange(nextBoard);
    },
    [value, onChange]
  );

  const handleDragStart = (e: React.DragEvent, item: T, sourceColId: string) => {
    if (readOnly) return;
    setDraggedItemId(item.id);
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ itemId: item.id, sourceColId })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    if (readOnly) return;
    e.preventDefault();
    if (dragOverCol !== colId) {
      setDragOverCol(colId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    if (readOnly) return;
    e.preventDefault();
    setDragOverCol(null);
    setDraggedItemId(null);

    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      const { itemId, sourceColId } = JSON.parse(data);
      if (itemId && sourceColId) {
        moveCard(itemId, sourceColId, targetColId);
      }
    } catch (err) {
      console.error('Failed to parse drag drop data', err);
    }
  };

  return (
    <div
      className={cn(
        'grid gap-4 w-full select-none',
        columns.length === 3
          ? 'grid-cols-1 md:grid-cols-3'
          : columns.length === 4
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          : 'grid-cols-1 md:grid-cols-3',
        className
      )}
    >
      {columns.map((col, colIndex) => {
        const items = value[col.id] || [];
        const isTarget = dragOverCol === col.id;
        const toneStyle = columnToneStyles[col.tone || 'default'] || columnToneStyles.default;

        return (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={() => {
              if (dragOverCol === col.id) setDragOverCol(null);
            }}
            onDrop={(e) => handleDrop(e, col.id)}
            className={cn(
              'flex flex-col space-y-3 rounded-2xl p-2 transition-all duration-150',
              isTarget && cn('ring-2 ring-offset-2', toneStyle.dropRing)
            )}
          >
            {/* Column Header */}
            <div
              className={cn(
                'flex items-center justify-between px-3.5 py-2.5 rounded-xl border bg-card shadow-2xs border-t-[3px]',
                toneStyle.topBorder
              )}
            >
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-foreground truncate">
                <span className="truncate">{col.title}</span>
                <span
                  className={cn(
                    'inline-flex items-center justify-center font-mono text-[11px] font-bold px-2 py-0.2 rounded-full shrink-0',
                    toneStyle.badge
                  )}
                >
                  {items.length}
                </span>
              </div>

              {headerActions && headerActions(col)}
            </div>

            {/* Cards List */}
            <div className="flex flex-col space-y-2.5 min-h-[360px] pb-6">
              {items.map((item) => {
                const isBeingDragged = draggedItemId === item.id;

                return (
                  <div
                    key={item.id}
                    draggable={!readOnly}
                    onDragStart={(e) => handleDragStart(e, item, col.id)}
                    onDragEnd={() => {
                      setDraggedItemId(null);
                      setDragOverCol(null);
                    }}
                    onClick={() => onCardClick && onCardClick(item, col.id)}
                    className={cn(
                      'group relative rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-all duration-150 text-left',
                      !readOnly && 'cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-slate-300 dark:hover:border-slate-700',
                      isBeingDragged && 'opacity-40 scale-[0.98]'
                    )}
                  >
                    {renderCard(item, col.id)}

                    {/* Touch / Quick Stage Advance Buttons */}
                    {!readOnly && onChange && columns.length > 1 && (
                      <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {colIndex > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveCard(item.id, col.id, columns[colIndex - 1]!.id);
                            }}
                            title={`Move to ${columns[colIndex - 1]!.title}`}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                          >
                            ‹ {columns[colIndex - 1]!.title}
                          </button>
                        )}
                        {colIndex < columns.length - 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveCard(item.id, col.id, columns[colIndex + 1]!.id);
                            }}
                            title={`Move to ${columns[colIndex + 1]!.title}`}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 cursor-pointer"
                          >
                            {columns[colIndex + 1]!.title} ›
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {items.length === 0 && (
                <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground border-2 border-dashed border-border/80 rounded-xl bg-card/40 min-h-[140px]">
                  No tasks in {col.title}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Kanban;
