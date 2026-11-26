import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { holidayService } from '../../services/holidayService';
import { cn } from '../../lib/utils';

// Official 2026 Indian Gazetted & Festive Holidays
const INDIAN_FESTIVAL_HOLIDAYS_2026 = [
  {
    id: 'hol-1',
    date: '2026-01-14',
    month: 'JAN',
    day: '14',
    name: 'Makar Sankranti / Pongal',
    dayOfWeek: 'Wednesday',
    type: 'Harvest Festival',
    category: 'festive',
    badge: 'Harvest Festival',
    description: 'Traditional harvest festival celebrating the sun transition into Capricorn (Makara Sankranti).',
    quarter: 'Q1',
  },
  {
    id: 'hol-2',
    date: '2026-01-26',
    month: 'JAN',
    day: '26',
    name: 'Republic Day',
    dayOfWeek: 'Monday',
    type: 'National Holiday',
    category: 'national',
    badge: 'National Holiday',
    description: 'Honoring the Constitution of India which came into effect on 26 January 1950.',
    quarter: 'Q1',
  },
  {
    id: 'hol-3',
    date: '2026-03-03',
    month: 'MAR',
    day: '03',
    name: 'Maha Shivratri',
    dayOfWeek: 'Tuesday',
    type: 'Gazetted Festive Holiday',
    category: 'festive',
    badge: 'Religious Festival',
    description: 'Great night of Lord Shiva observed with traditional prayers and night vigils.',
    quarter: 'Q1',
  },
  {
    id: 'hol-4',
    date: '2026-03-20',
    month: 'MAR',
    day: '20',
    name: 'Eid-ul-Fitr',
    dayOfWeek: 'Friday',
    type: 'Gazetted Festive Holiday',
    category: 'festive',
    badge: 'Religious Festival',
    description: 'Celebration marking the conclusion of the holy month of Ramadan.',
    quarter: 'Q1',
  },
  {
    id: 'hol-5',
    date: '2026-03-25',
    month: 'MAR',
    day: '25',
    name: 'Holi (Festival of Colors)',
    dayOfWeek: 'Wednesday',
    type: 'Major Festive Holiday',
    category: 'festive',
    badge: 'Major Festival',
    description: 'Joyous spring festival of colors celebrating love, triumph of good over evil, and renewal.',
    quarter: 'Q1',
  },
  {
    id: 'hol-6',
    date: '2026-04-14',
    month: 'APR',
    day: '14',
    name: 'Dr. B.R. Ambedkar Jayanti / Tamil New Year',
    dayOfWeek: 'Tuesday',
    type: 'Gazetted Holiday',
    category: 'national',
    badge: 'Public Holiday',
    description: 'Commemorating the birth anniversary of Dr. B.R. Ambedkar, chief architect of the Constitution.',
    quarter: 'Q2',
  },
  {
    id: 'hol-7',
    date: '2026-05-01',
    month: 'MAY',
    day: '01',
    name: 'Labour Day / Maharashtra Day',
    dayOfWeek: 'Friday',
    type: 'State / Commercial Holiday',
    category: 'commercial',
    badge: 'Workforce Holiday',
    description: 'International Workers Day recognizing the artisans, craftsmen, and workforce.',
    quarter: 'Q2',
  },
  {
    id: 'hol-8',
    date: '2026-08-15',
    month: 'AUG',
    day: '15',
    name: 'Independence Day',
    dayOfWeek: 'Saturday',
    type: 'National Holiday',
    category: 'national',
    badge: 'National Holiday',
    description: 'National festival celebrating India independence achieved on 15 August 1947.',
    quarter: 'Q3',
  },
  {
    id: 'hol-9',
    date: '2026-08-27',
    month: 'AUG',
    day: '27',
    name: 'Raksha Bandhan',
    dayOfWeek: 'Thursday',
    type: 'Festive Holiday',
    category: 'festive',
    badge: 'Festive Holiday',
    description: 'Traditional festival celebrating the sacred bond of protection and affection between siblings.',
    quarter: 'Q3',
  },
  {
    id: 'hol-10',
    date: '2026-09-04',
    month: 'SEP',
    day: '04',
    name: 'Krishna Janmashtami',
    dayOfWeek: 'Friday',
    type: 'Gazetted Festive Holiday',
    category: 'festive',
    badge: 'Religious Festival',
    description: 'Celebration of the birth of Lord Krishna with devotional singing and Dahi Handi.',
    quarter: 'Q3',
  },
  {
    id: 'hol-11',
    date: '2026-09-14',
    month: 'SEP',
    day: '14',
    name: 'Ganesh Chaturthi',
    dayOfWeek: 'Monday',
    type: 'Major Festive Holiday',
    category: 'festive',
    badge: 'Major Festival',
    description: 'Grand 10-day celebration welcoming Lord Ganesha, remover of obstacles.',
    quarter: 'Q3',
  },
  {
    id: 'hol-12',
    date: '2026-10-02',
    month: 'OCT',
    day: '02',
    name: 'Mahatma Gandhi Jayanti',
    dayOfWeek: 'Friday',
    type: 'National Holiday',
    category: 'national',
    badge: 'National Holiday',
    description: 'National commemoration of the birth anniversary of Mahatma Gandhi, leader of Indian independence.',
    quarter: 'Q4',
  },
  {
    id: 'hol-13',
    date: '2026-10-20',
    month: 'OCT',
    day: '20',
    name: 'Dussehra (Vijayadashami)',
    dayOfWeek: 'Tuesday',
    type: 'Major Festive Holiday',
    category: 'festive',
    badge: 'Major Festival',
    description: 'Celebration of the triumph of good over evil (Lord Rama over Ravana and Goddess Durga over Mahishasura).',
    quarter: 'Q4',
  },
  {
    id: 'hol-14',
    date: '2026-11-08',
    month: 'NOV',
    day: '08',
    name: 'Diwali (Lakshmi Puja)',
    dayOfWeek: 'Sunday',
    type: 'Major Festive Holiday',
    category: 'festive',
    badge: 'Grand Festival',
    description: 'The Festival of Lights illuminating homes and businesses with lamps, prayers, and prosperity.',
    quarter: 'Q4',
  },
  {
    id: 'hol-15',
    date: '2026-11-10',
    month: 'NOV',
    day: '10',
    name: 'Diwali (Bhai Dooj)',
    dayOfWeek: 'Tuesday',
    type: 'Gazetted Festive Holiday',
    category: 'festive',
    badge: 'Festive Holiday',
    description: 'Culmination of Diwali festivities celebrating love and sibling companionship.',
    quarter: 'Q4',
  },
  {
    id: 'hol-16',
    date: '2026-11-24',
    month: 'NOV',
    day: '24',
    name: 'Guru Nanak Jayanti',
    dayOfWeek: 'Tuesday',
    type: 'Gazetted Festive Holiday',
    category: 'festive',
    badge: 'Religious Festival',
    description: 'Birth anniversary of Guru Nanak Dev Ji, founder of Sikhism and first Sikh Guru.',
    quarter: 'Q4',
  },
  {
    id: 'hol-17',
    date: '2026-12-25',
    month: 'DEC',
    day: '25',
    name: 'Christmas Day',
    dayOfWeek: 'Friday',
    type: 'Gazetted Festive Holiday',
    category: 'festive',
    badge: 'Global Festival',
    description: 'Celebration of the birth of Jesus Christ, marked with carols, feasts, and gift-giving.',
    quarter: 'Q4',
  },
];

