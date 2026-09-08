const fs = require('fs');
const path = require('path');

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

fs.readdirSync(functionsDirectory)
  .filter(file => file.endsWith('.js') && !skipFiles.has(file))
  .forEach(file => {
    const base = path.parse(file).name;
    if (allowedSet && !allowedSet.has(base)) {
      return; // skip non-allowed functions when ALLOWED_FUNCTIONS is set
    }
    require(path.join(functionsDirectory, file));
  });
