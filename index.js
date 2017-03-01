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
    // Get the loaded model
    const model = this.getModel(name);
    // Create the message with the model
    const msg = model.create(fields);

    // Encode the message in a BufferArray
    return model.encode(msg).finish();
  }
  
  /**
   * Decode a message coming from a websocket
   * @param name
   * @param arrayBuffer
   */
  decodeMessage(name, arrayBuffer) {
    // ArrayBuffer from the websocket to a Buffer object
    const buffer = arrayBuffer;

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
  
  /**
   * http://stackoverflow.com/questions/40031688/javascript-arraybuffer-to-hex
   * @param buffer ArrayBuffer
   * @returns {*|string}
   */
  bufferToHex(buffer) {
    return Array.prototype.map.call(buffer, x => ('00' + x.toString(16)).slice(-2)).join('');
  }
}

export default new CothorityProtobuf();
