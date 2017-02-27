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
    return model.encode(msg).finish();
  }
  
  decodeMessage(name, arrayBuffer) {
    // ArrayBuffer from the websocket to a Buffer object
    const buffer = arrayBuffer;

    const model = this.getModel(name);
    return model.decode(buffer);
  }
  
  getModel(name) {
    return this.root.lookup(`cothority.${name}`);
  }
}

export default new CothorityProtobuf();