/** Whole days from today to a 'YYYY-MM-DD' date. */
function daysUntil(iso) {
  return Math.round((new Date(`${iso}T00:00:00`) - new Date(new Date().toDateString())) / 86400000);
}

/** The next company holiday as a blue banner, with the one after it and the yearly calendar. */
export function HolidaySpotlight({ className }) {
  const [upcoming, setUpcoming] = useState(() => holidayService.getUpcomingHolidays(2));
  const [all, setAll] = useState(() => holidayService.getAllActiveHolidays());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setUpcoming(holidayService.getUpcomingHolidays(2));
      setAll(holidayService.getAllActiveHolidays());
    };
    window.addEventListener('osm_holidays_updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('osm_holidays_updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const [next, after] = upcoming;
  const away = next?.date ? daysUntil(next.date) : null;

  return (
    <>
      <div className={cn('surface-brand relative isolate overflow-hidden rounded-xl p-4 text-primary-foreground shadow-md', className)}>
        {/* two soft rings, as on the first figure card */}
        <span aria-hidden="true" className="absolute -bottom-14 -right-8 -z-10 size-32 rounded-full bg-white/10" />
        <span aria-hidden="true" className="absolute -bottom-20 -right-14 -z-10 size-44 rounded-full bg-white/5" />

        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold opacity-90">Next holiday</h3>
          <button type="button" onClick={() => setIsOpen(true)} className="cursor-pointer rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold hover:bg-white/30">
            Yearly calendar
          </button>
        </div>

        {next ? (
          <div className="mt-3 flex items-center gap-3">
            <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-white text-brand-600">
              <span className="text-[9px] font-semibold uppercase leading-none tracking-wider">{next.month}</span>
              <span className="mt-0.5 text-lg font-semibold leading-none tabular-nums">{next.day}</span>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold leading-tight">{next.name}</span>
              <span className="block truncate text-[11px] opacity-90">
                {next.dayOfWeek}
                {away === null ? '' : away === 0 ? ' · today' : away === 1 ? ' · tomorrow' : ` · in ${away} days`}
              </span>
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm">No upcoming holidays scheduled.</p>
        )}
        {after && (
          <p className="mt-2 truncate text-[11px] opacity-90">
            Then {after.name}, {after.day} {after.month}
          </p>
        )}

      </div>

      {/* Holidays Calendar Modal conforming to BefUI */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Holidays calendar"
        size="lg"
        footer={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Close Calendar
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Festival Holidays Scrollable List with BefUI Tokens */}
          <div className="max-h-[460px] overflow-y-auto space-y-2 pr-1.5 scrollbar-thin">
            {(all && all.length > 0 ? all : INDIAN_FESTIVAL_HOLIDAYS_2026).map((holiday) => {
              const isNational = holiday.category === 'national' || holiday.type === 'national';
              return (
                <div
                  key={holiday.id}
                  className={cn(
                    'p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all flex items-center justify-between gap-3.5',
                    isNational && 'border-primary/40 bg-primary/5'
                  )}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Festival Date Block */}
                    <div className="w-12 h-12 rounded-xl bg-muted border border-border flex flex-col items-center justify-center shrink-0 shadow-2xs">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground leading-none">
                        {holiday.month}
                      </span>
                      <span className="text-base font-bold text-foreground leading-none mt-1 font-mono">
                        {holiday.day}
                      </span>
                    </div>

                    {/* Holiday Name */}
                    <h4 className="text-xs sm:text-sm font-bold text-foreground">
                      {holiday.name}
                    </h4>
                  </div>

                  {/* Day of Week */}
                  <span className="text-xs text-muted-foreground font-medium shrink-0">
                    {holiday.dayOfWeek}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </>
  );
}

export default HolidaySpotlight;
