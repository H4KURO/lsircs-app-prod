// app/src/TaskCalendar.jsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import ja from 'date-fns/locale/ja';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const API_URL = '/api';

const locales = { 'ja': ja };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

// ▼▼▼ onTaskSelectをpropsとして受け取る ▼▼▼
export function TaskCalendar({ onTaskSelect }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    axios.get(`${API_URL}/GetTasks`)
      .then(res => {
        const formattedEvents = res.data
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
      .catch(error => console.error("Error fetching tasks for calendar:", error));
  }, []);

  // ▼▼▼ カレンダー上のイベントがクリックされたときに呼ばれる関数 ▼▼▼
  const handleSelectEvent = (event) => {
    // event.resourceに元のタスク情報が格納されている
    if (event.resource && onTaskSelect) {
      onTaskSelect(event.resource);
    }
  };

  return (
    <div style={{ height: '100%' }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        culture='ja'
        messages={{ next: "次", previous: "前", today: "今日", month: "月", week: "週", day: "日", agenda: "リスト" }}
        // ▼▼▼ onSelectEventプロパティを追加 ▼▼▼
        onSelectEvent={handleSelectEvent}
      />
    </div>
  );
}