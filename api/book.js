// api/book.js
// Vercel Serverless Function
// 役割: お客様の予約情報を受け取り、Googleカレンダーに登録する

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
