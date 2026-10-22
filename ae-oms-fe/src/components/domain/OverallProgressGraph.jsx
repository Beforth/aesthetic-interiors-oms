import React from 'react';
import Icon from '../ui/Icon';

/**
 * Modern organic Overall Progress visualization card inspired by contemporary
 * design studio analytics with fluid layered gradients, SVG radial arcs, and live metrics.
 *
 * @param {Object} props
 * @param {number} props.percentage - Overall completion percentage (0 - 100)
 * @param {number} [props.activeCount=0] - Number of active ongoing projects
 * @param {number} [props.completedCount=0] - Number of completed/delivered projects
 * @param {number} [props.totalMilestones=0] - Total milestone stages across portfolio
 * @param {number} [props.completedMilestones=0] - Milestone stages completed so far
 * @param {string} [props.className='']
 */
export function OverallProgressGraph({
  percentage = 0,
  activeCount = 0,
  completedCount = 0,
  totalMilestones = 0,
  completedMilestones = 0,
  className = '',
}) {
  const clampedProgress = Math.min(100, Math.max(0, Math.round(percentage)));

  // SVG circular arc geometry
  const radius = 54;
  const circumference = 2 * Math.PI * radius; // ~339.29
  const strokeDashoffset = circumference - (clampedProgress / 100) * circumference;

  return (
    <div
      className={`p-5 bg-surface rounded-2xl border border-border shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-xs ${className}`}
    >
      {/* Background Subtle Gradient Aura */}
      <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-accent-foreground/5 blur-3xl pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/80 relative z-10">
        <div>
          <h3 className="text-base font-bold text-text-main flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-pulse" />
            <span>Overall Progress</span>
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Cross-project execution health & milestone fulfillment
          </p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
          Live Portfolio
        </span>
      </div>

      {/* Organic Center Radial Wave & Circular Progress Display */}
      <div className="relative py-4 flex items-center justify-center">
        <div className="relative w-48 h-48 sm:w-52 sm:h-52 flex items-center justify-center">
          {/* Layered Organic Fluid SVG Waves (Blobs) */}
          <svg
            viewBox="0 0 200 200"
            className="absolute inset-0 w-full h-full transform scale-110 select-none pointer-events-none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="blobGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.20" />
                <stop offset="50%" stopColor="#818cf8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#c084fc" stopOpacity="0.18" />
              </linearGradient>

              <linearGradient id="blobGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.22" />
              </linearGradient>

              <linearGradient id="progressArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="60%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>

              <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Back undulating fluid petal shape */}
            <path
              d="M100,20 C125,18 150,30 168,48 C185,65 188,95 180,120 C172,145 152,168 128,178 C102,188 72,185 50,170 C28,155 18,125 22,100 C25,74 42,50 62,35 C74,25 87,21 100,20 Z"
              fill="url(#blobGrad1)"
              className="animate-[spin_25s_linear_infinite]"
              style={{ transformOrigin: '100px 100px' }}
            />

            {/* Middle organic wave contour with counter-rotation */}
            <path
              d="M100,28 C120,24 142,32 158,46 C174,60 180,84 175,108 C170,132 155,152 135,165 C115,178 88,178 68,168 C48,158 35,136 34,112 C32,88 44,66 60,50 C72,38 86,29 100,28 Z"
              fill="url(#blobGrad2)"
              className="animate-[spin_18s_linear_infinite_reverse]"
              style={{ transformOrigin: '100px 100px' }}
            />

            {/* Circular Progress Background Track */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="#e0e7ff"
              strokeWidth="9"
              className="opacity-75"
            />

            {/* Active Circular Progress Arc */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="url(#progressArcGrad)"
              strokeWidth="9"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 100 100)"
              filter="url(#softGlow)"
              style={{
                transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </svg>

          {/* Central Cutout Content Pill */}
          <div className="relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-surface/95 backdrop-blur-md border border-brand-200/60 shadow-lg flex flex-col items-center justify-center text-center p-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-brand-700 tracking-tight leading-none">
              {clampedProgress}%
            </span>
            <span className="text-[11px] uppercase font-bold tracking-wider text-text-muted mt-1">
              Progress
            </span>
            <span className="text-[9px] text-brand-600 font-medium">
              Overall Portfolio
            </span>
          </div>
        </div>
      </div>

      {/* Cross-Project Portfolio Metrics Breakdown */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/80">
        <div className="p-2.5 rounded-xl bg-brand-50/70 border border-brand-100 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-semibold text-text-muted">
              Live Sites
            </div>
            <div className="text-sm font-bold text-text-main">
              {activeCount} Active
            </div>
          </div>
          <div className="w-6 h-6 rounded-lg bg-brand-600 text-white flex items-center justify-center shrink-0">
            <Icon name="briefcase" size={13} />
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-brand-50/70 border border-brand-100 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-semibold text-text-muted">
              Milestones Done
            </div>
            <div className="text-sm font-bold text-text-main">
              {completedMilestones}
              {totalMilestones > 0 && (
                <span className="text-xs font-normal text-text-muted">/{totalMilestones}</span>
              )}
            </div>
          </div>
          <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Icon name="check" size={13} />
          </div>
        </div>
      </div>

      {/* Footer Milestone Health Status Pill */}
      <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
        <span className="flex items-center gap-1.5 font-medium">
          <Icon name="sparkles" size={13} className="text-brand-600" />
          <span>Delivered: <strong className="text-text-main">{completedCount} Completed</strong></span>
        </span>
        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          {clampedProgress >= 75 ? 'Healthy Velocity' : clampedProgress >= 40 ? 'On Track' : 'Mobilizing'}
        </span>
      </div>
    </div>
  );
}

export default OverallProgressGraph;
