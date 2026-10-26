import React, { useEffect, useRef, useState } from 'react';
import { UserIcon, UsersIcon, ChevronDownIcon, CheckIcon } from '../ui/icons';

/**
 * Person filter for the DSR: a sleek dropdown menu with checkbox items,
 * allowing single or multiple team member selection.
 *
 * @param {Object} props
 * @param {string} props.me - the signed-in person's name
 * @param {string[]} props.others - every other person's name
 * @param {string[]} props.value - the selected names (never empty)
 * @param {function(string[]): void} props.onChange
 */
export function PersonMenu({ me, others, value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const everyone = [me, ...others];
  const allSelected = everyone.every((n) => value.includes(n));

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = (name) => {
    const next = value.includes(name) ? value.filter((n) => n !== name) : [...value, name];
    onChange(next.length ? next : [me]); // at least one person stays selected
  };

  const toggleEveryone = () => onChange(allSelected ? [me] : everyone);

  let label;
  if (allSelected && everyone.length > 1) label = 'Everyone';
  else if (value.length === 1) label = value[0] === me ? 'Me' : value[0];
  else label = `${value.length} team members`;

  const Item = ({ checked, onClick, children, isMe = false }) => (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onClick}
      className={`group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors cursor-pointer ${
        checked
          ? 'bg-muted/70 text-foreground'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      }`}
    >
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card group-hover:border-border/80'
        }`}
      >
        {checked && <CheckIcon className="size-3 stroke-[2.5]" />}
      </span>
      <span className="flex-1 truncate">{children}</span>
      {isMe && (
        <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
          You
        </span>
      )}
    </button>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Person"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-all hover:border-border/80 hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs cursor-pointer"
      >
        {allSelected || value.length > 1 ? (
          <UsersIcon className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <UserIcon className="size-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDownIcon
          className={`size-3.5 text-muted-foreground transition-transform duration-150 shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-1.5 max-h-80 w-64 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Filter Team Members
          </div>
          <Item checked={value.includes(me)} onClick={() => toggle(me)} isMe>
            {me}
          </Item>
          {others.length > 0 && (
            <Item checked={allSelected} onClick={toggleEveryone}>
              All Team Members
            </Item>
          )}
          {others.length > 0 && <div role="separator" className="my-1.5 h-px bg-border" />}
          {others.map((name) => (
            <Item key={name} checked={value.includes(name)} onClick={() => toggle(name)}>
              {name}
            </Item>
          ))}
        </div>
      )}
    </div>
  );
}

export default PersonMenu;
