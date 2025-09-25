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

export function TaskCalendar({ onTaskSelect }) {
  const [events, setEvents] = useState([]);
  const [categoryColors, setCategoryColors] = useState({}); // カテゴリーの色設定を保存

  useEffect(() => {
    // APIからタスクとカテゴリーの色設定の両方を取得
    Promise.all([
      axios.get(`${API_URL}/GetTasks`),
      axios.get(`${API_URL}/GetCategories`)
    ]).then(([tasksRes, categoriesRes]) => {
      
      // カテゴリー名と色の対応表を作成
      const colors = {};
      categoriesRes.data.forEach(cat => {
        colors[cat.name] = cat.color;
      });
      setCategoryColors(colors);

      const formattedEvents = tasksRes.data
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
    .catch(error => console.error("Error fetching data for calendar:", error));
  }, []);

  const handleSelectEvent = (event) => {
    if (event.resource && onTaskSelect) {
      onTaskSelect(event.resource);
    }
  };
  
  // イベントのスタイルを設定するための関数
  const eventStyleGetter = (event) => {
    // 対応表から色を取得。なければデフォルト色
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
        messages={{ next: "次", previous: "前", today: "今日", month: "月", week: "週", day: "日", agenda: "リスト" }}
        onSelectEvent={handleSelectEvent}
        // eventPropGetterプロパティでスタイルを適用
        eventPropGetter={eventStyleGetter}
      />
    </div>
  );
}

