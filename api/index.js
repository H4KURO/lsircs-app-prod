const fs = require('fs');
const path = require('path');
const { app } = require('@azure/functions');

const functionsDirectory = __dirname;
const skipFiles = new Set(['index.js', 'cosmosClient.js']);
const allowedEnv = process.env.ALLOWED_FUNCTIONS;
const allowedSet =
  typeof allowedEnv === 'string' && allowedEnv.trim().length > 0
    ? new Set(
        allowedEnv
          .split(',')
          .map(name => name.trim())
          .filter(Boolean),
      )
    : null; // null means load all (default behavior for main app)

// Diagnostic endpoint (always registered from index.js, unaffected by ALLOWED_FUNCTIONS)
app.http('DebugInfo', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const loadedFiles = fs.readdirSync(functionsDirectory)
      .filter(file => file.endsWith('.js') && !skipFiles.has(file));
    return {
      status: 200,
      jsonBody: {
        allowedFunctions: allowedEnv || null,
        allowedSet: allowedSet ? Array.from(allowedSet) : null,
        filesInDirectory: loadedFiles,
        skippedByFilter: allowedSet
          ? loadedFiles.filter(f => !allowedSet.has(path.parse(f).name))
          : [],
      },
    };
  },
});

// TaskDeadlineReminder registered directly here to bypass ALLOWED_FUNCTIONS filtering
app.http('TaskDeadlineReminder', {
  methods: ['POST', 'GET'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    context.log('TaskDeadlineReminder called (registered from index.js)');
    return {
      status: 200,
      jsonBody: { ok: true, message: 'TaskDeadlineReminder is alive (from index.js)' },
    };
  },
});

const loadedFunctions = [];
fs.readdirSync(functionsDirectory)
  .filter(file => file.endsWith('.js') && !skipFiles.has(file))
  .forEach(file => {
    const base = path.parse(file).name;
    // Skip files already registered directly above
    if (base === 'TaskDeadlineReminder') return;
    if (allowedSet && !allowedSet.has(base)) {
      return; // skip non-allowed functions when ALLOWED_FUNCTIONS is set
    }
    loadedFunctions.push(base);
    require(path.join(functionsDirectory, file));
  });
