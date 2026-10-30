import React, { useState, useEffect, useRef } from 'react';
import { Avatar } from '../ui/avatar';
import { cn } from '../../lib/utils';
import {
  SearchIcon,
  XIcon,
  CheckIcon,
  ChevronDownIcon,
} from '../ui/icons';

/**
 * BefUI Multi-Assignee Selector
 * Allows selecting multiple team members for a single task with search, avatar badges, and checkbox indicators.
 */
export function FormMultiAssigneeSelect({
  users = [],
  selectedIds = [],
  onChange,
  error,
  required = false,
  label = 'Assign',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getUserLabel = (u) => {
    if (!u) return '';
    const roleLower = String(u.role || '').toLowerCase();
    const isOwner = roleLower === 'owner' || roleLower === 'admin' || (u.name && u.name.toLowerCase().includes('rohit'));
    return isOwner ? `${u.name} (Admin)` : u.name;
  };

  const toggleUser = (userId) => {
    const strId = String(userId);
    if (selectedIds.includes(strId)) {
      onChange(selectedIds.filter((id) => id !== strId));
    } else {
      onChange([...selectedIds, strId]);
    }
  };

  const selectedUsers = users.filter((u) => selectedIds.includes(String(u.id)));

  const filteredUsers = users.filter((u) => {
    const text = getUserLabel(u).toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div ref={ref} className="relative space-y-1.5">
      <label className="block text-xs font-medium text-foreground">
        {label} {required && <span className="text-destructive font-bold">*</span>}{' '}
        <span className="text-muted-foreground text-[11px] font-normal">(Multiple Allowed)</span>
      </label>

      {/* Trigger Box */}
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'w-full min-h-[38px] rounded-lg border bg-background px-3 py-1.5 text-xs flex items-center justify-between text-left transition-colors cursor-pointer',
          error
            ? 'border-destructive ring-1 ring-destructive'
            : 'border-border hover:border-muted-foreground/40 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20'
        )}
      >
        <div className="flex items-center gap-1.5 flex-wrap flex-1 mr-2">
          {selectedUsers.length === 0 ? (
            <span className="text-muted-foreground">Select one or more assignees...</span>
          ) : (
            selectedUsers.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium border border-border"
              >
                <Avatar name={u.name} size="xs" />
                <span>{getUserLabel(u)}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleUser(u.id);
                  }}
                  className="text-muted-foreground hover:text-foreground ml-0.5 cursor-pointer"
                  title="Remove"
                >
                  <XIcon className="size-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDownIcon
          className={cn('size-3.5 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-180')}
        />
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border bg-card text-card-foreground shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-1.5 border-b border-border bg-muted/30">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-background rounded-md border border-border">
              <SearchIcon className="size-3 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff to assign..."
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-[190px] overflow-y-auto scrollbar-thin p-1 space-y-0.5">
            {filteredUsers.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground italic text-center">
                No matching personnel
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedIds.includes(String(u.id));
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors',
                      isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} size="xs" />
                      <span>{getUserLabel(u)}</span>
                    </div>
                    <div
                      className={cn(
                        'size-4 rounded border flex items-center justify-center transition-colors',
                        isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                      )}
                    >
                      {isSelected && <CheckIcon className="size-3 stroke-[2.5]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="p-2 border-t border-border bg-muted/20 flex items-center justify-between text-xs">
              <span className="text-[11px] text-muted-foreground font-medium">
                {selectedIds.length} person(s) assigned
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] text-destructive hover:underline font-semibold cursor-pointer"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FormMultiAssigneeSelect;
