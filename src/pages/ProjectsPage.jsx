import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { clientService } from '../services/clientService';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';
import { ROLES, ROLE_LABELS } from '../config/roles';
import { cn } from '../lib/utils';
import { validateRequired, validatePositiveNumber } from '../utils/validators';

import PageHeader from '../components/ui/PageHeader';
import DataToolbar from '../components/ui/DataToolbar';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import Icon from '../components/ui/Icon';
import ProjectCard from '../components/domain/ProjectCard';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import EmptyState from '../components/ui/EmptyState';
import AssigneePicker from '../components/domain/AssigneePicker';
import PermissionGate from '../components/ui/PermissionGate';
import { Kanban } from '../components/ui/kanban';
import { Avatar } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import {
  ArrowRightIcon,
  CheckIcon,
  CalendarIcon,
  AlertIcon,
  BuildingIcon,
  ChevronDownIcon,
  SearchIcon,
  XIcon,
} from '../components/ui/icons';

// 12 SRS Interior Fit-Out Stages in strict sequential order
const SITE_STAGE_COLUMNS = [
  { id: 'cleaning', title: '1. Cleaning', tone: 'default' },
  { id: 'ceiling', title: '2. Ceiling', tone: 'info' },
  { id: 'carpenter', title: '3. Carpenter', tone: 'warning' },
  { id: 'tiles', title: '4. Tiles', tone: 'info' },
  { id: 'plumbing', title: '5. Plumbing', tone: 'info' },
  { id: 'electrical', title: '6. Electrical', tone: 'warning' },
  { id: 'glass agencies', title: '7. Glass Agencies', tone: 'info' },
  { id: 'finishing', title: '8. Finishing (Wallpaper & Soft)', tone: 'info' },
  { id: 'fabrication', title: '9. Fabrication', tone: 'warning' },
  { id: 'civil work', title: '10. Civil Work', tone: 'info' },
  { id: 'artistic work', title: '11. Artistic Work', tone: 'warning' },
  { id: 'painter', title: '12. Painter', tone: 'success' },
];

function normalizeStageId(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('clean')) return 'cleaning';
  if (n.includes('ceil')) return 'ceiling';
  if (n.includes('carp')) return 'carpenter';
  if (n.includes('tile')) return 'tiles';
  if (n.includes('plumb')) return 'plumbing';
  if (n.includes('elect')) return 'electrical';
  if (n.includes('glass')) return 'glass agencies';
  if (n.includes('finish') || n.includes('wallp') || n.includes('curtain')) return 'finishing';
  if (n.includes('fabr')) return 'fabrication';
  if (n.includes('civil')) return 'civil work';
  if (n.includes('artist')) return 'artistic work';
  if (n.includes('paint')) return 'painter';
  return 'cleaning';
}

function getProjectActiveStageId(project) {
  if (!project.stages || project.stages.length === 0) {
    return 'cleaning';
  }
  const inProgressStage = project.stages.find((s) => s.status === 'in progress');
  if (inProgressStage) {
    return normalizeStageId(inProgressStage.name);
  }
  const allDone = project.stages.every((s) => s.status === 'done' || s.status === 'completed');
  if (allDone || project.status === 'completed' || project.status === 'handed over') {
    return 'painter';
  }
  const nextStage = project.stages.find((s) => s.status !== 'done' && s.status !== 'completed');
  if (nextStage) {
    return normalizeStageId(nextStage.name);
  }
  return 'cleaning';
}

function isStageOverdue(stage) {
  if (!stage || !stage.endDate) return false;
  const status = (stage.status || '').toLowerCase();
  if (status === 'done' || status === 'completed' || status === 'handed over') {
    return false;
  }
  const end = new Date(stage.endDate + 'T23:59:59');
  if (isNaN(end.getTime())) return false;
  const today = new Date();
  return end < today;
}

