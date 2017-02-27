import Protobuf from 'protobufjs'

class CothorityProtobuf {
  
  constructor() {
    this.protobuf = Protobuf.load('./models/base.proto');
    this.protobuf
      .then((root) => {
        this.root = root;
      })
      .catch((e) => console.log(e));
  }
  
  wait() {
    return this.protobuf;
  }
  
  encodeMessage(name, fields) {
    // Get the loaded model
    const model = this.getModel(name);
    // Create the message with the model
    const msg = model.create(fields);

    // Encode the message in a BufferArray
    const buffer = model.encode(msg).finish();

    // ArrayBuffer to be able to transmit with a websocket
    return toArrayBuffer(buffer);
  }
  
  decodeMessage(name, arrayBuffer) {
    // ArrayBuffer from the websocket to a Buffer object
    const buffer = toBuffer(arrayBuffer);

    const model = this.getModel(name);
    return model.decode(buffer);
  }
  
  getModel(name) {
    return this.root.lookup(`cothority.${name}`);
  }
}

/**
 * http://stackoverflow.com/questions/8609289/convert-a-binary-nodejs-buffer-to-javascript-arraybuffer
 * @param buf
 * @returns {ArrayBuffer}
 */
function toArrayBuffer(buf) {
  var ab = new ArrayBuffer(buf.length);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) {
    view[i] = buf[i];
  }
  return ab;
}

function toBuffer(ab) {
  var buf = new Buffer(ab.byteLength);
  var view = new Uint8Array(ab);
  for (var i = 0; i < buf.length; ++i) {
    buf[i] = view[i];
  }
  return buf;
}

export default new CothorityProtobuf();
