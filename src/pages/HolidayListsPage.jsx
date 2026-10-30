import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { holidayService, WEEKDAYS } from '../services/holidayService';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/utils';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  PlusIcon,
  SparkleIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CalendarDaysIcon,
  TrashIcon,
  SaveIcon,
  BoxIcon,
  SearchIcon,
  CheckIcon,
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
  const [isCreating, setIsCreating] = useState(
    () => location.pathname.includes('/new') || location.search.includes('new=true')
  );
  const [listPendingDelete, setListPendingDelete] = useState(null);

  // Form State for "New Holiday List"
  const [formName, setFormName] = useState('FY 2026–2027 Holidays');
  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState('2027-03-31');
  const [weeklyOffDay, setWeeklyOffDay] = useState('Sunday');

  // Custom row input state
  const [customDate, setCustomDate] = useState('');
  const [customName, setCustomName] = useState('');

  // Added holidays list in current builder
  const [builderHolidays, setBuilderHolidays] = useState([]);
  const [tableSearch, setTableSearch] = useState('');

  // Sync holiday lists from service
  const reloadLists = () => {
    setHolidayLists(holidayService.getHolidayLists());
  };

  useEffect(() => {
    reloadLists();
    window.addEventListener('osm_holidays_updated', reloadLists);
    return () => window.removeEventListener('osm_holidays_updated', reloadLists);
  }, []);

  // Filtered Holiday Lists
  const filteredLists = useMemo(() => {
    if (!searchQuery.trim()) return holidayLists;
    const q = searchQuery.toLowerCase().trim();
    return holidayLists.filter(
      (l) =>
        l.name?.toLowerCase().includes(q) ||
        l.fromDate?.includes(q) ||
        l.toDate?.includes(q) ||
        l.weeklyOffDay?.toLowerCase().includes(q)
    );
  }, [holidayLists, searchQuery]);

  // Filtered Builder Holidays table
  const filteredTableHolidays = useMemo(() => {
    if (!tableSearch.trim()) return builderHolidays;
    const q = tableSearch.toLowerCase().trim();
    return builderHolidays.filter(
      (h) =>
        h.name?.toLowerCase().includes(q) ||
        h.date?.includes(q) ||
        h.dayOfWeek?.toLowerCase().includes(q) ||
        h.type?.toLowerCase().includes(q)
    );
  }, [builderHolidays, tableSearch]);

  // Open Builder View
  const handleOpenBuilder = () => {
    setFormName('');
    setFromDate('2026-04-01');
    setToDate('2027-03-31');
    setWeeklyOffDay('Sunday');
    setBuilderHolidays([]);
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

  // Add Fixed National & State Holidays
  const handleAddNationalHolidays = () => {
    if (!fromDate || !toDate) {
      toast.error('Please specify both From Date and To Date first.');
      return;
    }
    const national = holidayService.getFixedNationalHolidays(fromDate, toDate);
    if (national.length === 0) {
      toast.error('No fixed national holidays found in the selected date range.');
      return;
    }

    setBuilderHolidays((prev) => {
      const map = new Map();
      prev.forEach((h) => map.set(h.date, h));
      let addedCount = 0;
      national.forEach((nh) => {
        if (map.has(nh.date)) {
          const existing = map.get(nh.date);
          map.set(nh.date, {
            ...existing,
            name: `${existing.name} & ${nh.name}`,
            type: 'national',
          });
          addedCount++;
        } else {
          map.set(nh.date, nh);
          addedCount++;
        }
      });
      const merged = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      toast.success(`Added ${addedCount} gazetted & national festival holidays.`);
      return merged;
    });
  };

  // Add Custom Festival / Row
  const handleAddCustomRow = (e) => {
    e?.preventDefault();
    if (!customDate) {
      toast.error('Please select a date for the holiday.');
      return;
    }
    if (!customName.trim()) {
      toast.error('Please enter the holiday name or description.');
      return;
    }

    const [y, m, d] = customDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = WEEKDAYS[dateObj.getDay()] || 'Day';

    const newRow = {
      id: `hol-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      date: customDate,
      name: customName.trim(),
      type: 'festival',
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

  // Remove single row from builder
  const handleRemoveBuilderRow = (id) => {
    setBuilderHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  // Save new Holiday List
  const handleSaveHolidayList = () => {
    if (!formName.trim()) {
      toast.error('Please enter a name for the Holiday List.');
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

    const created = holidayService.createHolidayList({
      name: formName.trim(),
      fromDate,
      toDate,
      weeklyOffDay,
      holidays: builderHolidays,
    });

    toast.success(`Holiday List "${created.name}" created with ${created.totalHolidays} holidays!`);
    setIsCreating(false);
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
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* ========================================================================= */}
      {/* 1. BUILDER VIEW: "New Holiday List" (Screenshots 3 & 4)                   */}
      {/* ========================================================================= */}
      {isCreating ? (
        <div className="space-y-6 max-w-6xl mx-auto">
          {/* Breadcrumb / Top Header */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Back to Holiday Lists"
            >
              <ArrowLeftIcon className="size-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                New Holiday List
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Frappe-style Holiday List builder with automatic weekly off generator
              </p>
            </div>
          </div>

          {/* Main Form Container */}
          <div className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm space-y-6">
            {/* Top Inputs: Name, From Date, To Date */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Holiday List Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. FY 2026–2027 Holidays"
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  From Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  To Date <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                />
              </div>
            </div>

            <div className="border-t border-border/80 pt-5 space-y-6">
              {/* SECTION 1: ADD WEEKLY HOLIDAYS (WEEKLY OFF) */}
              <div className="p-4 sm:p-5 rounded-xl bg-muted/20 border border-border/80 space-y-3">
                <div className="flex items-center gap-2 text-foreground font-bold text-xs sm:text-sm tracking-wide">
                  <CalendarDaysIcon className="size-4 text-primary" />
                  <span>ADD WEEKLY HOLIDAYS (WEEKLY OFF)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Automatically generate weekly rest days between From Date and To Date.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-1">
                  <div className="sm:w-64 space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Weekly Off Day
                    </label>
                    <select
                      value={weeklyOffDay}
                      onChange={(e) => setWeeklyOffDay(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                      {WEEKDAYS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleAddWeeklyOffs}
                    className="flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <PlusIcon className="size-4" />
                    <span>Add to Holidays</span>
                  </Button>
                </div>
              </div>

              {/* SECTION 2: FIXED NATIONAL & STATE HOLIDAYS */}
              <div className="p-4 sm:p-5 rounded-xl bg-muted/20 border border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-foreground font-bold text-xs sm:text-sm tracking-wide">
                    <SparkleIcon className="size-4 text-primary" />
                    <span>FIXED NATIONAL & STATE HOLIDAYS</span>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-2xl">
                    Select and add fixed calendar holidays (Gandhi Jayanti, Ambedkar Jayanti, Shiv
                    Jayanti, Republic Day, Diwali, Independence Day, etc.)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleAddNationalHolidays}
                  className="flex items-center justify-center gap-1.5 shrink-0"
                >
                  <SparkleIcon className="size-4" />
                  <span>Add Fixed National Holidays</span>
                </Button>
              </div>

              {/* SECTION 3: ADD SPECIFIC FESTIVAL / LOCAL HOLIDAY */}
              <div className="p-4 sm:p-5 rounded-xl bg-muted/20 border border-border/80 space-y-3">
                <div className="text-foreground font-bold text-xs sm:text-sm tracking-wide">
                  ADD SPECIFIC FESTIVAL / LOCAL HOLIDAY
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                  <div className="sm:w-56 space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Holiday Date
                    </label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Holiday Name / Description
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g. Diwali, Independence Day, Regional Festival"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomRow}
                    className="flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <PlusIcon className="size-4" />
                    <span>Add Row</span>
                  </Button>
                </div>
              </div>

              {/* SECTION 4: HOLIDAYS LIST TABLE */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">Holidays List</h3>
                    <Badge variant="outline" className="px-2 py-0.5 text-xs font-mono font-bold">
                      {builderHolidays.length}
                    </Badge>
                  </div>

                  {builderHolidays.length > 0 && (
                    <div className="relative sm:w-64">
                      <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        placeholder="Search table..."
                        className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* Table Content or Empty State */}
                {builderHolidays.length === 0 ? (
                  <div className="p-12 text-center rounded-xl border border-dashed border-border bg-muted/10 space-y-2">
                    <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground mx-auto mb-2">
                      <CalendarDaysIcon className="size-5" />
                    </div>
                    <div className="font-semibold text-sm text-foreground">
                      No holidays added to this list yet.
                    </div>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Use "Add to Holidays" or "Add Fixed National Holidays" above to generate dates
                      or add custom dates.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden bg-card shadow-2xs">
                    <div className="max-h-[380px] overflow-y-auto scrollbar-thin">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-muted/60 text-muted-foreground font-semibold uppercase tracking-wider text-[11px] border-b border-border z-10">
                          <tr>
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-4">Day</th>
                            <th className="py-2.5 px-4">Holiday Name / Description</th>
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
                              <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                                {item.dayOfWeek}
                              </td>
                              <td className="py-2.5 px-4 font-medium text-foreground">
                                {item.name}
                              </td>
                              <td className="py-2.5 px-4 whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px] font-medium px-2 py-0.5',
                                    item.type === 'national' &&
                                      'bg-primary/10 text-primary border-primary/30',
                                    item.type === 'weekly_off' &&
                                      'bg-muted text-muted-foreground border-border',
                                    item.type === 'festival' &&
                                      'bg-accent/15 text-accent-foreground border-accent/40'
                                  )}
                                >
                                  {item.type === 'weekly_off'
                                    ? 'Weekly Off'
                                    : item.type === 'national'
                                    ? 'National'
                                    : 'Festival'}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBuilderRow(item.id)}
                                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                  title="Delete Holiday"
                                >
                                  <TrashIcon className="size-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions: Cancel & Create */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleSaveHolidayList}
                className="flex items-center gap-1.5"
              >
                <SaveIcon className="size-4" />
                <span>Create Holiday List</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. LIST VIEW: "Holiday Lists" (Screenshot 2)                              */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Holiday Lists
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Manage company holiday schedules and official rest days
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleOpenBuilder}
              className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <PlusIcon className="size-4" />
              <span>New Holiday List</span>
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-md">
            <SearchIcon className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search holiday lists..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-2xs"
            />
          </div>

          {/* Content: Empty State vs Cards / Table */}
          {filteredLists.length === 0 ? (
            <div className="p-16 text-center rounded-2xl border border-border bg-card shadow-2xs space-y-3">
              <div className="size-12 rounded-full bg-muted/60 border border-border/80 flex items-center justify-center text-muted-foreground mx-auto">
                <BoxIcon className="size-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-base text-foreground">
                No holiday lists created yet
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Click "New Holiday List" above to create your first company holiday schedule.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLists.map((list) => {
                const isDefault = list.isDefault;
                return (
                  <div
                    key={list.id}
                    className={cn(
                      'p-5 rounded-2xl border bg-card transition-all flex flex-col justify-between gap-4 shadow-2xs hover:shadow-sm',
                      isDefault
                        ? 'border-primary/50 ring-1 ring-primary/20 bg-primary/5'
                        : 'border-border hover:border-border/80'
                    )}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-base text-foreground leading-snug">
                            {list.name}
                          </h4>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            {formatDateDisplay(list.fromDate)} — {formatDateDisplay(list.toDate)}
                          </p>
                        </div>
                        {isDefault && (
                          <Badge variant="primary" className="text-[10px] uppercase font-bold shrink-0">
                            Active
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-2.5 rounded-xl bg-background border border-border/70">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">
                            Total Days
                          </span>
                          <span className="text-sm font-bold text-foreground font-mono mt-0.5 block">
                            {list.totalHolidays || list.holidays?.length || 0}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-background border border-border/70">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">
                            Weekly Off
                          </span>
                          <span className="text-sm font-bold text-foreground mt-0.5 block truncate">
                            {list.weeklyOffDay || 'Sunday'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
                      {!isDefault ? (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(list.id, list.name)}
                          className="text-primary hover:underline font-semibold cursor-pointer flex items-center gap-1"
                        >
                          <CheckIcon className="size-3.5" />
                          <span>Set as Active</span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1">
                          <CheckIcon className="size-3.5 text-primary" />
                          <span>Current Schedule</span>
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setListPendingDelete(list)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          title="Delete Holiday List"
                        >
                          <TrashIcon className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(listPendingDelete)}
        title="Delete Holiday List"
        message={`Are you sure you want to delete "${listPendingDelete?.name}"? Any upcoming holidays associated with this schedule will no longer be visible on the dashboard.`}
        confirmText="Delete Schedule"
        confirmVariant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={() => setListPendingDelete(null)}
      />
    </div>
  );
}

export default HolidayListsPage;
