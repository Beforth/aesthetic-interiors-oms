import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import iconMap from '../config/iconMap';

import {
  Icon,
  Button,
  IconButton,
  FormField,
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Switch,
  DatePicker,
  SearchInput,
  FileInput,
  Badge,
  StatusBadge,
  Card,
  StatCard,
  Table,
  Modal,
  ConfirmDialog,
  Drawer,
  Tabs,
  Avatar,
  ProgressBar,
  EmptyState,
  Spinner,
  Skeleton,
  Dropdown,
  Breadcrumbs,
  PageHeader,
  Tooltip,
  Alert,
  MultiSelect,
  DataToolbar,
  DetailList,
  Tag,
  FileImportDialog,
  PermissionGate,
} from '../components/ui';

import ClientCard from '../components/domain/ClientCard';
import ProjectCard from '../components/domain/ProjectCard';
import StageTimeline from '../components/domain/StageTimeline';
import StageStatusControl from '../components/domain/StageStatusControl';
import AssigneePicker from '../components/domain/AssigneePicker';
import AgencySelect from '../components/domain/AgencySelect';
import { mockUsers } from '../data/users';
import { mockAgencies } from '../data/agencies';


export function ComponentsShowcasePage() {
  const toast = useToast();

  // Interactive component states
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('palette');
  const [radioVal, setRadioVal] = useState('opt1');
  const [checkVal, setCheckVal] = useState(true);
  const [switchVal, setSwitchVal] = useState(true);
  const [searchVal, setSearchVal] = useState('Indiranagar');
  const [dateVal, setDateVal] = useState('2026-10-19');
  const [selectVal, setSelectVal] = useState('carpenter');
  const [tablePage, setTablePage] = useState(1);
  const [multiVal, setMultiVal] = useState(['opt1', 'opt2']);
  const [assigneeVal, setAssigneeVal] = useState(['u4', 'u6']);
  const [agencyVal, setAgencyVal] = useState('a1');
  const [stageStatusVal, setStageStatusVal] = useState('in progress');
  const [importOpen, setImportOpen] = useState(false);

  const showcaseTabs = [
    { id: 'palette', label: 'Color Tokens & Contrast', icon: 'sparkles' },
    { id: 'buttons', label: 'Buttons & Icons', icon: 'wrench' },
    { id: 'forms', label: 'Form Controls', icon: 'edit' },
    { id: 'badges', label: 'Badges & Alerts', icon: 'check-circle' },
    { id: 'cards', label: 'Cards & Stats', icon: 'layers' },
    { id: 'tables', label: 'Tables & Navigation', icon: 'tasks' },
    { id: 'dialogs', label: 'Modals & Drawers', icon: 'more' },
    { id: 'domain', label: 'Domain & Timeline (Phase 2)', icon: 'calendar' },
  ];


  const sampleTableData = [
    {
      id: 1,
      trade: 'False Ceiling GI Framing',
      contractor: 'Apex False Ceiling',
      status: 'done',
      date: '2026-10-18',
      amount: 85000,
    },
    {
      id: 2,
      trade: 'Plywood Wardrobe Boxing',
      contractor: 'Veneer Craft Works',
      status: 'in progress',
      date: '2026-10-22',
      amount: 145000,
    },
    {
      id: 3,
      trade: 'Toughened Shower Glass',
      contractor: 'Crystal Clear Glass',
      status: 'pending',
      date: '2026-10-25',
      amount: 52000,
    },
    {
      id: 4,
      trade: 'Plumbing Core Cutting',
      contractor: 'Apex False Ceiling',
      status: 'late',
      date: '2026-10-15',
      amount: 18000,
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Design System & Component Showcase"
        subtitle="Live catalogue of all reusable UI building blocks, WCAG 2.2 AA tokens, and interaction primitives."
        breadcrumbs={[
          { label: 'Operations', path: '/dashboard' },
          { label: 'Design System' },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            leadingIcon="bell"
            onClick={() => toast.success('Toast notification system verified!')}
          >
            Trigger Toast
          </Button>
        }
      />

      {/* Tabs Switcher for Showcase */}
      <Tabs
        tabs={showcaseTabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="bg-surface rounded-t border px-2"
      />

      {/* TAB 1: COLOR PALETTE & CONTRAST */}
      {activeTab === 'palette' && (
        <div className="space-y-6">
          <Card title="Warm Walnut / Umber Brand Tokens" subtitle="Theme tokens declared in tailwind.config.js (Base #7D5A44)">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div className="border border-border rounded p-3 bg-surface">
                <div className="h-16 rounded bg-brand-50 border border-border mb-2 flex items-center justify-center text-xs font-mono text-text-muted">
                  #F8F6F4
                </div>
                <div className="font-bold text-sm text-text-main">brand-50</div>
                <div className="text-xs text-text-muted">Page & header background</div>
              </div>

              <div className="border border-border rounded p-3 bg-surface">
                <div className="h-16 rounded bg-brand-100 border border-border mb-2 flex items-center justify-center text-xs font-mono text-text-muted">
                  #EFEAE6
                </div>
                <div className="font-bold text-sm text-text-main">brand-100</div>
                <div className="text-xs text-text-muted">Hover rows & selected bg</div>
              </div>

              <div className="border border-border rounded p-3 bg-surface">
                <div className="h-16 rounded bg-brand-500 mb-2 flex items-center justify-center text-xs font-mono text-surface font-semibold">
                  #7D5A44
                </div>
                <div className="font-bold text-sm text-text-main">brand-500</div>
                <div className="text-xs text-text-muted">Base brand, icons, progress</div>
              </div>

              <div className="border border-border rounded p-3 bg-surface">
                <div className="h-16 rounded bg-brand-600 mb-2 flex items-center justify-center text-xs font-mono text-surface font-semibold">
                  #6B4D3A
                </div>
                <div className="font-bold text-sm text-text-main">brand-600</div>
                <div className="text-xs text-text-muted">Primary button (WCAG AA)</div>
              </div>

              <div className="border border-border rounded p-3 bg-surface">
                <div className="h-16 rounded bg-brand-700 mb-2 flex items-center justify-center text-xs font-mono text-surface font-semibold">
                  #593F2F
                </div>
                <div className="font-bold text-sm text-text-main">brand-700</div>
                <div className="text-xs text-text-muted">Hover/pressed & accents</div>
              </div>
            </div>
          </Card>

          <Card title="Neutrals & Surface Tokens">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="border border-border rounded p-3 bg-surface">
                <div className="h-14 rounded bg-surface border border-border mb-2 flex items-center justify-center text-xs font-mono text-text-main">
                  #FFFFFF
                </div>
                <div className="font-bold text-sm text-text-main">surface</div>
                <div className="text-xs text-text-muted">Cards, modals, inputs</div>
              </div>

              <div className="border border-border rounded p-3 bg-surface">
                <div className="h-14 rounded bg-border mb-2 flex items-center justify-center text-xs font-mono text-text-main">
                  #DCD6D0
                </div>
                <div className="font-bold text-sm text-text-main">border</div>
                <div className="text-xs text-text-muted">1px dividers & outlines</div>
              </div>

              <div className="border border-border rounded p-3 bg-surface">
                <div className="h-14 rounded bg-text-main mb-2 flex items-center justify-center text-xs font-mono text-surface font-semibold">
                  #1F2933
                </div>
                <div className="font-bold text-sm text-text-main">text-main</div>
                <div className="text-xs text-text-muted">Primary body & headings</div>
              </div>

              <div className="border border-border rounded p-3 bg-surface">
                <div className="h-14 rounded bg-text-muted mb-2 flex items-center justify-center text-xs font-mono text-surface font-semibold">
                  #6B7785
                </div>
                <div className="font-bold text-sm text-text-main">text-muted</div>
                <div className="text-xs text-text-muted">Captions & secondary text</div>
              </div>
            </div>
          </Card>

          <Card title="Status Colors (Muted & Tinted)">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border border-border rounded p-3 bg-surface">
                <div className="h-12 rounded bg-success mb-2 flex items-center justify-center text-xs font-mono text-surface font-semibold">
                  #2F855A
                </div>
                <div className="h-8 rounded bg-success-light border border-success/30 flex items-center justify-center text-xs text-success font-semibold mb-2">
                  bg-success-light
                </div>
                <div className="font-bold text-sm text-text-main">success</div>
                <div className="text-xs text-text-muted">Completed, active, paid</div>
              </div>

              <div className="border border-border rounded p-3 bg-surface">
                <div className="h-12 rounded bg-warning mb-2 flex items-center justify-center text-xs font-mono text-surface font-semibold">
                  #B7791F
                </div>
                <div className="h-8 rounded bg-warning-light border border-warning/30 flex items-center justify-center text-xs text-warning font-semibold mb-2">
                  bg-warning-light
                </div>
                <div className="font-bold text-sm text-text-main">warning</div>
                <div className="text-xs text-text-muted">Pending, review, partial</div>
              </div>

              <div className="border border-border rounded p-3 bg-surface">
                <div className="h-12 rounded bg-danger mb-2 flex items-center justify-center text-xs font-mono text-surface font-semibold">
                  #C53030
                </div>
                <div className="h-8 rounded bg-danger-light border border-danger/30 flex items-center justify-center text-xs text-danger font-semibold mb-2">
                  bg-danger-light
                </div>
                <div className="font-bold text-sm text-text-main">danger</div>
                <div className="text-xs text-text-muted">Late, overdue, inactive</div>
              </div>

              <div className="border border-border rounded p-3 bg-surface">
                <div className="h-12 rounded bg-info mb-2 flex items-center justify-center text-xs font-mono text-surface font-semibold">
                  #3B6EA5
                </div>
                <div className="h-8 rounded bg-info-light border border-info/30 flex items-center justify-center text-xs text-info font-semibold mb-2">
                  bg-info-light
                </div>
                <div className="font-bold text-sm text-text-main">info</div>
                <div className="text-xs text-text-muted">In progress, scheduled</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: BUTTONS & ICONS */}
      {activeTab === 'buttons' && (
        <div className="space-y-6">
          <Card title="Button Variants & States">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="danger">Danger Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="primary" loading>Loading</Button>
              <Button variant="primary" disabled>Disabled</Button>
            </div>

            <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-3">
              <Button variant="primary" size="sm" leadingIcon="plus">Small Button</Button>
              <Button variant="primary" size="md" leadingIcon="check">Medium Button</Button>
              <Button variant="primary" size="lg" trailingIcon="arrow-right">Large Button</Button>
            </div>
          </Card>

          <Card title="IconButton (Mandatory aria-label & 44px Mobile Target)">
            <div className="flex flex-wrap items-center gap-3">
              <IconButton icon="search" ariaLabel="Search items" variant="ghost" />
              <IconButton icon="bell" ariaLabel="Notifications" variant="outline" />
              <IconButton icon="plus" ariaLabel="Add entry" variant="primary" />
              <IconButton icon="edit" ariaLabel="Edit user" variant="secondary" />
              <IconButton icon="trash" ariaLabel="Delete record" variant="ghost" className="text-danger" />
              <IconButton icon="refresh" ariaLabel="Reloading" loading />
            </div>
          </Card>

          <Card title="Icon Map (Universal lucide-react Wrapper)">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {Object.keys(iconMap).map((key) => (
                <div
                  key={key}
                  className="flex flex-col items-center justify-center p-3 rounded border border-border bg-surface text-center hover:bg-brand-50 transition-colors"
                >
                  <Icon name={key} size={20} className="text-brand-600 mb-1.5" />
                  <span className="text-[11px] font-mono text-text-muted truncate max-w-full">
                    {key}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: FORM CONTROLS */}
      {activeTab === 'forms' && (
        <div className="space-y-6">
          <Card title="Form Input Elements">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Standard Input"
                placeholder="Enter client project name..."
                helperText="Project names must be descriptive"
              />

              <Input
                label="Input with Error State"
                value="Invalid Value"
                error="Please enter a valid GSTIN number"
              />

              <SearchInput
                label="Search Input"
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
                placeholder="Search drawings or specs..."
              />

              <DatePicker
                label="Date Picker (Native Wrapped)"
                value={dateVal}
                onChange={(e) => setDateVal(e.target.value)}
                helperText="Formatted as DD MMM YYYY throughout the app"
              />

              <Select
                label="Select Dropdown"
                value={selectVal}
                onChange={(e) => setSelectVal(e.target.value)}
                options={[
                  { value: 'ceiling', label: 'Stage 02: Ceiling' },
                  { value: 'carpenter', label: 'Stage 03: Carpenter' },
                  { value: 'tiles', label: 'Stage 04: Tiles' },
                  { value: 'electrical', label: 'Stage 06: Electrical' },
                ]}
              />

              <FileInput
                label="File Input / Drawing Upload"
                helperText="Supports PDF, DWG, and JPG up to 25MB"
              />
            </div>

            <div className="mt-4">
              <Textarea
                label="Multi-line Notes (Textarea)"
                rows={3}
                placeholder="Enter site supervisor daily execution notes..."
              />
            </div>
          </Card>

          <Card title="Toggles, Checkboxes & Radios">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Checkboxes
                </h4>
                <Checkbox
                  label="Safety Helmet Check"
                  description="Supervisor signed verification"
                  checked={checkVal}
                  onChange={(e) => setCheckVal(e.target.checked)}
                />
                <Checkbox
                  label="Moisture reading < 12%"
                  checked={false}
                />
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Radio Group
                </h4>
                <Radio
                  name="demo-radio"
                  label="High Priority"
                  description="Immediate site inspection"
                  value="opt1"
                  checked={radioVal === 'opt1'}
                  onChange={() => setRadioVal('opt1')}
                />
                <Radio
                  name="demo-radio"
                  label="Standard Priority"
                  description="Routine stage progression"
                  value="opt2"
                  checked={radioVal === 'opt2'}
                  onChange={() => setRadioVal('opt2')}
                />
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                  Switch Controls
                </h4>
                <Switch
                  label="Automated Client DSR"
                  description="Send WhatsApp daily update"
                  checked={switchVal}
                  onChange={setSwitchVal}
                />
                <Switch
                  label="Geo-fenced Punch In"
                  checked={false}
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: BADGES & ALERTS */}
      {activeTab === 'badges' && (
        <div className="space-y-6">
          <Card title="StatusBadge Matrix (Auto-mapped Statuses)">
            <p className="text-xs text-text-muted mb-4">
              StatusBadge maps every operational status string directly into design-system muted tints.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <StatusBadge status="done" />
              <StatusBadge status="completed" />
              <StatusBadge status="active" />
              <StatusBadge status="paid" />
              <StatusBadge status="approved" />
              <StatusBadge status="in progress" />
              <StatusBadge status="contacted" />
              <StatusBadge status="scheduled" />
              <StatusBadge status="pending" />
              <StatusBadge status="under review" />
              <StatusBadge status="late" />
              <StatusBadge status="overdue" />
              <StatusBadge status="inactive" />
              <StatusBadge status="rejected" />
              <StatusBadge status="not started" />
              <StatusBadge status="new" />
              <StatusBadge status="converted" />
            </div>
          </Card>

          <Card title="Alerts (Inline Notification Banners)">
            <div className="space-y-3">
              <Alert type="info" title="Site Material Notice">
                Gypsum board bundles arrived at Indiranagar site. Please verify quantity with driver.
              </Alert>

              <Alert type="success" title="Milestone Sign-off">
                Stage 02 Ceiling has been formally approved by the client Mr. Suresh Reddy.
              </Alert>

              <Alert type="warning" title="Lead Moisture Alert">
                Moisture meter on Whitefield Penthouse plaster reads 14.2%. Wait 48 hours before priming.
              </Alert>

              <Alert
                type="danger"
                title="Critical Safety Escalation"
                onDismiss={() => toast.info('Alert dismissed')}
              >
                Electrical conduit trench obstructed near master bathroom. Immediate supervisor check required.
              </Alert>
            </div>
          </Card>

          <Card title="Toast Notification Triggers">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.success('Task marked as completed!')}
              >
                Success Toast
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.warning('Payment milestone due in 3 days.')}
              >
                Warning Toast
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.error('Failed to connect to site camera.')}
              >
                Danger Toast
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info('New drawing rev 3 uploaded.')}
              >
                Info Toast
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: CARDS & STATS */}
      {activeTab === 'cards' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Active Sites"
              value="3 Ongoing"
              icon="projects"
              trend="+1 site started this week"
              trendDirection="up"
            />
            <StatCard
              title="Pipeline Value"
              value={formatCurrency(13650000)}
              icon="payments"
              trend="INR formatted (en-IN)"
              trendDirection="neutral"
            />
            <StatCard
              title="Overdue Tasks"
              value="2 Delayed"
              icon="danger"
              trend="Countertop & glass template"
              trendDirection="down"
            />
            <StatCard
              title="Total Team"
              value="8 Members"
              icon="users"
              trend="Across 5 system roles"
              trendDirection="up"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              title="Standard Card Container"
              subtitle="1px border, 6px radius, minimal shadow"
              headerAction={
                <Button variant="outline" size="sm">
                  Action
                </Button>
              }
            >
              <p className="text-xs text-text-muted leading-relaxed">
                Cards form the primary content boundaries of Aesthetic Interiors OSM.
                They strictly use tokenized borders and backgrounds to preserve a clean,
                professional CRM layout.
              </p>
            </Card>

            <Card title="Progress Bars & Indicators">
              <div className="space-y-4">
                <ProgressBar value={25} showLabel label="Stage 01: Cleaning (25%)" color="warning" />
                <ProgressBar value={58} showLabel label="Stage 03: Carpenter (58%)" color="brand" />
                <ProgressBar value={100} showLabel label="Stage 12: Painter (100%)" color="success" />
              </div>
            </Card>
          </div>

          <Card title="User Avatars & Sizing">
            <div className="flex items-center gap-4">
              <Avatar name="Rahul Sharma" size="sm" status="online" />
              <Avatar name="Priya Deshmukh" size="md" status="online" />
              <Avatar name="Amit Patel" size="lg" status="offline" />
              <Avatar name="Santosh Yadav" size="xl" />
            </div>
          </Card>
        </div>
      )}

      {/* TAB 6: TABLES & NAVIGATION */}
      {activeTab === 'tables' && (
        <div className="space-y-6">
          <Card title="Accessible Table with Custom Columns & Badges">
            <Table
              columns={[
                { key: 'trade', header: 'Trade Scope' },
                { key: 'contractor', header: 'Assigned Contractor' },
                {
                  key: 'amount',
                  header: 'PO Value',
                  align: 'right',
                  render: (r) => formatCurrency(r.amount),
                },
                {
                  key: 'date',
                  header: 'Target Date',
                  render: (r) => formatDate(r.date),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (r) => <StatusBadge status={r.status} size="sm" />,
                },
              ]}
              data={sampleTableData}
              pagination={{
                currentPage: tablePage,
                totalPages: 3,
                totalItems: 12,
                pageSize: 4,
                onPageChange: setTablePage,
              }}
            />
          </Card>

          <Card title="Breadcrumbs & Tooltips">
            <div className="space-y-4">
              <Breadcrumbs
                items={[
                  { label: 'Operations', path: '/dashboard' },
                  { label: 'Projects', path: '/projects' },
                  { label: 'Indiranagar 4BHK Villa' },
                ]}
              />

              <div className="flex items-center gap-4 pt-2">
                <Tooltip content="WCAG AA Compliant Button" placement="top">
                  <Button variant="primary" size="sm">
                    Hover for Tooltip
                  </Button>
                </Tooltip>

                <Tooltip content="Displays detailed client specification sheet" placement="right">
                  <span className="text-xs text-brand-600 underline cursor-help">
                    Helpful Tooltip Link
                  </span>
                </Tooltip>
              </div>
            </div>
          </Card>

          <Card title="Empty States & Skeletons">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <EmptyState
                icon="folder"
                title="No Vendor Drawings Found"
                description="Upload the initial architectural DWG or PDF plan to begin staging."
                action={<Button size="sm">Upload First Drawing</Button>}
              />

              <div className="space-y-3 p-4 border border-border rounded bg-surface">
                <div className="text-xs font-semibold text-text-muted mb-2">Skeleton Loading</div>
                <div className="flex items-center gap-3">
                  <Skeleton variant="circular" width={36} height={36} />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="40%" />
                  </div>
                </div>
                <Skeleton variant="rectangular" height={40} className="w-full mt-3" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 7: MODALS & DRAWERS */}
      {activeTab === 'dialogs' && (
        <div className="space-y-6">
          <Card title="Interactive Dialog & Overlay Triggers">
            <div className="flex flex-wrap gap-4">
              <Button
                variant="primary"
                onClick={() => setModalOpen(true)}
                leadingIcon="more"
              >
                Open Test Modal
              </Button>

              <Button
                variant="danger"
                onClick={() => setConfirmOpen(true)}
                leadingIcon="trash"
              >
                Open Confirm Dialog
              </Button>

              <Button
                variant="outline"
                onClick={() => setDrawerOpen(true)}
                leadingIcon="menu"
              >
                Open Slide Drawer
              </Button>
            </div>
          </Card>

          {/* Test Modal */}
          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Sample Specification Modal"
            subtitle="Accessible keyboard navigation, ESC listener, and backdrop entrapment."
            footer={
              <>
                <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    toast.success('Modal action performed');
                    setModalOpen(false);
                  }}
                >
                  Save Changes
                </Button>
              </>
            }
          >
            <div className="space-y-3 text-xs leading-relaxed text-text-muted">
              <p>
                This modal follows all WCAG 2.2 accessibility principles: pressing the Escape key dismisses the dialog,
                and background scrolling is strictly locked.
              </p>
              <Input label="Specification Title" placeholder="e.g. Master Bedroom Smoked Oak Veneer" />
            </div>
          </Modal>

          {/* Test Confirm Dialog */}
          <ConfirmDialog
            isOpen={confirmOpen}
            title="Delete Site Stage?"
            message="Are you sure you want to remove this stage from the active project timeline? This action cannot be reversed."
            confirmText="Yes, Delete Stage"
            confirmVariant="danger"
            onConfirm={() => {
              toast.error('Site stage deleted');
              setConfirmOpen(false);
            }}
            onCancel={() => setConfirmOpen(false)}
          />

          {/* Test Drawer */}
          <Drawer
            isOpen={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            title="Site Details Slide Drawer"
            subtitle="Quick drawer for phone and desktop contextual oversight"
            footer={
              <Button size="sm" fullWidth onClick={() => setDrawerOpen(false)}>
                Close Drawer
              </Button>
            }
          >
            <div className="space-y-4 text-xs text-text-muted leading-relaxed">
              <p>
                Slide-over panels are ideal for inspecting drawing specifications, subcontractor contact cards,
                and mobile menus without full page navigation.
              </p>
              <div className="p-3 rounded bg-brand-50 border border-border">
                <span className="font-semibold text-text-main">Indiranagar 4BHK Villa</span>
                <div className="text-[11px] text-brand-600 mt-1">Lead: Amit Patel</div>
              </div>
            </div>
          </Drawer>
        </div>
      )}

      {/* TAB 8: DOMAIN & TIMELINE (PHASE 2) */}
      {activeTab === 'domain' && (
        <div className="space-y-6">
          {/* StageTimeline */}
          <Card
            title="StageTimeline Gantt View (Real Dates & Today Marker)"
            subtitle="Horizontal stage duration bars with Today (20 Oct 2026) indicator, status color codes, and late alerts"
          >
            <StageTimeline
              stages={[
                {
                  id: 'demo-s1',
                  order: 1,
                  name: 'Cleaning',
                  startDate: '2026-08-01',
                  endDate: '2026-08-05',
                  status: 'done',
                  agencyName: 'Internal Site Crew',
                },
                {
                  id: 'demo-s2',
                  order: 2,
                  name: 'Ceiling',
                  startDate: '2026-08-06',
                  endDate: '2026-08-20',
                  status: 'done',
                  agencyName: 'Apex False Ceiling & Gypsum',
                },
                {
                  id: 'demo-s3',
                  order: 3,
                  name: 'Carpenter',
                  startDate: '2026-08-21',
                  endDate: '2026-10-25',
                  status: 'in progress',
                  agencyName: 'Veneer Craft Woodworks',
                },
                {
                  id: 'demo-s7',
                  order: 7,
                  name: 'Glass agencies',
                  startDate: '2026-10-01',
                  endDate: '2026-10-16', // LATE (today is 20 Oct)
                  status: 'in progress',
                  agencyName: 'Crystal Clear Glass & Aluminium',
                },
                {
                  id: 'demo-s12',
                  order: 12,
                  name: 'Painter',
                  startDate: '2026-11-15',
                  endDate: '2026-11-30',
                  status: 'not started',
                  agencyName: 'Asian Elegance Painters',
                },
              ]}
              today="2026-10-20"
              onStageClick={(s) => toast.info(`Clicked stage: ${s.name}`)}
            />
          </Card>

          {/* StageStatusControl */}
          <Card
            title="StageStatusControl (44px Mobile Touch Segment)"
            subtitle="Phone-first quick state switcher for site supervisors and artisans"
          >
            <div className="max-w-md">
              <StageStatusControl
                value={stageStatusVal}
                onChange={(val) => {
                  setStageStatusVal(val);
                  toast.success(`Stage status changed to "${val}"`);
                }}
              />
              <p className="text-xs text-text-muted mt-2">
                Current selected state: <strong className="text-text-main capitalize">{stageStatusVal}</strong>
              </p>
            </div>
          </Card>

          {/* Domain Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                ProjectCard Domain Component
              </h4>
              <ProjectCard
                project={{
                  id: 'P1',
                  name: 'Indiranagar 4BHK Luxury Villa',
                  clientName: 'Priya Sharma',
                  siteAddress: 'Plot 42, 12th Main, Indiranagar, Bengaluru',
                  totalCost: 4850000,
                  status: 'in progress',
                  supervisors: ['u4'],
                  workers: ['u6'],
                  stages: [
                    { id: '1', status: 'done' },
                    { id: '2', status: 'done' },
                    { id: '3', status: 'in progress' },
                    { id: '7', status: 'in progress', endDate: '2026-10-16' }, // late
                  ],
                }}
                teamUsers={mockUsers}
                onClick={() => toast.info('Navigating to project detail...')}
              />
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                ClientCard Domain Component
              </h4>
              <ClientCard
                client={{
                  id: 'c1',
                  name: 'Priya Sharma',
                  phone: '+91 98450 99001',
                  email: 'priya@client.demo',
                  address: 'Plot 42, 12th Main, HAL 2nd Stage, Indiranagar',
                  type: 'new',
                }}
                projectsCount={2}
                onClick={() => toast.info('Navigating to client profile...')}
              />
            </div>
          </div>

          {/* Selectors & Toolbars */}
          <Card title="MultiSelect, AssigneePicker & AgencySelect">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MultiSelect
                label="MultiSelect with Chips"
                options={[
                  { value: 'opt1', label: 'False Ceiling Spec' },
                  { value: 'opt2', label: 'Italian Marble Tile' },
                  { value: 'opt3', label: 'Concealed Conduit' },
                ]}
                value={multiVal}
                onChange={setMultiVal}
              />

              <AssigneePicker
                label="AssigneePicker (Personnel)"
                users={mockUsers}
                value={assigneeVal}
                onChange={setAssigneeVal}
              />

              <AgencySelect
                label="AgencySelect (Contractor)"
                agencies={mockAgencies}
                value={agencyVal}
                onChange={setAgencyVal}
              />
            </div>
          </Card>

          {/* DetailList & Tag */}
          <Card title="DetailList & Tags">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Tag label="Ceiling Subcontractor" variant="brand" />
                <Tag label="On Time Milestone" variant="success" />
                <Tag label="Late Snag Check" variant="danger" />
                <Tag label="Pending Material" variant="warning" />
                <Tag label="Removable Filter Tag" variant="info" onRemove={() => toast.info('Removed tag')} />
              </div>

              <div className="border-t border-border pt-3">
                <DetailList
                  items={[
                    { label: 'Site Code', value: 'IND-VILLA-01', icon: 'projects' },
                    { label: 'Client POC', value: 'Priya Sharma', icon: 'user' },
                    { label: 'Supervisor Lead', value: 'Vikram Jadhav', icon: 'hardhat' },
                    { label: 'Contract Amount', value: formatCurrency(4850000), icon: 'payments' },
                  ]}
                  columns={4}
                />
              </div>
            </div>
          </Card>

          {/* FileImportDialog & PermissionGate */}
          <Card title="FileImportDialog & PermissionGate Demos">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon="upload"
                  onClick={() => setImportOpen(true)}
                >
                  Open FileImportDialog (CSV / Excel)
                </Button>

                <PermissionGate
                  permission="clients.manage"
                  fallback={
                    <span className="text-xs text-text-muted italic">
                      [PermissionGate: clients.manage hidden for non-admin/manager]
                    </span>
                  }
                >
                  <Tag label="PermissionGate: clients.manage Authorized ✓" variant="success" />
                </PermissionGate>
              </div>

              <FileImportDialog
                isOpen={importOpen}
                onClose={() => setImportOpen(false)}
                onImport={async (rows) => {
                  toast.success(`Imported ${rows.length} records!`);
                  return { importedCount: rows.length, skippedCount: 0 };
                }}
                title="Spreadsheet Import Dialog Demo"
                entityName="clients"
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}


export default ComponentsShowcasePage;
