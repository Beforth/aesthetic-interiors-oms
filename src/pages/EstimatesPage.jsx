import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { estimateService } from '../services/estimateService';
import { clientService } from '../services/clientService';

import PageHeader from '../components/ui/PageHeader';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import DataToolbar from '../components/ui/DataToolbar';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import {
  ClipboardListIcon,
  DownloadIcon,
  IndianRupeeIcon,
  PlusIcon,
  RefreshIcon,
} from '../components/ui/icons';
import MoneyInput from '../components/ui/MoneyInput';
import NumberInput from '../components/ui/NumberInput';

const OTHER = '__other__';

const FALLBACK_SPACES = [
  'Living Room', 'Dining Room', 'Master Bedroom', 'Guest Bedroom', 'Kids Room', 'Kitchen',
  'Common Toilet', 'Master Bathroom', 'Guest Bathroom', 'Foyer / Entrance', 'Balcony',
  'Pooja Room', 'Study / Home Office', 'Corridor / Passage', 'Utility / Laundry', 'Store Room', 'Terrace',
];

const FALLBACK_QUALITIES = [
  { value: 'A1', label: 'A1 (Premium)' },
  { value: 'A2', label: 'A2 (Better)' },
  { value: 'A3', label: 'A3 (Good)' },
  { value: 'A4', label: 'A4 (Budget)' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'final', label: 'Final' },
];

let rowSequence = 0;

function makeRow(space = '', spaces = FALLBACK_SPACES) {
  rowSequence += 1;
  const known = spaces.includes(space);
  return {
    key: `row-${rowSequence}`,
    id: null,
    spaceChoice: known ? space : (space ? OTHER : ''),
    customSpace: known ? '' : space,
    quality: 'A3',
    areaSqft: '',
    baseRate: '',
  };
}

