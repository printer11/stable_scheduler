'use strict';

const { parseJsonBody, requireAdmin, response } = require('./lib/firebase-admin');

const ALLOWED_ROLES = new Set(['owner', 'student', 'admin']);

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

  let createdUser = null;

  try {
    const body = parseJsonBody(event);
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const surname = String(body.surname || '').trim();
    const role = String(body.role || '').trim();
    const horse = String(body.horse || '').trim();

    if (!email || !name) {
      return response(400, { error: 'Name and email are required' });
    }

    if (!ALLOWED_ROLES.has(role)) {
      return response(400, { error: 'Invalid role' });
    }

    if (role !== 'owner' && horse) {
      return response(400, { error: 'Horse can be assigned only to owner role' });
    }

    const tempPass = `Temp${Math.random().toString(36).slice(2, 10)}!`;
    createdUser = await adminCtx.auth.createUser({
      email,
      password: tempPass,
      displayName: [name, surname].filter(Boolean).join(' ')
    });

    const profile = {
      email,
      name,
      surname,
      initials: ((name[0] || '') + (surname[0] || '')).toUpperCase(),
      role,
      horse: role === 'owner' ? horse : '',
      photo: '',
      createdAt: new Date().toISOString()
    };

    await adminCtx.db.collection('users').doc(createdUser.uid).set(profile);
    await sendPasswordResetEmail(email);

    return response(200, {
      ok: true,
      user: { id: createdUser.uid, ...profile }
    });
  } catch (error) {
    if (createdUser) {
      await Promise.allSettled([
        adminCtx.auth.deleteUser(createdUser.uid),
        adminCtx.db.collection('users').doc(createdUser.uid).delete()
      ]);
    }

    const code = String(error.code || '');
    const message =
      code === 'auth/email-already-exists'
        ? 'Ten e-mail jest już zarejestrowany'
        : error.message || 'Nie udało się utworzyć konta';

    return response(400, { error: message });
  }
};
