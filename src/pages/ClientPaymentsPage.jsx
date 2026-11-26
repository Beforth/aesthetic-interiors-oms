import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { clientPaymentService } from '../services/clientPaymentService';
import { formatCurrency, formatDate } from '../utils/formatters';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Table from '../components/ui/Table';
import StatCard from '../components/ui/StatCard';
import ProgressBar from '../components/ui/ProgressBar';
import EmptyState from '../components/ui/EmptyState';
import Spinner from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { IndianRupeeIcon, CheckCircleIcon, ClockIcon, AlertCircleIcon } from '../components/ui/icons';

const STATUS = {
  paid: { label: 'Paid', variant: 'success' },
  pending: { label: 'Due', variant: 'warning' },
  overdue: { label: 'Overdue', variant: 'danger' },
};

const sum = (rows, pick) => rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0);

function Detail({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono font-medium text-foreground">{value || '—'}</dd>
    </div>
  );
}

/**
 * Payments for a client: what they owe the company for each project, what they have paid (when, how, receipt number),
 * what is still due and by when, and where to send the money. Read-only: the team records a payment when it arrives.
 */
export function ClientPaymentsPage() {
  const toast = useToast();
  const [schedules, setSchedules] = useState([]);
  const [payTo, setPayTo] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [rows, details] = await Promise.all([clientPaymentService.getSchedules(), clientPaymentService.getPayTo().catch(() => null)]);
      setSchedules(Array.isArray(rows) ? rows : []);
      setPayTo(details);
    } catch (err) {
      toast.error(err?.message || 'Could not load your payments');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // pick up a payment the team has just recorded when the client comes back to this tab
  useEffect(() => {
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);

  const totals = useMemo(() => {
    const installments = schedules.flatMap((s) => s.installments || []);
    const unpaid = installments.filter((i) => i.status !== 'paid');
    const next = [...unpaid].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];
    const nextProject = next ? schedules.find((s) => (s.installments || []).some((i) => i.id === next.id)) : null;
    return {
      contract: sum(schedules, (s) => s.totalCost),
      paid: sum(schedules, (s) => s.totalPaid),
      due: sum(schedules, (s) => s.totalPending),
      overdue: sum(unpaid.filter((i) => i.status === 'overdue'), (i) => i.amount),
      next,
      nextProject,
    };
  }, [schedules]);

  const columns = [
    { key: 'title', header: 'Payment', render: (i) => (
        <div>
          <p className="font-semibold text-foreground">{i.title}</p>
          <p className="text-xs text-muted-foreground">Installment {i.order}</p>
        </div>
      ) },
    { key: 'dueDate', header: 'Due date', render: (i) => <span className="text-muted-foreground">{formatDate(i.dueDate)}</span> },
    { key: 'amount', header: 'Amount', render: (i) => <span className="font-mono font-semibold text-foreground">{formatCurrency(i.amount)}</span> },
    { key: 'status', header: 'Status', render: (i) => {
        const meta = STATUS[i.status] || STATUS.pending;
        return (
          <Badge variant={meta.variant} dot>
            {meta.label}
          </Badge>
        );
      } },
    { key: 'paidDate', header: 'Paid on', render: (i) => <span className="text-muted-foreground">{i.paidDate ? formatDate(i.paidDate) : '—'}</span> },
    { key: 'paymentMode', header: 'Paid how', render: (i) => <span className="text-muted-foreground">{i.paymentMode || '—'}</span> },
    { key: 'receiptNumber', header: 'Receipt', render: (i) => <span className="font-mono text-xs text-muted-foreground">{i.receiptNumber || '—'}</span> },
  ];

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-200">
      <PageHeader title="Payments" subtitle="What you have paid, what is due, and by when" />

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : schedules.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="No payments to show yet"
          description="Your payment schedule appears here once your project's contract value has been set."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard variant="inline" label="Total contract value" value={formatCurrency(totals.contract)} tone="primary" icon={<IndianRupeeIcon className="size-5" />} />
            <StatCard variant="inline" label="Total paid" value={formatCurrency(totals.paid)} tone="success" icon={<CheckCircleIcon className="size-5" />} />
            <StatCard variant="inline" label="Balance to pay" value={formatCurrency(totals.due)} tone="warning" icon={<ClockIcon className="size-5" />} />
            <StatCard variant="inline" label="Overdue" value={formatCurrency(totals.overdue)} tone={totals.overdue > 0 ? 'danger' : 'neutral'} icon={<AlertCircleIcon className="size-5" />} />
          </div>

          {totals.next ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {totals.next.status === 'overdue' ? 'Payment overdue' : 'Next payment'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {totals.next.title}
                    {schedules.length > 1 && totals.nextProject ? ` · ${totals.nextProject.projectName}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">Due on {formatDate(totals.next.dueDate)}</p>
                </div>
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{formatCurrency(totals.next.amount)}</p>
              </div>
            </Card>
          ) : (
            <Card>
              <p className="text-sm font-medium text-success">Everything is paid. Thank you!</p>
            </Card>
          )}

          {schedules.map((schedule) => {
            const percent = schedule.totalCost > 0 ? Math.min(100, Math.round((Number(schedule.totalPaid) / Number(schedule.totalCost)) * 100)) : 0;
            return (
              <Card
                key={schedule.projectId}
                title={schedule.projectName}
                subtitle={`Contract value ${formatCurrency(schedule.totalCost)} · Paid ${formatCurrency(schedule.totalPaid)} · Balance ${formatCurrency(schedule.totalPending)}`}
                bodyClassName="p-0"
              >
                <div className="px-5 pb-4 pt-2">
                  <ProgressBar value={percent} size="md" color={percent >= 100 ? 'success' : 'brand'} />
                  <p className="mt-1 text-xs text-muted-foreground">{percent}% of the contract paid</p>
                </div>
                <Table columns={columns} data={schedule.installments || []} keyField="id" emptyTitle="No installments yet" emptyDescription="The payment plan for this project has not been set up." />
              </Card>
            );
          })}

          {payTo && (
            <Card title="How to pay" subtitle="Send your payment to this account. The team records it here once it arrives.">
              <dl className="divide-y divide-border">
                <Detail label="Account name" value={payTo.accountName} />
                <Detail label="Bank" value={payTo.bankName} />
                <Detail label="Account number" value={payTo.accountNumber} />
                <Detail label="IFSC code" value={payTo.ifscCode} />
                {payTo.upiId ? <Detail label="UPI ID" value={payTo.upiId} /> : null}
              </dl>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default ClientPaymentsPage;
