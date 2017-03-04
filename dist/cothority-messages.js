import protobuf from 'protobufjs';

const {Type, Field, MapField} = protobuf;

const StatusResponse = new Type('StatusResponse')
  .add(new MapField('system', 1, 'string', 'Status'))
  .add(new Field('server', 2, 'ServerIdentity'));

const {Type: Type$1, MapField: MapField$1} = protobuf;

const status = new Type$1('Status')
  .add(new MapField$1('field', 1, 'string', 'string'));

const {Type: Type$2, Field: Field$1} = protobuf;

const serverIdentity = new Type$2('ServerIdentity')
  .add(new Field$1('public', 1, 'bytes'))
  .add(new Field$1('id', 2, 'bytes'))
  .add(new Field$1('address', 3, 'string'))
  .add(new Field$1('description', 4, 'string'));

const {Type: Type$3, Field: Field$2} = protobuf;

const roster = new Type$3("Roster")
  .add(new Field$2('id', 1, 'bytes'))
  .add(new Field$2('list', 2, 'ServerIdentity', 'repeated'))
  .add(new Field$2('aggregate', 3, 'bytes'));

const {Type: Type$4, Field: Field$3} = protobuf;

const signatureRequest = new Type$4("SignatureRequest")
  .add(new Field$3('message', 1, 'bytes'))
  .add(new Field$3('roster', 2, 'Roster'));

const {Type: Type$5, Field: Field$4} = protobuf;

const signatureResponse = new Type$5("SignatureResponse")
  .add(new Field$4('hash', 1, 'bytes', 'required'))
  .add(new Field$4('signature', 2, 'bytes', 'required'));

const {Root} = protobuf;

const root = new Root();
root.define("cothority")
  .add(status)
  .add(serverIdentity)
  .add(StatusResponse)
  .add(roster)
  .add(signatureRequest)
  .add(signatureResponse);

class CothorityProtobuf {
  
  constructor() {
    this.root = root;
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

class CothorityMessages extends CothorityProtobuf {
  
  /**
   * Create an encoded message to make a sign request to a cothority node
   * @param message to sign stored in a Uint8Array
   * @param servers list of ServerIdentity
   * @returns {*|Buffer|Uint8Array}
   */
  createSignatureRequest(message, servers) {
    if (!(message instanceof Uint8Array)) {
      throw new Error("message must be a instance of Uint8Array");
    }
    
    const fields = {
      message,
      roster: {
        list: servers
      }
    };
    
    return this.encodeMessage('SignatureRequest', fields);
  }
  
  /**
   * Return the decoded response
   * @param response
   * @returns {*}
   */
  decodeSignatureResponse(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('SignatureResponse', response);
  }
  
  /**
   * Return the decoded response
   * @param response
   * @returns {*}
   */
  decodeStatusResponse(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('StatusResponse', response);
  }
  
}

var index = new CothorityMessages();

export default index;
