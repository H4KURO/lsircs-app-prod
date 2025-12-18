const { app } = require('@azure/functions');
const https = require('https');

function getEnvRegion() {
  return (
    process.env.WEBSITE_REGION ||
    process.env.REGION_NAME ||
    process.env.LOCATION ||
    process.env.WEBSITE_SITE_NAME ||
    'unknown'
  );
}

function fetchPublicIp() {
  return new Promise((resolve) => {
    const req = https.get('https://ifconfig.me/ip', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk.toString();
      });
      res.on('end', () => resolve(data.trim()));
    });
    req.on('error', () => resolve('unknown'));
    req.setTimeout(4000, () => {
      req.destroy();
      resolve('timeout');
    });
  });
}

app.http('RegionCheck', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'region-check',
  handler: async (request, context) => {
    const region = getEnvRegion();
    const publicIp = await fetchPublicIp();
    context.log('RegionCheck', { region, publicIp });
    return { status: 200, jsonBody: { region, publicIp } };
  },
});

