import protobuf from 'protobufjs';

var skeleton = '{"nested":{"cothority":{},"BlockLink":{"fields":{"Hash":{"rule":"required","type":"bytes","id":1},"Signature":{"rule":"required","type":"bytes","id":2}}},"LatestBlockRequest":{"fields":{"LatestID":{"rule":"required","type":"bytes","id":1}}},"LatestBlockResponse":{"fields":{"Update":{"rule":"repeated","type":"SkipBlock","id":1,"options":{"packed":false}}}},"RandomRequest":{"fields":{}},"RandomResponse":{"fields":{"R":{"rule":"required","type":"bytes","id":1},"T":{"rule":"required","type":"Transcript","id":2}},"nested":{"Transcript":{"fields":{"nodes":{"rule":"required","type":"sint32","id":1},"groups":{"rule":"required","type":"sint32","id":2},"purpose":{"rule":"required","type":"string","id":3},"time":{"rule":"required","type":"fixed64","id":4}}}}},"google":{"nested":{"protobuf":{"nested":{"Timestamp":{"fields":{"seconds":{"type":"int64","id":1},"nanos":{"type":"int32","id":2}}}}}}},"Roster":{"fields":{"id":{"type":"bytes","id":1},"list":{"rule":"repeated","type":"ServerIdentity","id":2,"options":{"packed":false}},"aggregate":{"type":"bytes","id":3}}},"ServerIdentity":{"fields":{"public":{"rule":"required","type":"bytes","id":1},"id":{"rule":"required","type":"bytes","id":2},"address":{"rule":"required","type":"string","id":3},"description":{"rule":"required","type":"string","id":4}}},"SignatureRequest":{"fields":{"message":{"rule":"required","type":"bytes","id":1},"roster":{"rule":"required","type":"Roster","id":2}}},"SignatureResponse":{"fields":{"hash":{"rule":"required","type":"bytes","id":1},"signature":{"rule":"required","type":"bytes","id":2}}},"SkipBlock":{"fields":{"Index":{"type":"sint32","id":1},"Height":{"type":"sint32","id":2},"MaximumHeight":{"type":"sint32","id":3},"BaseHeight":{"type":"sint32","id":4},"BackLinkIDs":{"rule":"repeated","type":"bytes","id":5,"options":{"packed":false}},"VerifierIDs":{"rule":"repeated","type":"bytes","id":6,"options":{"packed":false}},"ParentBlockID":{"type":"bytes","id":7},"GenesisID":{"type":"bytes","id":8},"Data":{"type":"bytes","id":9},"Roster":{"type":"Roster","id":10},"Hash":{"type":"bytes","id":11},"ForwardLink":{"rule":"repeated","type":"BlockLink","id":12,"options":{"packed":false}},"ChildSL":{"type":"bytes","id":13}}},"StatusResponse":{"fields":{"system":{"keyType":"string","type":"Status","id":1},"server":{"type":"ServerIdentity","id":2}},"nested":{"Status":{"fields":{"field":{"keyType":"string","type":"string","id":1}}}}},"StoreSkipBlockRequest":{"fields":{"LatestID":{"rule":"required","type":"bytes","id":1},"NewBlock":{"rule":"required","type":"SkipBlock","id":2}}},"StoreSkipBlockResponse":{"fields":{"Previous":{"rule":"required","type":"SkipBlock","id":1},"Latest":{"rule":"required","type":"SkipBlock","id":2}}}}}';

const {Root} = protobuf;

const root = Root.fromJSON(JSON.parse(skeleton));

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
    return this.root.lookup(`${name}`);
  }
}

/**
 * Helpers to encode and decode messages of the Cothority
 *
 * @author Gaylor Bosson (gaylor.bosson@epfl.ch)
 */
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

  createStoreSkipBlockRequest(id, servers) {
    if (!(id instanceof Uint8Array)) {
      throw new Error("message must be a instance of Uint8Array");
    }

    return this.encodeMessage('StoreSkipBlockRequest', {
      LatestID: id,
      NewBlock: {
        MaximumHeight: 1,
        BaseHeight: 1,
        Data: new Uint8Array([]),
        Roster: {
          list: servers
        }
      }
    });
  }

  decodeStoreSkipBlockResponse(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('StoreSkipBlockResponse', response);
  }

  createLatestBlockRequest(id) {
    if (!(id instanceof Uint8Array)) {
      throw new Error("message must be a instance of Uint8Array");
    }

    return this.encodeMessage('LatestBlockRequest', {
      LatestID: id
    });
  }

  decodeLatestBlockResponse(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('LatestBlockResponse', response);
  }

  createRandomMessage() {
    return this.encodeMessage('RandomRequest');
  }

  decodeRandomResponse(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('RandomResponse', response);
  }
  
}

var index = new CothorityMessages();

export default index;
