import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import ja from 'date-fns/locale/ja';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { normalizeTask } from './taskUtils';

const API_URL = '/api';

const locales = { 'ja': ja };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

export function TaskCalendar({ onTaskSelect }) {
  const [events, setEvents] = useState([]);
  const [categoryColors, setCategoryColors] = useState({});

  useEffect(() => {
    Promise.all([
      axios.get(`${API_URL}/GetTasks`),
      axios.get(`${API_URL}/GetCategories`)
    ]).then(([tasksRes, categoriesRes]) => {
      const colors = {};
      categoriesRes.data.forEach(cat => {
        colors[cat.name] = cat.color;
      });
      setCategoryColors(colors);

      const formattedEvents = tasksRes.data
        .map(normalizeTask)
        .filter(task => task.deadline)
        .map(task => ({
          title: task.title,
          start: new Date(task.deadline),
          end: new Date(task.deadline),
          allDay: true,
          resource: task,
        }));
      setEvents(formattedEvents);
    })
    .catch(error => console.error('Error fetching data for calendar:', error));
  }, []);

  const handleSelectEvent = (event) => {
    if (event.resource && onTaskSelect) {
      onTaskSelect(event.resource);
    }
  };

  const eventStyleGetter = (event) => {
    const backgroundColor = categoryColors[event.resource.category] || '#9e9e9e';
    const style = {
      backgroundColor,
      borderRadius: '5px',
      opacity: 0.8,
      color: 'white',
      border: '0px',
      display: 'block'
    };
    return {
      style: style
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
