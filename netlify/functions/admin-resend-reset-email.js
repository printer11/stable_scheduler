'use strict';

const { parseJsonBody, requireAdmin, response } = require('./lib/firebase-admin');

async function sendPasswordResetEmail(email) {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;

  if (!apiKey) {
    throw new Error('Missing FIREBASE_WEB_API_KEY');
  }

  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email
      })
    }
  );

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const message = data?.error?.message || 'Failed to send password reset email';
    throw new Error(message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return response(405, { error: 'Method not allowed' });
  }

  const adminCtx = await requireAdmin(event);
  if (adminCtx.error) {
    return adminCtx.error;
  }

  try {
    const body = parseJsonBody(event);
    const uid = String(body.uid || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!uid || !email) {
      return response(400, { error: 'uid and email are required' });
    }

    const userRecord = await adminCtx.auth.getUser(uid);
    const authEmail = String(userRecord.email || '').trim().toLowerCase();

    if (!authEmail) {
      return response(400, { error: 'Użytkownik nie ma adresu e-mail w Firebase Auth' });
    }

    if (authEmail !== email) {
      return response(400, { error: 'Adres e-mail w profilu i Firebase Auth nie zgadza się' });
    }

    await sendPasswordResetEmail(authEmail);

    return response(200, {
      ok: true,
      email: authEmail
    });
  } catch (error) {
    const code = String(error.code || '');
    const message =
      code === 'auth/user-not-found'
        ? 'Nie znaleziono użytkownika w Firebase Auth'
        : error.message || 'Nie udało się wysłać maila resetującego hasło';

    return response(400, { error: message });
  }
};
