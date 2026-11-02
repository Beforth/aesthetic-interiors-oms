'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { notificationService } from '../services/notificationService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Select from '../components/ui/Select';
import Checkbox from '../components/ui/Checkbox';
import Badge from '../components/ui/badge';
import Modal from '../components/ui/Modal';
import {
  BellIcon,
  SearchIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  FileSpreadsheetIcon,
  WalletIcon,
  CheckCircleIcon,
  ChevronRightIcon,
} from '../components/ui/icons';

/**
 * Filter tabs matching user's reference screenshot (Image 1)
 */
const FILTER_TABS = [
  { id: 'all', label: 'All', icon: BellIcon },
  { id: 'attendance', label: 'Attendance', icon: CheckIcon },
  { id: 'shifts', label: 'Shifts', icon: CalendarIcon },
  { id: 'leave', label: 'Leave', icon: ClockIcon },
  { id: 'expenses', label: 'Expenses', icon: WalletIcon },
  { id: 'payroll', label: 'Payroll', icon: FileSpreadsheetIcon },
];

export function NotificationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentUser, hasPermission } = useAuth();

  // Active filter tab
  const [activeTab, setActiveTab] = useState('all');

  // Search input query
  const [searchQuery, setSearchQuery] = useState('');

  // Selected notification IDs for batch actions
  const [selectedIds, setSelectedIds] = useState([]);

  // All visible notifications according to user's granular role permissions
  const [notifications, setNotifications] = useState([]);

  // Announcement Modal State
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    category: 'announcements',
    description: '',
  });

  // Sync notifications from notificationService factoring role permissions
  const loadNotifications = useCallback(() => {
    if (!currentUser) return;
    const list = notificationService.getVisibleNotifications(currentUser, hasPermission);
    setNotifications(list);
  }, [currentUser, hasPermission]);

  useEffect(() => {
    loadNotifications();

    const handleStorageUpdate = () => {
      loadNotifications();
    };

    window.addEventListener(notificationService.EVENT_NAME, handleStorageUpdate);
    return () => window.removeEventListener(notificationService.EVENT_NAME, handleStorageUpdate);
  }, [loadNotifications]);

  // Compute filtered notifications list
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // 1. Tab category filter
      if (activeTab !== 'all') {
        if (activeTab === 'expenses') {
          if (item.category !== 'expenses' && item.category !== 'payments') return false;
        } else if (activeTab === 'payroll') {
          if (item.category !== 'payroll' && item.category !== 'dsr') return false;
        } else if (item.category !== activeTab) {
          return false;
        }
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        const matchTime = item.time?.toLowerCase().includes(q);
        const matchBadge = item.badge?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchTime && !matchBadge) return false;
      }

      return true;
    });
  }, [notifications, activeTab, searchQuery]);

  // Handle single item deletion
  const handleDeleteSingle = (id, e) => {
    e?.stopPropagation();
    notificationService.deleteNotification(id);
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    toast.success('Notification removed');
  };

  // Handle Delete All / Clear
  const handleDeleteAll = () => {
    if (filteredNotifications.length === 0) return;
    notificationService.deleteAllNotifications(activeTab);
    setSelectedIds([]);
    toast.success(
      activeTab === 'all'
        ? 'All notifications cleared'
        : `All ${activeTab} notifications cleared`
    );
  };

  // Handle batch deletion
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    notificationService.deleteNotifications(selectedIds);
    setSelectedIds([]);
    toast.success(`Removed ${selectedIds.length} notification(s)`);
  };

  // Handle batch mark as read
  const handleMarkSelectedAsRead = () => {
    if (selectedIds.length === 0) return;
    const updated = notifications.map((n) =>
      selectedIds.includes(n.id) ? { ...n, unread: false } : n
    );
    notificationService.saveNotifications(updated);
    setSelectedIds([]);
    toast.success(`Marked ${selectedIds.length} notification(s) as read`);
  };

  // Checkbox toggle single item
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Select all visible toggle
  const isAllSelected =
    filteredNotifications.length > 0 &&
    filteredNotifications.every((n) => selectedIds.includes(n.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map((n) => n.id));
    }
  };

  // Handle posting new announcement
  const handleCreateAnnouncement = (e) => {
    e.preventDefault();
    if (!announcementForm.title.trim()) {
      toast.error('Announcement title is required');
      return;
    }
    if (!announcementForm.description.trim()) {
      toast.error('Announcement message is required');
      return;
    }

    notificationService.addAnnouncement(announcementForm);
    toast.success('Announcement broadcasted successfully to all staff!');
    setIsAnnouncementModalOpen(false);
    setAnnouncementForm({
      title: '',
      category: 'announcements',
      description: '',
    });
  };

  return (
    <div className="space-y-5 pb-12 animate-fadeIn select-none">
      {/* Top Breadcrumbs (matching reference screenshot) */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>Aesthetic Interiors</span>
        <ChevronRightIcon className="size-3 text-muted-foreground/60" />
        <span className="font-semibold text-foreground">Notifications</span>
      </div>

      {/* Main Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Notifications & Updates
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Management updates & user requests
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAnnouncementModalOpen(true)}
          className="flex items-center gap-1.5 self-start sm:self-auto font-semibold shadow-2xs"
        >
          <PlusIcon className="size-4" />
          <span>New Announcement</span>
        </Button>
      </div>

      {/* Controls Bar: Filter Pills & Search / Delete (matching screenshot) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {FILTER_TABS.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedIds([]);
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-card text-muted-foreground border border-border hover:bg-muted hover:text-foreground'
                }`}
              >
                <IconComponent className="size-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Search Input & Delete All */}
        <div className="flex items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <SearchIcon className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteAll}
            disabled={filteredNotifications.length === 0}
            className="h-8 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive shrink-0"
          >
            <TrashIcon className="size-3.5" />
            <span>Delete All</span>
          </Button>
        </div>
      </div>

      {/* Bulk Selection Actions Banner */}
      {selectedIds.length > 0 && (
        <div className="p-2.5 rounded-xl border border-border bg-card shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">{selectedIds.length} selected</span>
            <span className="text-muted-foreground">across this view</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={handleMarkSelectedAsRead}
              className="flex items-center gap-1"
            >
              <CheckCircleIcon className="size-3" />
              <span>Mark as Read</span>
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={handleDeleteSelected}
              className="flex items-center gap-1 text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <TrashIcon className="size-3" />
              <span>Delete Selected</span>
            </Button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer ml-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Notifications List Container Card */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        {/* Table / List Header */}
        <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
          <div className="flex items-center gap-3">
            <Checkbox
              id="select-all-notifications"
              checked={isAllSelected}
              onChange={handleToggleSelectAll}
              aria-label="Select all notifications"
            />
            <span className="uppercase tracking-wider">
              {filteredNotifications.length} Notification
              {filteredNotifications.length === 1 ? '' : 's'}
            </span>
          </div>

          {filteredNotifications.some((n) => n.unread) && (
            <button
              type="button"
              onClick={() => {
                notificationService.markAllNotificationsAsRead();
                toast.success('All marked as read');
              }}
              className="text-primary hover:underline font-semibold cursor-pointer"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Notification Items Rows */}
        <div className="divide-y divide-border/60">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-2">
              <CheckCircleIcon className="size-8 text-emerald-500 mx-auto opacity-75" />
              <div className="text-sm font-semibold text-foreground">
                No notifications in this category
              </div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchQuery
                  ? 'No notifications match your search query.'
                  : "You're all caught up with your operational updates and site notices!"}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isSelected = selectedIds.includes(notif.id);

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    notificationService.markNotificationAsRead(notif.id);
                    if (notif.path) navigate(notif.path);
                  }}
                  className={`px-4 py-3.5 flex items-start sm:items-center justify-between gap-3 transition-colors cursor-pointer group ${
                    isSelected
                      ? 'bg-primary/5'
                      : notif.unread
                        ? 'bg-muted/20 hover:bg-muted/40'
                        : 'hover:bg-muted/30'
                  }`}
                >
                  {/* Left: Checkbox & Content */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div
                      className="pt-0.5 sm:pt-0 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        id={`notif-check-${notif.id}`}
                        checked={isSelected}
                        onChange={() => handleToggleSelect(notif.id)}
                        aria-label={`Select ${notif.title}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs truncate ${
                            notif.unread
                              ? 'font-bold text-foreground'
                              : 'font-semibold text-foreground/90'
                          }`}
                        >
                          {notif.title}
                        </span>

                        {notif.badge && (
                          <Badge
                            variant={notif.badgeVariant || 'secondary'}
                            size="sm"
                            className="font-medium capitalize text-[10px]"
                          >
                            {notif.badge}
                          </Badge>
                        )}

                        {notif.unread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-1">
                        {notif.description}
                      </p>
                    </div>
                  </div>

                  {/* Right: Timestamp & Delete Icon Button */}
                  <div className="flex items-center gap-3 shrink-0 self-center">
                    <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap hidden sm:inline">
                      {notif.time}
                    </span>

                    <button
                      type="button"
                      title="Delete notification"
                      onClick={(e) => handleDeleteSingle(notif.id, e)}
                      className="p-1 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                    >
                      <TrashIcon className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: Post New Announcement */}
      {isAnnouncementModalOpen && (
        <Modal
          isOpen={isAnnouncementModalOpen}
          onClose={() => setIsAnnouncementModalOpen(false)}
          title="Create New Announcement"
          subtitle="Broadcast message to all staff, site supervisors, and active workforce"
          size="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAnnouncementModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateAnnouncement}
                className="font-semibold shadow-2xs"
              >
                Post Announcement
              </Button>
            </div>
          }
        >
          <form onSubmit={handleCreateAnnouncement} className="space-y-4 py-1 text-xs">
            <Input
              label="Announcement Title"
              required
              placeholder="e.g. Diwali Trade Safety & Office Schedule"
              value={announcementForm.title}
              onChange={(e) =>
                setAnnouncementForm({ ...announcementForm, title: e.target.value })
              }
            />

            <Select
              label="Category Feed"
              value={announcementForm.category}
              onChange={(e) =>
                setAnnouncementForm({ ...announcementForm, category: e.target.value })
              }
              options={[
                { value: 'announcements', label: 'General Announcement' },
                { value: 'attendance', label: 'Attendance & Punch Notice' },
                { value: 'shifts', label: 'Shift & Roster Policy' },
                { value: 'leave', label: 'Leave Policy Update' },
                { value: 'expenses', label: 'Billing & Payments Advisory' },
                { value: 'payroll', label: 'DSR & Site Execution Guidelines' },
              ]}
            />

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">
                Announcement Message <span className="text-destructive">*</span>
              </label>
              <Textarea
                rows={3}
                required
                placeholder="Write message details for the workforce..."
                value={announcementForm.description}
                onChange={(e) =>
                  setAnnouncementForm({ ...announcementForm, description: e.target.value })
                }
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default NotificationsPage;
