import React from 'react';
import Card from '../ui/Card';
import StatusBadge from '../ui/StatusBadge';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';

/**
 * Domain card representing a Client entity.
 *
 * @param {Object} props
 * @param {Object} props.client
 * @param {number} [props.projectsCount=0]
 * @param {function(): void} [props.onClick]
 */
export function ClientCard({ client, projectsCount = 0, onClick }) {
  return (
    <Card
      onClick={onClick}
      className={`transition-all hover:border-brand-500 hover:shadow-sm ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={client.name} size="md" />
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-text-main truncate">
              {client.name}
            </h4>
            <span className="text-xs text-text-muted capitalize">
              {client.type === 'old' ? 'Existing Client' : 'New Client'}
            </span>
          </div>
        </div>

        <StatusBadge status={client.type === 'old' ? 'converted' : 'new'} size="sm" />
      </div>

      <div className="space-y-1.5 text-xs text-text-muted mb-4 border-t border-brand-50 pt-3">
        <div className="flex items-center gap-2 truncate">
          <Icon name="phone" size={14} className="text-brand-500 shrink-0" />
          <span>{client.phone}</span>
        </div>
        <div className="flex items-center gap-2 truncate">
          <Icon name="mail" size={14} className="text-brand-500 shrink-0" />
          <span>{client.email}</span>
        </div>
        <div className="flex items-start gap-2 line-clamp-2">
          <Icon name="mapPin" size={14} className="text-brand-500 shrink-0 mt-0.5" />
          <span>{client.address}</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="text-text-muted font-medium">
          {projectsCount} {projectsCount === 1 ? 'Project' : 'Projects'}
        </span>
        <span className="text-brand-600 font-semibold flex items-center gap-1 group">
          <span>View Details</span>
          <Icon name="arrow-right" size={14} />
        </span>
      </div>
    </Card>
  );
}

export default ClientCard;
