import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import payrollService from '../../services/payrollService';
import { formatCurrency } from '../../utils/formatters';
import { PayslipSheet } from '../../pages/MyPayslipsPage';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import Input from '../ui/Input';
import Table from '../ui/Table';
import StatCard from '../ui/StatCard';
import { Badge } from '../ui/Badge';
import {
  ArrowLeftIcon,
  DownloadIcon,
  FileTextIcon,
  EditIcon,
  LockIcon,
  WalletIcon,
  TrashIcon,
  IndianRupeeIcon,
  XCircleIcon,
} from '../ui/icons';

const STATUS_VARIANT = { Draft: 'neutral', Calculated: 'warning', Approved: 'info', Paid: 'success' };

const number = (value) => Number(value) || 0;

function RowButton({ title, onClick, danger = false, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`cursor-pointer rounded p-1.5 text-muted-foreground transition-colors ${danger ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-muted hover:text-foreground'}`}
    >
      {children}
    </button>
  );
}

/** The fields each "change this employee" window asks for, and how they are turned into the request. */
const FORMS = {
  edit: {
    title: 'Edit pay for this run',
    fields: [
      ['monthlySalary', 'Monthly salary (₹)', 'Changes the salary on this run only.'],
      ['bonus', 'Bonus (₹)'],
      ['otherDeduction', 'Other deduction (₹)'],
      ['tds', 'TDS (₹)', 'Leave empty to use the salary template or settings.'],
    ],
    initial: (l) => ({ monthlySalary: l.monthlySalary, bonus: l.bonus, otherDeduction: l.otherDeduction, tds: l.tdsOverride ?? '' }),
    // only what actually changed is sent, so saving a bonus does not freeze the salary or TDS on this run
    payload: (v, l) => ({
      ...(number(v.monthlySalary) !== number(l.monthlySalary) ? { monthlySalary: number(v.monthlySalary) } : {}),
      bonus: number(v.bonus),
      otherDeduction: number(v.otherDeduction),
      ...(String(v.tds) !== String(l.tdsOverride ?? '') ? { tds: v.tds === '' ? null : number(v.tds) } : {}),
    }),
  },
  hold: {
    title: 'Hold an amount',
    fields: [['holdAmount', 'Amount to hold back (₹)', 'Enter 0 to release the hold.'], ['holdNote', 'Reason']],
    initial: (l) => ({ holdAmount: l.holdAmount, holdNote: l.holdNote }),
    payload: (v) => ({ holdAmount: number(v.holdAmount), holdNote: v.holdNote || '' }),
  },
  adjust: {
    title: 'Adjust amount paid',
    fields: [['paidAmount', 'Amount actually paid (₹)', 'Leave empty to pay net pay minus any hold.'], ['paidNote', 'Note']],
    initial: (l) => ({ paidAmount: l.paidAmount ?? '', paidNote: l.paidNote }),
    payload: (v) => ({ paidAmount: v.paidAmount === '' ? null : number(v.paidAmount), paidNote: v.paidNote || '' }),
  },
};

