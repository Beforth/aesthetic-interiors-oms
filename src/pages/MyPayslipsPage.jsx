import React, { useCallback, useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { myFinanceService } from '../services/myFinanceService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { usePagination } from '../hooks/usePagination';

import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Table from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { ArrowLeftIcon, DownloadIcon, EyeIcon } from '../components/ui/icons';

const EMPTY_COMPANY = { companyName: '', companyAddress: '', pfNumber: '', panNumber: '' };

function Line({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${tone || 'text-foreground'}`}>{formatCurrency(value || 0)}</span>
    </div>
  );
}

/** One payslip as a printable sheet. Only this sheet is printed or saved as a PDF (see `.print-payslip`). */
export function PayslipSheet({ slip, company, statusText }) {
  const earnings = [
    ['Basic pay', slip.basicPay],
    ['HRA', slip.hra],
    ...(Number(slip.conveyance) ? [['Conveyance', slip.conveyance]] : []),
    ['Special allowance', slip.specialAllowance],
    ...(Number(slip.bonus) ? [['Bonus', slip.bonus]] : []),
    ...(Number(slip.leaveEncashment) ? [['Leave encashment', slip.leaveEncashment]] : []),
  ];
  const deductions = [
    ['Provident fund', slip.providentFund],
    ...(Number(slip.esic) ? [['ESIC', slip.esic]] : []),
    ['Professional tax', slip.professionalTax],
    ...(Number(slip.tds) ? [['TDS', slip.tds]] : []),
    ...(Number(slip.advanceRecovery) ? [['Salary advance recovery', slip.advanceRecovery]] : []),
    ...(Number(slip.otherDeduction) ? [['Other deduction', slip.otherDeduction]] : []),
  ];
  return (
    <div className="print-payslip mx-auto max-w-3xl space-y-5 rounded-xl border border-border bg-card p-6 shadow-2xs sm:p-8">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">{company.companyName || 'Payslip'}</h2>
          {company.companyAddress ? <p className="text-[11px] text-muted-foreground">{company.companyAddress}</p> : null}
          {company.pfNumber || company.panNumber ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {company.pfNumber ? `PF: ${company.pfNumber}` : ''}
              {company.pfNumber && company.panNumber ? ' - ' : ''}
              {company.panNumber ? `PAN: ${company.panNumber}` : ''}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payslip</span>
          <p className="text-xs font-semibold text-foreground">{slip.period}</p>
          <p className="text-[11px] text-muted-foreground">{statusText || (slip.status === 'paid' ? `Paid on ${formatDate(slip.paidOn)}` : 'Generated')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <Field label="Employee" value={slip.employeeName} />
        <Field label="Role" value={slip.role || '—'} />
        <Field label="Payable days" value={`${Number(slip.payableDays)} / ${slip.daysInMonth}`} />
        <Field label="Payment mode" value={slip.paymentMode || 'Bank Transfer'} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="bg-muted/30 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Earnings</div>
          <div className="divide-y divide-border text-xs">
            {earnings.map(([label, value]) => (
              <Line key={label} label={label} value={value} />
            ))}
            <div className="flex items-center justify-between bg-muted/20 px-3 py-2 font-semibold">
              <span className="text-foreground">Gross</span>
              <span className="font-mono text-foreground">{formatCurrency(slip.gross)}</span>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <div className="bg-muted/30 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Deductions</div>
          <div className="divide-y divide-border text-xs">
            {deductions.map(([label, value]) => (
              <Line key={label} label={label} value={value} />
            ))}
            <div className="flex items-center justify-between bg-muted/20 px-3 py-2 font-semibold">
              <span className="text-foreground">Total deductions</span>
              <span className="font-mono text-destructive">{formatCurrency(slip.totalDeductions)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border bg-success/10 px-3 py-3">
            <span className="text-xs font-bold text-foreground">Net pay</span>
            <span className="font-mono text-sm font-bold text-success">{formatCurrency(slip.netPay)}</span>
          </div>
          {Number(slip.heldAmount) > 0 && (
            <div className="divide-y divide-border border-t border-border text-xs">
              <Line label="Held back" value={slip.heldAmount} />
            </div>
          )}
          {slip.paidAmount !== null && slip.paidAmount !== undefined && Number(slip.paidAmount) !== Number(slip.netPay) && (
            <div className="border-t border-border text-xs">
              <Line label="Amount paid" value={slip.paidAmount} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

/**
 * Payroll for someone on staff: only their own payslips, this month's and earlier ones. They can open a payslip and
 * download it (the browser's Save as PDF). Nothing else: no cycles, structures, settings or other people's pay.
 */
export function MyPayslipsPage() {
  const toast = useToast();
  const [slips, setSlips] = useState([]);
  const [company, setCompany] = useState(EMPTY_COMPANY);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const pager = usePagination(slips);

  const load = useCallback(async () => {
    try {
      const [rows, info] = await Promise.all([myFinanceService.listPayslips(), myFinanceService.getCompany().catch(() => null)]);
      setSlips(Array.isArray(rows) ? rows : []);
      if (info) setCompany({ ...EMPTY_COMPANY, ...info });
    } catch (err) {
      toast.error(err?.message || 'Could not load your payslips');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  /** Opens the sheet and hands it to the browser's print dialog, where "Save as PDF" downloads it. */
  const download = (slip) => {
    setOpen(slip);
    window.setTimeout(() => window.print(), 300);
  };

  if (open) {
    return (
      <div className="space-y-4 pb-16 animate-in fade-in duration-200">
        <div className="no-print flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Back to my payslips
          </button>
          <Button variant="primary" size="sm" onClick={() => window.print()} className="flex items-center gap-1.5 font-semibold">
            <DownloadIcon className="size-4" />
            <span>Download</span>
          </Button>
        </div>
        <PayslipSheet slip={open} company={company} />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16 animate-in fade-in duration-200">
      <PageHeader title="Payroll" subtitle="Your payslips, this month and earlier ones" />
      <Table
        variant="clean"
        loading={loading}
        columns={[
          { key: 'period', header: 'Month', render: (s) => <span className="font-semibold text-foreground">{s.period}</span> },
          { key: 'gross', header: 'Gross', render: (s) => <span className="font-mono text-muted-foreground">{formatCurrency(s.gross)}</span> },
          { key: 'totalDeductions', header: 'Deductions', render: (s) => <span className="font-mono text-muted-foreground">{formatCurrency(s.totalDeductions)}</span> },
          { key: 'netPay', header: 'Net pay', render: (s) => <span className="font-mono font-semibold text-foreground">{formatCurrency(s.netPay)}</span> },
          {
            key: 'status',
            header: 'Status',
            render: (s) => (
              <Badge variant={s.status === 'paid' ? 'success' : 'warning'} dot>
                {s.status === 'paid' ? 'Paid' : 'Generated'}
              </Badge>
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (s) => (
              <div className="flex items-center justify-end gap-0.5 text-muted-foreground">
                <button type="button" onClick={() => setOpen(s)} className="cursor-pointer rounded p-1.5 transition-colors hover:bg-muted hover:text-foreground" title="View payslip">
                  <EyeIcon className="size-3.5" />
                </button>
                <button type="button" onClick={() => download(s)} className="cursor-pointer rounded p-1.5 transition-colors hover:bg-muted hover:text-foreground" title="Download payslip">
                  <DownloadIcon className="size-3.5" />
                </button>
              </div>
            ),
          },
        ]}
        data={pager.paginatedItems}
        pagination={pager.pagination}
        keyField="id"
        emptyTitle="No payslips yet"
        emptyDescription="Your payslips appear here once payroll for a month has been run."
      />
    </div>
  );
}

export default MyPayslipsPage;
