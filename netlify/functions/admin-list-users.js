'use strict';

const { requireAdmin, response } = require('./lib/firebase-admin');

const STATE_PRIORITY = {
  missing_profile: 0,
  invited: 1,
  profile_only: 2,
  active: 3
};

function toIsoString(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

async function listAllAuthUsers(auth) {
  const users = [];
  let nextPageToken;

  do {
    const page = await auth.listUsers(1000, nextPageToken);
    users.push(...page.users);
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  return users;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function buildUser(uid, profileDoc, authUser) {
  const profile = profileDoc?.data() || null;
  const displayName = String(authUser?.displayName || '').trim();
  const displayNameParts = displayName ? displayName.split(/\s+/) : [];
  const fallbackName = displayNameParts[0] || '';
  const fallbackSurname = displayNameParts.slice(1).join(' ');

  const profileExists = !!profile;
  const authExists = !!authUser;
  const authCreatedAt = toIsoString(authUser?.metadata?.creationTime);
  const lastSignInAt = toIsoString(authUser?.metadata?.lastSignInTime);

  let accountState = 'active';
  if (authExists && !profileExists) {
    accountState = 'missing_profile';
  } else if (profileExists && !authExists) {
    accountState = 'profile_only';
  } else if (authExists && !lastSignInAt) {
    accountState = 'invited';
  }

  const email = normalizeEmail(profile?.email || authUser?.email);
  const name = String(profile?.name || fallbackName || '').trim();
  const surname = String(profile?.surname || fallbackSurname || '').trim();
  const createdAt = String(profile?.createdAt || authCreatedAt || '').trim();

  return {
    id: uid,
    email,
    name,
    surname,
    initials: String(
      profile?.initials ||
      ((name[0] || '') + (surname[0] || '')).toUpperCase()
    ).trim(),
    role: profile?.role || '',
    horse: profile?.horse || '',
    photo: profile?.photo || '',
    createdAt,
    profileExists,
    authExists,
    accountState,
    authCreatedAt,
    lastSignInAt,
    emailVerified: !!authUser?.emailVerified,
    disabled: !!authUser?.disabled
  };
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
    const [profileSnap, authUsers] = await Promise.all([
      adminCtx.db.collection('users').get(),
      listAllAuthUsers(adminCtx.auth)
    ]);

    const profileByUid = new Map(profileSnap.docs.map((doc) => [doc.id, doc]));
    const authByUid = new Map(authUsers.map((user) => [user.uid, user]));
    const allUids = new Set([...profileByUid.keys(), ...authByUid.keys()]);

    const users = [...allUids]
      .map((uid) => buildUser(uid, profileByUid.get(uid), authByUid.get(uid)))
      .filter((user) => user.email)
      .sort((a, b) => {
        const priorityDiff =
          (STATE_PRIORITY[a.accountState] ?? 99) -
          (STATE_PRIORITY[b.accountState] ?? 99);

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        const timeA = a.createdAt || a.authCreatedAt || '';
        const timeB = b.createdAt || b.authCreatedAt || '';
        return timeB.localeCompare(timeA);
      });

    return response(200, {
      ok: true,
      users
    });
  } catch (error) {
    return response(400, {
      error: error.message || 'Nie udało się pobrać listy użytkowników'
    });
  }
};
