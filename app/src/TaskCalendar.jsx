import { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import ja from 'date-fns/locale/ja';
import enUS from 'date-fns/locale/en-US';
import { useTranslation } from 'react-i18next';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { normalizeTask } from './taskUtils';

const locales = { ja, en: enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

export function TaskCalendar({ tasks = [], categoryColors = {}, onTaskSelect }) {
  const { t, i18n } = useTranslation();
  const currentLanguage = (i18n.language || 'ja').split('-')[0];
  const culture = locales[currentLanguage] ? currentLanguage : 'ja';

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

  const messages = useMemo(
    () => ({
      next: t('calendar.next'),
      previous: t('calendar.previous'),
      today: t('calendar.today'),
      month: t('calendar.month'),
      week: t('calendar.week'),
      day: t('calendar.day'),
      agenda: t('calendar.agenda'),
    }),
    [t],
  );

  return (
    <div style={{ height: '100%' }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        culture={culture}
        messages={messages}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventStyleGetter}
      />
    </div>
  );
}
