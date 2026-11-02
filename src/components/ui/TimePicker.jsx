'use client';

import React, { useState, useEffect, useRef, useId, forwardRef, useMemo } from 'react';
import { ClockIcon, KeyboardIcon } from './icons';
import { cn } from '../../lib/utils';

/**
 * Normalizes any time string (12h with AM/PM, or 24h) to a strict "HH:MM" 24-hour format.
 */
export function normalizeTo24HourTime(str) {
  if (!str || typeof str !== 'string') return '';
  const clean = str.trim();
  if (!clean || clean === '—' || clean === '-') return '';

  const lower = clean.toLowerCase();
  const isPM = lower.includes('pm');
  const isAM = lower.includes('am');

  const timeOnly = clean.replace(/[^\d:]/g, '').trim();
  if (!timeOnly) return '';

  const parts = timeOnly.split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);

  if (Number.isNaN(h)) return '';
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Converts 24h "HH:MM" to readable 12h format "HH:MM AM/PM".
 */
export function formatTo12HourTime(time24) {
  if (!time24) return '';
  const parts = String(time24).split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  if (Number.isNaN(h)) return time24;
  const isPM = h >= 12;
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
}

/**
 * Parses a 24h or 12h time string into { hour12, minute, period }.
 */
function parseTimeComponents(val) {
  const norm = normalizeTo24HourTime(val);
  if (!norm) {
    const now = new Date();
    const curH = now.getHours();
    const curM = now.getMinutes();
    return {
      hour12: curH % 12 || 12,
      minute: curM,
      period: curH >= 12 ? 'PM' : 'AM',
    };
  }
  const [hStr, mStr] = norm.split(':');
  const h24 = parseInt(hStr, 10);
  const minute = parseInt(mStr || '0', 10);
  return {
    hour12: h24 % 12 || 12,
    minute,
    period: h24 >= 12 ? 'PM' : 'AM',
  };
}

/**
 * Material / Android style Radial Clock Face TimePicker
 * Conforming strictly to BefUI tokens & design.md.
 */
