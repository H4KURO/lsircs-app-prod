const fs = require('fs');
const path = require('path');

const functionsDirectory = __dirname;
const skipFiles = new Set(['index.js', 'cosmosClient.js']);

fs.readdirSync(functionsDirectory)
  .filter(file => file.endsWith('.js') && !skipFiles.has(file))
  .forEach(file => {
    require(path.join(functionsDirectory, file));
  });

