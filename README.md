# CothorityProtoBuf
Implementation of messages of the Cothority for protobuf protocl

# How to build #

```
npm i
npm i -g gulp
gulp build
```

# How to use #

use the file `dist/cothority-messages.js`. It is an ES6 module so you need to use Babel or an other transpiler. Then
you can simply use
```
import CothorityMessages from './dist/cothority-messages'

CothorityMessages.createSignatureRequest(...);
```