export const TimePicker = forwardRef(function TimePicker(
  {
    value,
    onChange,
    label,
    error,
    required = false,
    disabled = false,
    placeholder = 'Select time',
    className = '',
    id,
    ...rest
  },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const [mode, setMode] = useState('hour'); // 'hour' | 'minute'

  // Internal draft state while modal is open
  const [draftHour, setDraftHour] = useState(12);
  const [draftMinute, setDraftMinute] = useState(0);
  const [draftPeriod, setDraftPeriod] = useState('AM');

  // Strict synchronized 24h value
  const internal24 = normalizeTo24HourTime(value) || '';

  // Synchronize draft state when opening modal
  const handleOpenModal = () => {
    if (disabled) return;
    const comps = parseTimeComponents(value);
    setDraftHour(comps.hour12);
    setDraftMinute(comps.minute);
    setDraftPeriod(comps.period);
    setMode('hour');
    setIsKeyboardMode(false);
    setIsOpen(true);
  };

  const handleCloseModal = () => {
    setIsOpen(false);
  };

  const handleConfirm = () => {
    let h24 = draftHour % 12;
    if (draftPeriod === 'PM') h24 += 12;
    const result24 = `${String(h24).padStart(2, '0')}:${String(draftMinute).padStart(2, '0')}`;
    if (onChange) {
      onChange(result24);
    }
    setIsOpen(false);
  };

  // Clock Dial Geometry
  const dialRef = useRef(null);
  const DIAL_RADIUS = 120; // 240px diameter / 2
  const NUM_RADIUS = 88;

  // Calculate coordinates for hours 1..12
  const hoursPositions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const h = i + 1;
      const angle = (h * 30 - 90) * (Math.PI / 180);
      const x = DIAL_RADIUS + NUM_RADIUS * Math.cos(angle);
      const y = DIAL_RADIUS + NUM_RADIUS * Math.sin(angle);
      return { num: h, x, y };
    });
  }, []);

  // Calculate coordinates for minutes in 5-minute increments (00, 05, ..., 55)
  const minutesPositions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i * 5;
      const angle = (m * 6 - 90) * (Math.PI / 180);
      const x = DIAL_RADIUS + NUM_RADIUS * Math.cos(angle);
      const y = DIAL_RADIUS + NUM_RADIUS * Math.sin(angle);
      return { num: m, label: String(m).padStart(2, '0'), x, y };
    });
  }, []);

  // Pointer line target
  const activeAngle = useMemo(() => {
    if (mode === 'hour') {
      return (draftHour * 30 - 90) * (Math.PI / 180);
    }
    return (draftMinute * 6 - 90) * (Math.PI / 180);
  }, [mode, draftHour, draftMinute]);

  const pointerX = DIAL_RADIUS + NUM_RADIUS * Math.cos(activeAngle);
  const pointerY = DIAL_RADIUS + NUM_RADIUS * Math.sin(activeAngle);

  // Handle dial interaction (click or drag)
  const handleDialPointer = (e) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    let deg = Math.atan2(dy, dx) * (180 / Math.PI);
    // Normalize to 0..360 starting from 12 o'clock
    deg = (deg + 90 + 360) % 360;

    if (mode === 'hour') {
      let h = Math.round(deg / 30);
      if (h === 0) h = 12;
      setDraftHour(h);
    } else {
      const m = Math.round(deg / 6) % 60;
      setDraftMinute(m);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    handleDialPointer(e);
  };

  const handlePointerMove = (e) => {
    if (isDragging) {
      handleDialPointer(e);
    }
  };

  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false);
      // If user was picking hour, auto-advance to minute selection
      if (mode === 'hour') {
        setMode('minute');
      }
    }
  };

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider"
        >
          {label} {required && <span className="text-destructive">*</span>}
        </label>
      )}

      {/* Clickable time trigger input */}
      <div className="relative flex items-center">
        <button
          ref={ref}
          id={inputId}
          type="button"
          disabled={disabled}
          onClick={handleOpenModal}
          className={cn(
            'w-full px-3.5 py-2.5 border rounded-xl font-mono text-xs sm:text-sm bg-card text-foreground transition-all flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
            error
              ? 'border-destructive ring-1 ring-destructive/40 bg-destructive/5'
              : 'border-border hover:border-muted-foreground/40',
            className
          )}
          {...rest}
        >
          <span className={cn(!internal24 && 'text-muted-foreground')}>
            {internal24 ? formatTo12HourTime(internal24) : placeholder}
          </span>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ClockIcon className="size-4 shrink-0" />
          </div>
        </button>
      </div>

      {error && (
        <p className="text-[11px] font-medium text-destructive mt-1">{error}</p>
      )}

      {/* Radial Analog Clock TimePicker Dialog Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-[310px] rounded-2xl bg-card border border-border shadow-2xl p-5 flex flex-col items-center gap-4 text-foreground animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Time Display */}
            <div className="flex items-center justify-center gap-2 w-full pt-1">
              <button
                type="button"
                onClick={() => setMode('hour')}
                className={cn(
                  'w-20 h-18 sm:w-22 sm:h-20 rounded-xl flex items-center justify-center text-4xl sm:text-5xl font-medium transition-all cursor-pointer select-none',
                  mode === 'hour'
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                )}
              >
                {draftHour}
              </button>

              <span className="text-3xl sm:text-4xl font-normal text-foreground select-none">
                :
              </span>

              <button
                type="button"
                onClick={() => setMode('minute')}
                className={cn(
                  'w-20 h-18 sm:w-22 sm:h-20 rounded-xl flex items-center justify-center text-4xl sm:text-5xl font-medium transition-all cursor-pointer select-none',
                  mode === 'minute'
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                )}
              >
                {String(draftMinute).padStart(2, '0')}
              </button>

              {/* AM / PM Segmented Box */}
              <div className="flex flex-col rounded-xl border border-border overflow-hidden ml-1 text-xs">
                <button
                  type="button"
                  onClick={() => setDraftPeriod('AM')}
                  className={cn(
                    'px-2.5 py-1.5 font-bold transition-colors cursor-pointer',
                    draftPeriod === 'AM'
                      ? 'bg-primary/15 text-primary'
                      : 'bg-card text-muted-foreground hover:bg-muted'
                  )}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setDraftPeriod('PM')}
                  className={cn(
                    'px-2.5 py-1.5 font-bold transition-colors border-t border-border cursor-pointer',
                    draftPeriod === 'PM'
                      ? 'bg-primary/15 text-primary'
                      : 'bg-card text-muted-foreground hover:bg-muted'
                  )}
                >
                  PM
                </button>
              </div>
            </div>

            {/* Mode Switch: Clock Dial vs Keyboard input */}
            {!isKeyboardMode ? (
              /* Analog Radial Clock Face */
              <div
                ref={dialRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="relative size-60 rounded-full bg-muted/80 select-none flex items-center justify-center cursor-pointer shadow-inner touch-none"
              >
                {/* SVG Pointer Needle */}
                <svg className="absolute inset-0 size-full pointer-events-none">
                  {/* Center Pivot Dot */}
                  <circle cx={DIAL_RADIUS} cy={DIAL_RADIUS} r="4" className="fill-primary" />
                  {/* Pointer Hand */}
                  <line
                    x1={DIAL_RADIUS}
                    y1={DIAL_RADIUS}
                    x2={pointerX}
                    y2={pointerY}
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-primary"
                  />
                  {/* Target Circle Knob */}
                  <circle cx={pointerX} cy={pointerY} r="18" className="fill-primary" />
                </svg>

                {/* Clock Face Numbers */}
                {mode === 'hour'
                  ? hoursPositions.map(({ num, x, y }) => {
                      const isSelected = draftHour === num;
                      return (
                        <div
                          key={num}
                          style={{
                            left: `${x}px`,
                            top: `${y}px`,
                            transform: 'translate(-50%, -50%)',
                          }}
                          className={cn(
                            'absolute size-8 flex items-center justify-center text-xs font-semibold rounded-full pointer-events-none transition-colors z-10',
                            isSelected
                              ? 'text-primary-foreground font-bold'
                              : 'text-foreground hover:text-primary'
                          )}
                        >
                          {num}
                        </div>
                      );
                    })
                  : minutesPositions.map(({ num, label: lbl, x, y }) => {
                      const isSelected = draftMinute === num;
                      return (
                        <div
                          key={lbl}
                          style={{
                            left: `${x}px`,
                            top: `${y}px`,
                            transform: 'translate(-50%, -50%)',
                          }}
                          className={cn(
                            'absolute size-8 flex items-center justify-center text-xs font-semibold rounded-full pointer-events-none transition-colors z-10',
                            isSelected
                              ? 'text-primary-foreground font-bold'
                              : 'text-foreground'
                          )}
                        >
                          {lbl}
                        </div>
                      );
                    })}
              </div>
            ) : (
              /* Keyboard / Manual Input Mode */
              <div className="w-full py-6 flex flex-col items-center justify-center gap-3">
                <p className="text-xs text-muted-foreground font-medium">
                  Enter time manually
                </p>
                <div className="flex items-center gap-2">
                  <div className="space-y-1 text-center">
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={draftHour}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v) && v >= 1 && v <= 12) setDraftHour(v);
                      }}
                      className="w-16 h-14 text-center text-2xl font-bold bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
                      Hour
                    </span>
                  </div>

                  <span className="text-2xl font-bold text-muted-foreground pb-4">:</span>

                  <div className="space-y-1 text-center">
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={draftMinute}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!Number.isNaN(v) && v >= 0 && v <= 59) setDraftMinute(v);
                      }}
                      className="w-16 h-14 text-center text-2xl font-bold bg-muted border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <span className="block text-[10px] text-muted-foreground uppercase font-semibold">
                      Minute
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="w-full flex items-center justify-between pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsKeyboardMode(!isKeyboardMode)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                data-tooltip={isKeyboardMode ? 'Switch to clock dial' : 'Switch to keyboard input'}
                aria-label="Toggle input mode"
              >
                <KeyboardIcon className="size-4.5" />
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default TimePicker;
