import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { agencyService } from '../services/agencyService';
import { TRADE_SKILLS_CATALOG, FITOUT_12_STAGES } from '../data/agencies';
import { mockProjects } from '../data/projects';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePermission } from '../hooks/usePermission';

import PageHeader from '../components/ui/PageHeader';
import DataToolbar from '../components/ui/DataToolbar';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import PermissionGate from '../components/ui/PermissionGate';
import { Badge } from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  BuildingIcon,
  UserIcon,
  UsersIcon,
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  TagIcon,
  BriefcaseIcon,
  EyeIcon,
  ShieldCheckIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CheckIcon,
  XIcon,
} from '../components/ui/icons';
import {
  validatePhone,
  sanitizePhone,
  validateEmail,
  validateRequired,
  validatePincode,
} from '../utils/validators';

const TRADE_OPTIONS = [
  { value: 'Ceiling', label: 'Ceiling (Gypsum / False Ceiling)' },
  { value: 'Carpenter', label: 'Carpenter & Woodwork' },
  { value: 'Tiles', label: 'Tiles, Stone & Marble Flooring' },
  { value: 'Plumbing', label: 'Plumbing & Concealed Lines' },
  { value: 'Electrical', label: 'Electrical, Lighting & Automation' },
  { value: 'Glass', label: 'Glass, Partitions & Aluminium' },
  { value: 'Paint', label: 'Painting, Duco & PU Polishing' },
  { value: 'Civil', label: 'Civil, Masonry & Plastering' },
  { value: 'Fabrication', label: 'Metal Fabrication & Grills' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active (On Site)' },
  { value: 'on_hold', label: 'On Hold (Review)' },
  { value: 'inactive', label: 'Inactive' },
];

const RATE_UNIT_OPTIONS = [
  { value: 'sqft', label: 'Per Sq. Ft. (₹/sqft)' },
  { value: 'day', label: 'Per Day / Daily Wage (₹/day)' },
  { value: 'point', label: 'Per Point (₹/point)' },
  { value: 'milestone', label: 'Lump Sum Milestone (₹/milestone)' },
];

const PAYMENT_TERMS_OPTIONS = [
  { value: 'Weekly Milestone Basis', label: 'Weekly Milestone Basis' },
  { value: 'Weekly Running Bill', label: 'Weekly Running Bill' },
  { value: '50% Advance + Running Bills', label: '50% Advance + Running Bills' },
  { value: '30% Rough-In + 70% Fixture Handover', label: '30% Rough-In + 70% Fixture Handover' },
  { value: 'Milestone Completion', label: 'Milestone Completion' },
  { value: 'Net 15 Days', label: 'Net 15 Days' },
];

const DEFAULT_FORM = {
  name: '',
  trade: 'Ceiling',
  ownerName: '',
  contactPerson: '',
  phone: '',
  alternatePhone: '',
  email: '',
  address: '',
  city: 'Bangalore',
  pincode: '',
  skills: [],
  stages: [],
  teamSize: 8,
  rateUnit: 'sqft',
  baseRate: 50,
  paymentTerms: 'Weekly Running Bill',
  gstin: '',
  pan: '',
  bankDetails: '',
  status: 'active',
  rating: 4.8,
  notes: '',
};

export function AgenciesPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const toast = useToast();
  const canManageAgencies = usePermission('agencies.manage');

  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('ALL');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState(null);
  const [viewingAgency, setViewingAgency] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [projectsModalAgency, setProjectsModalAgency] = useState(null);

  const handleOpenProjects = (agency) => {
    const pIds = agency.activeProjects || [];
    if (pIds.length === 0) {
      toast.error('No active sites allocated to this agency');
      return;
    }

    if (pIds.length === 1) {
      navigate(`/projects/${pIds[0]}`);
    } else {
      setProjectsModalAgency(agency);
    }
  };

  // Form state
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [skillInput, setSkillInput] = useState('');
  const [stageProductInputs, setStageProductInputs] = useState({});

  const fetchAgencies = async () => {
    setLoading(true);
    try {
      const data = await agencyService.getAllAgencies();
      setAgencies(data);
    } catch (err) {
      toast.error('Failed to load agency directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgencies();
  }, []);

  // Summary Metrics
  const stats = useMemo(() => {
    const totalAgencies = agencies.length;
    const totalArtisans = agencies.reduce((acc, a) => acc + (Number(a.teamSize) || 0), 0);
    const activeSites = agencies.reduce((acc, a) => acc + (a.activeProjects?.length || 0), 0);
    const uniqueTrades = new Set(agencies.map((a) => a.trade).filter(Boolean)).size;
    return { totalAgencies, totalArtisans, activeSites, uniqueTrades };
  }, [agencies]);

  const tradesList = useMemo(() => {
    const set = new Set(agencies.map((a) => a.trade).filter(Boolean));
    return Array.from(set);
  }, [agencies]);

  const filteredAgencies = useMemo(() => {
    return agencies.filter((a) => {
      const q = search.toLowerCase();
      const matchesSearch =
        search === '' ||
        a.name?.toLowerCase().includes(q) ||
        a.ownerName?.toLowerCase().includes(q) ||
        a.contactPerson?.toLowerCase().includes(q) ||
        a.trade?.toLowerCase().includes(q) ||
        a.phone?.includes(q) ||
        a.city?.toLowerCase().includes(q) ||
        a.address?.toLowerCase().includes(q) ||
        (Array.isArray(a.skills) && a.skills.some((s) => s.toLowerCase().includes(q))) ||
        (Array.isArray(a.stages) &&
          a.stages.some(
            (st) =>
              st.stageName?.toLowerCase().includes(q) ||
              (Array.isArray(st.products) &&
                st.products.some((pr) => pr.toLowerCase().includes(q)))
          ));

      const matchesTrade = tradeFilter === 'ALL' || a.trade === tradeFilter;
      const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;

      const matchesStage =
        stageFilter === 'ALL' ||
        (Array.isArray(a.stages) &&
          a.stages.some((st) => String(st.stageOrder) === stageFilter));

      return matchesSearch && matchesTrade && matchesStatus && matchesStage;
    });
  }, [agencies, search, tradeFilter, statusFilter, stageFilter]);

  const handleOpenAdd = () => {
    setEditingAgency(null);
    const defaultStage = FITOUT_12_STAGES.find((s) => s.trade === 'Ceiling') || FITOUT_12_STAGES[1];
    setFormData({
      ...DEFAULT_FORM,
      skills: [...(TRADE_SKILLS_CATALOG.Ceiling?.slice(0, 3) || [])],
      stages: [
        {
          stageOrder: defaultStage.order,
          stageName: defaultStage.name,
          products: [...defaultStage.defaultProducts.slice(0, 4)],
        },
      ],
    });
    setSkillInput('');
    setStageProductInputs({});
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (agency) => {
    setEditingAgency(agency);
    setFormData({
      name: agency.name || '',
      trade: agency.trade || 'Ceiling',
      ownerName: agency.ownerName || agency.contactPerson || '',
      contactPerson: agency.contactPerson || agency.ownerName || '',
      phone: agency.phone || '',
      alternatePhone: agency.alternatePhone || '',
      email: agency.email || '',
      address: agency.address || '',
      city: agency.city || 'Bangalore',
      pincode: agency.pincode || '',
      skills: Array.isArray(agency.skills) ? [...agency.skills] : [],
      stages: Array.isArray(agency.stages) ? JSON.parse(JSON.stringify(agency.stages)) : [],
      teamSize: agency.teamSize || 8,
      rateUnit: agency.rateUnit || 'sqft',
      baseRate: agency.baseRate || 50,
      paymentTerms: agency.paymentTerms || 'Weekly Running Bill',
      gstin: agency.gstin || '',
      pan: agency.pan || '',
      bankDetails: agency.bankDetails || '',
      status: agency.status || 'active',
      rating: agency.rating !== undefined ? agency.rating : 4.8,
      notes: agency.notes || '',
    });
    setSkillInput('');
    setStageProductInputs({});
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Skill management in form
  const handleAddSkill = (skillToAdd) => {
    const trimmed = (skillToAdd || skillInput).trim();
    if (!trimmed) return;
    if (!formData.skills.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, trimmed],
      }));
    }
    setSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillToRemove),
    }));
  };

  const handleTradeChange = (newTrade) => {
    const suggested = TRADE_SKILLS_CATALOG[newTrade] || [];
    const matchedStage = FITOUT_12_STAGES.find((s) => s.trade === newTrade);

    setFormData((prev) => {
      let nextStages = [...prev.stages];
      if (matchedStage && !nextStages.some((st) => st.stageOrder === matchedStage.order)) {
        nextStages.push({
          stageOrder: matchedStage.order,
          stageName: matchedStage.name,
          products: [...matchedStage.defaultProducts.slice(0, 4)],
        });
      }

      return {
        ...prev,
        trade: newTrade,
        skills: prev.skills.length === 0 ? suggested.slice(0, 4) : prev.skills,
        stages: nextStages,
      };
    });
  };

  // 12 Stages management in form
  const handleToggleStage = (stageObj) => {
    setFormData((prev) => {
      const exists = prev.stages.some((st) => st.stageOrder === stageObj.order);
      if (exists) {
        return {
          ...prev,
          stages: prev.stages.filter((st) => st.stageOrder !== stageObj.order),
        };
      }
      return {
        ...prev,
        stages: [
          ...prev.stages,
          {
            stageOrder: stageObj.order,
            stageName: stageObj.name,
            products: [...stageObj.defaultProducts.slice(0, 4)],
          },
        ].sort((a, b) => a.stageOrder - b.stageOrder),
      };
    });
  };

  const handleAddProductToStage = (stageOrder, productText) => {
    const trimmed = (productText || stageProductInputs[stageOrder] || '').trim();
    if (!trimmed) return;

    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((st) => {
        if (st.stageOrder !== stageOrder) return st;
        if (st.products?.includes(trimmed)) return st;
        return {
          ...st,
          products: [...(st.products || []), trimmed],
        };
      }),
    }));

    setStageProductInputs((prev) => ({ ...prev, [stageOrder]: '' }));
  };

  const handleRemoveProductFromStage = (stageOrder, productToRemove) => {
    setFormData((prev) => ({
      ...prev,
      stages: prev.stages.map((st) => {
        if (st.stageOrder !== stageOrder) return st;
        return {
          ...st,
          products: (st.products || []).filter((p) => p !== productToRemove),
        };
      }),
    }));
  };

  const validate = () => {
    const errs = {};
    const nameErr = validateRequired(formData.name, 'Agency business name', 2);
    if (nameErr) errs.name = nameErr;

    const ownerErr = validateRequired(formData.ownerName, 'Owner / Contractor name', 2);
    if (ownerErr) errs.ownerName = ownerErr;

    const phoneErr = validatePhone(formData.phone, { required: true, fieldLabel: 'Phone number' });
    if (phoneErr) errs.phone = phoneErr;

    if (formData.alternatePhone) {
      const altErr = validatePhone(formData.alternatePhone, {
        required: false,
        fieldLabel: 'Alternate phone',
      });
      if (altErr) errs.alternatePhone = altErr;
    }

    if (formData.email) {
      const emailErr = validateEmail(formData.email, {
        required: false,
        fieldLabel: 'Email address',
      });
      if (emailErr) errs.email = emailErr;
    }

    if (formData.pincode) {
      const pinErr = validatePincode(formData.pincode);
      if (pinErr) errs.pincode = pinErr;
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (editingAgency) {
        await agencyService.updateAgency(editingAgency.id, formData);
        toast.success(`Agency "${formData.name}" updated successfully`);
      } else {
        await agencyService.createAgency(formData);
        toast.success(`Agency "${formData.name}" registered successfully`);
      }
      setIsFormModalOpen(false);
      fetchAgencies();
    } catch (err) {
      toast.error(err.message || 'Failed to save agency');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await agencyService.deleteAgency(deleteTarget.id);
      toast.success(`Agency "${deleteTarget.name}" removed`);
      setDeleteTarget(null);
      fetchAgencies();
    } catch (err) {
      toast.error(err.message || 'Failed to delete agency');
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Agency & Owner',
      width: '24%',
      render: (a) => {
        return (
          <div className="space-y-1">
            {/* Row 1: Agency Name */}
            <div className="flex items-center gap-2">
              <span
                onClick={() => setViewingAgency(a)}
                className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer text-sm leading-tight hover:underline truncate"
                title="Click to view full agency profile & 12-stage products"
              >
                {a.name}
              </span>
            </div>

            {/* Row 2: Owner Name */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UserIcon className="size-3 text-muted-foreground/80 shrink-0" />
              <span>Owner:</span>
              <span className="font-semibold text-foreground/90">{a.ownerName || a.contactPerson}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'stages',
      header: '12 Fit-Out Stages',
      width: '20%',
      render: (a) => {
        const stagesList = [...(Array.isArray(a.stages) ? a.stages : [])].sort(
          (x, y) => (x.stageOrder || 0) - (y.stageOrder || 0)
        );

        const getShortStageName = (name) => {
          if (!name) return '';
          return name.split('(')[0].replace(/agencies/i, '').trim();
        };

        return (
          <div className="flex flex-wrap items-center gap-1.5 max-w-[220px]">
            {stagesList.length > 0 ? (
              stagesList.map((st) => (
                <span
                  key={st.stageOrder}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 shadow-2xs whitespace-nowrap"
                  title={`Stage ${st.stageOrder}: ${st.stageName} (${st.products?.length || 0} products)`}
                >
                  <span className="font-bold opacity-80 font-mono text-[10px]">S{st.stageOrder}:</span>
                  <span>{getShortStageName(st.stageName)}</span>
                </span>
              ))
            ) : (
              <Badge variant="secondary" size="sm">
                {a.trade}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'contact',
      header: 'Contact Numbers',
      width: '18%',
      render: (a) => (
        <div className="space-y-1 text-xs">
          {/* Primary Phone & Alt Tag */}
          <div className="flex items-center gap-1.5 font-medium text-foreground font-mono">
            <a href={`tel:${a.phone}`} className="hover:text-primary transition-colors tracking-tight font-semibold">
              {a.phone}
            </a>
            {a.alternatePhone && (
              <span
                className="text-[10px] font-semibold text-muted-foreground font-mono bg-muted px-1.5 py-0.2 rounded border border-border/80 cursor-help"
                title={`Alternate Contact: ${a.alternatePhone}`}
              >
                ALT
              </span>
            )}
          </div>

          {/* Email */}
          {a.email && (
            <div className="text-muted-foreground text-[11px] truncate max-w-[180px]">
              <a href={`mailto:${a.email}`} className="truncate hover:text-primary transition-colors" title={a.email}>
                {a.email}
              </a>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Location / Address',
      width: '16%',
      render: (a) => (
        <div className="space-y-1 text-xs">
          {/* City & Pin */}
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <span>{a.city || 'Bangalore'}</span>
            {a.pincode && (
              <span className="text-muted-foreground text-[11px] font-mono font-normal">
                ({a.pincode})
              </span>
            )}
          </div>

          {/* Street Address */}
          {a.address && (
            <div
              className="text-[11px] text-muted-foreground truncate max-w-[170px]"
              title={a.address}
            >
              {a.address}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'commercials',
      header: 'Workers & Rate',
      width: '12%',
      render: (a) => (
        <div className="space-y-1 text-xs">
          {/* Team Size without icon */}
          <div className="flex items-center gap-1 font-medium text-foreground">
            <span className="font-semibold">{a.teamSize || 8}</span>
            <span className="text-muted-foreground text-[11px]">workers</span>
          </div>

          {/* Commercial Rate */}
          {a.baseRate > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
              <span className="font-bold text-foreground">₹{a.baseRate}</span>
              <span className="text-[10px] text-muted-foreground/80">/ {a.rateUnit || 'sqft'}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'activeProjects',
      header: 'Active Sites',
      width: '10%',
      align: 'center',
      render: (a) => {
        const count = a.activeProjects?.length || 0;
        return (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (count > 0) handleOpenProjects(a);
              }}
              disabled={count === 0}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                count > 0
                  ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:border-primary/40 shadow-2xs cursor-pointer active:scale-95'
                  : 'bg-muted/60 text-muted-foreground border-border/70 cursor-not-allowed opacity-60'
              }`}
              title={
                count > 0
                  ? (count === 1 ? 'Click to open project screen' : 'Click to view and open project screens')
                  : 'No active sites allocated'
              }
            >
              <BuildingIcon className="size-3 shrink-0" />
              <span>{count} {count === 1 ? 'site' : 'sites'}</span>
            </button>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '8%',
      align: 'right',
      render: (a) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setViewingAgency(a)}
            className="p-1.5 text-text-muted hover:text-primary hover:bg-accent rounded-md transition-colors cursor-pointer"
            title="View Agency Profile & 12-Stage Products"
          >
            <EyeIcon className="size-3.5" />
          </button>
          <PermissionGate permission="agencies.manage">
            <button
              type="button"
              onClick={() => handleOpenEdit(a)}
              className="p-1.5 text-text-muted hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
              title="Edit Agency Coordinates & Commercials"
            >
              <EditIcon className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(a)}
              className="p-1.5 text-text-muted hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
              title="Delete Agency"
            >
              <TrashIcon className="size-3.5" />
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

    const suggestedSkillsForTrade = useMemo(() => {
    return TRADE_SKILLS_CATALOG[formData.trade] || [];
  }, [formData.trade]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Subcontractor & Trade Agencies"
        subtitle="SRS Module 3.4 & 3.5: Master directory of specialist trade contractors, 12 sequential fit-out stages, supplied products, and site allocations"
        actions={
          <PermissionGate permission="agencies.manage">
            <Button
              variant="primary"
              size="sm"
              leadingIcon="plus"
              onClick={handleOpenAdd}
            >
              Register New Agency
            </Button>
          </PermissionGate>
        }
      />

      {/* Sleek Compact KPI Summary Cards - Consistent Size across screens */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Total Agencies */}
        <div className="w-48 sm:w-52 rounded-xl border border-border bg-card px-3 py-2 shadow-2xs hover:border-border/80 transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Registered Agencies
            </span>
            <div className="size-5 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <BriefcaseIcon className="size-3" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-bold font-mono tracking-tight text-foreground tabular-nums">
              {stats.totalAgencies}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground truncate">
              12 fit-out stages
            </span>
          </div>
        </div>

        {/* Total Workforce */}
        <div className="w-48 sm:w-52 rounded-xl border border-border bg-card px-3 py-2 shadow-2xs hover:border-border/80 transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Total Workers
            </span>
            <div className="size-5 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <UsersIcon className="size-3" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-bold font-mono tracking-tight text-foreground tabular-nums">
              {stats.totalArtisans}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground truncate">
              Active workers
            </span>
          </div>
        </div>

        {/* Active Sites Under Execution */}
        <div className="w-48 sm:w-52 rounded-xl border border-border bg-card px-3 py-2 shadow-2xs hover:border-border/80 transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
              Active Site Stages
            </span>
            <div className="size-5 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <BuildingIcon className="size-3" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-bold font-mono tracking-tight text-foreground tabular-nums">
              {stats.activeSites}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground truncate">
              Live projects
            </span>
          </div>
        </div>
      </div>

      {/* Enhanced Data Toolbar with 12 Stages Filter - Sticky Toolbar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md py-1">
        <DataToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search agency, owner name, products, stage, trade, phone..."
          totalCount={filteredAgencies.length}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter by 12 Stages */}
              <div className="w-52">
                <Select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All 12 Fit-Out Stages' },
                    ...FITOUT_12_STAGES.map((s) => ({
                      value: String(s.order),
                      label: `Stage ${s.order}: ${s.name}`,
                    })),
                  ]}
                />
              </div>

              {/* Filter by Trade */}
              <div className="w-40">
                <Select
                  value={tradeFilter}
                  onChange={(e) => setTradeFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Trades' },
                    ...tradesList.map((t) => ({ value: t, label: t })),
                  ]}
                />
              </div>

              {/* Filter by Status */}
              <div className="w-36">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: 'ALL', label: 'All Statuses' },
                    { value: 'active', label: 'Active Only' },
                    { value: 'on_hold', label: 'On Hold' },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                />
              </div>
            </div>
          }
        />
      </div>

      {/* Agencies Data Table */}
      <Table
        columns={columns}
        data={filteredAgencies}
        loading={loading}
        emptyTitle={
          search || tradeFilter !== 'ALL' || statusFilter !== 'ALL' || stageFilter !== 'ALL'
            ? 'No agencies match your criteria'
            : 'No agencies registered yet'
        }
        emptyDescription={
          search || tradeFilter !== 'ALL' || statusFilter !== 'ALL' || stageFilter !== 'ALL'
            ? 'Try clearing your search query or adjusting the 12-stage and trade filters.'
            : 'Register your specialist trade contractors to allocate them and their products across the 12 sequential fit-out stages.'
        }
      />

      {/* View Agency Profile Modal (Showing 12 Stages & Products) */}
      {viewingAgency && (
        <Modal
          isOpen={Boolean(viewingAgency)}
          onClose={() => setViewingAgency(null)}
          title={viewingAgency.name}
          subtitle={`Proprietor: ${viewingAgency.ownerName || viewingAgency.contactPerson} • ${viewingAgency.trade} Trade`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-muted-foreground">
                Partner ID: <span className="font-mono">{viewingAgency.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setViewingAgency(null)}>
                  Close
                </Button>
                <PermissionGate permission="agencies.manage">
                  <Button
                    variant="primary"
                    size="sm"
                    leadingIcon="edit"
                    onClick={() => {
                      const target = viewingAgency;
                      setViewingAgency(null);
                      handleOpenEdit(target);
                    }}
                  >
                    Edit Agency & Products
                  </Button>
                </PermissionGate>
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Top Identity Card */}
            <div className="p-4 rounded-xl border border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">{viewingAgency.name}</h3>
                  <Badge variant="secondary" size="md">
                    {viewingAgency.trade}
                  </Badge>
                  {viewingAgency.status === 'active' ? (
                    <Badge variant="success" size="sm" dot>
                      Active
                    </Badge>
                  ) : viewingAgency.status === 'on_hold' ? (
                    <Badge variant="warning" size="sm" dot>
                      On Hold
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm" dot>
                      Inactive
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>
                    Contractor Owner: <strong className="text-foreground">{viewingAgency.ownerName || viewingAgency.contactPerson}</strong>
                  </span>
                  {viewingAgency.establishedYear && <span>• Est. {viewingAgency.establishedYear}</span>}
                </div>
              </div>
            </div>

            {/* 12 Fit-Out Milestone Stages & Supplied Products / Materials */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div className="flex items-center gap-2">
                  <BuildingIcon className="size-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    12 Interior Fit-Out Stages & Supplied Products
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {viewingAgency.stages?.length || 0} stages covered
                </span>
              </div>

              {viewingAgency.stages && viewingAgency.stages.length > 0 ? (
                <div className="space-y-3 pt-1">
                  {viewingAgency.stages.map((st) => (
                    <div
                      key={st.stageOrder}
                      className="p-3 rounded-lg border border-border/80 bg-muted/25 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="size-5 rounded-full bg-primary text-primary-foreground font-bold text-[10px] flex items-center justify-center">
                            {st.stageOrder}
                          </span>
                          <span className="text-xs font-bold text-foreground">
                            Stage {st.stageOrder}: {st.stageName}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {st.products?.length || 0} products supplied
                        </span>
                      </div>

                      {/* Products List */}
                      {st.products && st.products.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {st.products.map((p, pIdx) => (
                            <span
                              key={pIdx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-card text-foreground border border-border/80 shadow-2xs"
                            >
                              <CheckIcon className="size-3 text-emerald-500" />
                              <span>{p}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Standard stage execution items.
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic py-2">
                  No specific stage products configured yet. Click Edit Agency to map stages.
                </div>
              )}
            </div>

            {/* Grid 1: Contact Coordinates & Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <PhoneIcon className="size-3.5 text-primary" />
                  <span>Contact Coordinates</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Primary Mobile:</span>
                    <a
                      href={`tel:${viewingAgency.phone}`}
                      className="font-mono font-medium text-foreground hover:text-primary"
                    >
                      {viewingAgency.phone}
                    </a>
                  </div>
                  {viewingAgency.alternatePhone && (
                    <div className="flex items-center justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">WhatsApp / Alternate:</span>
                      <a
                        href={`tel:${viewingAgency.alternatePhone}`}
                        className="font-mono font-medium text-foreground hover:text-primary"
                      >
                        {viewingAgency.alternatePhone}
                      </a>
                    </div>
                  )}
                  {viewingAgency.email && (
                    <div className="flex items-center justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Business Email:</span>
                      <a
                        href={`mailto:${viewingAgency.email}`}
                        className="font-medium text-foreground hover:text-primary truncate max-w-[180px]"
                      >
                        {viewingAgency.email}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Site Supervisor:</span>
                    <span className="font-medium text-foreground">
                      {viewingAgency.contactPerson || viewingAgency.ownerName}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <MapPinIcon className="size-3.5 text-primary" />
                  <span>Workshop & Address</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">City:</span>
                    <span className="font-medium text-foreground">{viewingAgency.city || 'Bangalore'}</span>
                  </div>
                  {viewingAgency.pincode && (
                    <div className="flex items-center justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Pincode:</span>
                      <span className="font-mono font-medium text-foreground">{viewingAgency.pincode}</span>
                    </div>
                  )}
                  <div className="py-1">
                    <span className="text-muted-foreground block mb-0.5">Street Address:</span>
                    <span className="font-medium text-foreground leading-relaxed">
                      {viewingAgency.address || 'Site office / workshop address not specified'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trade Skills & Specializations */}
            <div className="p-4 rounded-xl border border-border bg-card space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <TagIcon className="size-3.5 text-primary" />
                  <span>Trade Skills & Workmanship Specializations</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {viewingAgency.skills?.length || 0} registered skills
                </span>
              </div>

              {viewingAgency.skills && viewingAgency.skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {viewingAgency.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-muted text-foreground border border-border/70"
                    >
                      <CheckIcon className="size-3 text-emerald-500" />
                      <span>{skill}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">Standard trade capabilities.</div>
              )}
            </div>

            {/* Grid 2: Commercials & Compliance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <BriefcaseIcon className="size-3.5 text-primary" />
                  <span>Commercial & Capacity</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total Workers:</span>
                    <span className="font-bold text-foreground">
                      {viewingAgency.teamSize || 8} workers on roll
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Standard Base Rate:</span>
                    <span className="font-mono font-bold text-foreground">
                      ₹{viewingAgency.baseRate || 0} / {viewingAgency.rateUnit || 'sqft'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Payment Terms:</span>
                    <span className="font-medium text-foreground">
                      {viewingAgency.paymentTerms || 'Weekly Running Bill'}
                    </span>
                  </div>
                  {viewingAgency.bankDetails && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-muted-foreground">UPI / Payout ID:</span>
                      <span className="font-mono text-foreground font-medium">
                        {viewingAgency.bankDetails}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-border bg-card space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <ShieldCheckIcon className="size-3.5 text-primary" />
                  <span>Statutory & Compliance</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">GSTIN Number:</span>
                    <span className="font-mono font-medium text-foreground">
                      {viewingAgency.gstin || 'Unregistered / Composite'}
                    </span>
                  </div>
                  {viewingAgency.pan && (
                    <div className="flex items-center justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Business PAN:</span>
                      <span className="font-mono font-medium text-foreground">{viewingAgency.pan}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Active Allocated Sites:</span>
                    <span className="font-semibold text-primary">
                      {viewingAgency.activeProjects?.length || 0} active site(s)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality & Workmanship Remarks */}
            {viewingAgency.notes && (
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 text-xs">
                <span className="font-semibold text-foreground block mb-1">
                  Supervisor Notes & Remarks:
                </span>
                <p className="text-muted-foreground leading-relaxed">{viewingAgency.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Add / Edit Agency Form Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingAgency ? `Edit Agency: ${editingAgency.name}` : 'Register New Subcontractor Agency'}
        subtitle="Configure agency coordinates, 12 fit-out stages, supplied products, and commercials"
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">* Indicates mandatory field</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsFormModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSubmit}>
                {editingAgency ? 'Save Changes' : 'Register Agency'}
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1: Business Identity & Owner */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              1. Agency Business & Owner Identity
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Agency Business Name"
                required
                placeholder="e.g. Royal Touch Tiles & Masonry"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={formErrors.name}
              />

              <Input
                label="Owner / Contractor Name"
                required
                placeholder="e.g. Sunil Sharma"
                value={formData.ownerName}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ownerName: e.target.value,
                    contactPerson: formData.contactPerson || e.target.value,
                  })
                }
                error={formErrors.ownerName}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Primary Trade Scope"
                required
                value={formData.trade}
                onChange={(e) => handleTradeChange(e.target.value)}
                options={TRADE_OPTIONS}
              />

              <Input
                label="Site Supervisor / POC"
                placeholder="e.g. Dinesh Kumar"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                helperText="Primary contact on site"
              />

              <Select
                label="Operational Status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                options={STATUS_OPTIONS}
              />
            </div>
          </div>

          {/* SECTION 2: 12 Sequential Fit-Out Stages & Provided Products */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 flex items-center justify-between">
              <span>2. 12 Sequential Fit-Out Stages & Provided Products</span>
              <span className="text-[11px] font-normal text-primary">
                Select stages to map supplied products
              </span>
            </div>

            {/* Stage Selector Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {FITOUT_12_STAGES.map((stageObj) => {
                const isSelected = formData.stages?.some((st) => st.stageOrder === stageObj.order);
                return (
                  <button
                    key={stageObj.order}
                    type="button"
                    onClick={() => handleToggleStage(stageObj)}
                    className={`flex items-start gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-foreground ring-1 ring-primary/30 shadow-2xs'
                        : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <span
                      className={`size-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted-foreground/30 text-foreground'
                      }`}
                    >
                      {stageObj.order}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate leading-tight">
                        {stageObj.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground/80 truncate">
                        {stageObj.trade}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Products Configurator for Selected Stages */}
            {formData.stages && formData.stages.length > 0 ? (
              <div className="space-y-3 pt-2">
                <span className="text-[11px] font-semibold text-foreground block">
                  Configured Products & Supplies for Selected Stages:
                </span>

                {formData.stages.map((st) => {
                  const masterStage = FITOUT_12_STAGES.find((s) => s.order === st.stageOrder);
                  const recommended = masterStage?.defaultProducts || [];

                  return (
                    <div
                      key={st.stageOrder}
                      className="p-3 rounded-lg border border-border bg-muted/20 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="size-5 rounded-full bg-primary text-primary-foreground font-bold text-[10px] flex items-center justify-center">
                            {st.stageOrder}
                          </span>
                          <span className="text-xs font-bold text-foreground">
                            Stage {st.stageOrder}: {st.stageName} Products
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleStage({ order: st.stageOrder, name: st.stageName })}
                          className="text-[11px] text-destructive hover:underline cursor-pointer"
                        >
                          Remove Stage
                        </button>
                      </div>

                      {/* Quick Add Recommended Products */}
                      {recommended.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[10px] text-muted-foreground">
                            Recommended Products for {st.stageName}:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {recommended.map((rp, rIdx) => {
                              const alreadyAdded = st.products?.includes(rp);
                              return (
                                <button
                                  key={rIdx}
                                  type="button"
                                  disabled={alreadyAdded}
                                  onClick={() => handleAddProductToStage(st.stageOrder, rp)}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                                    alreadyAdded
                                      ? 'bg-muted text-muted-foreground/50 border-border/50 cursor-default'
                                      : 'bg-card text-foreground hover:bg-primary/10 hover:border-primary/40 border-border cursor-pointer'
                                  }`}
                                >
                                  {alreadyAdded ? (
                                    <CheckIcon className="size-2.5 text-emerald-500" />
                                  ) : (
                                    <PlusIcon className="size-2.5 text-primary" />
                                  )}
                                  <span>{rp}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Custom Product Input for this stage */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder={`Add product/material for Stage ${st.stageOrder}...`}
                          value={stageProductInputs[st.stageOrder] || ''}
                          onChange={(e) =>
                            setStageProductInputs({
                              ...stageProductInputs,
                              [st.stageOrder]: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddProductToStage(st.stageOrder);
                            }
                          }}
                          className="flex-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddProductToStage(st.stageOrder)}
                        >
                          Add
                        </Button>
                      </div>

                      {/* Active Products List for this stage */}
                      <div className="flex flex-wrap gap-1.5 min-h-[28px] p-2 rounded bg-card border border-border/70">
                        {st.products && st.products.length > 0 ? (
                          st.products.map((p, pIdx) => (
                            <span
                              key={pIdx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground border border-border"
                            >
                              <span>{p}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveProductFromStage(st.stageOrder, p)}
                                className="text-muted-foreground hover:text-destructive p-0.5 transition-colors cursor-pointer"
                                title="Remove product"
                              >
                                <XIcon className="size-3" />
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            No products configured yet. Click recommendations above or type custom products.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground">
                Select one or more stages above to specify products provided by this agency.
              </div>
            )}
          </div>

          {/* SECTION 3: Contact Numbers & Address */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              3. Contact Numbers & Workshop Address
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Phone Number (10 digits)"
                required
                type="tel"
                maxLength={10}
                placeholder="9845012345"
                value={formData.phone}
                onChange={(e) => {
                  const clean = sanitizePhone(e.target.value);
                  setFormData({ ...formData, phone: clean });
                  if (formErrors.phone) {
                    setFormErrors((prev) => ({
                      ...prev,
                      phone: validatePhone(clean, { required: true, fieldLabel: 'Phone number' }),
                    }));
                  }
                }}
                error={formErrors.phone}
                helperText="Only 10 digits allowed"
              />

              <Input
                label="Alternate / WhatsApp No."
                type="tel"
                maxLength={10}
                placeholder="9845012346"
                value={formData.alternatePhone}
                onChange={(e) => {
                  const clean = sanitizePhone(e.target.value);
                  setFormData({ ...formData, alternatePhone: clean });
                  if (formErrors.alternatePhone) {
                    setFormErrors((prev) => ({
                      ...prev,
                      alternatePhone: validatePhone(clean, {
                        required: false,
                        fieldLabel: 'Alternate phone',
                      }),
                    }));
                  }
                }}
                error={formErrors.alternatePhone}
                helperText="For site dispatch updates"
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="contact@agency.com"
                value={formData.email}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({ ...formData, email: val });
                  if (formErrors.email) {
                    setFormErrors((prev) => ({
                      ...prev,
                      email: validateEmail(val, { required: false, fieldLabel: 'Email address' }),
                    }));
                  }
                }}
                error={formErrors.email}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Input
                  label="Street Address / Workshop Location"
                  placeholder="e.g. Plot 42, Bommanahalli Industrial Area"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
                <Input
                  label="Pincode"
                  maxLength={6}
                  placeholder="560068"
                  value={formData.pincode}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setFormData({ ...formData, pincode: clean });
                  }}
                  error={formErrors.pincode}
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Trade Skills & Specializations */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1 flex items-center justify-between">
              <span>4. Trade Skills & Specializations</span>
              <span className="text-[11px] font-normal text-muted-foreground">Click chips to add</span>
            </div>

            {/* Quick Suggestions for Selected Trade */}
            {suggestedSkillsForTrade.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground block font-medium">
                  Recommended for {formData.trade}:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedSkillsForTrade.map((skill, idx) => {
                    const isSelected = formData.skills.includes(skill);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            handleRemoveSkill(skill);
                          } else {
                            handleAddSkill(skill);
                          }
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted/70 hover:bg-muted text-muted-foreground hover:text-foreground border-border/80'
                        }`}
                      >
                        {isSelected ? <CheckIcon className="size-3" /> : <PlusIcon className="size-3" />}
                        <span>{skill}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Skill Input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Type custom skill and press Enter..."
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => handleAddSkill()}>
                Add Skill
              </Button>
            </div>

            {/* Current Active Skills */}
            <div className="flex flex-wrap gap-1.5 pt-1 min-h-[32px] p-2 rounded-lg bg-muted/20 border border-border/60">
              {formData.skills.length > 0 ? (
                formData.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-card text-foreground border border-border shadow-2xs"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors cursor-pointer"
                      title="Remove skill"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  No specialized skills tagged yet. Click suggestions above or type custom skill.
                </span>
              )}
            </div>
          </div>

          {/* SECTION 5: Workforce Capacity & Commercials */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              5. Workforce Capacity & Commercial Terms (SRS FR-LAB)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Input
                label="Number of Workers"
                type="number"
                min={1}
                max={200}
                placeholder="e.g. 12"
                value={formData.teamSize}
                onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
                helperText="Active workers available on roll"
              />

              <Select
                label="Billing Basis"
                value={formData.rateUnit}
                onChange={(e) => setFormData({ ...formData, rateUnit: e.target.value })}
                options={RATE_UNIT_OPTIONS}
              />

              <Input
                label="Standard Rate (₹)"
                type="number"
                min={0}
                placeholder="e.g. 45"
                value={formData.baseRate}
                onChange={(e) => setFormData({ ...formData, baseRate: e.target.value })}
                helperText={`Amount in ₹ per ${formData.rateUnit}`}
              />

              <Select
                label="Payment Terms"
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                options={PAYMENT_TERMS_OPTIONS}
              />
            </div>
          </div>

          {/* SECTION 6: Compliance, Bank Coordinates & Remarks */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
              6. Compliance, Statutory & Payout Coordinates
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="GSTIN Number (Optional)"
                maxLength={15}
                placeholder="e.g. 29AAACA1234F1Z5"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                helperText="15-character GST identification"
              />

              <Input
                label="PAN Card Number"
                maxLength={10}
                placeholder="e.g. AAACA1234F"
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                helperText="10-character business PAN"
              />

              <Input
                label="UPI ID / Bank Payout Coordinate"
                placeholder="e.g. agency@okaxis"
                value={formData.bankDetails}
                onChange={(e) => setFormData({ ...formData, bankDetails: e.target.value })}
                helperText="For direct vendor payouts"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Internal Remarks & Workmanship History
              </label>
              <textarea
                rows={2}
                placeholder="Enter internal supervisor remarks, reliability notes, or equipment specifications..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        title={`Delete Agency: ${deleteTarget?.name}`}
        message={
          deleteTarget?.activeProjects?.length > 0
            ? `Cannot remove "${deleteTarget?.name}" because it is currently assigned to ${deleteTarget.activeProjects.length} active project stage(s). You must first reallocate or close those project stages.`
            : `Are you sure you want to permanently remove "${deleteTarget?.name}" from the agency directory? This action cannot be undone.`
        }
        confirmText="Delete Agency"
        confirmVariant="danger"
        loading={deleteLoading}
      />

      {/* Active Projects Modal - Redirects to Project Screen on Click */}
      {projectsModalAgency && (
        <Modal
          isOpen={Boolean(projectsModalAgency)}
          onClose={() => setProjectsModalAgency(null)}
          title={`Active Projects: ${projectsModalAgency.name}`}
          subtitle={`Allocated to ${projectsModalAgency.activeProjects?.length || 0} active project site(s). Click any project to open its details screen.`}
          size="md"
          footer={
            <div className="flex items-center justify-end w-full">
              <Button variant="outline" size="sm" onClick={() => setProjectsModalAgency(null)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="space-y-2.5">
            {(projectsModalAgency.activeProjects || []).map((pId) => {
              const proj = mockProjects.find((p) => String(p.id).toLowerCase() === String(pId).toLowerCase());
              const address = proj?.siteAddress || `${proj?.name || pId}, Bengaluru`;
              const name = proj?.name || `Project ${pId}`;

              return (
                <div
                  key={pId}
                  onClick={() => {
                    setProjectsModalAgency(null);
                    navigate(`/projects/${pId}`);
                  }}
                  className="p-3 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/40 transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-2xs"
                  title={`Click to open ${name} screen`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                        {pId}
                      </span>
                      <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                        {name}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {address}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="xs"
                    className="shrink-0 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors pointer-events-none"
                  >
                    View Project →
                  </Button>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default AgenciesPage;
