'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { holidayService, WEEKDAYS } from '../services/holidayService';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/utils';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  PlusIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CalendarDaysIcon,
  TrashIcon,
  EditIcon,
  BadgeCheckIcon,
  SaveIcon,
  BoxIcon,
  SearchIcon,
  CheckIcon,
  EyeIcon,
  XIcon,
} from '../components/ui/icons';

function formatDateDisplay(isoStr) {
  if (!isoStr) return '—';
  try {
    const [y, m, d] = isoStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoStr;
  }
}

export function HolidayListsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [holidayLists, setHolidayLists] = useState(() => holidayService.getHolidayLists());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'
  const [isCreating, setIsCreating] = useState(
    () => location.pathname.includes('/new') || location.search.includes('new=true')
  );
  const [editingId, setEditingId] = useState(null);
  const [listPendingDelete, setListPendingDelete] = useState(null);

  // Form State for "New Holiday List"
  const [formName, setFormName] = useState('FY 2026–2027 Holidays');
  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState('2027-03-31');
  const [weeklyOffDay, setWeeklyOffDay] = useState('Sunday');
  const [builderHolidays, setBuilderHolidays] = useState([]);
  const [nameError, setNameError] = useState(false);
  const nameInputRef = useRef(null);

  // Quick single custom holiday adder
  const [customDate, setCustomDate] = useState('');
  const [customName, setCustomName] = useState('');
  const [editingRow, setEditingRow] = useState(null);
  const [editingRowName, setEditingRowName] = useState('');
  const [editingRowIsWorking, setEditingRowIsWorking] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  // Auto reload when local storage changes
  const reloadLists = () => {
    setHolidayLists(holidayService.getHolidayLists());
  };

  useEffect(() => {
    window.addEventListener('osm_holidays_updated', reloadLists);
    return () => window.removeEventListener('osm_holidays_updated', reloadLists);
  }, []);

  // Filtered lists in directory
  const filteredLists = useMemo(() => {
    return holidayLists.filter((list) => {
      // 1. Status filter
      if (statusFilter === 'ACTIVE' && !list.isDefault) return false;
      if (statusFilter === 'INACTIVE' && list.isDefault) return false;

      // 2. Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = list.name.toLowerCase().includes(q);
      const matchDates =
        list.fromDate?.toLowerCase().includes(q) || list.toDate?.toLowerCase().includes(q);
      const matchWeekly = list.weeklyOffDay?.toLowerCase().includes(q);
      return matchName || matchDates || matchWeekly;
    });
  }, [holidayLists, searchQuery, statusFilter]);

  // Filtered Builder Holidays table
  const filteredTableHolidays = useMemo(() => {
    if (!tableSearch.trim()) return builderHolidays;
    const q = tableSearch.toLowerCase().trim();
    return builderHolidays.filter((h) => {
      return (
        h.name.toLowerCase().includes(q) ||
        h.date.toLowerCase().includes(q) ||
        h.dayOfWeek?.toLowerCase().includes(q) ||
        h.type?.toLowerCase().includes(q)
      );
    });
  }, [builderHolidays, tableSearch]);

  // Counts summary
  const counts = useMemo(() => {
    const weekly = builderHolidays.filter((h) => h.type === 'weekly_off').length;
    const national = builderHolidays.filter((h) => h.type === 'national').length;
    const festival = builderHolidays.filter(
      (h) => h.type === 'festival' || h.type === 'custom'
    ).length;
    return { total: builderHolidays.length, weekly, national, festival };
  }, [builderHolidays]);

  // Open Builder for New List
  const handleOpenBuilder = () => {
    setEditingId(null);
    setFormName('FY 2026–2027 Holidays');
    setFromDate('2026-04-01');
    setToDate('2027-03-31');
    setWeeklyOffDay('Sunday');
    setBuilderHolidays([]);
    setCustomDate('');
    setCustomName('');
    setTableSearch('');
    setIsCreating(true);
  };

  // Open Builder to Edit an Existing List
  const handleEditList = (list) => {
    setEditingId(list.id);
    setFormName(list.name || '');
    setFromDate(list.fromDate || '2026-04-01');
    setToDate(list.toDate || '2027-03-31');
    setWeeklyOffDay(list.weeklyOffDay || 'Sunday');
    setBuilderHolidays(list.holidays || []);
    setCustomDate('');
    setCustomName('');
    setTableSearch('');
    setIsCreating(true);
  };

  // Add Weekly Offs
  const handleAddWeeklyOffs = () => {
    if (!fromDate || !toDate) {
      toast.error('Please specify both From Date and To Date first.');
      return;
    }
    if (fromDate > toDate) {
      toast.error('From Date cannot be after To Date.');
      return;
    }

    const generated = holidayService.generateWeeklyOffs(fromDate, toDate, weeklyOffDay);
    if (generated.length === 0) {
      toast.error(`No ${weeklyOffDay}s found in the specified date range.`);
      return;
    }

    // Merge without duplicates by date
    setBuilderHolidays((prev) => {
      const map = new Map();
      prev.forEach((h) => map.set(h.date, h));
      let addedCount = 0;
      generated.forEach((g) => {
        if (!map.has(g.date)) {
          map.set(g.date, g);
          addedCount++;
        }
      });
      const merged = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      toast.success(`Added ${addedCount} weekly rest days (${weeklyOffDay}) to the schedule.`);
      return merged;
    });
  };

  // Add National Holidays
  const handleAddNationalHolidays = () => {
    if (!fromDate || !toDate) {
      toast.error('Please specify both From Date and To Date first.');
      return;
    }
    if (fromDate > toDate) {
      toast.error('From Date cannot be after To Date.');
      return;
    }

    const fixed = holidayService.getFixedIndianHolidays(fromDate, toDate);
    if (fixed.length === 0) {
      toast.error('No fixed national holidays fall within this date range.');
      return;
    }

    setBuilderHolidays((prev) => {
      const map = new Map();
      prev.forEach((h) => map.set(h.date, h));
      let addedCount = 0;
      fixed.forEach((f) => {
        if (!map.has(f.date)) {
          map.set(f.date, f);
          addedCount++;
        }
      });
      const merged = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      toast.success(`Added ${addedCount} official national/gazetted holidays.`);
      return merged;
    });
  };

  // Add single custom holiday
  const handleAddCustomRow = (e) => {
    e.preventDefault();
    if (!customDate) {
      toast.error('Please select a date for the custom holiday.');
      return;
    }
    if (!customName.trim()) {
      toast.error('Please enter a holiday description/name.');
      return;
    }

    const dateObj = new Date(customDate + 'T00:00:00');
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

    const newRow = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: customDate,
      name: customName.trim(),
      type: 'custom',
      dayOfWeek,
    };

    setBuilderHolidays((prev) => {
      const filtered = prev.filter((h) => h.date !== customDate);
      const merged = [...filtered, newRow].sort((a, b) => a.date.localeCompare(b.date));
      return merged;
    });

    toast.success(`Holiday "${customName.trim()}" added to list.`);
    setCustomDate('');
    setCustomName('');
  };

  // Toggle Work ON / Weekly Off for a specific day (e.g. employee works on Sunday)
  const handleToggleWorkDay = (id) => {
    setBuilderHolidays((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const willBeWorking = !item.isWorkingDay;
        const currentName = item.name || '';
        let newName = currentName;
        if (willBeWorking) {
          if (!currentName.includes('Work ON')) {
            newName = currentName.replace(' (Weekly Off)', '') + ' (Work ON)';
          }
        } else {
          newName = currentName.replace(' (Work ON)', '').replace(' (Work ON - Overridden)', '') + ' (Weekly Off)';
        }
        return {
          ...item,
          isWorkingDay: willBeWorking,
          status: willBeWorking ? 'ON' : 'WEEKLY_OFF',
          name: newName,
        };
      })
    );

    const target = builderHolidays.find((h) => h.id === id);
    if (target) {
      if (!target.isWorkingDay) {
        toast.success(`${target.dayOfWeek || 'Day'} (${formatDateDisplay(target.date)}) marked as Work ON (Employees will work)`);
      } else {
        toast.info(`${target.dayOfWeek || 'Day'} (${formatDateDisplay(target.date)}) reverted to Weekly Off`);
      }
    }
  };

  // Open modal to edit single schedule row
  const handleOpenEditRowModal = (item) => {
    setEditingRow(item);
    setEditingRowName(item.name || '');
    setEditingRowIsWorking(!!item.isWorkingDay);
  };

  // Save row edit
  const handleSaveRowEdit = () => {
    if (!editingRow) return;
    setBuilderHolidays((prev) =>
      prev.map((item) => {
        if (item.id !== editingRow.id) return item;
        return {
          ...item,
          name: editingRowName.trim() || item.name,
          isWorkingDay: editingRowIsWorking,
          status: editingRowIsWorking ? 'ON' : (item.type === 'weekly_off' ? 'WEEKLY_OFF' : 'OFF'),
        };
      })
    );
    toast.success('Schedule entry updated successfully');
    setEditingRow(null);
  };

  // Remove single row from builder
  const handleRemoveBuilderRow = (id) => {
    setBuilderHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  // Save new or updated Holiday List
  const handleSaveHolidayList = () => {
    if (!formName.trim()) {
      setNameError(true);
      toast.error('Please enter a name for the Holiday List.');
      if (nameInputRef.current) {
        nameInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nameInputRef.current.focus();
      }
      return;
    }
    if (!fromDate || !toDate) {
      toast.error('Please specify the date range (From Date and To Date).');
      return;
    }
    if (fromDate > toDate) {
      toast.error('From Date cannot be after To Date.');
      return;
    }

    if (editingId) {
      holidayService.updateHolidayList(editingId, {
        name: formName.trim(),
        fromDate,
        toDate,
        weeklyOffDay,
        holidays: builderHolidays,
      });
      toast.success(`Holiday Schedule "${formName.trim()}" updated successfully!`);
    } else {
      const created = holidayService.createHolidayList({
        name: formName.trim(),
        fromDate,
        toDate,
        weeklyOffDay,
        holidays: builderHolidays,
      });
      toast.success(`Holiday Schedule "${created.name}" created with ${created.totalHolidays} holidays!`);
    }

    setIsCreating(false);
    setEditingId(null);
    reloadLists();
  };

  // Set Default Schedule
  const handleSetDefault = (id, name) => {
    holidayService.setDefaultList(id);
    toast.success(`"${name}" is now the active company holiday schedule.`);
    reloadLists();
  };

  // Confirm Delete List
  const handleConfirmDelete = () => {
    if (!listPendingDelete) return;
    holidayService.deleteHolidayList(listPendingDelete.id);
    toast.success(`Holiday List "${listPendingDelete.name}" deleted.`);
    setListPendingDelete(null);
    reloadLists();
  };

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* 1. BUILDER VIEW: Clean 2-Card Layout (Aligned & BefUI Compliant)          */}
      {/* ========================================================================= */}
      {isCreating ? (
        <div className="space-y-5">
          {/* Header with Back button and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingId(null);
                }}
                className="size-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors cursor-pointer shrink-0"
                title="Back to Holiday Lists"
                data-tooltip="Back to Holiday Lists"
                aria-label="Back"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {editingId ? 'Edit Holiday Schedule' : 'New Holiday Schedule'}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure company holiday calendar and generate weekly rest days
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsCreating(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSaveHolidayList}
                className="gap-1.5"
              >
                <SaveIcon className="size-4" />
                <span>{editingId ? 'Save Changes' : 'Create Holiday List'}</span>
              </Button>
            </div>
          </div>

          {/* Card 1: Configuration Form & Generator Toolbar */}
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
            {/* Row 1: 4 Equal Grid Columns with clean vertical alignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Holiday List Name <span className="text-destructive">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (nameError) setNameError(false);
                  }}
                  placeholder="e.g. FY 2026–2027 Holidays"
                  className={cn(
                    'w-full h-9 px-3 text-xs rounded-lg bg-background border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all',
                    nameError
                      ? 'border-destructive ring-1 ring-destructive/40 bg-destructive/5'
                      : 'border-border focus:border-primary'
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  From Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg bg-background border border-border text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  To Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg bg-background border border-border text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Weekly Off Day
                </label>
                <select
                  value={weeklyOffDay}
                  onChange={(e) => setWeeklyOffDay(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                >
                  {WEEKDAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Aligned Generation Actions & Single Holiday Adder */}
            <div className="pt-3.5 border-t border-border flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
              {/* Auto generator triggers */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddWeeklyOffs}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <CalendarDaysIcon className="size-3.5 text-primary" />
                  <span>Generate Weekly Offs ({weeklyOffDay}s)</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddNationalHolidays}
                  className="gap-1.5 text-xs font-semibold"
                >
                  <CalendarIcon className="size-3.5 text-primary" />
                  <span>Add Fixed National Holidays</span>
                </Button>
              </div>

              {/* Inline Custom Holiday Adder */}
              <form
                onSubmit={handleAddCustomRow}
                className="flex items-center gap-2 flex-1 max-w-xl"
              >
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="h-8.5 px-2.5 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium cursor-pointer"
                  title="Pick custom holiday date"
                  data-tooltip="Pick holiday date"
                />
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Regional Festival, Annual Day"
                  className="flex-1 h-8.5 px-3 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="gap-1 text-xs shrink-0"
                >
                  <PlusIcon className="size-3.5" />
                  <span>Add</span>
                </Button>
              </form>
            </div>
          </div>

          {/* Card 2: Holidays Table */}
          <div className="bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
            {/* Table Header Bar */}
            <div className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border bg-card">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-foreground">Scheduled Holidays</span>
                <Badge variant="outline" className="px-2 py-0.5 text-xs font-mono font-bold">
                  {counts.total} total
                </Badge>
                {counts.weekly > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.2 font-medium">
                    {counts.weekly} weekly offs
                  </Badge>
                )}
                {counts.national > 0 && (
                  <Badge variant="primary" className="text-[10px] px-1.5 py-0.2 font-medium">
                    {counts.national} national
                  </Badge>
                )}
                {counts.festival > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0.2 font-medium">
                    {counts.festival} custom
                  </Badge>
                )}
              </div>

              {builderHolidays.length > 0 && (
                <div className="relative sm:w-60">
                  <SearchIcon className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Filter holidays in table..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
              )}
            </div>

            {/* Table or Empty State */}
            {builderHolidays.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="size-10 rounded-full bg-muted/60 border border-border flex items-center justify-center text-muted-foreground mx-auto mb-2">
                  <CalendarDaysIcon className="size-5" />
                </div>
                <div className="font-semibold text-sm text-foreground">
                  No holidays added to this schedule yet
                </div>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Click <strong className="text-foreground">"Generate Weekly Offs"</strong> or <strong className="text-foreground">"Add Fixed National Holidays"</strong> above to instantly populate the list.
                </p>
              </div>
            ) : (
              <div className="max-h-[460px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-card text-muted-foreground font-semibold uppercase tracking-wider text-[11px] border-b border-border z-10 shadow-2xs">
                    <tr>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Day</th>
                      <th className="py-2.5 px-4">Holiday Description</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredTableHolidays.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-medium text-foreground whitespace-nowrap">
                          {formatDateDisplay(item.date)}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap font-medium">
                          {item.dayOfWeek || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-foreground">
                          {item.name}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                              item.type === 'weekly_off'
                                ? 'bg-secondary text-secondary-foreground'
                                : item.type === 'national'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {item.type === 'weekly_off'
                              ? 'Weekly Off'
                              : item.type === 'national'
                              ? 'National'
                              : 'Festival / Custom'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveBuilderRow(item.id)}
                            className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            title="Remove"
                            data-tooltip="Remove"
                          >
                            <TrashIcon className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. DIRECTORY VIEW: BEFUI TABLE FORMAT (NO MORE CARDS)                     */
        /* ========================================================================= */
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Holiday Lists
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manage company holiday schedules and official rest days
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleOpenBuilder}
              className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <PlusIcon className="size-4" />
              <span>New Holiday List</span>
            </Button>
          </div>

          {/* Single-Line Modern BefUI Filter Toolbar */}
          <div className="bg-card border border-border rounded-xl p-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
                {/* Search Bar */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <SearchIcon className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search holiday lists by name, dates..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                    </button>
                  )}
                </div>

                {/* Status Filter Dropdown */}
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-8 px-2.5 text-xs font-semibold rounded-lg border border-border bg-background text-foreground hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="ALL">All Schedules ({holidayLists.length})</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="INACTIVE">Inactive Only</option>
                  </select>
                </div>

                {/* Clear Filter button */}
                {(searchQuery || statusFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('ALL');
                    }}
                    className="h-8 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <XIcon className="size-3" />
                    <span>Clear Filter</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Directory Table Format */}
          {filteredLists.length === 0 ? (
            <div className="p-16 text-center rounded-xl border border-border bg-card shadow-2xs space-y-3">
              <div className="size-12 rounded-full bg-muted/60 border border-border/80 flex items-center justify-center text-muted-foreground mx-auto">
                <BoxIcon className="size-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-base text-foreground">
                No holiday schedules found
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'No schedules match your search filters. Try clearing filters.'
                  : 'Click "New Holiday List" above to create your first company holiday schedule.'}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="py-3 px-4">Schedule Name</th>
                      <th className="py-3 px-4">Valid Period</th>
                      <th className="py-3 px-4">Total Days</th>
                      <th className="py-3 px-4">Weekly Off</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLists.map((list) => {
                      const isDefault = list.isDefault;
                      return (
                        <tr
                          key={list.id}
                          className={cn(
                            'hover:bg-muted/30 transition-colors',
                            isDefault && 'bg-primary/5 font-medium'
                          )}
                        >
                          {/* Schedule Name */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-sm">
                                {list.name}
                              </span>
                              {isDefault && (
                                <Badge variant="primary" className="text-[10px] uppercase font-bold">
                                  Active
                                </Badge>
                              )}
                            </div>
                          </td>

                          {/* Valid Period */}
                          <td className="py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">
                            {formatDateDisplay(list.fromDate)} — {formatDateDisplay(list.toDate)}
                          </td>

                          {/* Total Holidays / Days */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-semibold text-foreground inline-flex items-center gap-1">
                              {list.totalHolidays || list.holidays?.length || 0} Days
                            </span>
                          </td>

                          {/* Weekly Off Day */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="text-foreground font-medium">
                              {list.weeklyOffDay || 'Sunday'}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isDefault ? (
                              <Badge variant="success">Active Schedule</Badge>
                            ) : (
                              <Badge variant="neutral">Inactive</Badge>
                            )}
                          </td>

                          {/* Action Buttons (Aligned 3-slot column) */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5 w-[96px] ml-auto">
                              {/* Slot 1: Set as Active */}
                              {!isDefault ? (
                                <button
                                  type="button"
                                  onClick={() => handleSetDefault(list.id, list.name)}
                                  title="Set as Active"
                                  data-tooltip="Set as Active"
                                  className="size-7 rounded-md flex items-center justify-center text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                                >
                                  <CheckIcon className="size-4" />
                                </button>
                              ) : (
                                <div
                                  title="Current Active Schedule"
                                  data-tooltip="Active Schedule"
                                  className="size-7 rounded-md flex items-center justify-center text-success shrink-0"
                                >
                                  <CheckIcon className="size-4" />
                                </div>
                              )}

                              {/* Slot 2: View / Edit Schedule */}
                              <button
                                type="button"
                                onClick={() => handleEditList(list)}
                                title="View Schedule"
                                data-tooltip="View Schedule"
                                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                              >
                                <EyeIcon className="size-3.5" />
                              </button>

                              {/* Slot 3: Delete Schedule */}
                              <button
                                type="button"
                                onClick={() => setListPendingDelete(list)}
                                title="Delete"
                                data-tooltip="Delete"
                                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                              >
                                <TrashIcon className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {listPendingDelete && (
        <ConfirmDialog
          isOpen={Boolean(listPendingDelete)}
          title="Delete Holiday Schedule"
          message={`Are you sure you want to delete "${listPendingDelete.name}"? This action cannot be undone.`}
          confirmLabel="Delete Schedule"
          confirmVariant="destructive"
          onConfirm={handleConfirmDelete}
          onCancel={() => setListPendingDelete(null)}
        />
      )}
    </div>
  );
}

export default HolidayListsPage;
