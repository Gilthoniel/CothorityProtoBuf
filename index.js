import Protobuf from 'protobufjs'

class CothorityProtobuf {
  
  constructor() {
    this.protobuf = Protobuf.load('./models/base.proto');
    this.protobuf
      .then((root) => {
        console.log(root.nested);
        this.root = root;
      })
      .catch((e) => console.log(e));
  }
  
  wait() {
    return this.protobuf;
  }
  
  createMessage(name, fields) {
    const model = this.getModel(name);
    return model.create(fields);
  }
  
  encodeMessage(name, message) {
    const model = this.getModel(name);
    return model.encode(message).finish();
  }
  
  decodeMessage(name, buffer) {
    const model = this.getModel(name);
    return model.decode(buffer);
  }
  
  getModel(name) {
    return this.root.lookup(`cothority.${name}`);
  }
}

export default new CothorityProtobuf();
