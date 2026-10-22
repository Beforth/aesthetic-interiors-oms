'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { PanelLeftIcon, ChevronDownIcon, ChevronRightIcon } from './icons';

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebar: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(undefined);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

export interface SidebarProviderProps {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
}

export function SidebarProvider({
  children,
  defaultCollapsed = false,
  className,
}: SidebarProviderProps) {
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultCollapsed;
    try {
      const saved = localStorage.getItem('ae_sidebar_collapsed');
      return saved !== null ? saved === 'true' : defaultCollapsed;
    } catch {
      return defaultCollapsed;
    }
  });

  const [openMobile, setOpenMobile] = React.useState<boolean>(false);
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
  });

  // Track responsive screen size (< 1024px is mobile / tablet)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 1023px)');
    const updateMatch = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      if (!e.matches) {
        setOpenMobile(false);
      }
    };
    updateMatch(media);

    const listener = (e: MediaQueryListEvent) => updateMatch(e);
    if (media.addEventListener) {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    } else {
      media.addListener(listener);
      return () => media.removeListener(listener);
    }
  }, []);

  // Persist desktop collapsed preference
  React.useEffect(() => {
    try {
      localStorage.setItem('ae_sidebar_collapsed', String(collapsed));
    } catch {
      // Ignore localStorage errors
    }
  }, [collapsed]);

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((prev) => !prev);
    } else {
      setCollapsed((prev) => !prev);
    }
  }, [isMobile]);

  // Close mobile drawer on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openMobile) {
        setOpenMobile(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openMobile]);

  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        setCollapsed,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }}
    >
      <div className={cn('flex min-h-full w-full', className)}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
}

