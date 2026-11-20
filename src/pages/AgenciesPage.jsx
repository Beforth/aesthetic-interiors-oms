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
import Card from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import StarRating from '../components/ui/StarRating';
import Textarea from '../components/ui/Textarea';
import PermissionGate from '../components/ui/PermissionGate';
import { Badge } from '../components/ui/Badge';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  BuildingIcon,
  UsersIcon,
  BriefcaseIcon,
  PlusIcon,
  XIcon,
  ArrowLeftIcon,
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

function AgencyRatingBadge({ value, compact = false }) {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating <= 0) {
    return <span className="text-[11px] italic text-muted-foreground">Not rated</span>;
  }
  return <StarRating value={rating} readOnly size={compact ? 'xs' : 'sm'} showScore />;
}

const ADD_TRADE_OPTION = '__add_trade_category__';
const CUSTOM_TRADES_KEY = 'osm_custom_trades';

function getStoredCustomTrades() {
  try {
    const raw = localStorage.getItem(CUSTOM_TRADES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomTrade(newTrade) {
  try {
    const existing = getStoredCustomTrades();
    if (!existing.some((t) => t.value.toLowerCase() === newTrade.value.toLowerCase())) {
      const updated = [...existing, newTrade];
      localStorage.setItem(CUSTOM_TRADES_KEY, JSON.stringify(updated));
      return updated;
    }
    return existing;
  } catch {
    return [];
  }
}

const DEFAULT_FORM = {
  name: '',
  trade: 'Ceiling',
  additionalTrades: [],
  ownerName: '',
  contactPerson: '',
  phone: '',
  alternatePhone: '',
  email: '',
  address: '',
  city: '',
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // options: 10, 25, 30

  // Custom trade state & options
  const [customTrades, setCustomTrades] = useState(() => getStoredCustomTrades());
  const [isAddTradeModalOpen, setIsAddTradeModalOpen] = useState(false);
  const [newTradeName, setNewTradeName] = useState('');

  const allTradeOptions = useMemo(() => {
    return [...TRADE_OPTIONS, ...customTrades];
  }, [customTrades]);

  const handleAddNewTrade = (e) => {
    e?.preventDefault?.();
    const trimmed = newTradeName.trim();
    if (!trimmed) {
      toast.error('Please enter a trade category name');
      return;
    }
    const tradeObj = { value: trimmed, label: trimmed };
    const updated = saveCustomTrade(tradeObj);
    setCustomTrades(updated);
    setFormData((prev) => {
      // Picking "+ Add" from the dropdown leaves the placeholder selected; replace it
      // with the real category once it has been created. The side "+" keeps the
      // current primary trade and only appends an extra one.
      const trade = prev.trade === ADD_TRADE_OPTION ? trimmed : prev.trade;
      const alreadyAdded = trade === trimmed || (prev.additionalTrades || []).includes(trimmed);
      return {
        ...prev,
        trade,
        additionalTrades: alreadyAdded
          ? prev.additionalTrades || []
          : [...(prev.additionalTrades || []), trimmed],
      };
    });
    setNewTradeName('');
    setIsAddTradeModalOpen(false);
    toast.success(`Trade category "${trimmed}" added. Use + again to add more.`);
  };

  const closeAddTradeModal = () => {
    // Cancelling after choosing "+ Add" must not keep the placeholder as the trade.
    setFormData((prev) =>
      prev.trade === ADD_TRADE_OPTION
        ? { ...prev, trade: TRADE_OPTIONS[0]?.value || 'Ceiling' }
        : prev
    );
    setNewTradeName('');
    setIsAddTradeModalOpen(false);
  };

  // Full Page Form view state instead of cramped popup
  const [isFullFormOpen, setIsFullFormOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState(null);
  const [viewingAgency, setViewingAgency] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [projectsModalAgency, setProjectsModalAgency] = useState(null);
  const [stagesModalAgency, setStagesModalAgency] = useState(null);

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

  // Requirement: Newly created records should be shown on the top
  const sortedAgencies = useMemo(() => {
    return [...filteredAgencies].sort((a, b) => {
      // 1. Primary: Compare createdAt or created_at descending if present
      const dateA = a.createdAt || a.created_at;
      const dateB = b.createdAt || b.created_at;
      if (dateA && dateB && dateA !== dateB) {
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }
      if (dateB && !dateA) return 1;
      if (dateA && !dateB) return -1;

      // 2. Secondary fallback: numeric timestamp / ID descending
      const numA = Number(String(a.id).replace(/\D/g, ''));
      const numB = Number(String(b.id).replace(/\D/g, ''));
      if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
        return numB - numA;
      }
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [filteredAgencies]);

  const totalPages = Math.ceil(sortedAgencies.length / pageSize) || 1;

  const paginatedAgencies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAgencies.slice(start, start + pageSize);
  }, [sortedAgencies, currentPage, pageSize]);

  // Reset pagination when any filter or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, tradeFilter, stageFilter, statusFilter, pageSize]);

  const handleOpenAdd = () => {
    setEditingAgency(null);
    setFormData({
      ...DEFAULT_FORM,
      city: '',
      skills: [],
      additionalTrades: [],
      stages: [
        {
          stageOrder: 2,
          stageName: 'Ceiling',
          products: [],
        },
      ],
    });
    setSkillInput('');
    setStageProductInputs({});
    setFormErrors({});
    setIsFullFormOpen(true);
  };

  const handleOpenEdit = (agency) => {
    setEditingAgency(agency);
    setFormData({
      name: agency.name || '',
      trade: agency.trade || 'Ceiling',
      additionalTrades: Array.isArray(agency.additionalTrades)
        ? [...agency.additionalTrades]
        : [],
      ownerName: agency.ownerName || agency.contactPerson || '',
      contactPerson: agency.contactPerson || agency.ownerName || '',
      phone: agency.phone || '',
      alternatePhone: agency.alternatePhone || '',
      email: agency.email || '',
      address: agency.address || '',
      city: agency.city || '',
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
    setIsFullFormOpen(true);
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
    if (newTrade === ADD_TRADE_OPTION) {
      setNewTradeName('');
      setIsAddTradeModalOpen(true);
      return;
    }

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
      setIsFullFormOpen(false);
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
      width: '30%',
      render: (a) => (
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => setViewingAgency(a)}
            className="max-w-full truncate text-left text-sm font-semibold text-foreground hover:text-primary hover:underline transition-colors cursor-pointer"
            title="View full agency profile"
          >
            {a.name}
          </button>
          <span className="truncate text-xs text-muted-foreground">
            Owner: <span className="font-medium text-foreground">{a.ownerName || a.contactPerson}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rating</span>
            <AgencyRatingBadge value={a.rating} compact />
          </div>
        </div>
      ),
    },
    {
      key: 'stages',
      header: 'Work Stages',
      width: '26%',
      render: (a) => {
        const stagesList = [...(Array.isArray(a.stages) ? a.stages : [])].sort(
          (x, y) => (x.stageOrder || 0) - (y.stageOrder || 0)
        );

        const getShortStageName = (name) => {
          if (!name) return '';
          return name.split('(')[0].replace(/agencies/i, '').trim();
        };

        const visibleStages = stagesList.slice(0, 2);
        const remainingStages = stagesList.slice(2);

        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {stagesList.length > 0 ? (
              <>
                {visibleStages.map((st) => (
                  <span
                    key={st.stageOrder}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary whitespace-nowrap"
                    title={`Stage ${st.stageOrder}: ${st.stageName} (${st.products?.length || 0} materials)`}
                  >
                    <span className="font-mono text-[10px] opacity-80">S{st.stageOrder}</span>
                    <span>{getShortStageName(st.stageName)}</span>
                  </span>
                ))}
                {remainingStages.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setStagesModalAgency(a);
                    }}
                    className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
                    title={`View all ${stagesList.length} assigned stages`}
                  >
                    +{remainingStages.length}
                  </button>
                )}
              </>
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
      header: 'Phone',
      width: '16%',
      render: (a) => (
        <a
          href={`tel:${a.phone}`}
          className="font-mono text-xs font-medium text-foreground hover:text-primary transition-colors whitespace-nowrap"
        >
          {a.phone}
        </a>
      ),
    },
    {
      key: 'activeProjects',
      header: 'Active Sites',
      width: '12%',
      align: 'center',
      render: (a) => {
        const count = a.activeProjects?.length || 0;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (count > 0) handleOpenProjects(a);
            }}
            disabled={count === 0}
            className={
              count > 0
                ? 'rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer'
                : 'rounded-full px-2 py-0.5 text-xs text-muted-foreground/70 cursor-not-allowed'
            }
            title={
              count > 0
                ? count === 1
                  ? 'Open project screen'
                  : 'View and open project screens'
                : 'No active sites allocated'
            }
          >
            {count} {count === 1 ? 'site' : 'sites'}
          </button>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '8%',
      align: 'right',
      render: (a) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            icon="eye"
            ariaLabel="View"
            size="sm"
            onClick={() => setViewingAgency(a)}
            className="hover:bg-primary/10 hover:text-primary"
          />
          <PermissionGate permission="agencies.manage">
            <IconButton
              icon="edit"
              ariaLabel="Edit"
              size="sm"
              onClick={() => handleOpenEdit(a)}
              className="hover:bg-primary/10 hover:text-primary"
            />
            <IconButton
              icon="trash"
              ariaLabel="Delete"
              size="sm"
              onClick={() => setDeleteTarget(a)}
              className="hover:bg-destructive/10 hover:text-destructive"
            />
          </PermissionGate>
        </div>
      ),
    },
  ];

  const suggestedSkillsForTrade = useMemo(() => {
    return TRADE_SKILLS_CATALOG[formData.trade] || [];
  }, [formData.trade]);

  // Compact label/value row used inside the agency profile modal.
  const renderModalRow = (label, value) => (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium text-foreground">{value}</span>
    </div>
  );

  // If user clicked "Register New Agency" or "Edit Agency", render the full page form view
  if (isFullFormOpen) {
    return (
      <div className="w-full space-y-6 pb-12 animate-fadeIn">
        {/* Top Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-1">
          <div>
            <button
              type="button"
              onClick={() => setIsFullFormOpen(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-2"
            >
              <ArrowLeftIcon className="size-3.5" />
              <span>Back to Agencies Directory</span>
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {editingAgency ? `Edit Agency: ${editingAgency.name}` : 'Register New Agency'}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFullFormOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSubmit}
            >
              {editingAgency ? 'Save Changes' : 'Register Agency'}
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="rounded-xl border border-muted-foreground/35 dark:border-muted-foreground/30 bg-card shadow-2xs">
            <div className="space-y-8 p-1 sm:p-2">
              {/* 1. Agency Information */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-foreground tracking-tight">Agency Information</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Agency / Company Name"
                    required
                    placeholder="e.g. Royal Touch Tiles & Masonry"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    error={formErrors.name}
                  />

                  <Input
                    label="Owner Name"
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-end gap-1.5">
                      <div className="flex-1">
                        <Select
                          label="Trade Category"
                          required
                          value={formData.trade}
                          onChange={(e) => handleTradeChange(e.target.value)}
                          options={[
                            ...allTradeOptions,
                            { value: ADD_TRADE_OPTION, label: '+ Add new trade category' },
                          ]}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNewTradeName('');
                          setIsAddTradeModalOpen(true);
                        }}
                        title="Add trade category (can add multiple)"
                        className="p-2 h-9 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer flex items-center justify-center shrink-0 mb-0.5"
                      >
                        <PlusIcon className="size-4" />
                      </button>
                    </div>
                    {(formData.additionalTrades || []).length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {formData.additionalTrades.map((trade) => (
                          <span
                            key={trade}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium"
                          >
                            {trade}
                            <button
                              type="button"
                              title={`Remove ${trade}`}
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  additionalTrades: (prev.additionalTrades || []).filter(
                                    (t) => t !== trade
                                  ),
                                }))
                              }
                              className="text-primary hover:text-destructive cursor-pointer"
                            >
                              <XIcon className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <Input
                    label="Contact Person"
                    placeholder="e.g. Dinesh Kumar"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  />

                  <Select
                    label="Status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    options={STATUS_OPTIONS}
                  />
                </div>
              </div>

              {/* 2. Contact Details */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-foreground tracking-tight">Contact Details</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="Phone Number"
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <Textarea
                      label="Street Address / Workshop Location"
                      placeholder="Enter full workshop or warehouse address..."
                      rows={3}
                      className="resize-y"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="City"
                      placeholder="e.g. Mumbai, Bangalore"
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

              {/* 3. Worker Skills */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-bold text-foreground tracking-tight">Worker Skills</h3>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Type artisan skill (e.g. Gypsum Board, CNC Cutting, PU Polishing) and press Enter..."
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSkill();
                      }
                    }}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => handleAddSkill()}>
                    <PlusIcon className="size-3.5 mr-1" />
                    Add Skill
                  </Button>
                </div>

                {formData.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-card border border-border/80">
                    {formData.skills.map((skill, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-muted text-foreground border border-border shadow-2xs"
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
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Team Size & Payment Terms */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-bold text-foreground tracking-tight">Team Size & Payment Terms</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <Input
                    label="Number of Workers"
                    type="number"
                    min={1}
                    max={200}
                    placeholder="e.g. 12"
                    value={formData.teamSize}
                    onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
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
                  />

                  <Select
                    label="Payment Terms"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    options={PAYMENT_TERMS_OPTIONS}
                  />
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="text-xs font-medium text-foreground">Agency Rating</span>
                  <StarRating
                    value={Number(formData.rating) || 0}
                    onChange={(rating) =>
                      setFormData((prev) => ({ ...prev, rating }))
                    }
                    size="md"
                    showScore
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Rate this agency from 0 to 5. The rating is shown in the agency directory.
                  </span>
                </div>
              </div>

              {/* 5. Tax & Bank Details */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-foreground tracking-tight">Tax & Bank Details</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    label="GSTIN Number (Optional)"
                    maxLength={15}
                    placeholder="e.g. 29AAACA1234F1Z5"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  />

                  <Input
                    label="PAN Card Number"
                    maxLength={10}
                    placeholder="e.g. AAACA1234F"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                  />

                  <Input
                    label="Bank Account or UPI ID"
                    placeholder="e.g. agency@okaxis or Bank Account / IFSC"
                    value={formData.bankDetails}
                    onChange={(e) => setFormData({ ...formData, bankDetails: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 select-none">
                    Internal Remarks & Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter internal supervisor remarks, reliability notes, or equipment specifications..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>
          </Card>
        {/* Bottom Actions Bar */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFullFormOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              {editingAgency ? 'Save Changes' : 'Register Agency'}
            </Button>
          </div>
        </form>

        {/* Add New Trade Category Modal (in form view) */}
        <Modal
          isOpen={isAddTradeModalOpen}
          onClose={closeAddTradeModal}
          title="Add New Trade Category"
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={closeAddTradeModal}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddNewTrade}
              >
                Add Trade
              </Button>
            </div>
          }
        >
          <div className="space-y-3 py-1">
            <Input
              label="Trade Name"
              required
              placeholder="e.g. HVAC, Acoustics, Automation"
              value={newTradeName}
              onChange={(e) => setNewTradeName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddNewTrade();
                }
              }}
            />
            
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Agencies"
        subtitle="Trade contractors and site agencies"
        actions={
          <PermissionGate permission="agencies.manage">
            <Button
              variant="primary"
              size="sm"
              className="text-xs px-3 py-1.5 h-8 font-semibold shadow-2xs"
              leadingIcon="plus"
              onClick={handleOpenAdd}
            >
              Register New Agency
            </Button>
          </PermissionGate>
        }
      />

      {/* Compact KPI summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          variant="inline"
          label="Registered Agencies"
          value={stats.totalAgencies}
          subtext="Across 12 fit-out stages"
          icon={<BriefcaseIcon className="size-5" />}
          tone="primary"
        />
        <StatCard
          variant="inline"
          label="Total Workers"
          value={stats.totalArtisans}
          subtext="Active workers on roll"
          icon={<UsersIcon className="size-5" />}
          tone="success"
        />
        <StatCard
          variant="inline"
          label="Active Site Stages"
          value={stats.activeSites}
          subtext="Live project allocations"
          icon={<BuildingIcon className="size-5" />}
        />
      </div>

      {/* Enhanced Data Toolbar with 12 Stages Filter - Sticky Toolbar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md py-1">
        <DataToolbar
          variant="clean"
          layout="inline"
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search agency, owner name, products, stage, trade, phone..."
          totalCount={filteredAgencies.length}
          filters={
            <div className="flex items-center gap-2 shrink-0">
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
        variant="clean"
        columns={columns}
        data={paginatedAgencies}
        loading={loading}
        pagination={{
          currentPage,
          totalPages,
          totalItems: sortedAgencies.length,
          pageSize,
          onPageChange: setCurrentPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setCurrentPage(1);
          },
        }}
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
            <>
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
            </>
          }
        >
          <div className="space-y-4">
            {/* Compact meta — name, owner and trade already appear in the modal header */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
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
              <span>
                Partner ID:{' '}
                <span className="font-mono text-foreground">{viewingAgency.id}</span>
              </span>
              {viewingAgency.establishedYear && <span>Est. {viewingAgency.establishedYear}</span>}
              <span className="ml-auto">
                {viewingAgency.stages?.length || 0} of {FITOUT_12_STAGES.length} stages
              </span>
            </div>

            {/* Stage coverage — compact two-column list; full product names kept in the tooltip */}
            <section className="space-y-2">
              <h4 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                Stage Coverage &amp; Supplied Products
              </h4>
              {viewingAgency.stages && viewingAgency.stages.length > 0 ? (
                <div className="grid grid-cols-1 gap-x-5 gap-y-2 sm:grid-cols-2">
                  {viewingAgency.stages.map((st) => (
                    <div key={st.stageOrder} className="flex items-start gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {st.stageOrder}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className="truncate text-xs font-medium text-foreground"
                            title={st.stageName}
                          >
                            {st.stageName}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {st.products?.length || 0} products
                          </span>
                        </div>
                        {st.products && st.products.length > 0 ? (
                          <p
                            className="mt-0.5 truncate text-[11px] text-muted-foreground"
                            title={st.products.join(', ')}
                          >
                            {st.products.join(' · ')}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[11px] italic text-muted-foreground">
                            Standard stage items
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-1 text-xs italic text-muted-foreground">
                  No stage products configured yet. Use “Edit Agency &amp; Products” to map stages.
                </p>
              )}
            </section>

            {/* Two-column detail grid: Contact | Commercial & Compliance */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-4">
                <section className="space-y-1.5">
                  <h4 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                    Contact &amp; Location
                  </h4>
                  <div className="divide-y divide-border/70 text-xs">
                    {renderModalRow(
                      'Primary Mobile',
                      <a
                        href={`tel:${viewingAgency.phone}`}
                        className="font-mono text-foreground hover:text-primary"
                      >
                        {viewingAgency.phone}
                      </a>
                    )}
                    {viewingAgency.alternatePhone &&
                      renderModalRow(
                        'WhatsApp / Alternate',
                        <a
                          href={`tel:${viewingAgency.alternatePhone}`}
                          className="font-mono text-foreground hover:text-primary"
                        >
                          {viewingAgency.alternatePhone}
                        </a>
                      )}
                    {viewingAgency.email &&
                      renderModalRow(
                        'Business Email',
                        <a
                          href={`mailto:${viewingAgency.email}`}
                          className="break-all text-foreground hover:text-primary"
                        >
                          {viewingAgency.email}
                        </a>
                      )}
                    {renderModalRow(
                      'Site Supervisor',
                      viewingAgency.contactPerson || viewingAgency.ownerName
                    )}
                    {renderModalRow('City', viewingAgency.city || 'Bangalore')}
                    {viewingAgency.pincode &&
                      renderModalRow(
                        'Pincode',
                        <span className="font-mono">{viewingAgency.pincode}</span>
                      )}
                  </div>
                  <div className="pt-2 text-xs">
                    <span className="block text-muted-foreground">Street Address</span>
                    <span className="mt-0.5 block leading-relaxed text-foreground">
                      {viewingAgency.address || 'Site office / workshop address not specified'}
                    </span>
                  </div>
                </section>

                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Trade Skills &amp; Specializations
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
                      {viewingAgency.skills?.length || 0} registered
                    </span>
                  </div>
                  {viewingAgency.skills && viewingAgency.skills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {viewingAgency.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">Standard trade capabilities.</p>
                  )}
                </section>
              </div>

              <div className="space-y-5">
                <section className="space-y-1.5">
                  <h4 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                    Commercial &amp; Capacity
                  </h4>
                  <div className="divide-y divide-border/70 text-xs">
                    {renderModalRow(
                      'Total Workers',
                      `${viewingAgency.teamSize || 8} on roll`
                    )}
                    {renderModalRow(
                      'Standard Base Rate',
                      <span className="font-mono">
                        ₹{viewingAgency.baseRate || 0} / {viewingAgency.rateUnit || 'sqft'}
                      </span>
                    )}
                    {renderModalRow(
                      'Payment Terms',
                      viewingAgency.paymentTerms || 'Weekly Running Bill'
                    )}
                    {renderModalRow(
                      'Agency Rating',
                      <AgencyRatingBadge value={viewingAgency.rating} />
                    )}
                    {viewingAgency.bankDetails &&
                      renderModalRow(
                        'UPI / Payout ID',
                        <span className="font-mono">{viewingAgency.bankDetails}</span>
                      )}
                  </div>
                </section>

                <section className="space-y-1.5">
                  <h4 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                    Statutory &amp; Compliance
                  </h4>
                  <div className="divide-y divide-border/70 text-xs">
                    {renderModalRow(
                      'GSTIN Number',
                      <span className="font-mono">
                        {viewingAgency.gstin || 'Unregistered / Composite'}
                      </span>
                    )}
                    {viewingAgency.pan &&
                      renderModalRow(
                        'Business PAN',
                        <span className="font-mono">{viewingAgency.pan}</span>
                      )}
                    {renderModalRow(
                      'Active Allocated Sites',
                      <button
                        type="button"
                        disabled={!viewingAgency.activeProjects?.length}
                        onClick={() => {
                          const target = viewingAgency;
                          setViewingAgency(null);
                          setProjectsModalAgency(target);
                        }}
                        className="font-medium text-primary hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline cursor-pointer"
                      >
                        {viewingAgency.activeProjects?.length || 0} active site(s)
                      </button>
                    )}
                  </div>
                </section>

                {viewingAgency.notes && (
                  <section className="space-y-1.5">
                    <h4 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                      Supervisor Notes &amp; Remarks
                    </h4>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {viewingAgency.notes}
                    </p>
                  </section>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Stages Detail Modal for Table row "+N more" click */}
      {stagesModalAgency && (
        <Modal
          isOpen={Boolean(stagesModalAgency)}
          onClose={() => setStagesModalAgency(null)}
          title={`Work Stages: ${stagesModalAgency.name}`}
          subtitle={`${stagesModalAgency.trade} Trade • ${stagesModalAgency.stages?.length || 0} stages assigned`}
          size="sm"
          footer={
            <Button variant="outline" size="sm" onClick={() => setStagesModalAgency(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-2 py-1 max-h-[60vh] overflow-y-auto">
            {stagesModalAgency.stages && stagesModalAgency.stages.length > 0 ? (
              stagesModalAgency.stages.map((st) => (
                <div key={st.stageOrder} className="p-2.5 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded-full bg-primary text-primary-foreground font-bold text-[10px] flex items-center justify-center shrink-0">
                      {st.stageOrder}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      Stage {st.stageOrder}: {st.stageName}
                    </span>
                  </div>
                  {st.products && st.products.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pl-7">
                      {st.products.map((p, idx) => (
                        <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-card border border-border/70 text-muted-foreground">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No specific stages mapped.</p>
            )}
          </div>
        </Modal>
      )}

      {/* Add New Trade Category Modal (Directory view) */}
      <Modal
        isOpen={isAddTradeModalOpen}
        onClose={closeAddTradeModal}
        title="Add New Trade Category"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={closeAddTradeModal}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddNewTrade}
            >
              Add Trade
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-1">
          <Input
            label="Trade Name"
            required
            placeholder="e.g. HVAC, Acoustics, Automation"
            value={newTradeName}
            onChange={(e) => setNewTradeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddNewTrade();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            This will add a new craftsmanship trade category that can be assigned to agencies across projects.
          </p>
        </div>
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
          <div className="divide-y divide-border/70">
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
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2.5 group hover:bg-muted/50 transition-colors"
                  title={`Open ${name}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                        {pId}
                      </span>
                      <span className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                        {name}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {address}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-medium text-primary group-hover:bg-primary/20 transition-colors">
                    Open
                  </span>
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
