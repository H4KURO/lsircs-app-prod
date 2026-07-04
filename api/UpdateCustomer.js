const { app } = require('@azure/functions');
const { getNamedContainer } = require('./cosmosClient');
const { notifyDxTeamCustomerUpdated } = require('./slackClient');

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

const ALLOWED_UPDATE_FIELDS = [
  'name', 'email', 'phone', 'company', 'country', 'region', 'status',
  'source', 'assignedTo', 'propertyInterest', 'preferredBedrooms',
  'budget', 'lastContactedAt', 'nextFollowUpAt', 'notes', 'buyerLink',
];

const FIELD_LABELS = {
  name: '氏名',
  email: 'メール',
  phone: '電話番号',
  company: '会社名',
  country: '国',
  region: '地域',
  status: 'ステータス',
  source: '情報ソース',
  assignedTo: '担当者',
  propertyInterest: '希望物件',
  preferredBedrooms: '希望間取り',
  budget: '予算',
  lastContactedAt: '最終接触日',
  nextFollowUpAt: '次回フォロー日',
  notes: '備考',
};

app.http('UpdateCustomer', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const clientPrincipal = parseClientPrincipal(request);
    if (!clientPrincipal) {
      return { status: 401, body: 'Unauthorized access. Please log in.' };
    }

    try {
      const payload = await request.json();
      const { id } = payload;
      if (!id) {
        return { status: 400, body: 'Customer id is required.' };
      }

      const container = customersContainer();

      let existingCustomer;
      try {
        const { resource } = await container.item(id, id).read();
        existingCustomer = resource;
      } catch (readError) {
        const msg = readError.message || '';
        if (msg.includes('Resource NotFound') || msg.includes('Resource Not Found') || readError.code === 404) {
          return { status: 404, body: 'Customer not found.' };
        }
        throw readError;
      }

      if (!existingCustomer) {
        return { status: 404, body: 'Customer not found.' };
      }

      const changedFields = Object.keys(FIELD_LABELS)
        .filter(
          (k) =>
            payload[k] !== undefined &&
            String(payload[k] ?? '') !== String(existingCustomer[k] ?? ''),
        )
        .map(
          (k) =>
            `${FIELD_LABELS[k]}: ${existingCustomer[k] ?? '（空）'} → ${payload[k] ?? '（空）'}`,
        );

      const updates = {};
      for (const field of ALLOWED_UPDATE_FIELDS) {
        if (payload[field] !== undefined) {
          updates[field] = payload[field];
        }
      }

      const now = new Date().toISOString();
      const updatedCustomer = {
        ...existingCustomer,
        ...updates,
        updatedAt: now,
        updatedBy: clientPrincipal.userDetails,
      };

      const { resource } = await container.item(id, id).replace(updatedCustomer);

      if (changedFields.length > 0) {
        await notifyDxTeamCustomerUpdated(resource, changedFields, context, {
          actorName: clientPrincipal.userDetails,
        });
      }

      return { status: 200, jsonBody: resource };
    } catch (error) {
      const message = error.message || '';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      if (message.includes('Resource NotFound') || message.includes('Resource Not Found')) {
        return { status: 404, body: 'Customer not found.' };
      }
      context.log('UpdateCustomer failed', error);
      return { status: 500, body: 'Error updating customer.' };
    }
  },
});
