'use strict';

const { parseJsonBody, requireAdmin, response } = require('./lib/firebase-admin');

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

    if (uid === adminCtx.decoded.uid) {
      return response(400, { error: 'Nie możesz usunąć własnego konta administracyjnego' });
    }

    const reservationsSnap = await adminCtx.db
      .collection('reservations')
      .where('userEmail', '==', email)
      .get();

    const notificationsSnap = await adminCtx.db
      .collection('notifications')
      .where('userEmail', '==', email)
      .get();

    const batch = adminCtx.db.batch();

    reservationsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    notificationsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(adminCtx.db.collection('users').doc(uid));

    await batch.commit();

    let authAlreadyMissing = false;
    try {
      await adminCtx.auth.deleteUser(uid);
    } catch (error) {
      if (String(error.code || '') === 'auth/user-not-found') {
        authAlreadyMissing = true;
      } else {
        throw error;
      }
    }

    return response(200, {
      ok: true,
      deletedReservations: reservationsSnap.size,
      deletedNotifications: notificationsSnap.size,
      authAlreadyMissing
    });
  } catch (error) {
    return response(400, { error: error.message || 'Nie udało się usunąć użytkownika' });
  }
};
