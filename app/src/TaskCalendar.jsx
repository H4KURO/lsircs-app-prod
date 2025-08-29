// app/src/TaskCalendar.jsx

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import ja from 'date-fns/locale/ja'; // 日本語化のためのロケール
import 'react-big-calendar/lib/css/react-big-calendar.css'; // カレンダーのCSS

const API_URL = 'http://localhost:7071/api';

// 日本語表示のための設定
const locales = { 'ja': ja };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), // 週の始まりを月曜日に
  getDay,
  locales,
});

export function TaskCalendar() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // APIからタスクを取得
    axios.get(`${API_URL}/GetTasks`)
      .then(res => {
        // 取得したタスクをカレンダーが表示できる形式（イベント）に変換
        const formattedEvents = res.data
          .filter(task => task.deadline) // 締め切りがあるタスクのみを対象
          .map(task => ({
            title: task.title,
            start: new Date(task.deadline),
            end: new Date(task.deadline), // 終日イベントとして開始日と終了日を同じにする
            allDay: true,
            resource: task, // 元のタスク情報を保持
          }));
        setEvents(formattedEvents);
      })
      .catch(error => console.error("Error fetching tasks for calendar:", error));
  }, []);

  return (
    <div style={{ height: '100%' }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        culture='ja' // カレンダーを日本語表示に
        messages={{
            next: "次",
            previous: "前",
            today: "今日",
            month: "月",
            week: "週",
            day: "日",
            agenda: "リスト"
        }}
      />
    </div>
  );
}