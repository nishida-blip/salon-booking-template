// api/slots.js
// Vercel Serverless Function
// 役割: 指定日のGoogleカレンダーの予約済み時間を取得し、空きスロットを返す

import { google } from 'googleapis';

// サロンの営業設定（ここを変えるだけでカスタマイズできる）
const BUSINESS_HOURS = { start: 10, end: 18 }; // 10:00〜18:00
const SLOT_DURATION = 60; // 1枠60分
const CLOSED_DAYS = []; // 定休日なし
const CALENDAR_ID = process.env.CALENDAR_ID; // Vercelの環境変数から読む

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'date parameter is required (YYYY-MM-DD)' });
  }

  const targetDate = new Date(date + 'T00:00:00+09:00');

  if (CLOSED_DAYS.includes(targetDate.getDay())) {
    return res.status(200).json({ slots: [], closed: true });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (targetDate < today) {
    return res.status(200).json({ slots: [], past: true });
  }

  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    auth.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const timeMin = new Date(date + 'T00:00:00+09:00').toISOString();
    const timeMax = new Date(date + 'T23:59:59+09:00').toISOString();

    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    const bookedHours = new Set();
    events.forEach(event => {
      const start = new Date(event.start.dateTime || event.start.date);
      const end = new Date(event.end.dateTime || event.end.date);
      for (let h = start.getHours(); h < end.getHours(); h++) {
        bookedHours.add(h);
      }
    });

    const slots = [];
    for (let h = BUSINESS_HOURS.start; h < BUSINESS_HOURS.end; h++) {
      if (h + SLOT_DURATION / 60 > BUSINESS_HOURS.end) break;
      slots.push({
        hour: h,
        label: `${h}:00`,
        available: !bookedHours.has(h),
      });
    }

    return res.status(200).json({ slots });

  } catch (error) {
    console.error('Google Calendar API error:', error);
    return res.status(500).json({ error: 'カレンダーの取得に失敗しました' });
  }
}
