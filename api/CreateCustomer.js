const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');

const customersContainer = () =>
  getNamedContainer('Customers', ['COSMOS_CUSTOMERS_CONTAINER']);

function parseClientPrincipal(request) {
  const header = request.headers.get('x-ms-client-principal');
  if (!header) return null;
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('ascii'));
  } catch {
    return null;
  }
}

app.http('CreateCustomer', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();
      const name = payload?.name?.trim();
      if (!name) {
        return { status: 400, body: 'Customer name is required.' };
      }

      const container = customersContainer();
      const now = new Date().toISOString();

      const customer = {
        id: uuidv4(),
        name,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        company: payload.company ?? null,
        country: payload.country ?? null,
        region: payload.region ?? null,
        status: payload.status ?? 'Lead',
        source: payload.source ?? null,
        assignedTo: payload.assignedTo ?? null,
        propertyInterest: payload.propertyInterest ?? null,
        preferredBedrooms: payload.preferredBedrooms ?? null,
        budget: payload.budget ?? null,
        lastContactedAt: payload.lastContactedAt ?? null,
        nextFollowUpAt: payload.nextFollowUpAt ?? null,
        notes: payload.notes ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: clientPrincipal.userDetails,
        updatedBy: null,
      };

      const { resource } = await container.items.create(customer);

      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound')) {
        return { status: 404, body: 'Customers container not found in Cosmos DB.' };
      }
      context.log('CreateCustomer failed', error);
      return { status: 500, body: 'Error creating customer.' };
    }
  },
});
