import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { projectService } from '../services/projectService';
import { userService } from '../services/userService';

import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import SearchInput from '../components/ui/SearchInput';
import ProjectCard from '../components/domain/ProjectCard';

const STATUSES = [
  { value: 'ALL', label: 'All Status' },
  { value: 'in progress', label: 'In Progress' },
  { value: 'not started', label: 'Not Started' },
  { value: 'on hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

/**
 * Projects for a site worker: only the projects they are assigned to (the server sends nothing else), as cards with
 * the progress bar. No create, delete, board view or advanced filters. Opening a card shows the project, where the
 * worker can mark the stages of their work.
 */
export function WorkerProjectsPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');

  const load = useCallback(async () => {
    try {
      const [list, team] = await Promise.all([
        projectService.getAllProjects(currentUser),
        userService.getAllUsers().catch(() => []),
      ]);
      setProjects(list || []);
      setUsers(team || []);
    } catch (err) {
      toast.error(err.message || 'Could not load your projects');
    } finally {
      setLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // pick up changes made elsewhere, for example a manager updating a stage
  useEffect(() => {
    const refresh = () => load();
    const events = ['osm_projects_changed', 'osm_project_updated', 'focus'];
    events.forEach((name) => window.addEventListener(name, refresh));
    return () => events.forEach((name) => window.removeEventListener(name, refresh));
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== 'ALL' && p.status !== status) return false;
      if (!q) return true;
      return [p.name, p.clientName, p.siteAddress].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [projects, search, status]);

  return (
    <div className="space-y-6">
      <PageHeader title="My Projects" subtitle="Sites you are assigned to" />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 max-w-md">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by project, client or site..."
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 text-xs bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium shadow-2xs"
          aria-label="Filter by status"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground sm:ml-auto">
          <span className="font-bold text-foreground">{visible.length}</span> of {projects.length} projects
        </span>
      </div>

      {loading ? (
        <div className="p-10 text-center text-xs text-muted-foreground">Loading your projects…</div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="projects"
          title={projects.length === 0 ? 'No projects assigned yet' : 'No projects match'}
          description={
            projects.length === 0
              ? 'When a manager adds you to a project, it will show up here.'
              : 'Try a different search or status.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              teamUsers={users}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default WorkerProjectsPage;
