# CothorityProtoBuf
Implementation of messages of the Cothority for protobuf protocl

# How to build #

ES6 compilation
```
npm i
npm i -g rollup
rollup src/index.js --output dist/cothority-messages.js
```

CommonJS compilation
````
npm i
node build.js
````


# How to use #

use the file `dist/cothority-messages.js`. It is an ES6 module so you need to use Babel or an other transpiler. Then
you can simply use
```
import CothorityMessages from './dist/cothority-messages'

CothorityMessages.createSignatureRequest(...);
```

In the case of the CommonJS compilation, you can use it this way
````
var CothorityMessages = require('./dist/bundle.js');

CothorityMessages.createSignatureRequest(...);
````