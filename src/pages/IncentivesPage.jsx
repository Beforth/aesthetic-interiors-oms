'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { incentiveService } from '../services/incentiveService';
import { INCENTIVE_CATEGORIES } from '../data/incentives';
import { mockProjects } from '../data/projects';
import { mockUsers } from '../data/users';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/badge';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  GiftIcon,
  AwardIcon,
  TrophyIcon,
  SparkleIcon,
  CheckIcon,
  PlusIcon,
  SearchIcon,
  EyeIcon,
  TrashIcon,
  DownloadIcon,
  FilterIcon,
  IndianRupeeIcon,
  Building2Icon,
  ClockIcon,
  CheckCircleIcon,
  XIcon,
  TrendingIcon,
  CalendarIcon,
  UserIcon,
  MapPinIcon,
  BadgeCheckIcon,
} from '../components/ui/icons';

function formatCurrency(amount) {
  if (amount === undefined || amount === null) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

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

export function IncentivesPage() {
  const toast = useToast();
  const { currentUser } = useAuth();

  const [incentives, setIncentives] = useState(() => incentiveService.getIncentives());
  const [stats, setStats] = useState(() => incentiveService.getStats());

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'PENDING' | 'PAID'
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'amount_desc' | 'amount_asc' | 'name'

  // Modals & Dialogs
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [viewIncentive, setViewIncentive] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [payTarget, setPayTarget] = useState(null);

  // Award Form State
  const [awardForm, setAwardForm] = useState({
    recipientId: 'u4',
    recipientName: 'Ramesh Shinde',
    recipientRole: 'Artisan',
    trade: 'Carpentry',
    projectId: 'P1',
    projectName: 'Indiranagar 4BHK Luxury Villa',
    category: 'On-Time Completion',
    title: '',
    description: '',
    amount: '',
    status: 'APPROVED',
  });

  const [formErrors, setFormErrors] = useState({});

  const reloadData = () => {
    const list = incentiveService.getIncentives();
    setIncentives(list);
    setStats(incentiveService.getStats());
  };

  // Sync recipient details when selecting user in Award Form
  const handleRecipientChange = (userId) => {
    const user = mockUsers.find((u) => u.id === userId);
    if (user) {
      setAwardForm((prev) => ({
        ...prev,
        recipientId: user.id,
        recipientName: user.name,
        recipientRole: user.role === 'Worker' ? 'Artisan' : user.role,
        trade: user.role === 'Worker' ? 'Carpentry & Joinery' : 'Design / Supervision',
      }));
    }
  };

  // Sync project name when selecting project
  const handleProjectChange = (projId) => {
    const proj = mockProjects.find((p) => p.id === projId);
    if (proj) {
      setAwardForm((prev) => ({
        ...prev,
        projectId: proj.id,
        projectName: proj.name,
      }));
    }
  };

  // 1-Click Approve Action
  const handleApprove = (id) => {
    const approver = currentUser?.name ? `${currentUser.name} (${currentUser.role || 'Admin'})` : 'Rohit Kumar (Owner)';
    const updated = incentiveService.approveIncentive(id, approver);
    if (updated) {
      toast.success(`Incentive of ${formatCurrency(updated.amount)} for ${updated.recipientName} approved!`);
      reloadData();
    }
  };

  // Mark as Paid Action
  const handleConfirmPayment = () => {
    if (!payTarget) return;
    const updated = incentiveService.markAsPaid(payTarget.id, {
      paymentMethod: 'Bank Transfer (IMPS)',
    });
    if (updated) {
      toast.success(`Bonus payout of ${formatCurrency(updated.amount)} to ${updated.recipientName} marked as Paid!`);
      setPayTarget(null);
      reloadData();
    }
  };

  // Delete Action
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    incentiveService.deleteIncentive(deleteTarget.id);
    toast.info(`Incentive for ${deleteTarget.recipientName} removed`);
    setDeleteTarget(null);
    reloadData();
  };

  // Submit New Award
  const handleSaveAward = (e) => {
    e.preventDefault();
    const errors = {};
    if (!awardForm.recipientName.trim()) errors.recipientName = 'Recipient name is required';
    if (!awardForm.title.trim()) errors.title = 'Milestone title is required';
    if (!awardForm.amount || Number(awardForm.amount) <= 0) errors.amount = 'Valid bonus amount is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const created = incentiveService.createIncentive({
      ...awardForm,
      approvedBy: awardForm.status !== 'PENDING' ? (currentUser?.name || 'Rohit Kumar (Owner)') : null,
    });

    if (created) {
      toast.success(`Incentive bonus of ${formatCurrency(created.amount)} awarded to ${created.recipientName}!`);
      setIsAwardModalOpen(false);
      setAwardForm({
        recipientId: 'u4',
        recipientName: 'Ramesh Shinde',
        recipientRole: 'Artisan',
        trade: 'Carpentry',
        projectId: 'P1',
        projectName: 'Indiranagar 4BHK Luxury Villa',
        category: 'On-Time Completion',
        title: '',
        description: '',
        amount: '',
        status: 'APPROVED',
      });
      setFormErrors({});
      reloadData();
    }
  };

  // Filter & Sort Logic
  const filteredIncentives = useMemo(() => {
    return incentives
      .filter((item) => {
        // Tab filter
        if (activeTab === 'PENDING' && item.status !== 'PENDING') return false;
        if (activeTab === 'PAID' && item.status !== 'PAID') return false;

        // Category filter
        if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = (item.recipientName || '').toLowerCase().includes(q);
          const matchTrade = (item.trade || '').toLowerCase().includes(q);
          const matchProject = (item.projectName || '').toLowerCase().includes(q);
          const matchTitle = (item.title || '').toLowerCase().includes(q);
          const matchCat = (item.category || '').toLowerCase().includes(q);
          if (!matchName && !matchTrade && !matchProject && !matchTitle && !matchCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'amount_desc') return (b.amount || 0) - (a.amount || 0);
        if (sortBy === 'amount_asc') return (a.amount || 0) - (b.amount || 0);
        if (sortBy === 'name') return (a.recipientName || '').localeCompare(b.recipientName || '');
        // default newest first
        return (b.awardedDate || '').localeCompare(a.awardedDate || '');
      });
  }, [incentives, activeTab, categoryFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Page Header with Actions */}
      <PageHeader
        title="Incentives & Performance Bonuses"
        subtitle="Manage artisan milestone awards, quality incentives, and turnkey delivery bonuses"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => incentiveService.exportCSV(filteredIncentives)}
              className="gap-1.5 text-xs font-semibold"
              data-tooltip="Download incentives report CSV"
            >
              <DownloadIcon className="size-3.5 text-muted-foreground" />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setFormErrors({});
                setIsAwardModalOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold shadow-xs"
              data-tooltip="Award milestone bonus to worker or supervisor"
            >
              <PlusIcon className="size-3.5" />
              <span>Award Incentive</span>
            </Button>
          </div>
        }
      />

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Disbursed */}
        <Card bodyClassName="p-4 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Total Disbursed
            </span>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {formatCurrency(stats.totalDisbursed)}
            </div>
            <p className="text-[11px] text-success flex items-center gap-1 font-medium">
              <CheckCircleIcon className="size-3" />
              <span>{stats.paidCount} bonuses paid out</span>
            </p>
          </div>
          <div className="size-11 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success shrink-0">
            <IndianRupeeIcon className="size-5" />
          </div>
        </Card>

        {/* Card 2: Pending Approval & Payout */}
        <Card bodyClassName="p-4 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Pending Payout
            </span>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {formatCurrency(stats.pendingPayout)}
            </div>
            <p className="text-[11px] text-warning flex items-center gap-1 font-medium">
              <ClockIcon className="size-3" />
              <span>{stats.pendingCount + stats.approvedCount} awaiting disbursement</span>
            </p>
          </div>
          <div className="size-11 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning shrink-0">
            <ClockIcon className="size-5" />
          </div>
        </Card>

        {/* Card 3: Qualified Earners */}
        <Card bodyClassName="p-4 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Rewarded Earners
            </span>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {stats.uniqueEarners} <span className="text-sm font-normal text-muted-foreground">Workers</span>
            </div>
            <p className="text-[11px] text-primary flex items-center gap-1 font-medium">
              <BadgeCheckIcon className="size-3" />
              <span>Across {mockProjects.length} active sites</span>
            </p>
          </div>
          <div className="size-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <AwardIcon className="size-5" />
          </div>
        </Card>

        {/* Card 4: Top Milestone Bonus */}
        <Card bodyClassName="p-4 flex items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Highest Bonus
            </span>
            <div className="text-2xl font-bold font-mono tracking-tight text-foreground">
              {formatCurrency(stats.highestIncentive)}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium truncate">
              <TrophyIcon className="size-3 text-warning shrink-0" />
              <span>Turnkey booking commission</span>
            </p>
          </div>
          <div className="size-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-warning shrink-0">
            <TrophyIcon className="size-5" />
          </div>
        </Card>
      </div>

      {/* 3. Filter & Search Toolbar */}
      <div className="bg-card border border-border rounded-xl p-3 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick View Filter Tabs */}
          <div className="inline-flex items-center gap-1 p-1 bg-muted/60 border border-border rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-md transition-all cursor-pointer',
                activeTab === 'ALL'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Incentives ({incentives.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PENDING')}
              className={cn(
                'px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5',
                activeTab === 'PENDING'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>Pending Review</span>
              {stats.pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-warning/20 text-warning font-bold">
                  {stats.pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PAID')}
              className={cn(
                'px-3 py-1.5 rounded-md transition-all cursor-pointer',
                activeTab === 'PAID'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Paid Out ({stats.paidCount})
            </button>
          </div>

          {/* Right Toolbar Controls: Search, Category, Sort */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 justify-end min-w-0">
            {/* Search Input */}
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <SearchIcon className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipient, trade, site..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-1.5">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                aria-label="Filter by category"
              >
                <option value="ALL">All Schemes</option>
                {INCENTIVE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-8.5 px-2.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
              aria-label="Sort incentives"
            >
              <option value="newest">Newest First</option>
              <option value="amount_desc">Amount (Highest)</option>
              <option value="amount_asc">Amount (Lowest)</option>
              <option value="name">Recipient Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Incentives Data Table */}
      <Card bodyClassName="p-0 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="py-3 px-4 font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                  Beneficiary
                </th>
                <th className="py-3 px-4 font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                  Project Site
                </th>
                <th className="py-3 px-4 font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                  Incentive Scheme & Milestone
                </th>
                <th className="py-3 px-4 font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                  Amount
                </th>
                <th className="py-3 px-4 font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                  Awarded Date
                </th>
                <th className="py-3 px-4 font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="py-3 px-4 font-bold text-[11px] text-muted-foreground uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredIncentives.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="size-12 rounded-full bg-muted/60 border border-border flex items-center justify-center text-muted-foreground mx-auto mb-3">
                      <GiftIcon className="size-6 text-muted-foreground/60" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">No incentives found</p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                      {searchQuery || categoryFilter !== 'ALL' || activeTab !== 'ALL'
                        ? 'Try clearing active filters or search keyword to view all records.'
                        : 'Click "Award Incentive" to grant a performance bonus to an artisan or supervisor.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredIncentives.map((item) => {
                  const isPaid = item.status === 'PAID';
                  const isApproved = item.status === 'APPROVED';
                  const isPending = item.status === 'PENDING';

                  return (
                    <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                      {/* 1. Beneficiary */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={item.recipientName}
                            size="md"
                            className="bg-primary/10 text-primary font-bold border border-primary/20 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground text-xs block truncate">
                              {item.recipientName}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] text-muted-foreground font-medium truncate">
                                {item.trade}
                              </span>
                              <span className="text-muted-foreground/40">•</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                                {item.recipientRole}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Project Site */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          <Building2Icon className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[180px]">{item.projectName}</span>
                        </div>
                      </td>

                      {/* 3. Scheme & Milestone */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground">
                              <SparkleIcon className="size-3 text-warning shrink-0" />
                              {item.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-xs">
                            {item.description || item.category}
                          </p>
                        </div>
                      </td>

                      {/* 4. Amount */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-xs font-bold font-mono text-foreground">
                          {formatCurrency(item.amount)}
                        </span>
                      </td>

                      {/* 5. Awarded Date */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatDateDisplay(item.awardedDate)}
                      </td>

                      {/* 6. Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-success/10 text-success border border-success/30">
                            <CheckIcon className="size-3" />
                            <span>Paid</span>
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/30">
                            <BadgeCheckIcon className="size-3" />
                            <span>Approved</span>
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-warning/10 text-warning border border-warning/30">
                            <ClockIcon className="size-3" />
                            <span>Pending Review</span>
                          </span>
                        )}
                      </td>

                      {/* 7. Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1-Click Approve (for Pending) */}
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleApprove(item.id)}
                              className="size-7 rounded-md flex items-center justify-center text-success hover:bg-success/15 transition-colors cursor-pointer"
                              title="Approve this bonus"
                              data-tooltip="Approve incentive"
                              aria-label="Approve"
                            >
                              <CheckIcon className="size-3.5" />
                            </button>
                          )}

                          {/* 1-Click Mark as Paid (for Approved) */}
                          {isApproved && (
                            <button
                              type="button"
                              onClick={() => setPayTarget(item)}
                              className="size-7 rounded-md flex items-center justify-center text-primary hover:bg-primary/15 transition-colors cursor-pointer"
                              title="Disburse / Mark as Paid"
                              data-tooltip="Disburse bonus"
                              aria-label="Mark Paid"
                            >
                              <IndianRupeeIcon className="size-3.5" />
                            </button>
                          )}

                          {/* View Detail */}
                          <button
                            type="button"
                            onClick={() => setViewIncentive(item)}
                            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="View incentive breakdown"
                            data-tooltip="View details"
                            aria-label="View Details"
                          >
                            <EyeIcon className="size-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            title="Delete incentive"
                            data-tooltip="Delete bonus"
                            aria-label="Delete"
                          >
                            <TrashIcon className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* MODAL 1: Award Incentive Form                                            */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAwardModalOpen}
        onClose={() => setIsAwardModalOpen(false)}
        title="Award Incentive / Performance Bonus"
        subtitle="Reward site artisans, designers, or supervisors for milestone excellence"
        size="lg"
        bodyClassName="p-6"
      >
        <form onSubmit={handleSaveAward} className="space-y-4 text-xs">
          {/* Row 1: Beneficiary & Project */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Recipient / Beneficiary <span className="text-destructive">*</span>
              </label>
              <select
                value={awardForm.recipientId}
                onChange={(e) => handleRecipientChange(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg bg-background border border-border text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {mockUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Associated Project Site <span className="text-destructive">*</span>
              </label>
              <select
                value={awardForm.projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg bg-background border border-border text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {mockProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Category & Bonus Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Incentive Scheme / Category <span className="text-destructive">*</span>
              </label>
              <select
                value={awardForm.category}
                onChange={(e) => setAwardForm({ ...awardForm, category: e.target.value })}
                className="w-full h-9 px-3 text-xs rounded-lg bg-background border border-border text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {INCENTIVE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Bonus Amount (₹) <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono font-bold text-xs">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="100"
                  value={awardForm.amount}
                  onChange={(e) => {
                    setAwardForm({ ...awardForm, amount: e.target.value });
                    if (formErrors.amount) setFormErrors({ ...formErrors, amount: null });
                  }}
                  placeholder="e.g. 5000"
                  className={cn(
                    'w-full h-9 pl-7 pr-3 text-xs rounded-lg bg-background border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary transition-all',
                    formErrors.amount ? 'border-destructive ring-1 ring-destructive/40' : 'border-border'
                  )}
                />
              </div>
              {formErrors.amount && <p className="text-[11px] text-destructive">{formErrors.amount}</p>}
            </div>
          </div>

          {/* Row 3: Milestone Title */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Achievement Milestone Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={awardForm.title}
              onChange={(e) => {
                setAwardForm({ ...awardForm, title: e.target.value });
                if (formErrors.title) setFormErrors({ ...formErrors, title: null });
              }}
              placeholder="e.g. Delivered modular wardrobes 3 days ahead of handover"
              className={cn(
                'w-full h-9 px-3 text-xs rounded-lg bg-background border text-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-all',
                formErrors.title ? 'border-destructive ring-1 ring-destructive/40' : 'border-border'
              )}
            />
            {formErrors.title && <p className="text-[11px] text-destructive">{formErrors.title}</p>}
          </div>

          {/* Row 4: Detailed Reason & Notes */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Justification & Performance Notes
            </label>
            <textarea
              rows={2}
              value={awardForm.description}
              onChange={(e) => setAwardForm({ ...awardForm, description: e.target.value })}
              placeholder="Provide specific metrics, client feedback, or quality audit observations..."
              className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Row 5: Initial Approval Status */}
          <div className="space-y-1.5 p-3 rounded-lg border border-border bg-card">
            <label className="block text-[11px] font-bold text-foreground">
              Initial Approval Status
            </label>
            <div className="flex items-center gap-4 pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-foreground font-medium">
                <input
                  type="radio"
                  name="awardStatus"
                  value="APPROVED"
                  checked={awardForm.status === 'APPROVED'}
                  onChange={() => setAwardForm({ ...awardForm, status: 'APPROVED' })}
                  className="accent-primary"
                />
                <span>Approve Immediately (Ready for Payout)</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-foreground font-medium">
                <input
                  type="radio"
                  name="awardStatus"
                  value="PENDING"
                  checked={awardForm.status === 'PENDING'}
                  onChange={() => setAwardForm({ ...awardForm, status: 'PENDING' })}
                  className="accent-primary"
                />
                <span>Submit for Manager Review</span>
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-card border-t border-border z-20 flex items-center justify-end gap-2 shadow-xs">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAwardModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" className="gap-1.5">
              <CheckIcon className="size-3.5" />
              <span>Grant Incentive</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: View Incentive Detail                                           */}
      {/* ========================================================================= */}
      {viewIncentive && (
        <Modal
          isOpen={!!viewIncentive}
          onClose={() => setViewIncentive(null)}
          title="Incentive Award Breakdown"
          subtitle={`Reference ID: ${viewIncentive.id}`}
          size="md"
          bodyClassName="p-6 space-y-4"
        >
          {/* Header Card */}
          <div className="p-4 rounded-xl border border-border bg-muted/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar
                name={viewIncentive.recipientName}
                size="lg"
                className="bg-primary/10 text-primary font-bold text-base"
              />
              <div>
                <h3 className="font-bold text-sm text-foreground">{viewIncentive.recipientName}</h3>
                <p className="text-xs text-muted-foreground">
                  {viewIncentive.trade} • {viewIncentive.recipientRole}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Bonus Amount
              </span>
              <span className="text-xl font-bold font-mono text-foreground">
                {formatCurrency(viewIncentive.amount)}
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-border bg-card space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Project Site
              </span>
              <p className="font-medium text-foreground">{viewIncentive.projectName}</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Category
              </span>
              <p className="font-medium text-foreground">{viewIncentive.category}</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Awarded Date
              </span>
              <p className="font-mono text-foreground">{formatDateDisplay(viewIncentive.awardedDate)}</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Status
              </span>
              <div>
                {viewIncentive.status === 'PAID' ? (
                  <Badge variant="success" className="text-[10px] px-2 py-0.5">
                    Paid ({formatDateDisplay(viewIncentive.paidDate)})
                  </Badge>
                ) : viewIncentive.status === 'APPROVED' ? (
                  <Badge variant="primary" className="text-[10px] px-2 py-0.5">
                    Approved for Payout
                  </Badge>
                ) : (
                  <Badge variant="warning" className="text-[10px] px-2 py-0.5">
                    Pending Review
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Milestone Details */}
          <div className="p-3.5 rounded-lg border border-border bg-card space-y-1.5 text-xs">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Milestone Achievement
            </span>
            <p className="font-bold text-foreground text-xs">{viewIncentive.title}</p>
            <p className="text-muted-foreground leading-relaxed">
              {viewIncentive.description || 'No additional notes provided.'}
            </p>
          </div>

          {/* Payment Details if Paid */}
          {viewIncentive.status === 'PAID' && (
            <div className="p-3 rounded-lg border border-success/30 bg-success/5 space-y-1 text-xs">
              <span className="text-[10px] font-bold text-success uppercase tracking-wider block">
                Disbursement Record
              </span>
              <p className="text-foreground">
                Paid on <strong className="font-mono">{formatDateDisplay(viewIncentive.paidDate)}</strong> via{' '}
                {viewIncentive.paymentMethod || 'Bank Transfer'}.
              </p>
              {viewIncentive.referenceNo && (
                <p className="font-mono text-muted-foreground text-[11px]">
                  Ref No: {viewIncentive.referenceNo}
                </p>
              )}
            </div>
          )}

          {/* Modal Footer */}
          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-card border-t border-border z-20 flex items-center justify-end gap-2 shadow-xs">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewIncentive(null)}
            >
              Close
            </Button>
            {viewIncentive.status === 'PENDING' && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  handleApprove(viewIncentive.id);
                  setViewIncentive(null);
                }}
                className="gap-1.5"
              >
                <CheckIcon className="size-3.5" />
                <span>Approve Bonus</span>
              </Button>
            )}
            {viewIncentive.status === 'APPROVED' && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setPayTarget(viewIncentive);
                  setViewIncentive(null);
                }}
                className="gap-1.5"
              >
                <IndianRupeeIcon className="size-3.5" />
                <span>Disburse Payout</span>
              </Button>
            )}
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* CONFIRM 1: Mark As Paid Confirmation                                     */}
      {/* ========================================================================= */}
      {payTarget && (
        <ConfirmDialog
          isOpen={!!payTarget}
          onClose={() => setPayTarget(null)}
          onConfirm={handleConfirmPayment}
          title="Disburse Incentive Payout"
          message={`Are you sure you want to mark the ${formatCurrency(payTarget.amount)} bonus for ${payTarget.recipientName} as Paid? This will log payment confirmation in the incentives ledger.`}
          confirmLabel="Confirm Payout"
          confirmVariant="primary"
        />
      )}

      {/* ========================================================================= */}
      {/* CONFIRM 2: Delete Incentive Confirmation                                 */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Incentive Award"
          message={`Are you sure you want to remove the ${formatCurrency(deleteTarget.amount)} incentive awarded to ${deleteTarget.recipientName}? This cannot be undone.`}
          confirmLabel="Delete"
          confirmVariant="destructive"
        />
      )}
    </div>
  );
}

export default IncentivesPage;
