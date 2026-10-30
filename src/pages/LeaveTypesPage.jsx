'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../context/ToastContext';
import { attendanceService } from '../services/attendanceService';
import { mockLeaveTypes } from '../data/attendance';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Textarea } from '../components/ui/Textarea';
import { SearchIcon, PlusIcon, EditIcon, TrashIcon, SortIcon, ArrowUpDownIcon } from '../components/ui/icons';

/**
 * Leave Types Management Page
 * Conforming strictly to BefUI tokens and design.md standards.
 */
export function LeaveTypesPage() {
  const toast = useToast();

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState('name'); // 'name' | 'days'
  const [sortAsc, setSortAsc] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deletingType, setDeletingType] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    daysPerYear: 12,
    carryForward: 'No',
    description: '',
    status: 'Active',
  });
  const [formErrors, setFormErrors] = useState({});

  // Fetch initial leave types
  const fetchTypes = async () => {
    try {
      setLoading(true);
      const data = await attendanceService.getLeaveTypes();
      if (Array.isArray(data) && data.length > 0) {
        setLeaveTypes(data);
      } else {
        setLeaveTypes(mockLeaveTypes);
      }
    } catch {
      setLeaveTypes(mockLeaveTypes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  // Filter & Sort Logic
  const filteredTypes = useMemo(() => {
    return leaveTypes.filter((lt) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        lt.name.toLowerCase().includes(q) ||
        (lt.description && lt.description.toLowerCase().includes(q));

      const matchStatus = statusFilter === 'ALL' || (lt.status || 'Active') === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [leaveTypes, search, statusFilter]);

  const sortedTypes = useMemo(() => {
    const list = [...filteredTypes];
    list.sort((a, b) => {
      if (sortField === 'days') {
        const daysA = Number(a.daysPerYear) || 0;
        const daysB = Number(b.daysPerYear) || 0;
        return sortAsc ? daysA - daysB : daysB - daysA;
      }
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
    return list;
  }, [filteredTypes, sortField, sortAsc]);

  const handleToggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Add / Edit Modal Openers
  const handleOpenAdd = () => {
    setEditingType(null);
    setFormData({
      name: '',
      daysPerYear: 12,
      carryForward: 'No',
      description: '',
      status: 'Active',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lt) => {
    setEditingType(lt);
    setFormData({
      name: lt.name,
      daysPerYear: lt.daysPerYear,
      carryForward: lt.carryForward || 'No',
      description: lt.description && lt.description !== '-' ? lt.description : '',
      status: lt.status || 'Active',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenDelete = (lt) => {
    setDeletingType(lt);
  };

  // Save / Update Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.name || !formData.name.trim()) {
      errors.name = 'Leave type title is required';
    }
    const days = Number(formData.daysPerYear);
    if (!days || days < 1 || days > 365) {
      errors.daysPerYear = 'Days per year must be between 1 and 365';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      if (editingType) {
        await attendanceService.updateLeaveType(editingType.id, {
          ...formData,
          daysPerYear: Number(formData.daysPerYear),
          description: formData.description.trim() || '-',
        });
        toast.success(`Leave type "${formData.name}" updated successfully`);
      } else {
        await attendanceService.addLeaveType({
          name: formData.name.trim(),
          daysPerYear: Number(formData.daysPerYear),
          carryForward: formData.carryForward,
          description: formData.description.trim() || '-',
          status: formData.status,
        });
        toast.success(`Leave type "${formData.name}" created successfully`);
      }
      setIsModalOpen(false);
      fetchTypes();
    } catch (err) {
      toast.error(err.message || 'Failed to save leave type');
    }
  };

  // Delete Handler
  const handleConfirmDelete = async () => {
    if (!deletingType) return;
    try {
      await attendanceService.deleteLeaveType(deletingType.id);
      toast.success(`Leave type "${deletingType.name}" deleted`);
      setDeletingType(null);
      fetchTypes();
    } catch (err) {
      toast.error(err.message || 'Failed to delete leave type');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave Types</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage leave categories</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 shadow-2xs font-semibold"
        >
          <PlusIcon className="size-4" />
          <span>Add Leave Type</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search leave types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
          />
        </div>

        {/* Status Dropdown & Sort */}
        <div className="flex items-center gap-2">
          <Select
            aria-label="Filter status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 min-w-[130px] text-xs"
            options={[
              { value: 'ALL', label: 'All Status' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' },
            ]}
          />
          <button
            type="button"
            onClick={() => handleToggleSort(sortField === 'name' ? 'days' : 'name')}
            title="Toggle sort order"
            className="h-9 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center"
          >
            <ArrowUpDownIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Leave Types Table */}
      <div className="rounded-xl border border-border bg-card shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
                <th
                  className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleToggleSort('name')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>LEAVE TYPE</span>
                    <span className="text-[10px] font-mono">
                      {sortField === 'name' ? (sortAsc ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleToggleSort('days')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>DAYS / YEAR</span>
                    <span className="text-[10px] font-mono">
                      {sortField === 'days' ? (sortAsc ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold">CARRY FORWARD</th>
                <th className="px-4 py-3 font-semibold">DESCRIPTION</th>
                <th className="px-4 py-3 font-semibold">STATUS</th>
                <th className="px-4 py-3 font-semibold text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    Loading leave categories...
                  </td>
                </tr>
              ) : sortedTypes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    No leave types match your search criteria.
                  </td>
                </tr>
              ) : (
                sortedTypes.map((lt) => (
                  <tr
                    key={lt.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* Leave Type Name */}
                    <td className="px-4 py-3.5 font-bold text-foreground">
                      {lt.name}
                    </td>

                    {/* Days / Year */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full text-xs font-semibold font-mono bg-muted text-foreground border border-border/80">
                        {lt.daysPerYear}
                      </span>
                    </td>

                    {/* Carry Forward */}
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {lt.carryForward || 'No'}
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {lt.description && lt.description !== '-' ? lt.description : '—'}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          (lt.status || 'Active') === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            (lt.status || 'Active') === 'Active' ? 'bg-emerald-500' : 'bg-muted-foreground'
                          }`}
                        />
                        <span>{lt.status || 'Active'}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(lt)}
                          title="Edit Leave Type"
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer"
                        >
                          <EditIcon className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(lt)}
                          title="Delete Leave Type"
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer"
                        >
                          <TrashIcon className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Counter */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10 text-xs text-muted-foreground">
          <span>
            Showing {sortedTypes.length > 0 ? `1-${sortedTypes.length}` : '0'} of {sortedTypes.length} types
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled
              className="h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center opacity-40 cursor-not-allowed text-xs"
            >
              &lt;
            </button>
            <button
              type="button"
              disabled
              className="h-7 w-7 rounded-md border border-border bg-background flex items-center justify-center opacity-40 cursor-not-allowed text-xs"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Leave Type Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingType ? 'Edit Leave Type' : 'Add Leave Type'}
        subtitle={editingType ? 'Update leave category configuration' : 'Define a new employee leave category'}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="leave-type-form" variant="primary" size="sm">
              {editingType ? 'Save Changes' : 'Add Leave Type'}
            </Button>
          </div>
        }
      >
        <form id="leave-type-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Leave Type Name"
            required
            autoFocus
            placeholder="e.g. Leave Without Pay, Maternity Leave"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Days / Year"
              required
              type="number"
              min={1}
              max={365}
              placeholder="e.g. 12"
              value={formData.daysPerYear}
              onChange={(e) => setFormData({ ...formData, daysPerYear: e.target.value })}
              error={formErrors.daysPerYear}
            />

            <Select
              label="Carry Forward"
              value={formData.carryForward}
              onChange={(e) => setFormData({ ...formData, carryForward: e.target.value })}
              options={[
                { value: 'No', label: 'No' },
                { value: 'Yes', label: 'Yes' },
              ]}
            />
          </div>

          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' },
            ]}
          />

          <Textarea
            label="Description (Optional)"
            placeholder="Optional description of leave terms or scope..."
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingType)}
        onClose={() => setDeletingType(null)}
        title="Delete Leave Type"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeletingType(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete}>
              Delete Type
            </Button>
          </div>
        }
      >
        <div className="py-2 text-xs text-foreground space-y-2">
          <p>
            Are you sure you want to delete <span className="font-bold">{deletingType?.name}</span>?
          </p>
          <p className="text-muted-foreground">
            Existing leave requests associated with this type will retain their history, but staff will no longer be able to select it for new requests.
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default LeaveTypesPage;