export function Sidebar({ className, children, ...props }: SidebarProps) {
  const { collapsed, isMobile, openMobile, setOpenMobile } = useSidebar();

  // Mobile Slide-over Drawer
  if (isMobile) {
    return (
      <>
        {/* Backdrop overlay */}
        {openMobile && (
          <div
            tabIndex={-1}
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200 animate-fadeIn"
            onClick={() => setOpenMobile(false)}
          />
        )}

        {/* Slide-over panel */}
        <aside
          role="dialog"
          aria-modal="true"
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex flex-col w-72 max-w-[85vw] bg-card border-r border-border shadow-2xl transition-transform duration-300 ease-in-out',
            openMobile ? 'translate-x-0' : '-translate-x-full',
            className
          )}
          {...props}
        >
          {children}
        </aside>
      </>
    );
  }

  // Desktop Rail / Collapsible Sidebar
  return (
    <aside
      className={cn(
        'relative flex flex-col h-full shrink-0 border-r border-border bg-card transition-[width] duration-300 ease-in-out select-none',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export interface SidebarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function SidebarHeader({ className, children, ...props }: SidebarHeaderProps) {
  const { collapsed, isMobile } = useSidebar();
  const isCollapsed = !isMobile && collapsed;

  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center gap-3 border-b border-border transition-all duration-200',
        isCollapsed ? 'justify-center px-2' : 'px-4',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SidebarContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function SidebarContent({ className, children, ...props }: SidebarContentProps) {
  const { collapsed, isMobile } = useSidebar();
  const isCollapsed = !isMobile && collapsed;

  return (
    <div
      className={cn(
        'flex flex-1 flex-col overflow-y-auto overflow-x-hidden py-3 space-y-4',
        isCollapsed ? 'px-2' : 'px-3',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SidebarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  children?: React.ReactNode;
}

export function SidebarGroup({ label, className, children, ...props }: SidebarGroupProps) {
  const { collapsed, isMobile } = useSidebar();
  const isCollapsed = !isMobile && collapsed;

  return (
    <div className={cn('flex flex-col gap-1', className)} {...props}>
      {label && !isCollapsed && (
        <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </div>
      )}
      {label && isCollapsed && (
        <div className="my-1.5 h-px bg-border/60 mx-1" title={label} />
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export interface SidebarSubItem {
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: string | number;
}

export interface SidebarItemProps {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: string | number;
  onClick?: () => void;
  items?: SidebarSubItem[];
  className?: string;
}

export function SidebarItem({
  icon,
  label,
  active = false,
  badge,
  onClick,
  items,
  className,
}: SidebarItemProps) {
  const { collapsed, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = !isMobile && collapsed;

  const hasSubItems = items && items.length > 0;
  const isAnySubActive = hasSubItems && items.some((it) => it.active);

  // Auto-expand submenu if any sub-item is active
  const [expanded, setExpanded] = React.useState<boolean>(() => Boolean(active || isAnySubActive));

  React.useEffect(() => {
    if (active || isAnySubActive) {
      setExpanded(true);
    }
  }, [active, isAnySubActive]);

  const handleClick = (e: React.MouseEvent) => {
    if (hasSubItems) {
      e.preventDefault();
      setExpanded((prev) => !prev);
      if (onClick) onClick();
    } else {
      if (onClick) onClick();
      if (isMobile) setOpenMobile(false);
    }
  };

  const isCurrentActive = active || (!isCollapsed && isAnySubActive && !expanded);

  return (
    <div className="relative group/sidebar-item flex flex-col">
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        className={cn(
          'group flex w-full items-center gap-3 rounded-lg text-sm font-medium transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isCollapsed ? 'h-10 justify-center px-0' : 'min-h-[38px] px-2.5 py-2',
          isCurrentActive
            ? 'bg-primary/10 text-primary font-semibold'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          className
        )}
      >
        {/* Icon */}
        {icon && (
          <span
            className={cn(
              'shrink-0 text-base transition-colors flex items-center justify-center',
              isCurrentActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
              isCollapsed ? 'size-5' : 'size-4'
            )}
          >
            {icon}
          </span>
        )}

        {/* Text Label */}
        {!isCollapsed && (
          <span className="truncate flex-1 text-left">{label}</span>
        )}

        {/* Badge */}
        {!isCollapsed && badge !== undefined && (
          <span className="ml-auto inline-flex items-center justify-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
            {badge}
          </span>
        )}

        {/* Sub-item Expand Chevron */}
        {!isCollapsed && hasSubItems && (
          <span className="ml-auto text-muted-foreground transition-transform duration-200">
            {expanded ? (
              <ChevronDownIcon className="size-3.5" />
            ) : (
              <ChevronRightIcon className="size-3.5" />
            )}
          </span>
        )}
      </button>

      {/* Hover Tooltip when Collapsed on Desktop */}
      {isCollapsed && (
        <div
          role="tooltip"
          className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 z-50 hidden rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-lg whitespace-nowrap group-hover/sidebar-item:block animate-fadeIn"
        >
          {label}
          {badge !== undefined && (
            <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.2 text-[9px] font-bold text-white">
              {badge}
            </span>
          )}
        </div>
      )}

      {/* Accordion Submenu Items (Expanded Mode) */}
      {!isCollapsed && hasSubItems && expanded && (
        <div className="ml-6 mt-1 flex flex-col gap-0.5 border-l border-border/70 pl-2">
          {items.map((subItem, index) => (
            <button
              key={`${subItem.label}-${index}`}
              type="button"
              onClick={() => {
                if (subItem.onClick) subItem.onClick();
                if (isMobile) setOpenMobile(false);
              }}
              className={cn(
                'flex items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors text-left select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary',
                subItem.active
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className="truncate">{subItem.label}</span>
              {subItem.badge !== undefined && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary/15 px-1.5 py-0.2 text-[9px] font-bold text-primary">
                  {subItem.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface SidebarFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function SidebarFooter({ className, children, ...props }: SidebarFooterProps) {
  const { collapsed, isMobile } = useSidebar();
  const isCollapsed = !isMobile && collapsed;

  return (
    <div
      className={cn(
        'mt-auto shrink-0 border-t border-border flex flex-col gap-1',
        isCollapsed ? 'p-2 items-center' : 'p-3',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SidebarTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
}

export function SidebarTrigger({ className, icon, onClick, children, ...props }: SidebarTriggerProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      onClick={(e) => {
        if (onClick) onClick(e);
        toggleSidebar();
      }}
      aria-label="Toggle sidebar"
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-2xs transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer',
        className
      )}
      {...props}
    >
      {children || icon || <PanelLeftIcon className="size-4" />}
    </button>
  );
}
