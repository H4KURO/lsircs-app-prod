const { app } = require('@azure/functions');
const axios = require('axios');
const { usersContainer, readUserProfile } = require('./userProfileStore');

app.http('SlackOAuthCallback', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'SlackOAuthCallback',
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
