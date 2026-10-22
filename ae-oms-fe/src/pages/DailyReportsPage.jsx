import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/formatters';
import { validateRequired, validatePositiveNumber, validateUrl } from '../utils/validators';
import { mockDsrLogs, mockMissingDsrEmployees } from '../data/dsr';

import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';
import Icon from '../components/ui/Icon';

export function DailyReportsPage() {
  const toast = useToast();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState('all-logs'); // 'all-logs' | 'missing' | 'client-link'
  const [dsrLogs, setDsrLogs] = useState(mockDsrLogs);
  const [missingEmployees, setMissingEmployees] = useState(mockMissingDsrEmployees);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Filter state
  const [projectFilter, setProjectFilter] = useState('ALL');

  // Submit DSR Modal (FR-DSR-01 / 02 / 03 / 04)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [dsrForm, setDsrForm] = useState({
    projectId: 'P1',
    projectName: 'Indiranagar 4BHK Luxury Villa',
    stageName: 'False Ceiling & POP Works',
    type: 'site', // 'site' | 'office'
    workDone: '',
    manpowerCount: 5,
    materialArrivals: '',
    photoUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80',
    showOnClientLink: true,
  });

  // Client Share Link Modal (FR-DSR-05 & FR-DSR-06)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareProject, setShareProject] = useState('P1');

  // Submit DSR Form with Validation (FR-DSR-02 & FR-DSR-03)
  const handleDsrSubmit = (e) => {
    e.preventDefault();

    const stageErr = validateRequired(dsrForm.stageName, 'Project stage', 2);
    if (stageErr) {
      toast.error(stageErr);
      return;
    }

    const workErr = validateRequired(dsrForm.workDone, 'Work completed description', 10);
    if (workErr) {
      toast.error(workErr);
      return;
    }

    const manpowerErr = validatePositiveNumber(dsrForm.manpowerCount, 'Manpower count', { min: 1, max: 200 });
    if (manpowerErr) {
      toast.error(manpowerErr);
      return;
    }

    // FR-DSR-02: Require at least one photo for on-site employees
    if (dsrForm.type === 'site') {
      if (!dsrForm.photoUrl.trim()) {
        toast.error('Site trade workers & supervisors must attach at least one progress site photo (FR-DSR-02)');
        return;
      }
      const urlErr = validateUrl(dsrForm.photoUrl, { required: true, fieldLabel: 'Site progress photo' });
      if (urlErr) {
        toast.error(urlErr);
        return;
      }
    } else if (dsrForm.photoUrl.trim()) {
      const urlErr = validateUrl(dsrForm.photoUrl, { required: false, fieldLabel: 'Design render photo' });
      if (urlErr) {
        toast.error(urlErr);
        return;
      }
    }

    const newLog = {
      id: `dsr-${Date.now()}`,
      projectId: dsrForm.projectId,
      projectName: dsrForm.projectName,
      stageId: `stg-${Date.now()}`,
      stageName: dsrForm.stageName,
      authorId: currentUser?.id || 'u3',
      authorName: currentUser?.name || 'Vikram Jadhav',
      authorRole: currentUser?.role || 'Site Supervisor',
      date: new Date().toISOString().split('T')[0],
      submissionTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: dsrForm.type,
      workDone: dsrForm.workDone,
      manpowerCount: Number(dsrForm.manpowerCount) || 1,
      materialArrivals: dsrForm.materialArrivals || 'No material dispatch today',
      photos: dsrForm.photoUrl ? [dsrForm.photoUrl] : [],
      showOnClientLink: dsrForm.showOnClientLink,
      clientFeedback: null,
    };

    setDsrLogs([newLog, ...dsrLogs]);
    toast.success('Daily Site Report submitted successfully!');
    setIsSubmitModalOpen(false);
    setDsrForm({
      projectId: 'P1',
      projectName: 'Indiranagar 4BHK Luxury Villa',
      stageName: 'False Ceiling & POP Works',
      type: 'site',
      workDone: '',
      manpowerCount: 5,
      materialArrivals: '',
      photoUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600&auto=format&fit=crop&q=80',
      showOnClientLink: true,
    });
  };

  // Toggle client link visibility (FR-DSR-07: Manager chooses which photos appear on client link)
  const handleToggleClientVisibility = (id) => {
    setDsrLogs(
      dsrLogs.map((log) =>
        log.id === id ? { ...log, showOnClientLink: !log.showOnClientLink } : log
      )
    );
    toast.success('Updated client portal visibility');
  };

  // Copy Public Share Link (FR-DSR-05 & 06)
  const handleCopyClientLink = () => {
    const url = `${window.location.origin}/dsr-share/${shareProject}`;
    navigator.clipboard?.writeText(url);
    toast.success('Client view link copied! Open in any browser without app install (FR-DSR-06)');
  };

  const filteredLogs = dsrLogs.filter(
    (l) => projectFilter === 'ALL' || l.projectId === projectFilter
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Site Reports (DSR)"
        subtitle="SRS Section 3.8: Collects each employee's daily site log, verified photo gallery, and keeps clients informed via shareable web links"
        breadcrumbs={[
          { label: 'Operations', path: '/dashboard' },
          { label: 'Daily Site Reports' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leadingIcon="link"
              onClick={() => setIsShareModalOpen(true)}
            >
              Share Client Link
            </Button>
            <Button
              variant="primary"
              size="sm"
              leadingIcon="plus"
              onClick={() => setIsSubmitModalOpen(true)}
            >
              Submit Daily DSR
            </Button>
          </div>
        }
      />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 rounded-2xl bg-surface border border-border shadow-2xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
            <span>Sites Reporting Today</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Icon name="projects" size={14} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-text-main">3 Sites</div>
          <p className="text-[11px] text-text-muted">100% active sites submitted progress</p>
        </Card>

        <Card className="p-4 rounded-2xl bg-surface border border-border shadow-2xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
            <span>Total DSR Logs</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Icon name="daily-reports" size={14} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-blue-600">{dsrLogs.length} Reports</div>
          <p className="text-[11px] text-text-muted">Archived for client & audit records</p>
        </Card>

        <Card className="p-4 rounded-2xl bg-surface border border-border shadow-2xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
            <span>Missing Submissions</span>
            <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <Icon name="clock" size={14} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-600">
            {missingEmployees.length} Pending
          </div>
          <p className="text-[11px] text-text-muted">Employees on duty without DSR (FR-DSR-09)</p>
        </Card>

        <Card className="p-4 rounded-2xl bg-surface border border-border shadow-2xs space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
            <span>Client Link Visibility</span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Icon name="eye" size={14} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-purple-700">
            {dsrLogs.filter((l) => l.showOnClientLink).length} Visible
          </div>
          <p className="text-[11px] text-text-muted">Manager vetted for client link</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('all-logs')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'all-logs'
              ? 'border-brand-600 text-brand-700 bg-surface'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Icon name="daily-reports" size={14} />
          <span>All Site Daily Logs (FR-DSR-08)</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-mono">
            {dsrLogs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('missing')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'missing'
              ? 'border-brand-600 text-brand-700 bg-surface'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Icon name="clock" size={14} />
          <span>Missing DSR Tracker (FR-DSR-09)</span>
          {missingEmployees.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold">
              {missingEmployees.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('client-link')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === 'client-link'
              ? 'border-brand-600 text-brand-700 bg-surface'
              : 'border-transparent text-text-muted hover:text-text-main'
          }`}
        >
          <Icon name="link" size={14} />
          <span>Client Web Portal Preview (FR-DSR-05/06)</span>
        </button>
      </div>

      {/* TAB 1: All DSR Logs (FR-DSR-08: Admin and Manager single daily screen) */}
      {activeTab === 'all-logs' && (
        <Card className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <div>
              <h3 className="text-sm font-bold text-text-main">Daily Execution Timeline</h3>
              <p className="text-xs text-text-muted">
                Real-time evening reports with trade photos, material arrivals, and manpower counts
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted font-medium">Filter Site:</span>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-border rounded-lg text-text-main font-medium focus:outline-none"
              >
                <option value="ALL">All Active Sites</option>
                <option value="P1">Indiranagar 4BHK Villa</option>
                <option value="P2">HSR Layout Contemporary 3BHK</option>
                <option value="P4">Lavelle Road Commercial Studio</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl border border-border bg-surface hover:border-brand-300 transition-all shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={log.authorName} size="sm" />
                    <div>
                      <div className="font-bold text-xs text-text-main flex items-center gap-2">
                        <span>{log.authorName}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                          {log.authorRole}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            log.type === 'site'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {log.type === 'site' ? 'On-Site Execution' : 'Studio / Office'}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-2">
                        <span className="font-semibold text-text-main">{log.projectName}</span>
                        <span>•</span>
                        <span>Stage: {log.stageName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto text-xs">
                    <div className="text-right text-[11px] text-text-muted">
                      <div>{formatDate(log.date)}</div>
                      <div className="font-mono">{log.submissionTime}</div>
                    </div>

                    {/* FR-DSR-07: Manager controls client link visibility */}
                    <button
                      type="button"
                      onClick={() => handleToggleClientVisibility(log.id)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                        log.showOnClientLink
                          ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                      title="Toggle client visibility"
                    >
                      <Icon name={log.showOnClientLink ? 'eye' : 'eye-off'} size={12} />
                      <span>{log.showOnClientLink ? 'Visible to Client' : 'Internal Only'}</span>
                    </button>
                  </div>
                </div>

                {/* Work Description */}
                <div>
                  <div className="text-xs text-text-main leading-relaxed font-medium">
                    {log.workDone}
                  </div>
                </div>

                {/* Manpower & Materials */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-border/80">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-muted uppercase text-[10px]">Manpower On Site:</span>
                    <span className="font-semibold text-text-main">{log.manpowerCount} Artisans</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-muted uppercase text-[10px]">Material Deliveries:</span>
                    <span className="text-text-main truncate">{log.materialArrivals}</span>
                  </div>
                </div>

                {/* Verified Site Photos (FR-DSR-02) */}
                {log.photos && log.photos.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                      <Icon name="camera" size={12} className="text-brand-600" />
                      <span>Trade Progress Photos ({log.photos.length})</span>
                    </div>
                    <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                      {log.photos.map((url, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedPhoto(url)}
                          className="w-28 h-20 rounded-lg overflow-hidden border border-border cursor-pointer hover:opacity-90 transition-opacity shrink-0 shadow-2xs"
                        >
                          <img src={url} alt={`Site log ${idx}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 2: Missing DSR Submissions (FR-DSR-09) */}
      {activeTab === 'missing' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="text-sm font-bold text-text-main">DSR Pending Submissions (FR-DSR-09)</h3>
              <p className="text-xs text-text-muted">
                Staff members checked-in today who have not submitted their evening report
              </p>
            </div>
            <button
              type="button"
              onClick={() => toast.success('Broadcast WhatsApp reminder sent to 1 artisan lead')}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-800 text-white hover:bg-brand-900 transition-colors shadow-2xs cursor-pointer"
            >
              Send WhatsApp Reminder
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border/80 uppercase font-semibold text-[10px] text-text-muted tracking-wider">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Assigned Site</th>
                  <th className="p-3">Check-In Time</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {missingEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-semibold text-text-main flex items-center gap-2">
                      <Avatar name={emp.name} size="sm" />
                      <div>
                        <div>{emp.name}</div>
                        <div className="text-[11px] text-text-muted font-normal">{emp.role}</div>
                      </div>
                    </td>
                    <td className="p-3 font-medium text-text-main">{emp.assignedSite}</td>
                    <td className="p-3 font-mono text-emerald-700">{emp.punchedInAt}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                        Missing Evening Log
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => toast.success(`Notification ping sent to ${emp.name}`)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-surface border border-border hover:bg-slate-50 text-text-main transition-colors cursor-pointer"
                      >
                        Ping Employee
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: Client Web Portal Preview (FR-DSR-05 / FR-DSR-06) */}
      {activeTab === 'client-link' && (
        <Card className="space-y-4">
          <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-purple-950 flex items-center gap-1.5">
                <Icon name="link" size={16} className="text-purple-700" />
                <span>Zero-Install Client Shareable Link (FR-DSR-05 & FR-DSR-06)</span>
              </div>
              <p className="text-xs text-purple-800/80 mt-0.5">
                Clients can tap this link in WhatsApp, iMessage, or SMS to view live photo progress without installing any app or password hurdles.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyClientLink}
              className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs transition-colors shrink-0 cursor-pointer shadow-2xs"
            >
              Copy Public Link
            </button>
          </div>

          {/* Live Mobile Client Preview Screen */}
          <div className="border border-border rounded-2xl p-6 bg-slate-50 max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <div className="text-xs uppercase font-bold text-text-muted">Aesthetic Interiors Client Portal</div>
                <div className="text-base font-bold text-text-main mt-0.5">
                  Indiranagar 4BHK Luxury Villa • Daily Log
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                Live Site
              </span>
            </div>

            <div className="space-y-3">
              {dsrLogs
                .filter((l) => l.showOnClientLink)
                .map((log) => (
                  <div key={log.id} className="p-4 rounded-xl bg-white border border-border shadow-2xs space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-brand-700">{log.stageName}</span>
                      <span className="text-text-muted">{formatDate(log.date)}</span>
                    </div>
                    <p className="text-xs text-text-main">{log.workDone}</p>
                    {log.photos && log.photos.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        {log.photos.map((p, i) => (
                          <img key={i} src={p} alt="Site" className="rounded-lg h-28 w-full object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </Card>
      )}

      {/* MODAL 1: Submit Daily DSR (FR-DSR-01) */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Submit Daily Site Report (DSR) • FR-DSR-01"
      >
        <form onSubmit={handleDsrSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase">Select Project</label>
              <select
                value={dsrForm.projectId}
                onChange={(e) => {
                  const names = {
                    P1: 'Indiranagar 4BHK Luxury Villa',
                    P2: 'HSR Layout Contemporary 3BHK',
                    P4: 'Lavelle Road Commercial Studio',
                  };
                  setDsrForm({
                    ...dsrForm,
                    projectId: e.target.value,
                    projectName: names[e.target.value] || 'Site Project',
                  });
                }}
                className="w-full px-3 py-2 border border-border rounded-lg bg-white text-text-main font-medium"
              >
                <option value="P1">Indiranagar 4BHK Luxury Villa</option>
                <option value="P2">HSR Layout Contemporary 3BHK</option>
                <option value="P4">Lavelle Road Commercial Studio</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase">Execution Type</label>
              <select
                value={dsrForm.type}
                onChange={(e) => setDsrForm({ ...dsrForm, type: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg bg-white text-text-main font-medium"
              >
                <option value="site">On-Site Trade Work (Requires Photo)</option>
                <option value="office">Office / Studio Design (Photo Optional)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase">
              Current Project Stage Worked On (FR-DSR-04)
            </label>
            <input
              type="text"
              required
              value={dsrForm.stageName}
              onChange={(e) => setDsrForm({ ...dsrForm, stageName: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-lg text-text-main"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase">
              Work Completed Today (FR-DSR-04)
            </label>
            <textarea
              rows={3}
              required
              value={dsrForm.workDone}
              onChange={(e) => setDsrForm({ ...dsrForm, workDone: e.target.value })}
              placeholder="Detail specific trade tasks, room locations, or inspections completed today..."
              className="w-full px-3 py-2 border border-border rounded-lg text-text-main"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase">Artisans on Site</label>
              <input
                type="number"
                min="1"
                value={dsrForm.manpowerCount}
                onChange={(e) => setDsrForm({ ...dsrForm, manpowerCount: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-lg text-text-main"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-text-muted uppercase">Materials Received</label>
              <input
                type="text"
                value={dsrForm.materialArrivals}
                onChange={(e) => setDsrForm({ ...dsrForm, materialArrivals: e.target.value })}
                placeholder="e.g. 5 bags Birla white cement"
                className="w-full px-3 py-2 border border-border rounded-lg text-text-main"
              />
            </div>
          </div>

          {/* Photo validation (FR-DSR-02 & FR-DSR-03) */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase">
              {dsrForm.type === 'site'
                ? 'Site Progress Photo URL (Mandatory for On-Site • FR-DSR-02)'
                : 'Design Render / Photo (Optional for Office • FR-DSR-03)'}
            </label>
            <input
              type="url"
              value={dsrForm.photoUrl}
              onChange={(e) => setDsrForm({ ...dsrForm, photoUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-border rounded-lg text-text-main font-mono"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="clientVis"
              checked={dsrForm.showOnClientLink}
              onChange={(e) => setDsrForm({ ...dsrForm, showOnClientLink: e.target.checked })}
              className="rounded accent-brand-600"
            />
            <label htmlFor="clientVis" className="text-xs text-text-main">
              Include in public Client WhatsApp Broadcast Link (FR-DSR-07)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsSubmitModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface border border-border text-text-main"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-800 text-white hover:bg-brand-900"
            >
              Submit Daily DSR
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Share Client Link */}
      <Modal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title="Share Live DSR Link with Client (FR-DSR-05 / 06)"
      >
        <div className="space-y-4 text-xs">
          <p className="text-text-muted">
            Generate an instant web link for the client. Clients do not need an account or application install.
          </p>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-text-muted uppercase">Choose Project</label>
            <select
              value={shareProject}
              onChange={(e) => setShareProject(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-text-main font-medium"
            >
              <option value="P1">Indiranagar 4BHK Luxury Villa</option>
              <option value="P2">HSR Layout Contemporary 3BHK</option>
              <option value="P4">Lavelle Road Commercial Studio</option>
            </select>
          </div>

          <div className="p-3 bg-slate-50 border border-border rounded-xl flex items-center justify-between font-mono text-[11px]">
            <span className="truncate text-text-main">
              {window.location.origin}/dsr-share/{shareProject}
            </span>
            <button
              type="button"
              onClick={handleCopyClientLink}
              className="px-3 py-1 bg-brand-800 text-white rounded-lg font-semibold shrink-0 ml-2"
            >
              Copy
            </button>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsShareModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-surface border border-border text-text-main"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: Photo Preview */}
      {selectedPhoto && (
        <Modal isOpen={!!selectedPhoto} onClose={() => setSelectedPhoto(null)} title="Site Inspection Photo">
          <div className="space-y-3">
            <img src={selectedPhoto} alt="Site preview" className="w-full rounded-xl max-h-[70vh] object-contain" />
            <div className="text-right">
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
              >
                Close Preview
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default DailyReportsPage;
