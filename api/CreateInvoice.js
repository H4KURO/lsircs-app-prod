const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const { getNamedContainer } = require('./cosmosClient');

const invoicesContainer = () =>
  getNamedContainer('Invoices', ['COSMOS_INVOICES_CONTAINER', 'CosmosInvoicesContainer']);

app.http('CreateInvoice', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    try {
      const payload = await request.json();
      if (!payload?.customerId || payload.amount == null) {
        return { status: 400, body: 'Customer ID and amount are required.' };
      }

      const container = invoicesContainer();
      const newInvoice = {
        id: uuidv4(),
        customerId: payload.customerId,
        amount: payload.amount,
        status: payload.status || 'draft',
        issueDate: new Date().toISOString(),
        dueDate: payload.dueDate || null,
        notes: payload.notes || '',
      };

      const { resource } = await container.items.create(newInvoice);
      return { status: 201, jsonBody: resource };
    } catch (error) {
      const message = error.message || 'Error creating invoice.';
      if (message.includes('connection string')) {
        return { status: 500, body: message };
      }
      context.log('CreateInvoice failed', error);
      return { status: 500, body: 'Error creating invoice.' };
    }
  },
});

