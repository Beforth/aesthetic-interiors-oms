'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { notificationService } from '../services/notificationService';
import Tabs from '../components/ui/Tabs';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Select from '../components/ui/Select';
import Checkbox from '../components/ui/Checkbox';
import Badge from '../components/ui/badge';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Pagination from '../components/ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import {
  SearchIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ChevronRightIcon,
} from '../components/ui/icons';

/**
 * Filter tabs matching user's reference screenshot (Image 1)
 */
const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'shifts', label: 'Shifts' },
  { id: 'leave', label: 'Leave' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'payroll', label: 'Payroll' },
];

export function NotificationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentUser, hasPermission } = useAuth();

  // The toast object is recreated by its provider; a ref keeps async callbacks current
  // without making the load callback change on every render.
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const mountedRef = useRef(true);

  // Active filter tab
  const [activeTab, setActiveTab] = useState('all');

  // Search input query
  const [searchQuery, setSearchQuery] = useState('');

  // Selected notification IDs for batch actions
  const [selectedIds, setSelectedIds] = useState([]);

  // All visible notifications according to user's granular role permissions
  const [notifications, setNotifications] = useState([]);

  // Delete confirmation target: { ids, label }
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Announcement Modal State
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    category: 'announcements',
    description: '',
  });

  // Sync notifications from notificationService factoring role permissions
  const loadNotifications = useCallback(async () => {
    if (!currentUser) return [];
    try {
      const list = await notificationService.getVisibleNotifications(currentUser, hasPermission);
      if (mountedRef.current) {
        setNotifications(Array.isArray(list) ? list : []);
      }
      return list;
    } catch (error) {
      toastRef.current.error(error?.message || 'Unable to load notifications');
      return [];
    }
  }, [currentUser, hasPermission]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Opening the notifications page means all of them have been seen, so clear the bell badge.
  useEffect(() => {
    notificationService.markAllNotificationsAsRead().catch(() => {});
  }, []);

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

  const notificationPager = usePagination(filteredNotifications);

  // Report a failed action with the existing toast and re-sync either way.
  const showActionError = (error, fallbackMessage) => {
    toast.error(error?.message || fallbackMessage);
    loadNotifications();
  };

  // All deletion paths go through one confirmation dialog
  const handleDeleteSingle = (id, e) => {
    e?.stopPropagation();
    setDeleteTarget({ ids: [id], label: 'this notification' });
  };

  const handleDeleteAll = () => {
    if (filteredNotifications.length === 0) return;
    setDeleteTarget({
      ids: filteredNotifications.map((n) => n.id),
      label: activeTab === 'all' ? 'all notifications' : `all ${activeTab} notifications`,
    });
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setDeleteTarget({
      ids: [...selectedIds],
      label: `${selectedIds.length} selected notification(s)`,
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { ids, label } = deleteTarget;
    try {
      await notificationService.deleteNotifications(ids);
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
      await loadNotifications();
      toast.success(`Removed ${label}`);
    } catch (error) {
      showActionError(error, 'Unable to remove notifications');
    }
    setDeleteTarget(null);
  };

  // Handle batch mark as read
  const handleMarkSelectedAsRead = async () => {
    if (selectedIds.length === 0) return;
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map((id) => notificationService.markNotificationAsRead(id)));
      setSelectedIds([]);
      await loadNotifications();
      toast.success(`Marked ${ids.length} notification(s) as read`);
    } catch (error) {
      showActionError(error, 'Unable to mark notifications as read');
    }
  };

  // Handle "Mark all as read" in the feed header
  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllNotificationsAsRead();
      await loadNotifications();
      toast.success('All marked as read');
    } catch (error) {
      showActionError(error, 'Unable to mark all as read');
    }
  };

  // Mark a row as read, then follow its link
  const handleOpenNotification = async (notif) => {
    try {
      await notificationService.markNotificationAsRead(notif.id);
      await loadNotifications();
    } catch (error) {
      showActionError(error, 'Unable to mark notification as read');
    }
    if (notif.path) navigate(notif.path);
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
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementForm.title.trim()) {
      toast.error('Announcement title is required');
      return;
    }
    if (!announcementForm.description.trim()) {
      toast.error('Announcement message is required');
      return;
    }

    try {
      await notificationService.addAnnouncement(announcementForm);
      await loadNotifications();
      toast.success('Announcement broadcasted successfully to all staff!');
      setIsAnnouncementModalOpen(false);
      setAnnouncementForm({
        title: '',
        category: 'announcements',
        description: '',
      });
    } catch (error) {
      showActionError(error, 'Unable to post announcement');
    }
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

      {/* Controls: minimal tab bar + outlined search */}
      <Tabs
        tabs={FILTER_TABS}
        activeTab={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          setSelectedIds([]);
        }}
      />

      {/* Search / Delete All */}
      <div className="pt-3">
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
        <div className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs animate-fadeIn">
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

      {/* Notifications feed — open list, no surrounding box */}
      <div className="pt-1">
        {/* Feed meta row */}
        <div className="pb-2 border-b border-border flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
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
              onClick={handleMarkAllRead}
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
            notificationPager.paginatedItems.map((notif) => {
              const isSelected = selectedIds.includes(notif.id);

              return (
                <div
                  key={notif.id}
                  onClick={() => handleOpenNotification(notif)}
                  className={`px-3 py-3.5 flex items-start justify-between gap-3 border-l-2 transition-colors cursor-pointer group ${
                    isSelected
                      ? 'border-l-primary bg-primary/5'
                      : notif.unread
                        ? 'border-l-primary bg-muted/20 hover:bg-muted/40'
                        : 'border-l-transparent hover:bg-muted/30'
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
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-1">
                        <span>{notif.category || 'update'}</span>
                        <span className="size-0.5 rounded-full bg-muted-foreground/50" />
                        <span className="font-mono normal-case tracking-normal">{notif.time}</span>
                      </div>
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

                  {/* Right: Delete */}
                  <div className="flex items-center shrink-0 self-center">
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

        {filteredNotifications.length > 0 && (
          <div className="border-t border-border/70 px-3 py-3">
            <Pagination {...notificationPager.pagination} />
          </div>
        )}
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

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete notifications?"
        message={`Are you sure you want to delete ${deleteTarget?.label || 'these notifications'}? This action cannot be undone.`}
        confirmText="Delete"
      />
    </div>
  );
}

export default NotificationsPage;
