import { google } from 'googleapis';

const CALENDAR_ID = process.env.CALENDAR_ID;
const SLOT_DURATION_MINUTES = 60;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { date, hour, name, tel, email, menu, note } = req.body;

  if (!date || hour === undefined || !name || !tel) {
    return res.status(400).json({ error: '必須項目が不足しています' });
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

    const startTime = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+09:00`);
    const endTime = new Date(startTime.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);

    const checkResponse = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
    });
    if ((checkResponse.data.items || []).length > 0) {
      return res.status(409).json({ error: 'この時間はすでに予約済みです。別の時間をお選びください。' });
    }

    const event = {
      summary: `[予約] ${name} 様 — ${menu || 'メニュー未選択'}`,
      description: [
        `お名前: ${name}`,
        `電話番号: ${tel}`,
        `メール: ${email || '未入力'}`,
        `メニュー: ${menu || '未選択'}`,
        `備考: ${note || 'なし'}`,
        '',
        '※ このイベントはホームページ予約システムから自動登録されました',
      ].join('\n'),
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Asia/Tokyo',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Tokyo',
      },
    };

    const createdEvent = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: event,
    });

    return res.status(200).json({
      success: true,
      eventId: createdEvent.data.id,
      message: '予約が確定しました',
    });

  } catch (error) {
    console.error('予約登録エラー:', error);
    return res.status(500).json({ error: '予約の登録に失敗しました。お手数ですが、お電話でお問い合わせください。' });
  }
}
