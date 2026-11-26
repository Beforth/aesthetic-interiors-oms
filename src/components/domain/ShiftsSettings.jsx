import React, { useCallback, useEffect, useState } from 'react';
import Card from '../ui/Card';
import Table from '../ui/Table';
import Button from '../ui/Button';
import IconButton from '../ui/IconButton';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Switch from '../ui/Switch';
import ConfirmDialog from '../ui/ConfirmDialog';
import { Badge } from '../ui/badge';
import { TimePicker, formatTo12HourTime, normalizeTo24HourTime } from '../ui/TimePicker';
import { shiftService } from '../../services/shiftService';
import { useToast } from '../../context/ToastContext';

const EMPTY_FORM = { name: '', startTime: '09:00', endTime: '18:00', isActive: true };

function durationText(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Settings > Shifts: the named working shifts (for example "Morning" 09:00 to 18:00). */
export function ShiftsSettings({ canEdit }) {
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = closed, 'new' or a shift
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setShifts((await shiftService.listShifts()) || []);
    } catch (err) {
      toast.error(err?.message || 'Could not load the shifts');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setEditing('new');
  };

  const openEdit = (shift) => {
    setForm({ name: shift.name, startTime: shift.startTime, endTime: shift.endTime, isActive: shift.isActive });
    setErrors({});
    setEditing(shift);
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Enter a shift name.';
    if (!normalizeTo24HourTime(form.startTime)) next.startTime = 'Pick a start time.';
    if (!normalizeTo24HourTime(form.endTime)) next.endTime = 'Pick an end time.';
    if (!next.startTime && !next.endTime && form.startTime === form.endTime) {
      next.endTime = 'A shift cannot start and end at the same time.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    const values = { ...form, name: form.name.trim() };
    try {
      if (editing === 'new') {
        await shiftService.createShift(values);
        toast.success(`Shift "${values.name}" added`);
      } else {
        await shiftService.updateShift(editing.id, values);
        toast.success(`Shift "${values.name}" updated`);
      }
      setEditing(null);
      await load();
    } catch (err) {
      if (err?.status === 409) setErrors({ name: err.message });
      else toast.error(err?.message || 'Could not save the shift');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const shift = pendingDelete;
    setSaving(true);
    try {
      await shiftService.deleteShift(shift.id);
      toast.success(`Shift "${shift.name}" deleted`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      toast.error(err?.message || 'Could not delete the shift');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Shift',
      render: (s) => <span className="font-semibold text-foreground">{s.name}</span>,
    },
    {
      key: 'time',
      header: 'Timing',
      render: (s) => (
        <div className="text-sm">
          <span className="font-mono">
            {formatTo12HourTime(s.startTime)} – {formatTo12HourTime(s.endTime)}
          </span>
          {s.crossesMidnight ? <span className="ml-2 text-xs text-muted-foreground">(ends next day)</span> : null}
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Length',
      render: (s) => <span className="text-sm text-muted-foreground">{durationText(s.durationMinutes)}</span>,
    },
    {
      key: 'employeeCount',
      header: 'People',
      render: (s) => <span className="text-sm text-muted-foreground">{s.employeeCount ?? 0}</span>,
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (s) => <Badge variant={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: '',
            render: (s) => (
              <div className="flex items-center justify-end gap-1">
                <IconButton icon="edit" size="sm" variant="ghost" ariaLabel={`Edit ${s.name}`} onClick={() => openEdit(s)} />
                <IconButton icon="trash" size="sm" variant="ghost" ariaLabel={`Delete ${s.name}`} onClick={() => setPendingDelete(s)} />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      <Card
        title="Shifts"
        subtitle="Name each working shift and set when it starts and ends"
        headerAction={
          canEdit ? (
            <Button variant="primary" size="sm" leadingIcon="plus" onClick={openNew}>
              Add shift
            </Button>
          ) : null
        }
        bodyClassName="p-0"
      >
        <Table
          columns={columns}
          data={shifts}
          loading={loading}
          emptyTitle="No shifts yet"
          emptyDescription={canEdit ? "Click 'Add shift' to create one, for example Morning 9:00 AM to 6:00 PM." : 'No shifts have been set up.'}
        />
      </Card>

      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add shift' : 'Edit shift'}
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={saving} onClick={save}>
              {editing === 'new' ? 'Add shift' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Shift name"
            required
            placeholder="e.g. Morning"
            value={form.name}
            maxLength={80}
            error={errors.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TimePicker
              label="Start time"
              required
              value={form.startTime}
              error={errors.startTime}
              onChange={(value) => setForm({ ...form, startTime: value })}
            />
            <TimePicker
              label="End time"
              required
              value={form.endTime}
              error={errors.endTime}
              onChange={(value) => setForm({ ...form, endTime: value })}
            />
          </div>
          <p className="text-xs text-muted-foreground">An end time earlier than the start time means the shift ends the next day (a night shift).</p>
          <Switch
            label="Active"
            description="Inactive shifts are kept but not offered for new use."
            checked={form.isActive}
            onChange={(checked) => setForm({ ...form, isActive: checked })}
          />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete this shift?"
        message={pendingDelete ? `"${pendingDelete.name}" will be removed from the list.` : ''}
        confirmText="Delete"
        loading={saving}
        onConfirm={remove}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default ShiftsSettings;
