const { app } = require('@azure/functions');
const { parseClientPrincipal, getPrincipalUserId } = require('./userProfileStore');

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
