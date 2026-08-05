const { app } = require('@azure/functions');
const axios = require('axios');
const {
  usersContainer,
  parseClientPrincipal,
  getPrincipalUserId,
  readUserProfile,
} = require('./userProfileStore');

app.http('UpdateUserProfile', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) {
      return { status: 401, body: 'Not logged in' };
    }

    const userId = getPrincipalUserId(principal);
    if (!userId) {
      return { status: 400, body: 'Client principal did not include a userId.' };
    }

    try {
      const updates = await request.json();
      const displayName = updates?.displayName?.trim();
      if (!displayName) {
        return { status: 400, body: 'Display name is required.' };
      }

      const container = await usersContainer();
      let existing;
      try {
        existing = await readUserProfile(container, userId);
      } catch (readError) {
        if (readError?.code === 404 || readError?.code === 'NotFound') {
          return { status: 404, body: 'User profile not found.' };
        }
        throw readError;
      }

      if (!existing) {
        return { status: 404, body: 'User profile not found.' };
      }

      const now = new Date().toISOString();
      const updatedProfile = { ...existing, displayName, updatedAt: now };

      if (updates?.unlinkSlack === true) {
        delete updatedProfile.slackMemberId;
      } else if (typeof updates?.slackMemberId === 'string' && updates.slackMemberId.trim()) {
        updatedProfile.slackMemberId = updates.slackMemberId.trim();
      }
      const { resource } = await container
        .item(userId, userId)
        .replace(updatedProfile, { disableAutomaticIdGeneration: true });
      return { status: 200, jsonBody: resource };
    } catch (error) {
      if (error?.code === 404 || error?.code === 'NotFound') {
        return { status: 404, body: 'User profile not found.' };
      }
      const message = error.message || 'Error updating user profile.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('UpdateUserProfile failed', error);
      return { status: 500, body: `Error updating user profile: ${message}` };
    }
  },
});

// SlackTest - 診断用（動作確認後削除予定）
app.http('SlackTest', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    context.log('SlackTest called from UpdateUserProfile.js');
    return { status: 200, body: 'SlackTest OK - loaded from UpdateUserProfile.js' };
  },
});

// SlackOAuthStart - Slack OAuth認証開始
app.http('SlackOAuthStart', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const principal = parseClientPrincipal(request);
    if (!principal) return { status: 401, body: 'Not logged in' };

    const clientId = process.env.SLACK_CLIENT_ID;
    const baseUrl = process.env.APP_BASE_URL;
    if (!clientId || !baseUrl) {
      return { status: 500, body: 'Slack OAuth is not configured (SLACK_CLIENT_ID / APP_BASE_URL missing)' };
    }

    const userId = getPrincipalUserId(principal);
    const redirectUri = `${baseUrl}/api/SlackOAuthCallback`;
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64url');

    const params = new URLSearchParams({
      client_id: clientId,
      scope: '',
      user_scope: 'identity.basic',
      redirect_uri: redirectUri,
      state,
    });

    return {
      status: 302,
      headers: { Location: `https://slack.com/oauth/v2/authorize?${params}` },
    };
  },
});

// SlackOAuthCallback - Slack OAuth認証コールバック
app.http('SlackOAuthCallback', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const baseUrl = process.env.APP_BASE_URL || '';
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;

    const code = request.query.get('code');
    const state = request.query.get('state');
    const error = request.query.get('error');

    const failRedirect = (reason) => ({
      status: 302,
      headers: { Location: `${baseUrl}?slack_oauth=${reason}` },
    });

    if (error || !code || !state) return failRedirect('cancelled');
    if (!clientId || !clientSecret) return failRedirect('not_configured');

    let userId;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      userId = decoded?.userId;
    } catch (e) {
      context.log('SlackOAuthCallback state decode error', e?.message);
      return failRedirect('invalid_state');
    }
    if (!userId) return failRedirect('invalid_state');

    const redirectUri = `${baseUrl}/api/SlackOAuthCallback`;
    let tokenData;
    try {
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      });
      const { data } = await axios.post('https://slack.com/api/oauth.v2.access', params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8000,
      });
      tokenData = data;
    } catch (fetchErr) {
      context.log('SlackOAuthCallback token exchange error', fetchErr?.message);
      return failRedirect('error');
    }

    if (!tokenData.ok) {
      context.log('SlackOAuth token exchange failed', tokenData.error);
      return failRedirect('error');
    }

    const slackMemberId = tokenData.authed_user?.id;
    if (!slackMemberId) return failRedirect('error');

    try {
      const container = await usersContainer();
      const existing = await readUserProfile(container, userId);
      if (!existing) return failRedirect('user_not_found');

      const updated = { ...existing, slackMemberId, updatedAt: new Date().toISOString() };
      await container.item(userId, userId).replace(updated, { disableAutomaticIdGeneration: true });
    } catch (dbErr) {
      context.log('SlackOAuthCallback DB error', dbErr?.message);
      return failRedirect('error');
    }

    return { status: 302, headers: { Location: `${baseUrl}?slack_oauth=success` } };
  },
});
