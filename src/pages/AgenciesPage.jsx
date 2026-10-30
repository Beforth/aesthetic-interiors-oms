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
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
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
    setFormData((prev) => ({ ...prev, trade: trimmed }));
    setNewTradeName('');
    setIsAddTradeModalOpen(false);
    toast.success(`Trade category "${trimmed}" added and selected.`);
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
      width: '26%',
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
      header: 'Work Stages',
      width: '24%',
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
          <div className="flex flex-wrap items-center gap-1.5 max-w-[240px]">
            {stagesList.length > 0 ? (
              <>
                {visibleStages.map((st) => (
                  <span
                    key={st.stageOrder}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 shadow-2xs whitespace-nowrap"
                    title={`Stage ${st.stageOrder}: ${st.stageName} (${st.products?.length || 0} materials)`}
                  >
                    <span className="font-bold opacity-80 font-mono text-[10px]">S{st.stageOrder}:</span>
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
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-muted text-foreground hover:bg-muted/80 border border-border/80 transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
                    title={`Click to view all ${stagesList.length} assigned stages`}
                  >
                    +{remainingStages.length} more
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
      header: 'Location',
      width: '18%',
      render: (a) => (
        <div className="space-y-1 text-xs">
          {/* City */}
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <span>{a.city || 'Bangalore'}</span>
          </div>

          {/* Street Address */}
          {a.address && (
            <div
              className="text-[11px] text-muted-foreground truncate max-w-[200px]"
              title={a.address}
            >
              {a.address}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'activeProjects',
      header: 'Active Sites',
      width: '8%',
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
      width: '6%',
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
                          options={allTradeOptions}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddTradeModalOpen(true)}
                        title="Add new trade category"
                        className="p-2 h-9 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer flex items-center justify-center shrink-0 mb-0.5"
                      >
                        <PlusIcon className="size-4" />
                      </button>
                    </div>
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
          onClose={() => setIsAddTradeModalOpen(false)}
          title="Add New Trade Category"
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddTradeModalOpen(false)}
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

      {/* Sleek KPI Summary Cards - Prominently highlighted */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Total Agencies */}
        <div className="w-64 sm:w-72 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs hover:border-primary/40 hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Registered Agencies
            </span>
            <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <BriefcaseIcon className="size-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-foreground tabular-nums">
              {stats.totalAgencies}
            </span>
            <span className="text-xs font-medium text-muted-foreground truncate">
              12 fit-out stages
            </span>
          </div>
        </div>

        {/* Total Workforce */}
        <div className="w-64 sm:w-72 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs hover:border-primary/40 hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Total Workers
            </span>
            <div className="size-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <UsersIcon className="size-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-foreground tabular-nums">
              {stats.totalArtisans}
            </span>
            <span className="text-xs font-medium text-muted-foreground truncate">
              Active workers
            </span>
          </div>
        </div>

        {/* Active Sites Under Execution */}
        <div className="w-64 sm:w-72 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs hover:border-primary/40 hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-muted-foreground mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Active Site Stages
            </span>
            <div className="size-6 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <BuildingIcon className="size-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-foreground tabular-nums">
              {stats.activeSites}
            </span>
            <span className="text-xs font-medium text-muted-foreground truncate">
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

              {/* Pagination Size Selector (10, 25, 30 per records) */}
              <div className="w-28">
                <Select
                  value={String(pageSize)}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  options={[
                    { value: '10', label: '10 / page' },
                    { value: '25', label: '25 / page' },
                    { value: '30', label: '30 / page' },
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
        data={paginatedAgencies}
        loading={loading}
        pagination={{
          currentPage,
          totalPages,
          totalItems: sortedAgencies.length,
          pageSize,
          onPageChange: setCurrentPage,
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
        onClose={() => setIsAddTradeModalOpen(false)}
        title="Add New Trade Category"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddTradeModalOpen(false)}
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
                    View Project â†’
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
