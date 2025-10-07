import { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import ja from 'date-fns/locale/ja';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { normalizeTask } from './taskUtils';

const locales = { 'ja': ja };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

export function TaskCalendar({ tasks = [], categoryColors = {}, onTaskSelect }) {
  const events = useMemo(() => {
    if (!Array.isArray(tasks)) {
      return [];
    }

    return tasks
      .map((task) => normalizeTask(task))
      .filter((task) => Boolean(task?.deadline))
      .map((task) => ({
        title: task.title,
        start: new Date(task.deadline),
        end: new Date(task.deadline),
        allDay: true,
        resource: task,
      }));
  }, [tasks]);

  const normalizedCategoryColors = useMemo(() => {
    if (!categoryColors || typeof categoryColors !== 'object') {
      return {};
    }

    const map = {};
    Object.entries(categoryColors).forEach(([key, value]) => {
      if (typeof key === 'string' && key.trim()) {
        map[key.trim()] = value || '#9e9e9e';
      }
    });
    return map;
  }, [categoryColors]);

  const handleSelectEvent = (event) => {
    if (event?.resource && onTaskSelect) {
      onTaskSelect(event.resource);
    }
  };

  const eventStyleGetter = (event) => {
    const category = typeof event?.resource?.category === 'string' ? event.resource.category.trim() : '';
    const backgroundColor = normalizedCategoryColors[category] || '#9e9e9e';
    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  return (
    <div style={{ height: '100%' }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        culture='ja'
        messages={{ next: '次', previous: '前', today: '今日', month: '月', week: '週', day: '日', agenda: '予定表' }}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
      />
    </div>
  );
}
