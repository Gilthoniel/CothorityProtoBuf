const protobuf = require('protobufjs');
const fs = require('fs');
const files = require('file');

const root = new protobuf.Root();
root.define('cothority');

const regex = /^.*\.proto$/;

files.walk('src/models', (err, path, dirs, items) => {
  items.forEach(file => {
    console.log(file);
    if (regex.test(file)) {
      root.loadSync(file);
    }
  });

  fs.writeFileSync('src/models/skeleton.js', `export default '${JSON.stringify(root.toJSON())}';`)
});

