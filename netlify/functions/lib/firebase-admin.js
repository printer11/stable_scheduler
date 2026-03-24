'use strict';

const admin = require('firebase-admin');

function readServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!raw) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_BASE64');
  }

  const json = Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(json);
}

function getAdminApp() {
  if (admin.apps.length) {
    return admin.app();
  }

  const serviceAccount = readServiceAccount();

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

function getFirestore() {
  return getAdminApp().firestore();
}

async function requireAdmin(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return { error: response(401, { error: 'Missing bearer token' }) };
  }

  try {
    const app = getAdminApp();
    const decoded = await app.auth().verifyIdToken(match[1]);
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(decoded.uid).get();

    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return { error: response(403, { error: 'Admin access required' }) };
    }

    return {
      app,
      db,
      auth: app.auth(),
      decoded,
      profile: userDoc.data()
    };
  } catch (error) {
    return { error: response(401, { error: 'Invalid bearer token', details: error.message }) };
  }
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(body)
  };
}

function parseJsonBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
}

module.exports = {
  getAdminApp,
  getFirestore,
  parseJsonBody,
  requireAdmin,
  response
};
