import React from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectsPage from './ProjectsPage';
import WorkerProjectsPage from './WorkerProjectsPage';

/**
 * The route's Projects page. Chooses by what the person may do (permissions, never role names): someone who only
 * sees the projects they are assigned to and cannot create tasks for others (a site worker) gets the simple view.
 * Everyone else keeps the existing page exactly as it is.
 */
export function RoleProjects(props) {
  const { hasPermission } = useAuth();
  const isWorkerView =
    hasPermission('projects.viewAssigned') &&
    !hasPermission('projects.viewAll') &&
    !hasPermission('projects.create') &&
    !hasPermission('tasks.create') &&
    !hasPermission('tasks.viewAll');
  return isWorkerView ? <WorkerProjectsPage /> : <ProjectsPage {...props} />;
}

export default RoleProjects;
