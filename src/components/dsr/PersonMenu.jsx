import React, { useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon';

/**
 * Person filter for the DSR: a small dropdown menu with checkbox items, so one or many people can be picked.
 * "Me" is the signed-in person, "Everyone" ticks every name, and the rest are the other people A to Z.
 * The menu stays open while ticking, and closes on an outside click or Esc.
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
  else label = `${value.length} people`;

  const Item = ({ checked, onClick, children }) => (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onClick}
      className="relative flex w-full items-center rounded-md py-2 pl-8 pr-3 text-left text-[13px] text-text-main hover:bg-brand-50 focus:bg-brand-50 focus:outline-none"
    >
      <span className="absolute left-2.5 grid h-4 w-4 place-items-center text-brand-600">
        {checked && <Icon name="check" size={14} />}
      </span>
      {children}
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
        className="flex w-full min-h-[44px] sm:min-h-[38px] items-center gap-2 rounded border border-border bg-surface px-3 text-sm text-text-main transition-colors hover:bg-brand-50 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      >
        <Icon name="user" size={16} className="text-text-muted" />
        <span className="flex-1 truncate text-left">{label}</span>
        <Icon name="chevron-down" size={16} className="text-text-muted" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-1.5 max-h-80 w-64 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          <Item checked={value.includes(me)} onClick={() => toggle(me)}>
            Me
          </Item>
          <Item checked={allSelected} onClick={toggleEveryone}>
            Everyone
          </Item>
          {others.length > 0 && <div role="separator" className="my-1 h-px bg-border" />}
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