function rowFromItem(item, spaces) {
  const row = makeRow(item.space || '', spaces);
  return {
    ...row,
    id: item.id,
    areaSqft: item.areaSqft ?? '',
    baseRate: item.baseRate ?? '',
    quality: item.quality || 'A3',
  };
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function rowAmount(row) {
  return (Number(row.areaSqft) || 0) * (Number(row.baseRate) || 0);
}

function toPayload(form) {
  return {
    clientId: form.clientId || '',
    clientName: form.clientName,
    clientPhone: form.clientPhone,
    siteAddress: form.siteAddress,
    title: form.title,
    estimatedAt: form.estimatedAt,
    status: form.status,
    notes: form.notes,
    items: form.rows
      .map((row, index) => ({
        id: row.id || undefined,
        space: (row.spaceChoice === OTHER ? row.customSpace : row.spaceChoice || '').trim(),
        quality: row.quality,
        areaSqft: Number(row.areaSqft) || 0,
        baseRate: Number(row.baseRate) || 0,
        sortOrder: index,
      }))
      .filter((row) => row.space),
  };
}

export function EstimatesPage() {
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);

  const [list, setList] = useState({ results: [], count: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [spaces, setSpaces] = useState(FALLBACK_SPACES);
  const [qualities, setQualities] = useState(FALLBACK_QUALITIES);
  const [clients, setClients] = useState([]);

  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(() => setRefreshKey((value) => value + 1), []);

  const spaceOptions = useMemo(() => Array.from(new Set([...FALLBACK_SPACES, ...spaces])), [spaces]);
  const qualityOptions = useMemo(
    () => (qualities.length ? qualities : FALLBACK_QUALITIES),
    [qualities]
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    estimateService
      .list({ search: debouncedSearch || undefined, status: status === 'all' ? undefined : status, page, page_size: pageSize })
      .then((data) => {
        if (cancelled) return;
        setList({
          results: Array.isArray(data?.results) ? data.results : [],
          count: Number(data?.count) || 0,
        });
      })
      .catch((cause) => {
        if (cancelled) return;
        setList({ results: [], count: 0 });
        setError(cause?.message || 'Unable to load estimates.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, debouncedSearch, page, pageSize, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    estimateService
      .options()
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.spaces) && data.spaces.length) setSpaces(data.spaces);
        if (Array.isArray(data?.qualities) && data.qualities.length) setQualities(data.qualities);
      })
      .catch(() => {
        if (!cancelled) {
          setSpaces(FALLBACK_SPACES);
          setQualities(FALLBACK_QUALITIES);
        }
      });
    clientService
      .getAllClients()
      .then((data) => {
        if (!cancelled) setClients(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setClients([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(list.count / pageSize));
    if (page > pages) setPage(pages);
  }, [list.count, page]);

  const openNew = () => {
    setFormError('');
    setEditor({ id: null, reference: 'New estimate' });
    setForm({
      clientId: '',
      clientName: '',
      clientPhone: '',
      siteAddress: '',
      title: '',
      estimatedAt: new Date().toISOString().slice(0, 10),
      status: 'draft',
      notes: '',
      rows: [makeRow('', spaceOptions)],
    });
  };

  const openEdit = (estimate) => {
    setFormError('');
    setEditor({ id: estimate.id, reference: estimate.reference });
    const items = Array.isArray(estimate.items) ? estimate.items : [];
    setForm({
      clientId: estimate.clientId || '',
      clientName: estimate.clientName || '',
      clientPhone: estimate.clientPhone || '',
      siteAddress: estimate.siteAddress || '',
      title: estimate.title || '',
      estimatedAt: estimate.estimatedAt || new Date().toISOString().slice(0, 10),
      status: estimate.status || 'draft',
      notes: estimate.notes || '',
      rows: items.length ? items.map((item) => rowFromItem(item, spaceOptions)) : [makeRow('', spaceOptions)],
    });
  };

  const closeEditor = () => {
    if (saving || downloading) return;
    setEditor(null);
    setForm(null);
    setFormError('');
  };

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const setRow = (index, patch) =>
    setForm((current) => ({
      ...current,
      rows: current.rows.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    }));

  const chooseClient = (id) => {
    const client = clients.find((c) => String(c.id) === String(id));
    setForm((current) => ({
      ...current,
      clientId: id,
      clientName: client?.name || current.clientName,
      clientPhone: client?.phone || current.clientPhone,
      siteAddress: client?.address || current.siteAddress,
    }));
  };

  const save = async () => {
    if (!form || saving) return;
    setFormError('');
    setSaving(true);
    try {
      const saved = editor.id
        ? await estimateService.update(editor.id, toPayload(form))
        : await estimateService.create(toPayload(form));
      setEditor({ id: saved.id, reference: saved.reference });
      toast.success(editor.id ? 'Estimate updated' : 'Estimate created');
      reload();
    } catch (cause) {
      setFormError(cause?.message || 'Unable to save this estimate.');
    } finally {
      setSaving(false);
    }
  };

  const download = async (id, reference) => {
    if (!id) return;
    setDownloading(true);
    try {
      await estimateService.downloadPdf(id, reference);
      toast.success(`Downloaded ${reference}.pdf`);
    } catch (cause) {
      toast.error(cause?.message || 'Unable to download the PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await estimateService.remove(deleteTarget.id);
      toast.success(`Deleted ${deleteTarget.reference}`);
      if (editor?.id === deleteTarget.id) {
        setEditor(null);
        setForm(null);
      }
      setDeleteTarget(null);
      reload();
    } catch (cause) {
      toast.error(cause?.message || 'Unable to delete this estimate.');
    } finally {
      setDeleting(false);
    }
  };

  const formTotal = useMemo(() => (form ? form.rows.reduce((sum, row) => sum + rowAmount(row), 0) : 0), [form]);

  const columns = [
    {
      key: 'reference',
      header: 'Estimate',
      width: '24%',
      render: (item) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
            <ClipboardListIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-[12px] font-semibold text-foreground">{item.reference}</p>
            <p className="truncate text-[11px] text-muted-foreground">{item.title || 'Cost estimate'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      width: '24%',
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-foreground">{item.clientName || 'Walk-in client'}</p>
          <p className="truncate text-[11px] text-muted-foreground">{item.clientPhone || '—'}</p>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Spaces',
      width: '10%',
      render: (item) => <span className="text-xs text-muted-foreground">{item.itemCount ?? item.items?.length ?? 0}</span>,
    },
    {
      key: 'total',
      header: 'Estimated total',
      width: '18%',
      align: 'right',
      render: (item) => (
        <span className="whitespace-nowrap font-mono text-xs font-semibold text-foreground">
          {formatMoney(item.total)}
        </span>
      ),
    },
    {
      key: 'meta',
      header: 'Prepared by',
      width: '14%',
      render: (item) => (
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-foreground">{item.preparedByName || '—'}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {formatDate(item.estimatedAt)} · {item.status}
          </p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '10%',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton icon="eye" ariaLabel="Open estimate" size="sm" onClick={() => openEdit(item)} />
          <IconButton
            icon="download"
            ariaLabel="Download PDF"
            size="sm"
            className="text-primary hover:bg-primary/10 hover:text-primary"
            onClick={() => download(item.id, item.reference)}
          />
          <IconButton
            icon="trash"
            ariaLabel="Delete estimate"
            size="sm"
            className="hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteTarget(item)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 pb-12 animate-fadeIn">
      <PageHeader
        title="Estimates"
        subtitle="Client requirement sheets: pick the spaces, finish quality, area and base rate. Save, edit, download the PDF or delete."
        actions={
          <Button size="sm" onClick={openNew} className="flex items-center gap-1.5">
            <PlusIcon className="size-3.5" />
            New estimate
          </Button>
        }
      />

      <div className="space-y-3">
        <DataToolbar
          variant="clean"
          layout="inline"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search reference, client or title…"
          totalCount={list.count}
          filters={
            <div className="w-40">
              <Select
                aria-label="Filter by status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                options={STATUS_OPTIONS}
                placeholder=""
                className="h-9 text-xs"
              />
            </div>
          }
          actions={
            <Button variant="outline" size="sm" onClick={reload} className="flex items-center gap-1.5">
              <RefreshIcon className="size-3.5" />
              Refresh
            </Button>
          }
        />

        {error ? (
          <Alert
            type="danger"
            title="Unable to load estimates"
            action={
              <Button variant="outline" size="sm" onClick={reload}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        ) : (
          <Table
            columns={columns}
            data={list.results}
            loading={loading}
            emptyTitle="No estimates yet"
            emptyDescription="Click New estimate to fill in a client's requirement sheet and generate a cost estimate."
            pagination={
              list.count > pageSize
                ? {
                    currentPage: page,
                    totalPages: Math.max(1, Math.ceil(list.count / pageSize)),
                    totalItems: list.count,
                    pageSize: pageSize,
                    onPageChange: setPage,
                    onPageSizeChange: (size) => {
                      setPageSize(size);
                      setPage(1);
                    },
                  }
                : undefined
            }
          />
        )}
      </div>

      {/* Editor — the sheet itself. It stays open after saving so it can be edited again and downloaded. */}
      <Modal
        isOpen={Boolean(editor && form)}
        onClose={closeEditor}
        title={editor?.id ? 'Edit estimate' : 'New estimate'}
        subtitle={editor?.reference}
        badge={
          <Badge variant="secondary" size="sm">
            {form?.status === 'final' ? 'Final' : 'Draft'}
          </Badge>
        }
        size="xl"
        footer={
          <>
            <Button variant="outline" size="sm" disabled={saving || downloading} onClick={closeEditor}>
              Cancel
            </Button>
            {editor?.id && (
              <Button
                variant="outline"
                size="sm"
                loading={downloading}
                onClick={() => download(editor.id, editor.reference)}
                className="flex items-center gap-1.5"
              >
                <DownloadIcon className="size-3.5" />
                Download PDF
              </Button>
            )}
            <Button size="sm" loading={saving} onClick={save}>
              Save estimate
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-5">
            {formError && (
              <Alert type="danger" title="Could not save">
                {formError}
              </Alert>
            )}

            {/* Sheet header */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label="Client"
                value={form.clientId}
                onChange={(event) => chooseClient(event.target.value)}
                placeholder=""
                options={[
                  { value: '', label: 'Walk-in / no client' },
                  ...clients.map((client) => ({ value: String(client.id), label: client.name })),
                ]}
                className="text-xs"
              />
              <Input
                label="Client name"
                value={form.clientName}
                onChange={(event) => setField('clientName', event.target.value)}
                placeholder="Name for the PDF"
                className="text-xs"
              />
              <Input
                label="Phone"
                value={form.clientPhone}
                onChange={(event) => setField('clientPhone', event.target.value)}
                placeholder="Optional"
                className="text-xs"
              />
              <Input
                label="Estimate date"
                type="date"
                value={form.estimatedAt}
                onChange={(event) => setField('estimatedAt', event.target.value)}
                className="text-xs"
              />
              <div className="sm:col-span-2 lg:col-span-2">
                <Input
                  label="Sheet title"
                  value={form.title}
                  onChange={(event) => setField('title', event.target.value)}
                  placeholder="e.g. Mr. Sharma · Full home"
                  className="text-xs"
                />
              </div>
              <Input
                label="Site address"
                value={form.siteAddress}
                onChange={(event) => setField('siteAddress', event.target.value)}
                placeholder="Optional"
                className="text-xs"
              />
              <Select
                label="Status"
                value={form.status}
                onChange={(event) => setField('status', event.target.value)}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'final', label: 'Final' },
                ]}
                placeholder=""
                className="text-xs"
              />
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Spaces &amp; costing</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Amount is calculated as area × base rate for each space.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setForm((current) => ({ ...current, rows: [...current.rows, makeRow('', spaceOptions)] }))}
                  className="flex items-center gap-1"
                >
                  <PlusIcon className="size-3.5" />
                  Add space
                </Button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[680px] text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-2.5 py-2 text-left font-medium">Space type</th>
                      <th className="w-32 px-2.5 py-2 text-left font-medium">Quality</th>
                      <th className="w-28 px-2.5 py-2 text-right font-medium">Area (sq ft)</th>
                      <th className="w-32 px-2.5 py-2 text-right font-medium">Rate (Rs/sqft)</th>
                      <th className="w-32 px-2.5 py-2 text-right font-medium">Amount</th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {form.rows.map((row, index) => (
                      <tr key={row.key}>
                        <td className="px-2.5 py-2 align-top">
                          <Select
                            aria-label={`Space for row ${index + 1}`}
                            value={row.spaceChoice}
                            onChange={(event) => setRow(index, { spaceChoice: event.target.value })}
                            placeholder="Select space"
                            options={[
                              ...spaceOptions.map((space) => ({ value: space, label: space })),
                              { value: OTHER, label: 'Other (type below)' },
                            ]}
                            className="h-8 text-xs"
                          />
                          {row.spaceChoice === OTHER && (
                            <Input
                              aria-label={`Custom space for row ${index + 1}`}
                              value={row.customSpace}
                              onChange={(event) => setRow(index, { customSpace: event.target.value })}
                              placeholder="Type the space name"
                              className="mt-1.5 h-8 text-xs"
                            />
                          )}
                        </td>
                        <td className="px-2.5 py-2 align-top">
                          <Select
                            aria-label={`Quality for row ${index + 1}`}
                            value={row.quality}
                            onChange={(event) => setRow(index, { quality: event.target.value })}
                            options={qualityOptions}
                            placeholder=""
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="px-2.5 py-2 align-top">
                          <NumberInput
                            aria-label={`Area for row ${index + 1}`}
                                                        min="0"
                            step="0.01"
                            max="1000000"
                            value={row.areaSqft}
                            onChange={(event) => setRow(index, { areaSqft: event.target.value })}
                            placeholder="0"
                            className="h-8 text-right text-xs"
                          />
                        </td>
                        <td className="px-2.5 py-2 align-top">
                          <MoneyInput
                            maxDigits={7}
                            aria-label={`Rate for row ${index + 1}`}
                           
                            min="0"
                           
                            value={row.baseRate}
                            onChange={(event) => setRow(index, { baseRate: event.target.value })}
                            placeholder="0"
                            className="min-w-[9.5rem] h-8 text-right text-xs"
                          />
                        </td>
                        <td className="px-2.5 py-2 text-right align-middle font-mono font-semibold text-foreground">
                          {formatMoney(rowAmount(row))}
                        </td>
                        <td className="px-1 py-2 text-center align-middle">
                          <IconButton
                            icon="trash"
                            ariaLabel={`Remove row ${index + 1}`}
                            size="sm"
                            className="hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                rows: current.rows.filter((_, position) => position !== index),
                              }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                    {form.rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                          No spaces added yet. Click “Add space” to start the sheet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <IndianRupeeIcon className="size-4" />
                  Estimated total cost
                </span>
                <span className="font-mono text-lg font-semibold text-primary">{formatMoney(formTotal)}</span>
              </div>
            </div>

            <Textarea
              label="Notes (optional)"
              rows={3}
              value={form.notes}
              onChange={(event) => setField('notes', event.target.value)}
              placeholder="Scope, exclusions or anything the client should know. Appears on the PDF."
              className="text-xs"
            />

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Save to keep the sheet. You can reopen it any time to edit the rows; the PDF is generated from the
              latest saved version, so it always matches these numbers.
            </p>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        title="Delete this estimate?"
        subtitle={deleteTarget?.reference}
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={submitDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-xs leading-relaxed text-muted-foreground">
          This hides the sheet and its rows from the list. The saved data stays in the database for audit and can be
          restored from Django admin. Any PDF already downloaded on a device is unaffected.
        </p>
      </Modal>
    </div>
  );
}

export default EstimatesPage;