function getOverdueDays(stage) {
  if (!stage || !stage.endDate) return 0;
  const end = new Date(stage.endDate + 'T23:59:59');
  if (isNaN(end.getTime())) return 0;
  const today = new Date();
  const diffTime = today - end;
  return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * BefUI Stage Transition Popover Menu.
 * Solid pure white surface matching the cards, with high-contrast, clear dark text.
 */
function StageNavigationDropdown({ currentStageId, onSelectStage }) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 272;
    const menuHeight = 370;

    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < menuHeight && rect.top > menuHeight;

    const top = placeAbove
      ? Math.max(8, rect.top - menuHeight - 6)
      : Math.min(window.innerHeight - menuHeight - 8, rect.bottom + 6);

    let left = rect.right - menuWidth;
    if (left < 12) left = 12;
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }

    setCoords({ top, left });
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    function handleScrollOrResize() {
      updatePosition();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        title="Move site to another stage"
        onClick={handleToggle}
        className={cn(
          'size-6 rounded-md flex items-center justify-center cursor-pointer select-none bg-white border border-border text-text-main shadow-2xs hover:bg-slate-100',
          isOpen && 'bg-primary text-white border-primary shadow-xs'
        )}
      >
        <ArrowRightIcon className="size-3.5" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: '272px',
              zIndex: 99999,
              backgroundColor: '#ffffff',
            }}
            className="rounded-xl border border-border bg-white text-text-main shadow-xl overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Header: Pure light surface with clear dark text */}
            <div
              style={{ backgroundColor: '#f8fafc' }}
              className="px-3.5 py-2.5 bg-slate-50 border-b border-border flex items-center justify-between"
            >
              <span className="text-[11px] font-bold text-text-main uppercase tracking-wider">
                Move to Site Stage
              </span>
              <span
                style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                className="text-[10px] font-bold text-text-main bg-white px-2 py-0.5 rounded-full border border-border shrink-0"
              >
                12 Stages
              </span>
            </div>

            {/* List of 12 stages with pure white background and clear text */}
            <div
              style={{
                backgroundColor: '#ffffff',
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 transparent',
              }}
              className="p-1.5 max-h-64 overflow-y-auto space-y-0.5 bg-white"
            >
              {SITE_STAGE_COLUMNS.map((col, idx) => {
                const isCurrent = col.id === currentStageId;
                const stageNum = String(idx + 1).padStart(2, '0');
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      if (!isCurrent) {
                        onSelectStage(col.id);
                      }
                    }}
                    style={{ backgroundColor: isCurrent ? '#eef2ff' : '#ffffff' }}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold text-left cursor-pointer transition-colors',
                      isCurrent
                        ? 'bg-primary/10 text-primary font-bold border-l-2 border-primary rounded-l-none'
                        : 'text-text-main hover:bg-slate-100'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          'font-mono text-[10px] w-4.5 shrink-0 font-bold',
                          isCurrent ? 'text-primary' : 'text-text-muted'
                        )}
                      >
                        {stageNum}
                      </span>
                      <span
                        className={cn(
                          'truncate font-semibold',
                          isCurrent ? 'text-primary' : 'text-text-main'
                        )}
                      >
                        {col.title.replace(/^\d+\.\s*/, '')}
                      </span>
                    </div>

                    {isCurrent ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-md shrink-0">
                        <CheckIcon className="size-3" strokeWidth={2.5} />
                        <span>Current</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-text-muted shrink-0">
                        →
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div
              style={{ backgroundColor: '#f8fafc' }}
              className="px-3 py-1.5 bg-slate-50 border-t border-border flex items-center justify-between text-[10px] font-medium text-text-muted"
            >
              <span>Click any stage to move</span>
              <span className="font-mono text-[9px]">Esc to close</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * Manager Modal to assign and update stage start & end dates (schedule)
 */
function ScheduleStageModal({ isOpen, onClose, data, onSave }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('not started');

  useEffect(() => {
    if (data?.stage) {
      setStartDate(data.stage.startDate || '');
      setEndDate(data.stage.endDate || '');
      setStatus(data.stage.status || 'not started');
    }
  }, [data]);

  if (!isOpen || !data) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      projectId: data.projectId,
      stageId: data.stage.id,
      stageName: data.stage.name,
      startDate,
      endDate,
      status,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Stage Schedule"
      subtitle={`${data.projectName} • ${data.stage.name || 'Site Stage'}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit}>
            Save Schedule
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-1">
        <div className="p-2.5 rounded-lg bg-slate-50 border border-border text-xs space-y-1">
          <div className="font-bold text-text-main flex items-center justify-between">
            <span className="truncate max-w-[200px]">{data.projectName}</span>
            <span className="font-mono text-[10px] text-text-muted uppercase">{data.projectId}</span>
          </div>
          <div className="text-text-muted font-medium">
            Stage: <span className="font-bold text-text-main">{data.stage.name}</span>
          </div>
        </div>

        <Input
          label="Stage Start Date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />

        <Input
          label="Stage Due Date (End Date)"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
        />

        <div>
          <label className="text-xs font-bold text-text-main flex items-center gap-1 mb-1.5">
            Stage Execution Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-text-main shadow-2xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="not started" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>Not Started / Planning</option>
            <option value="in progress" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>In Progress (Active Trade)</option>
            <option value="done" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>Completed & Handed Over</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}

function StageDotBadge() {
  return null;
}

/**
 * BefUI Searchable Project Filter Dropdown Combobox.
 * Lets users view all projects and type the project name to filter in real time.
 */
function ProjectFilterSearchDropdown({
  selectedProjectId,
  onSelectProject,
  projects = [],
  workingProjects = [],
  otherProjects = [],
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = 310;
    const height = 360;

    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < height && rect.top > height;

    const top = placeAbove
      ? Math.max(8, rect.top - height - 4)
      : Math.min(window.innerHeight - height - 8, rect.bottom + 4);

    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }

    setCoords({ top, left });
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!isOpen) {
      updatePosition();
      setQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }

    function handleScrollOrResize() {
      updatePosition();
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  const selectedLabel = useMemo(() => {
    if (selectedProjectId === 'ALL') return 'All Projects Progress';
    if (selectedProjectId === 'NONE') return 'No Project';
    const found = projects.find((p) => p.id === selectedProjectId);
    return found ? `${found.id} · ${found.name}` : 'Select Project';
  }, [selectedProjectId, projects]);

  const q = query.trim().toLowerCase();
  const matchesAll = q === '' || 'all projects progress'.includes(q) || 'all'.includes(q);
  const matchesNone = q === '' || 'no project'.includes(q) || 'none'.includes(q);

  const filteredWorking = useMemo(() => {
    if (!q) return workingProjects;
    return workingProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.clientName && p.clientName.toLowerCase().includes(q)) ||
        (p.siteAddress && p.siteAddress.toLowerCase().includes(q))
    );
  }, [workingProjects, q]);

  const filteredOther = useMemo(() => {
    if (!q) return otherProjects;
    return otherProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.clientName && p.clientName.toLowerCase().includes(q)) ||
        (p.siteAddress && p.siteAddress.toLowerCase().includes(q))
    );
  }, [otherProjects, q]);

  const hasAnyMatch = matchesAll || matchesNone || filteredWorking.length > 0 || filteredOther.length > 0;

  const handleSelect = (id) => {
    onSelectProject(id);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          'h-8 rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-bold text-[#0f172a] shadow-xs flex items-center justify-between gap-2 cursor-pointer transition-all hover:border-muted-foreground/40 max-w-[280px]',
          isOpen && 'border-primary ring-2 ring-primary/20'
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <BuildingIcon className="size-3.5 text-text-muted shrink-0" />
          <span className="text-text-muted font-medium shrink-0">Project:</span>
          <span className="truncate font-bold text-text-main">{selectedLabel}</span>
        </div>
        <ChevronDownIcon
          className={cn(
            'size-3.5 text-text-muted shrink-0 transition-transform duration-150',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: '310px',
              zIndex: 99999,
              backgroundColor: '#ffffff',
            }}
            className="rounded-xl border border-border bg-white text-text-main shadow-2xl overflow-hidden select-none animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-2 border-b border-border bg-slate-50/70">
              <div className="relative flex items-center">
                <SearchIcon className="size-3.5 text-text-muted absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type project name to filter..."
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-border bg-white text-xs font-semibold text-text-main placeholder:text-text-muted/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 text-text-muted hover:text-text-main p-0.5"
                  >
                    <XIcon className="size-3" />
                  </button>
                )}
              </div>
            </div>

            <div
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 transparent',
              }}
              className="p-1.5 max-h-64 overflow-y-auto space-y-0.5 bg-white text-xs"
            >
              {matchesAll && (
                <button
                  type="button"
                  onClick={() => handleSelect('ALL')}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold text-left cursor-pointer transition-colors',
                    selectedProjectId === 'ALL'
                      ? 'bg-primary/10 text-primary font-bold border-l-2 border-primary rounded-l-none'
                      : 'text-text-main hover:bg-slate-100'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-bold text-text-main border border-border shrink-0">
                      ALL
                    </span>
                    <span className="font-bold truncate">All Projects Progress</span>
                  </div>
                  {selectedProjectId === 'ALL' && <CheckIcon className="size-3.5 text-primary stroke-[2.5]" />}
                </button>
              )}

              {matchesNone && (
                <button
                  type="button"
                  onClick={() => handleSelect('NONE')}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold text-left cursor-pointer transition-colors',
                    selectedProjectId === 'NONE'
                      ? 'bg-primary/10 text-primary font-bold border-l-2 border-primary rounded-l-none'
                      : 'text-text-main hover:bg-slate-100'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 font-bold text-text-main border border-border shrink-0">
                      NONE
                    </span>
                    <span className="font-bold truncate">No Project</span>
                  </div>
                  {selectedProjectId === 'NONE' && <CheckIcon className="size-3.5 text-primary stroke-[2.5]" />}
                </button>
              )}

              {filteredWorking.length > 0 && (
                <>
                  <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center justify-between">
                    <span>Active Working Projects</span>
                    <span className="text-[9px] bg-slate-100 px-1.5 py-0.2 rounded-full border border-border font-mono">
                      {filteredWorking.length}
                    </span>
                  </div>

                  {filteredWorking.map((p) => {
                    const isSelected = selectedProjectId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelect(p.id)}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-primary/10 text-primary font-bold border-l-2 border-primary rounded-l-none'
                            : 'text-text-main hover:bg-slate-100'
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-bold text-text-main border border-border shrink-0">
                              {p.id}
                            </span>
                            <span className="font-bold truncate">{p.name}</span>
                          </div>
                          {p.clientName && (
                            <p className="text-[10px] text-text-muted truncate mt-0.5">
                              Client: {p.clientName}
                            </p>
                          )}
                        </div>
                        {isSelected && <CheckIcon className="size-3.5 text-primary stroke-[2.5] shrink-0" />}
                      </button>
                    );
                  })}
                </>
              )}

              {filteredOther.length > 0 && (
                <>
                  <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center justify-between">
                    <span>Other Projects</span>
                    <span className="text-[9px] bg-slate-100 px-1.5 py-0.2 rounded-full border border-border font-mono">
                      {filteredOther.length}
                    </span>
                  </div>

                  {filteredOther.map((p) => {
                    const isSelected = selectedProjectId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelect(p.id)}
                        className={cn(
                          'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-left cursor-pointer transition-colors',
                          isSelected
                            ? 'bg-primary/10 text-primary font-bold border-l-2 border-primary rounded-l-none'
                            : 'text-text-main hover:bg-slate-100'
                        )}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 font-bold text-text-main border border-border shrink-0">
                              {p.id}
                            </span>
                            <span className="font-semibold truncate">{p.name}</span>
                          </div>
                          <p className="text-[10px] text-text-muted truncate mt-0.5">
                            Status: {p.status}
                          </p>
                        </div>
                        {isSelected && <CheckIcon className="size-3.5 text-primary stroke-[2.5] shrink-0" />}
                      </button>
                    );
                  })}
                </>
              )}

              {!hasAnyMatch && (
                <div className="py-6 text-center text-xs text-text-muted">
                  <p className="font-semibold text-text-main">No projects found</p>
                  <p className="text-[11px] mt-0.5 text-text-muted">No projects match &ldquo;{query}&rdquo;</p>
                </div>
              )}
            </div>

            <div className="px-3 py-1.5 border-t border-border bg-slate-50 text-[10px] font-medium text-text-muted flex items-center justify-between">
              <span>Type to search projects</span>
              <span>Esc to close</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * Modal to confirm moving/upgrading a project from one site stage to another.
 * Requires authorized personnel confirmation before executing the transition.
 */
function ConfirmStageUpgradeModal({ isOpen, onClose, data, onConfirm }) {
  if (!data) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Stage Upgrade"
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            Confirm Upgrade
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1 text-xs">
        <p className="text-text-main text-sm">
          Do you want to upgrade the active site stage for{' '}
          <span className="font-bold text-text-main">{data.projectName}</span>?
        </p>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-border">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase font-bold text-text-muted block mb-0.5">Current Stage</span>
            <span className="font-semibold text-text-main truncate block">{data.fromStage}</span>
          </div>
          <ArrowRightIcon className="size-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase font-bold text-primary block mb-0.5">Target Stage</span>
            <span className="font-bold text-primary truncate block">{data.toStage}</span>
          </div>
        </div>

        <p className="text-[11px] text-text-muted">
          When confirmed, this card will move to the selected stage and update the live milestone for all field supervisors and site workers.
        </p>
      </div>
    </Modal>
  );
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const { currentUser, role, hasPermission } = useAuth();
  // The widest permission wins: the Owner holds all three, so only "viewAll" decides for them.
  const canViewAll = hasPermission('projects.viewAll');
  const isClientView = hasPermission('projects.viewOwn') && !canViewAll;
  const isAssignedView = hasPermission('projects.viewAssigned') && !canViewAll;
  const toast = useToast();
  const canCreateProject = usePermission('projects.create');
  const canEditProjectStatus =
    hasPermission('stages.editProjectStages') ||
    hasPermission('projects.create') ||
    role !== 'client';

  // Authority check for manager / owner / admin
  const isManagerOrAdmin =
    role === ROLES.MANAGER ||
    role === ROLES.ADMIN ||
    role === ROLES.OWNER ||
    role === 'manager' ||
    role === 'owner' ||
    role === 'admin' ||
    hasPermission('stages.editProjectStages') ||
    hasPermission('projects.create');

  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // View mode: 'board' (Kanban default) or 'grid' (cards)
  const [viewMode, setViewMode] = useState('board');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Project selector filter: 'ALL' (All Projects Progress), 'NONE' (No Project), or specific project ID
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');

  // Manager Stage Schedule Modal state
  const [editingStageData, setEditingStageData] = useState(null);

  // Stage Upgrade Confirmation Modal state
  const [confirmStageChange, setConfirmStageChange] = useState(null);

  // Create Project Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    clientId: '',
    siteAddress: '',
    startDate: '2026-10-20',
    totalCost: '',
    supervisors: [],
    workers: [],
  });
  const [formErrors, setFormErrors] = useState({});

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [projList, clientList, userList] = await Promise.all([
        projectService.getAllProjects(currentUser),
        clientService.getAllClients(currentUser),
        userService.getAllUsers(),
      ]);
      setProjects(projList);
      setClients(clientList);
      setUsers(userList);
    } catch (err) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [currentUser]);

  // Working / In Progress Projects for the dropdown
  const workingProjects = useMemo(() => {
    return projects.filter(
      (p) => (p.status || '').toLowerCase() === 'in progress'
    );
  }, [projects]);

  // Other Projects (planning, completed, etc.)
  const otherProjects = useMemo(() => {
    return projects.filter(
      (p) => (p.status || '').toLowerCase() !== 'in progress'
    );
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        search === '' ||
        p.name.toLowerCase().includes(q) ||
        (p.clientName && p.clientName.toLowerCase().includes(q)) ||
        (p.siteAddress && p.siteAddress.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (p.status || '').toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  // Selected project object when in single project view
  const currentSelectedProject = useMemo(() => {
    if (selectedProjectId === 'ALL' || selectedProjectId === 'NONE') return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // BefUI Kanban Board Data for 12 Site Stages
  const kanbanBoard = useMemo(() => {
    const board = {
      'cleaning': [],
      'ceiling': [],
      'carpenter': [],
      'tiles': [],
      'plumbing': [],
      'electrical': [],
      'glass agencies': [],
      'finishing': [],
      'fabrication': [],
      'civil work': [],
      'artistic work': [],
      'painter': [],
    };

    // Mode 1: No project selected
    if (selectedProjectId === 'NONE') {
      return board;
    }

    // Mode 2: All projects progress (shows all sites in their active stage)
    if (selectedProjectId === 'ALL') {
      filteredProjects.forEach((p) => {
        const activeStageId = getProjectActiveStageId(p);
        if (board[activeStageId]) {
          board[activeStageId].push(p);
        } else {
          board['cleaning'].push(p);
        }
      });
      return board;
    }

    // Mode 3: Specific project selected -> show only that project's 12 site stages across the columns!
    const targetProject = projects.find((p) => p.id === selectedProjectId);
    if (!targetProject) return board;

    SITE_STAGE_COLUMNS.forEach((col, idx) => {
      let stage = (targetProject.stages || []).find(
        (s) => normalizeStageId(s.name) === col.id
      );
      if (!stage && targetProject.stages && targetProject.stages[idx]) {
        stage = targetProject.stages[idx];
      }
      if (!stage) {
        stage = {
          id: `${targetProject.id}_stage_${col.id}`,
          order: idx + 1,
          name: col.title.replace(/^\d+\.\s*/, ''),
          startDate: targetProject.startDate || '2026-10-20',
          endDate: '2026-10-28',
          status: idx === 0 ? 'in progress' : 'not started',
          agencyName: 'Unallocated Trade',
        };
      }

      board[col.id].push({
        id: `stg_card_${targetProject.id}_${col.id}`,
        isStageCard: true,
        projectId: targetProject.id,
        projectName: targetProject.name,
        clientName: targetProject.clientName || 'Client',
        stage: stage,
        colId: col.id,
        colTitle: col.title,
        colIndex: idx,
        colTone: col.tone,
      });
    });

    return board;
  }, [filteredProjects, projects, selectedProjectId]);

  // Card highlight: turns RED when stage due date is passed and work is pending
  const getCardClassName = (item) => {
    if (item.isStageCard) {
      if (isStageOverdue(item.stage)) {
        return 'border-rose-400 bg-rose-50/90 shadow-xs ring-1 ring-rose-400/30';
      }
      return undefined;
    }

    const activeStageId = getProjectActiveStageId(item);
    const activeStage =
      item.stages?.find((s) => normalizeStageId(s.name) === activeStageId) ||
      item.stages?.find((s) => s.status === 'in progress') ||
      item.stages?.[0];

    if (activeStage && isStageOverdue(activeStage)) {
      return 'border-rose-400 bg-rose-50/90 shadow-xs ring-1 ring-rose-400/30';
    }

    return undefined;
  };

  const handleRequestStageChange = (projectId, targetStageId) => {
    if (!canEditProjectStatus) {
      toast.error('Only authorized personnel (Admin / Manager / Supervisor) can update project stages');
      return;
    }
    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj || !targetProj.stages) return;

    const currentStageId = getProjectActiveStageId(targetProj);
    if (currentStageId === targetStageId) return;

    const currentStageCol = SITE_STAGE_COLUMNS.find((c) => c.id === currentStageId);
    const targetStageCol = SITE_STAGE_COLUMNS.find((c) => c.id === targetStageId);

    setConfirmStageChange({
      projectId,
      projectName: targetProj.name,
      fromStage: currentStageCol?.title || currentStageId,
      toStage: targetStageCol?.title || targetStageId,
      targetStageId,
    });
  };

  const handleConfirmStageChange = async () => {
    if (!confirmStageChange) return;
    const { projectId, targetStageId, toStage, projectName } = confirmStageChange;

    const targetProj = projects.find((p) => p.id === projectId);
    if (!targetProj || !targetProj.stages) {
      setConfirmStageChange(null);
      return;
    }

    const targetIndex = SITE_STAGE_COLUMNS.findIndex((c) => c.id === targetStageId);
    if (targetIndex === -1) {
      setConfirmStageChange(null);
      return;
    }

    const updatedStages = targetProj.stages.map((stg, idx) => {
      if (idx < targetIndex) return { ...stg, status: 'done' };
      if (idx === targetIndex) return { ...stg, status: 'in progress' };
      return { ...stg, status: 'pending' };
    });

    try {
      await projectService.updateProjectStages(projectId, updatedStages);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, stages: updatedStages, status: 'in progress' }
            : p
        )
      );
      toast.success(`Project "${projectName}" successfully upgraded to ${toStage}`);
    } catch {
      toast.error('Failed to update project stage');
    } finally {
      setConfirmStageChange(null);
    }
  };

  const handleBoardChange = async (nextBoard) => {
    if (selectedProjectId !== 'ALL') {
      // In single-project 12-stages view, columns represent fixed sequential phases
      return;
    }

    if (!canEditProjectStatus) {
      toast.error('Only authorized personnel (Admin / Manager / Supervisor) can update project stages');
      return;
    }

    for (const [targetColId, list] of Object.entries(nextBoard)) {
      for (const project of list) {
        const prevCol = getProjectActiveStageId(project);
        if (prevCol !== targetColId) {
          handleRequestStageChange(project.id, targetColId);
          return;
        }
      }
    }
  };

  const handleOpenScheduleModal = (projectId, projectName, stage) => {
    if (!isManagerOrAdmin) {
      toast.error('Only Managers and Admins have authority to assign stage schedules');
      return;
    }
    setEditingStageData({
      projectId,
      projectName,
      stage,
    });
  };

  const handleSaveStageSchedule = async ({ projectId, stageId, stageName, startDate, endDate, status }) => {
    try {
      const updated = await projectService.updateStageDetails(projectId, stageId, {
        stageName,
        startDate,
        endDate,
        status,
      });
      if (updated) {
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? updated : p))
        );
        toast.success(`Schedule saved for ${stageName || 'stage'}`);
        setEditingStageData(null);
      }
    } catch (err) {
      toast.error('Failed to update stage schedule');
    }
  };

  const handleClientSelect = (clientId) => {
    const selected = clients.find((c) => c.id === clientId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        clientId: selected.id,
        siteAddress: prev.siteAddress || selected.address || '',
      }));
    }
  };

  const handleOpenCreate = () => {
    navigate('/projects/new');
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const errors = {};

    const nameErr = validateRequired(formData.name, 'Project Name');
    if (nameErr) errors.name = nameErr;

    const clientErr = validateRequired(formData.clientId, 'Client');
    if (clientErr) errors.clientId = clientErr;

    const costErr = validatePositiveNumber(formData.totalCost, 'Total Cost');
    if (costErr) errors.totalCost = costErr;

    const dateErr = validateRequired(formData.startDate, 'Start Date');
    if (dateErr) errors.startDate = dateErr;

    const addressErr = validateRequired(formData.siteAddress, 'Site Address');
    if (addressErr) errors.siteAddress = addressErr;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error('Please fix validation errors');
      return;
    }

    try {
      const clientObj = clients.find((c) => c.id === formData.clientId);
      const newProj = await projectService.createProject({
        ...formData,
        totalCost: Number(formData.totalCost),
        clientName: clientObj ? clientObj.name : 'Unknown Client',
      });
      setProjects((prev) => [newProj, ...prev]);
      toast.success('Project initiated with 12 sequential fit-out stages');
      setIsCreateOpen(false);
    } catch (err) {
      toast.error('Failed to create project');
    }
  };

  const handleAdvanceProjectStatus = async (projectId) => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;

    let nextStatus = 'in progress';
    if (proj.status === 'not started') nextStatus = 'in progress';
    else if (proj.status === 'in progress') nextStatus = 'completed';
    else if (proj.status === 'completed') nextStatus = 'in progress';

    try {
      await projectService.updateProjectStatus(projectId, nextStatus);
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, status: nextStatus } : p))
      );
      toast.success(`Project marked as ${nextStatus}`);
    } catch {
      toast.error('Failed to advance project');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Site Stages"
        subtitle={
          selectedProjectId === 'ALL'
            ? '12 SRS Interior Fit-Out Stages (Cleaning to Painter) across all active site contracts'
            : currentSelectedProject
            ? `12 Site Stages progress for ${currentSelectedProject.name}`
            : 'Select a project from the dropdown to monitor its 12 site stages'
        }
        actions={
          <div className="flex items-center gap-2">
            {/* View Switcher: Board vs Grid */}
            <div className="flex items-center bg-muted p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'board'
                    ? 'bg-card text-text-main shadow-2xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <span>Kanban Board</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'grid'
                    ? 'bg-card text-text-main shadow-2xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <span>Cards Grid</span>
              </button>
            </div>

            <PermissionGate permission="projects.create">
              <Button
                variant="primary"
                size="sm"
                leadingIcon="plus"
                onClick={handleOpenCreate}
              >
                Add Project
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {/* Toolbar with Searchable Project Combobox & Status Filter Buttons - Sticky Toolbar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md py-1">
        <DataToolbar
          totalCount={filteredProjects.length}
          filters={
            <div className="flex items-center gap-3 flex-wrap">
              {/* Searchable Project Filter Dropdown Combobox */}
              <ProjectFilterSearchDropdown
                selectedProjectId={selectedProjectId}
                onSelectProject={setSelectedProjectId}
                projects={projects}
                workingProjects={workingProjects}
                otherProjects={otherProjects}
              />

              <div className="h-4 w-px bg-border hidden sm:block" />

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer min-h-[36px] sm:min-h-0 ${
                    statusFilter === 'ALL'
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white text-text-main border border-border hover:bg-slate-50'
                  }`}
                >
                  All Status
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('not started')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer min-h-[36px] sm:min-h-0 ${
                    statusFilter === 'not started'
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white text-text-main border border-border hover:bg-slate-50'
                  }`}
                >
                  Planning
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('in progress')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer min-h-[36px] sm:min-h-0 ${
                    statusFilter === 'in progress'
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white text-text-main border border-border hover:bg-slate-50'
                  }`}
                >
                  In Progress
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer min-h-[36px] sm:min-h-0 ${
                    statusFilter === 'completed'
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white text-text-main border border-border hover:bg-slate-50'
                  }`}
                >
                  Completed
                </button>
              </div>
            </div>
          }
        />
      </div>

      {/* Selected Project Summary Banner (when a specific project is selected) */}
      {currentSelectedProject && (
        <div className="flex items-center justify-between p-3 px-4 rounded-xl bg-white border border-border shadow-xs flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
              {currentSelectedProject.id}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-text-main truncate">
                {currentSelectedProject.name}
              </h3>
              <p className="text-xs font-medium text-text-muted truncate">
                Client: <span className="text-text-main font-semibold">{currentSelectedProject.clientName}</span> • Site: {currentSelectedProject.siteAddress || 'Bengaluru'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="info" size="sm">
              12 Stages View
            </Badge>
            {(() => {
              const overdueCount = (currentSelectedProject.stages || []).filter(isStageOverdue).length;
              if (overdueCount > 0) {
                return (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">
                    <AlertIcon className="size-3" />
                    <span>{overdueCount} Overdue Stage{overdueCount > 1 ? 's' : ''}</span>
                  </span>
                );
              }
              return null;
            })()}
            <button
              type="button"
              onClick={() => setSelectedProjectId('ALL')}
              className="px-2.5 py-1 rounded-md text-xs font-bold text-primary hover:bg-primary/10 transition-colors cursor-pointer border border-primary/20"
            >
              View All Projects
            </button>
          </div>
        </div>
      )}

      {/* No Project Empty State Banner */}
      {selectedProjectId === 'NONE' && (
        <div className="p-8 text-center bg-white rounded-xl border border-dashed border-border my-2">
          <BuildingIcon className="size-8 text-text-muted mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-bold text-text-main">No Site Project Selected</h3>
          <p className="text-xs font-medium text-text-muted mt-1 max-w-md mx-auto">
            Select an active working project from the dropdown above to view its 12 sequential fit-out stages, or switch to "All Projects Progress".
          </p>
          <button
            type="button"
            onClick={() => setSelectedProjectId('ALL')}
            className="mt-3 px-3.5 py-1.5 rounded-lg bg-primary text-white text-xs font-bold cursor-pointer shadow-xs hover:bg-primary/90 transition-colors"
          >
            Show All Projects Progress
          </button>
        </div>
      )}

      {/* Projects Display */}
      {loading ? (
        <div className="p-12 text-center text-xs font-medium text-text-muted">
          Loading site projects...
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon="projects"
          title={search || statusFilter !== 'ALL' ? 'No Projects Found' : 'No data available yet'}
          description={
            projects.length === 0
              ? 'No fit-out projects have been initiated yet. Click below to create your first project.'
              : isAssignedView
              ? 'You are not assigned to any active site projects matching this filter.'
              : 'Try clearing the search query or initiate a new project contract.'
          }
          action={
            canCreateProject && (
              <Button size="sm" onClick={handleOpenCreate}>
                Create First Project
              </Button>
            )
          }
        />
      ) : viewMode === 'board' ? (
        /* BEFUI KANBAN COMPONENT (https://befui.vercel.app/#/components/kanban) */
        <Kanban
          columns={SITE_STAGE_COLUMNS}
          value={kanbanBoard}
          onChange={handleBoardChange}
          onAdd={canCreateProject ? () => handleOpenCreate() : undefined}
          getCardClassName={getCardClassName}
          renderCard={(item) => {
            // CASE 1: Single-Project Stage Card View
            if (item.isStageCard) {
              const overdue = isStageOverdue(item.stage);
              const overdueDays = getOverdueDays(item.stage);

              return (
                <div className="space-y-2 select-none">
                  {/* Header: Stage Number, Dot Icon & Trade Agency */}
                  <div className="flex items-center justify-between gap-2">
                    <StageDotBadge tone={item.colTone} />
                    <span className="text-[11px] font-bold text-text-main truncate max-w-[140px]">
                      {item.stage.agencyName || 'Trade Agency'}
                    </span>
                  </div>

                  {/* Overdue Warning Message Banner */}
                  {overdue && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-rose-100 text-rose-700 text-[11px] font-bold border border-rose-300 animate-in fade-in">
                      <AlertIcon className="size-3.5 shrink-0 text-rose-600" />
                      <span className="leading-tight">Due date has passed ({overdueDays} days late)</span>
                    </div>
                  )}

                  {/* Schedule Dates Box */}
                  <div className="p-2 rounded-lg bg-surface border border-border text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-text-muted">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="size-3 text-text-muted" />
                        <span className="font-medium text-text-muted">Start:</span>
                      </span>
                      <span className="font-mono font-bold text-text-main">
                        {item.stage.startDate || 'Not set'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-text-muted">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className={cn('size-3', overdue ? 'text-rose-600' : 'text-text-muted')} />
                        <span className={cn('font-medium', overdue ? 'text-rose-600 font-bold' : 'text-text-muted')}>Due:</span>
                      </span>
                      <span className={cn('font-mono font-bold', overdue ? 'text-rose-600' : 'text-text-main')}>
                        {item.stage.endDate || 'Not set'}
                      </span>
                    </div>
                  </div>

                  {/* Manager Schedule Action Button */}
                  {isManagerOrAdmin && (
                    <div className="pt-1 border-t border-border flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenScheduleModal(item.projectId, item.projectName, item.stage);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-bold text-primary hover:bg-primary/10 transition-colors cursor-pointer border border-primary/20"
                      >
                        <CalendarIcon className="size-3" />
                        <span>Assign / Edit Dates</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            // CASE 2: All Projects Progress Card View
            const project = item;
            const client = clients.find((c) => c.id === project.clientId);
            const clientName = project.clientName || client?.name || 'Client';
            const activeStageId = getProjectActiveStageId(project);
            const activeStageIndex = SITE_STAGE_COLUMNS.findIndex((c) => c.id === activeStageId);
            const activeStageCol = SITE_STAGE_COLUMNS[activeStageIndex >= 0 ? activeStageIndex : 0];
            const activeStage =
              project.stages?.find((s) => normalizeStageId(s.name) === activeStageId) ||
              project.stages?.find((s) => s.status === 'in progress') ||
              project.stages?.[0];

            const overdue = isStageOverdue(activeStage);
            const overdueDays = getOverdueDays(activeStage);

            return (
              <div
                onClick={() => navigate(`/projects/${project.id}`)}
                className="space-y-2 cursor-pointer select-none"
              >
                {/* Header: Project ID / Client + Stage Navigation Arrow Dropdown */}
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-medium text-text-muted truncate flex items-center gap-1">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted font-bold text-text-main border border-border">
                      {project.id || 'SITE'}
                    </span>
                    <span>·</span>
                    <span className="truncate font-semibold text-text-main">{clientName}</span>
                  </div>

                  <StageNavigationDropdown
                    currentStageId={activeStageId}
                    onSelectStage={(targetStageId) =>
                      handleRequestStageChange(project.id, targetStageId)
                    }
                  />
                </div>

                {/* Overdue Alert Banner if active stage due date has passed */}
                {overdue && (
                  <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-rose-100 text-rose-700 text-[11px] font-bold border border-rose-300 animate-in fade-in">
                    <AlertIcon className="size-3.5 shrink-0 text-rose-600" />
                    <span className="leading-tight">Due date has passed ({overdueDays} days late)</span>
                  </div>
                )}

                {/* Project Name: Original bold high-contrast text, NO hover dimming */}
                <h4 className="font-bold text-[13px] text-text-main leading-snug line-clamp-2">
                  {project.name}
                </h4>

                {/* Site Location */}
                <div className="flex items-center pt-0.5 text-xs">
                  <span className="text-[11px] font-medium text-text-muted truncate max-w-[180px]">
                    {project.siteAddress ? project.siteAddress.split(',')[0] : 'Bengaluru'}
                  </span>
                </div>

                {/* Stage Schedule Pill with Manager Edit Trigger */}
                <div className="flex items-center justify-between text-[11px] text-text-muted bg-surface px-2 py-1 rounded border border-border">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className={cn('size-3', overdue ? 'text-rose-600' : 'text-text-muted')} />
                    <span className={cn('font-semibold', overdue ? 'text-rose-600' : 'text-text-main')}>
                      Due: {activeStage?.endDate || 'Not set'}
                    </span>
                  </div>
                  {isManagerOrAdmin && activeStage && (
                    <button
                      type="button"
                      title="Assign or edit stage dates"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenScheduleModal(project.id, project.name, activeStage);
                      }}
                      className="text-primary hover:underline text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Edit</span>
                    </button>
                  )}
                </div>

                {/* Card Footer: Client Avatar & Supervisor */}
                <div className="flex items-center justify-between pt-1.5 border-t border-border text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar name={clientName} size="xs" />
                    <span className="text-[11px] font-bold text-text-main truncate max-w-[110px]">
                      {clientName}
                    </span>
                  </div>

                  <div className="flex items-center -space-x-1.5 overflow-hidden">
                    {project.supervisors && project.supervisors.length > 0 ? (
                      project.supervisors.slice(0, 3).map((supId) => {
                        const u = users.find((usr) => String(usr.id) === String(supId));
                        return <Avatar key={supId} name={u?.name || 'Supervisor'} size="xs" />;
                      })
                    ) : null}
                  </div>
                </div>
              </div>
            );
          }}
        />
      ) : (
        /* STANDARD CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              teamUsers={users}
              canAdvance={canEditProjectStatus}
              onAdvance={handleAdvanceProjectStatus}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}

      {/* Manager Assign / Edit Stage Dates Modal */}
      <ScheduleStageModal
        isOpen={!!editingStageData}
        onClose={() => setEditingStageData(null)}
        data={editingStageData}
        onSave={handleSaveStageSchedule}
      />

      {/* Confirm Stage Upgrade Modal */}
      <ConfirmStageUpgradeModal
        isOpen={!!confirmStageChange}
        onClose={() => setConfirmStageChange(null)}
        data={confirmStageChange}
        onConfirm={handleConfirmStageChange}
      />

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Initiate New Fit-out Project"
        subtitle="Generates 12 standard stages from template and assigns site personnel"
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateSubmit}>
              Create & Generate 12 Stages
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Project Name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Koramangala 4BHK Duplex Fit-out"
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Select Client"
              required
              value={formData.clientId}
              onChange={(e) => handleClientSelect(e.target.value)}
              options={clients.map((c) => ({
                value: c.id,
                label: `${c.name} (${c.type === 'old' ? 'Existing' : 'New'})`,
              }))}
              error={formErrors.clientId}
            />

            <Input
              label="Total Cost Estimate (INR)"
              required
              type="number"
              value={formData.totalCost}
              onChange={(e) =>
                setFormData({ ...formData, totalCost: e.target.value })
              }
              placeholder="e.g. 4500000"
              error={formErrors.totalCost}
              helperText="Indian Rupee contract estimation"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Project Commencement Date"
              type="date"
              required
              value={formData.startDate}
              onChange={(e) =>
                setFormData({ ...formData, startDate: e.target.value })
              }
              error={formErrors.startDate}
            />
            <Input
              label="Site Address"
              required
              value={formData.siteAddress}
              onChange={(e) =>
                setFormData({ ...formData, siteAddress: e.target.value })
              }
              placeholder="Full site location & landmark"
              error={formErrors.siteAddress}
            />
          </div>

          {/* Supervisor Assignee Picker */}
          <AssigneePicker
            label="Assign Site Supervisors"
            roleFilter={ROLES.SUPERVISOR}
            users={users}
            value={formData.supervisors}
            onChange={(selected) =>
              setFormData({ ...formData, supervisors: selected })
            }
            placeholder="Select one or more supervisors (e.g. Vikram Jadhav)..."
          />

          {/* Worker Assignee Picker */}
          <AssigneePicker
            label="Assign Site Workers & Artisans"
            roleFilter={ROLES.WORKER}
            users={users}
            value={formData.workers}
            onChange={(selected) =>
              setFormData({ ...formData, workers: selected })
            }
            placeholder="Select craftsmen (e.g. Ramesh Shinde, Suresh Gaikwad)..."
          />
        </form>
      </Modal>
    </div>
  );
}

export default ProjectsPage;
