import React, { useMemo, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/formatters';
import { compressImage } from '../../utils/dsr';
import { Button } from '../ui/Button';
import { PlusIcon, SaveIcon, ArrowLeftIcon } from '../ui/icons';
import DateInput from '../ui/DateInput';
import MoneyInput from '../ui/MoneyInput';
import SelectField from '../ui/SelectField';
import FileDrop from '../ui/FileDrop';
import Input from '../ui/Input';
import Textarea from '../ui/Textarea';
import TimeInput from '../ui/TimeInput';

export const PAYMENT_OPTIONS = ['Cash', 'Card', 'UPI', 'Net Banking', 'Cheque'];

const CATEGORY_OPTIONS = ['Software', 'Office', 'Travel', 'Subscriptions', 'Site Materials', 'Food & Welfare', 'Other'];

export const DEFAULT_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const nowTime = () => new Date().toTimeString().slice(0, 5);

const newPayment = () => ({
  title: '',
  paymentMethod: 'Cash',
  category: 'Software',
  amount: '',
  tax: '',
  time: nowTime(),
  receiptName: '',
  receiptUrl: '',
});

const inputClass =
  'w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary';

/**
 * The full-screen "Add Expense" form: expense details, then one or more payments (title, method, category, amount,
 * tax, time and a receipt). The same screen for every role, so it lives here once. What differs by role is passed in:
 * who the expense can be for (`employeeOptions`) and which statuses may be chosen (`statusOptions`).
 *
 * `onSubmit({ employee, date, description, status, payments })` does the saving and throws if it fails.
 */
export function AddExpenseView({ employeeOptions, statusOptions = DEFAULT_STATUS_OPTIONS, onBack, onSubmit }) {
  const toast = useToast();
  const [form, setForm] = useState({
    employee: employeeOptions[0]?.value || '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    status: statusOptions[0]?.value || 'draft',
  });
  const [payments, setPayments] = useState([newPayment()]);
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0), [payments]);

  const update = (index, field, value) =>
    setPayments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });

  const attachReceipt = async (index, files) => {
    if (!files || files.length === 0) return;
    try {
      const processed = await compressImage(files[0], 1200, 0.85);
      setPayments((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], receiptName: processed.name, receiptUrl: processed.url };
        return next;
      });
      toast.success(`Attached receipt: ${processed.name}`);
    } catch {
      toast.error('Could not process receipt file');
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (payments.length === 0 || !payments.some((p) => Number(p.amount) > 0)) {
      toast.error('Please enter at least one valid payment amount');
      return;
    }
    if (payments.some((p) => !p.title.trim()) && !form.description.trim()) {
      toast.error('Please provide a title for each payment');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...form, payments });
    } catch (err) {
      toast.error(err?.message || 'Failed to save expense claim');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-200">
      {/* Back navigation header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeftIcon className="size-4" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Add Expense</h1>
          <p className="text-xs text-muted-foreground">Log a new team expense</p>
        </div>
      </div>

      <form onSubmit={save} className="space-y-4">
        {/* Card 1: EXPENSE DETAILS */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Expense Details</span>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Employee</label>
              <SelectField
                value={form.employee}
                onChange={(e) => setForm({ ...form, employee: e.target.value })}
                disabled={employeeOptions.length === 1}
                className={`${inputClass} cursor-pointer disabled:cursor-not-allowed disabled:opacity-80`}
              >
                {employeeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Date *</label>
              <DateInput required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full" />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Description</label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What was this expense for?"
                className="w-full resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Status *</label>
              <SelectField
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                disabled={statusOptions.length === 1}
                className={`${inputClass} cursor-pointer disabled:cursor-not-allowed disabled:opacity-80`}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
        </div>

        {/* Card 2: AMOUNT & PAYMENT */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount & Payment</span>
            <span className="text-base font-mono font-bold text-foreground">{formatCurrency(total)}</span>
          </div>

          <div className="space-y-4">
            {payments.map((p, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Payment {idx + 1}</span>
                  {payments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-destructive hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Title *</label>
                    <Input
                      type="text"
                      placeholder="e.g. Client dinner"
                      value={p.title}
                      onChange={(e) => update(idx, 'title', e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Payment Method *</label>
                    <SelectField value={p.paymentMethod} onChange={(e) => update(idx, 'paymentMethod', e.target.value)} className={`${inputClass} cursor-pointer`}>
                      {PAYMENT_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </SelectField>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Category *</label>
                    <SelectField value={p.category} onChange={(e) => update(idx, 'category', e.target.value)} className={`${inputClass} cursor-pointer`}>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Amount (₹) *</label>
                    <MoneyInput
                     
                      min="0"
                      placeholder="0"
                      value={p.amount}
                      onChange={(e) => update(idx, 'amount', e.target.value)}
                     
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Tax (₹)</label>
                    <MoneyInput min="0" placeholder="0" value={p.tax} onChange={(e) => update(idx, 'tax', e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-muted-foreground mb-1">Time *</label>
                    <TimeInput value={p.time} onChange={(e) => update(idx, 'time', e.target.value)} className="w-full" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">Receipt / Proof</label>
                  <FileDrop accept="image/*" hint="Drop the receipt here or click to choose" onFile={(files) => attachReceipt(idx, files)} />
                  {p.receiptName ? <p className="mt-1 text-[11px] text-muted-foreground">Attached: {p.receiptName}</p> : null}
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() => setPayments((prev) => [...prev, newPayment()])}
              className="w-full border-dashed flex items-center justify-center gap-1.5 text-xs py-2"
            >
              <PlusIcon className="size-3.5" />
              <span>Add Another Payment</span>
            </Button>
          </div>
        </div>

        {/* Full-width brand theme Save Expense button */}
        <Button type="submit" variant="primary" loading={saving} className="w-full py-2.5 font-semibold text-xs flex items-center justify-center gap-2 shadow-2xs">
          <SaveIcon className="size-4" />
          <span>Save Expense</span>
        </Button>
      </form>
    </div>
  );
}

export default AddExpenseView;
