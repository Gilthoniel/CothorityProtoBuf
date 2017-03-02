import Protobuf from 'protobufjs'

export default class CothorityProtobuf {
  
  constructor() {
    this.protobuf = Protobuf.load('./models/base.proto');
    this.protobuf
      .then((root) => {
        this.root = root;
      })
      .catch((e) => console.log(e));
  }
  
  /**
   * Can be used to wait for the end of the parsing
   * @returns {undefined|Promise.<Root>|void|Promise<Root>|*}
   */
  wait() {
    return this.protobuf;
  }
  
  /**
   * Encode a model to be transmitted over websocket
   * @param name
   * @param fields
   * @returns {*|Buffer|Uint8Array}
   */
  encodeMessage(name, fields) {
    const model = this.getModel(name);
    
    // Create the message with the model
    const msg = model.create(fields);

    // Encode the message in a BufferArray
    return model.encode(msg).finish();
  }
  
  /**
   * Decode a message coming from a websocket
   * @param name
   * @param buffer
   */
  decodeMessage(name, buffer) {
    const model = this.getModel(name);
    return model.decode(buffer);
  }
  
  /**
   * Return the protobuf loaded model
   * @param name
   * @returns {ReflectionObject|?ReflectionObject|string}
   */
  getModel(name) {
    return this.root.lookup(`cothority.${name}`);
  }
}