function LineForm({ target, onClose, onSave }) {
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const spec = target ? FORMS[target.kind] : null;

  useEffect(() => {
    if (target) {
      setValues(FORMS[target.kind].initial(target.line));
      setErrors({});
    }
  }, [target]);

  if (!target) return null;

  const submit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await onSave(target.line, spec.payload(values, target.line));
    } catch (err) {
      const found = {};
      Object.entries(err?.errors || {}).forEach(([key, messages]) => {
        found[key] = Array.isArray(messages) ? messages[0] : String(messages);
      });
      const shown = spec.fields.some(([key]) => found[key]);
      setErrors(shown ? found : { [spec.fields[0][0]]: err?.message || 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={spec.title}
      subtitle={`${target.line.employeeName} · net pay ${formatCurrency(target.line.netPay)}`}
      size="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={saving} onClick={submit}>
            Save
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {spec.fields.map(([key, label, help]) => (
          <Input
            key={key}
            label={label}
            helperText={help}
            error={errors[key]}
            type={key.endsWith('Note') ? 'text' : 'number'}
            min={key.endsWith('Note') ? undefined : '0'}
            step={key.endsWith('Note') ? undefined : '0.01'}
            value={values[key] ?? ''}
            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
          />
        ))}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Modal>
  );
}

/** How one person's figures came about, shown under their payslip. */
function Working({ line }) {
  const rows = [
    ['Monthly salary', formatCurrency(line.monthlySalary)],
    ['Daily rate', `${formatCurrency(line.dailyRate)} (salary ÷ ${line.daysInMonth} days)`],
    ['Weekly off days in the month', `${number(line.weeklyOffDays)}${number(line.offDaysWorked) ? `, worked ${number(line.offDaysWorked)}` : ''}`],
    ['Leave and absence', `${number(line.leaveDays)} day(s): ${number(line.paidLeaveDays)} paid, ${number(line.unpaidLeaveDays)} unpaid`],
    ['Unused paid leave paid out', `${number(line.encashedLeaveDays)} day(s)`],
    ['Payable days', `${number(line.payableDays)} of ${line.daysInMonth}`],
  ];
  return (
    <div className="no-print mx-auto max-w-3xl rounded-xl border border-border bg-card p-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">How it was calculated</p>
      <dl className="divide-y divide-border text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * One payroll run: its employees and everything that can be done with them. The server calculates the figures and
 * decides what each status allows; this screen only shows the actions that are allowed right now.
 */
export function PayrollRunView({ cycle, company, onBack, onChanged }) {
  const toast = useToast();
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState(null); // { kind: 'edit' | 'hold' | 'adjust', line }
  const [confirm, setConfirm] = useState(null); // { title, message, text, run }
  const [slipLine, setSlipLine] = useState(null);

  const status = cycle.status;
  const open = status === 'Draft' || status === 'Calculated';
  const calculated = status !== 'Draft';

  const reload = useCallback(async () => {
    const [fresh, rows] = await Promise.all([payrollService.getCycle(cycle.id), payrollService.getLines(cycle.id)]);
    setLines(rows || []);
    if (fresh) onChanged(fresh);
  }, [cycle.id, onChanged]);

  useEffect(() => {
    let active = true;
    payrollService
      .getLines(cycle.id)
      .then((rows) => active && setLines(rows || []))
      .catch((err) => active && toast.error(err?.message || 'Could not load the employees'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [cycle.id, toast]);

  const perform = async (key, work, done) => {
    setBusy(key);
    try {
      const result = await work();
      await reload();
      toast.success(typeof done === 'function' ? done(result) : done);
    } catch (err) {
      toast.error(err?.message || 'That action could not be done');
    } finally {
      setBusy('');
      setConfirm(null);
    }
  };

  const action = (name, done) => perform(name, () => payrollService.runAction(cycle.id, name), done);

  const sync = () =>
    perform(
      'sync',
      () => payrollService.syncEmployees(cycle.id),
      (result) => {
        const parts = [];
        if (result.added.length) parts.push(`added ${result.added.join(', ')}`);
        if (result.removed.length) parts.push(`removed ${result.removed.join(', ')}`);
        return parts.length ? `Employees synced: ${parts.join('; ')}` : 'Employees are already up to date';
      }
    );

  const saveLine = async (line, changes) => {
    await payrollService.editLine(cycle.id, line.id, changes);
    await reload();
    setForm(null);
    toast.success(`${line.employeeName} updated`);
  };

  const remove = async () => {
    setBusy('delete');
    try {
      await payrollService.deleteCycle(cycle.id);
      toast.success('Payroll run removed');
      onBack();
    } catch (err) {
      toast.error(err?.message || 'Could not delete the run');
      setBusy('');
      setConfirm(null);
    }
  };

  if (slipLine) {
    const line = lines.find((l) => l.id === slipLine) || null;
    if (line) {
      // the sheet reads the payslip's names, which differ from the run line's for basic pay and the held amount
      const slip = { ...line, period: cycle.period, basicPay: line.basic, heldAmount: line.holdAmount };
      return (
        <div className="space-y-4 pb-16">
          <div className="no-print flex items-center justify-between gap-3">
            <button type="button" onClick={() => setSlipLine(null)} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeftIcon className="size-4" />
              Back to {cycle.period}
            </button>
            <Button variant="primary" size="sm" onClick={() => window.print()} className="flex items-center gap-1.5 font-semibold">
              <DownloadIcon className="size-4" />
              <span>Download / Print</span>
            </Button>
          </div>
          <PayslipSheet slip={slip} company={company} statusText={status} />
          <Working line={line} />
        </div>
      );
    }
  }

  const held = lines.reduce((sum, l) => sum + number(l.holdAmount), 0);
  const money = (value) => (calculated ? formatCurrency(value) : '—');

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (l) => (
        <div>
          <p className="font-semibold text-foreground">{l.employeeName}</p>
          <p className="text-[11px] text-muted-foreground">{l.role}</p>
        </div>
      ),
    },
    {
      key: 'salary',
      header: 'Monthly salary',
      render: (l) => (
        <div className="font-mono text-foreground">
          {formatCurrency(l.monthlySalary)}
          {l.salaryOverridden && <span className="block text-[10px] text-muted-foreground">edited</span>}
        </div>
      ),
    },
    {
      key: 'days',
      header: 'Attendance',
      render: (l) =>
        calculated ? (
          <div className="text-xs text-foreground">
            {number(l.payableDays)} payable days
            <span className="block text-[11px] text-muted-foreground">
              {number(l.leaveDays)} leave · {number(l.unpaidLeaveDays)} unpaid
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: 'gross', header: 'Gross', render: (l) => <span className="font-mono text-foreground">{money(l.gross)}</span> },
    { key: 'deductions', header: 'Deductions', render: (l) => <span className="font-mono text-destructive">{money(l.totalDeductions)}</span> },
    {
      key: 'net',
      header: 'Net pay',
      render: (l) => (
        <div>
          <span className="font-mono font-bold text-success">{money(l.netPay)}</span>
          {number(l.holdAmount) > 0 && <span className="block text-[10px] font-medium text-warning">Held {formatCurrency(l.holdAmount)}</span>}
          {l.paidAmount !== null && <span className="block text-[10px] text-muted-foreground">Paid {formatCurrency(l.paidAmount)}</span>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (l) => (
        <div className="flex items-center justify-end gap-0.5">
          {calculated && (
            <RowButton title="Payslip" onClick={() => setSlipLine(l.id)}>
              <FileTextIcon className="size-3.5" />
            </RowButton>
          )}
          {open && (
            <RowButton title="Edit" onClick={() => setForm({ kind: 'edit', line: l })}>
              <EditIcon className="size-3.5" />
            </RowButton>
          )}
          {status === 'Calculated' && (
            <RowButton title="Hold amount" onClick={() => setForm({ kind: 'hold', line: l })}>
              <LockIcon className="size-3.5" />
            </RowButton>
          )}
          {(status === 'Calculated' || status === 'Approved') && (
            <RowButton title="Adjust amount paid" onClick={() => setForm({ kind: 'adjust', line: l })}>
              <WalletIcon className="size-3.5" />
            </RowButton>
          )}
          {open && (
            <RowButton
              danger
              title="Remove from run"
              onClick={() =>
                setConfirm({
                  title: 'Remove from this run?',
                  message: `${l.employeeName} will not be paid in this run. Sync employees adds them back.`,
                  text: 'Remove',
                  run: () => perform('remove', () => payrollService.removeLine(cycle.id, l.id), `${l.employeeName} removed from the run`),
                })
              }
            >
              <TrashIcon className="size-3.5" />
            </RowButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 pb-16 animate-in fade-in duration-200">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">{cycle.period}</h1>
          <div className="mt-1 flex items-center gap-2">
            <button type="button" onClick={onBack} className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              ← Payroll runs
            </button>
            <Badge variant={STATUS_VARIANT[status] || 'neutral'}>{status}</Badge>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {open && (
            <>
              <Button variant="outline" size="sm" leadingIcon="refresh" loading={busy === 'sync'} onClick={sync}>
                Sync employees
              </Button>
              <Button variant={status === 'Draft' ? 'primary' : 'outline'} size="sm" loading={busy === 'calculate'} onClick={() => action('calculate', 'Payroll run calculated')}>
                {status === 'Draft' ? 'Calculate' : 'Recalculate'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setConfirm({
                    title: 'Regenerate this run?',
                    message: 'The run is built again from the staff list. Your edits, holds and removals on this run are discarded.',
                    text: 'Regenerate',
                    run: () => action('regenerate', 'Payroll run regenerated'),
                  })
                }
              >
                Regenerate
              </Button>
            </>
          )}
          {status === 'Calculated' && (
            <Button variant="primary" size="sm" loading={busy === 'approve'} onClick={() => action('approve', 'Run approved. Payslips are now visible to staff.')}>
              Approve Run
            </Button>
          )}
          {status === 'Approved' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() =>
                setConfirm({
                  title: 'Mark this run as paid?',
                  message: 'Payslips are marked paid and salary advances are recovered. A paid run can no longer be changed or deleted.',
                  text: 'Mark Paid',
                  run: () => action('pay', 'Payroll run marked as paid'),
                })
              }
            >
              Mark Paid
            </Button>
          )}
          {status !== 'Paid' && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirm({ title: 'Delete this payroll run?', message: 'The run and its payslips are removed.', text: 'Delete', run: remove })}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard variant="inline" label="Employees" value={cycle.employeesCount} icon={<FileTextIcon className="size-5" />} />
        <StatCard variant="inline" label="Gross" value={money(cycle.gross)} tone="primary" icon={<IndianRupeeIcon className="size-5" />} />
        <StatCard variant="inline" label="Deductions" value={money(cycle.deductions)} tone="danger" icon={<XCircleIcon className="size-5" />} />
        <StatCard variant="inline" label={held > 0 ? `Net pay (${formatCurrency(held)} held)` : 'Net pay'} value={money(cycle.netPay)} tone="success" icon={<IndianRupeeIcon className="size-5" />} />
      </div>

      <Table
        variant="clean"
        loading={loading}
        columns={columns}
        data={lines}
        keyField="id"
        emptyTitle="No employees on this run"
        emptyDescription={open ? "Set a monthly salary in Settings > Users (the pencil icon), then use 'Sync employees'." : 'This run has no employee records.'}
      />

      <p className="text-[11px] text-muted-foreground">
        Pay = daily rate × (days in month − weekly offs + weekly offs worked − unpaid leave days) + one paid leave paid out if unused + bonus. A working day with no
        attendance record is paid.
      </p>

      <LineForm target={form} onClose={() => setForm(null)} onSave={saveLine} />
      <ConfirmDialog
        isOpen={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmText={confirm?.text}
        loading={Boolean(busy)}
        onConfirm={() => confirm?.run()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

export default PayrollRunView;
