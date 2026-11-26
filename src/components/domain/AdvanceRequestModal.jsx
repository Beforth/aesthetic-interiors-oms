import React, { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import Modal from '../ui/Modal';
import { Button } from '../ui/Button';
import DateInput from '../ui/DateInput';
import MoneyInput from '../ui/MoneyInput';
import Input from '../ui/Input';
import Textarea from '../ui/Textarea';

const today = () => new Date().toISOString().split('T')[0];
const EMPTY = () => ({ title: '', amount: '', dateRequired: today(), reason: '' });

const fieldClass =
  'w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary';

/**
 * The "Request Salary Advance" window: purpose, amount, date required and a reason. The same window for every role, so
 * it lives here once. `onSubmit({ title, amount, dateRequired, reason })` does the saving and throws if it fails.
 */
export function AdvanceRequestModal({ isOpen, onClose, onSubmit }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setForm(EMPTY());
  }, [isOpen]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Please enter a title or purpose');
      return;
    }
    const amount = Number(form.amount);
    if (!form.amount || Number.isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid advance amount');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ title: form.title.trim(), amount, dateRequired: form.dateRequired, reason: form.reason.trim() });
    } catch (err) {
      toast.error(err?.message || 'Failed to submit salary advance');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Salary Advance">
      <form onSubmit={submit} className="space-y-4 pt-1">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Title / Purpose *</label>
          <Input
            type="text"
            required
            placeholder="e.g. Medical Emergency Loan, Festival Advance"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Advance Amount (₹) *</label>
          <MoneyInput
           
            required
            min="100"
            placeholder="e.g. 10000"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
           
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Date Required *</label>
          <DateInput required value={form.dateRequired} onChange={(e) => setForm({ ...form, dateRequired: e.target.value })} className="w-full" />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">Reason / Explanation</label>
          <Textarea
            rows={3}
            placeholder="Explain why you need this advance..."
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className="w-full resize-none"
          />
        </div>

        {/* Cancel and Submit Request */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="px-4">
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={saving} className="px-4 shadow-2xs font-semibold">
            Submit Request
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AdvanceRequestModal;
