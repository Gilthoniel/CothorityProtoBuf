import protobuf from 'protobufjs';

var skeleton = '{"nested":{"cothority":{},"BlockLink":{"fields":{"Hash":{"rule":"required","type":"bytes","id":1},"Signature":{"rule":"required","type":"bytes","id":2}}},"LatestBlockRequest":{"fields":{"LatestID":{"rule":"required","type":"bytes","id":1}}},"LatestBlockResponse":{"fields":{"Update":{"rule":"repeated","type":"SkipBlock","id":1,"options":{"packed":false}}}},"RandomRequest":{"fields":{}},"RandomResponse":{"fields":{"R":{"rule":"required","type":"bytes","id":1},"T":{"rule":"required","type":"Transcript","id":2}},"nested":{"Transcript":{"fields":{"nodes":{"rule":"required","type":"sint32","id":1},"groups":{"rule":"required","type":"sint32","id":2},"purpose":{"rule":"required","type":"string","id":3},"time":{"rule":"required","type":"fixed64","id":4}}}}},"google":{"nested":{"protobuf":{"nested":{"Timestamp":{"fields":{"seconds":{"type":"int64","id":1},"nanos":{"type":"int32","id":2}}}}}}},"Roster":{"fields":{"id":{"type":"bytes","id":1},"list":{"rule":"repeated","type":"ServerIdentity","id":2,"options":{"packed":false}},"aggregate":{"type":"bytes","id":3}}},"ServerIdentity":{"fields":{"public":{"rule":"required","type":"bytes","id":1},"id":{"rule":"required","type":"bytes","id":2},"address":{"rule":"required","type":"string","id":3},"description":{"rule":"required","type":"string","id":4}}},"SignatureRequest":{"fields":{"message":{"rule":"required","type":"bytes","id":1},"roster":{"rule":"required","type":"Roster","id":2}}},"SignatureResponse":{"fields":{"hash":{"rule":"required","type":"bytes","id":1},"signature":{"rule":"required","type":"bytes","id":2}}},"SkipBlock":{"fields":{"Index":{"type":"sint32","id":1},"Height":{"type":"sint32","id":2},"MaximumHeight":{"type":"sint32","id":3},"BaseHeight":{"type":"sint32","id":4},"BackLinkIDs":{"rule":"repeated","type":"bytes","id":5,"options":{"packed":false}},"VerifierIDs":{"rule":"repeated","type":"bytes","id":6,"options":{"packed":false}},"ParentBlockID":{"type":"bytes","id":7},"GenesisID":{"type":"bytes","id":8},"Data":{"type":"bytes","id":9},"Roster":{"type":"Roster","id":10},"Hash":{"type":"bytes","id":11},"ForwardLink":{"rule":"repeated","type":"BlockLink","id":12,"options":{"packed":false}},"ChildSL":{"type":"bytes","id":13}}},"StatusResponse":{"fields":{"system":{"keyType":"string","type":"Status","id":1},"server":{"type":"ServerIdentity","id":2}},"nested":{"Status":{"fields":{"field":{"keyType":"string","type":"string","id":1}}}}},"StoreSkipBlockRequest":{"fields":{"LatestID":{"rule":"required","type":"bytes","id":1},"NewBlock":{"rule":"required","type":"SkipBlock","id":2}}},"StoreSkipBlockResponse":{"fields":{"Previous":{"rule":"required","type":"SkipBlock","id":1},"Latest":{"rule":"required","type":"SkipBlock","id":2}}},"ConfigUpdateReply":{"fields":{"config":{"type":"Config","id":1}}},"ConfigUpdate":{"fields":{"id":{"type":"bytes","id":1}}},"Config":{"fields":{"threshold":{"type":"sint32","id":1},"device":{"keyType":"string","type":"Device","id":2},"data":{"keyType":"string","type":"string","id":3}}},"Device":{"fields":{"point":{"type":"bytes","id":1}}},"ProposeSend":{"fields":{"id":{"type":"bytes","id":1},"config":{"type":"Config","id":2}}},"ProposeUpdateReply":{"fields":{"propose":{"type":"Config","id":1}}},"ProposeUpdate":{"fields":{"id":{"type":"bytes","id":1}}},"ProposeVote":{"fields":{"id":{"type":"bytes","id":1},"signer":{"type":"string","id":2},"signature":{"type":"SchnorrSig","id":3}}},"SchnorrSig":{"fields":{"challenge":{"type":"bytes","id":1},"response":{"type":"bytes","id":2}}},"FinalStatement":{"fields":{"desc":{"type":"PopDesc","id":1},"attendees":{"type":"bytes","id":2},"signature":{"type":"bytes","id":3}}},"FinalizeRequest":{"fields":{"descId":{"type":"bytes","id":1},"attendees":{"type":"bytes","id":2}}},"FinalizeResponse":{"fields":{"final":{"type":"FinalStatement","id":1}}},"PinRequest":{"fields":{"pin":{"type":"string","id":1},"public":{"type":"bytes","id":2}}},"PopDesc":{"fields":{"name":{"type":"string","id":1},"dateTime":{"type":"string","id":2},"location":{"type":"string","id":3},"roster":{"type":"Roster","id":4}}},"StoreConfigReply":{"fields":{"id":{"type":"bytes","id":1}}},"StoreConfig":{"fields":{"desc":{"type":"PopDesc","id":1}}}}}';

const {Root} = protobuf;

/**
 * As we need to create a bundle, we cannot use the *.proto files and the a script will wrap
 * them in a skeleton file that contains the JSON representation that can be used in the js code
 */
var Root$1 = Root.fromJSON(JSON.parse(skeleton));

/**
 * Base class for the protobuf library that provides helpers to encode and decode
 * messages according to a given model
 *
 * @author Gaylor Bosson (gaylor.bosson@epfl.ch)
 */
class CothorityProtobuf {

  /**
   * @constructor
   */
  constructor() {
    this.root = Root$1;
  }
  
  /**
   * Encode a model to be transmitted over websocket
   * @param {String} name
   * @param {Object} fields
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
   * @param {String} name
   * @param {*|Buffer|Uint8Array} buffer
   */
  decodeMessage(name, buffer) {
    const model = this.getModel(name);
    return model.decode(buffer);
  }
  
  /**
   * Return the protobuf loaded model
   * @param {String} name
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
   * @param {Uint8Array} message - Message to sign stored in a Uint8Array
   * @param {Array} servers - list of ServerIdentity
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
   * Return the decoded response of a signature request
   * @param {*|Buffer|Uint8Array} response - Response of the Cothority
   * @returns {Object}
   */
  decodeSignatureResponse(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('SignatureResponse', response);
  }

  /**
   * Return the decoded response of a status request
   * @param {*|Buffer|Uint8Array} response - Response of the Cothority
   * @returns {*}
   */
  decodeStatusResponse(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('StatusResponse', response);
  }

  /**
   * Create a message to store a new block
   * @param {Uint8Array} id - ID of the current latest block
   * @param {Array} servers - list of ServerIdentity
   * @returns {*|Buffer|Uint8Array}
   */
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

  /**
   * Return the decoded message of a store skip block request
   * @param {*|Buffer|Uint8Array} response - Response of the Cothority
   * @returns {*}
   */
  decodeStoreSkipBlockResponse(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('StoreSkipBlockResponse', response);
  }

  /**
   * Create a message request to get the latest blocks of a skip-chain
   * @param {Uint8Array} id - ID of the genesis block of the skip-chain
   * @returns {*|Buffer|Uint8Array}
   */
  createLatestBlockRequest(id) {
    if (!(id instanceof Uint8Array)) {
      throw new Error("message must be a instance of Uint8Array");
    }

    return this.encodeMessage('LatestBlockRequest', {
      LatestID: id
    });
  }

  /**
   * Return the decoded message of a latest block request
   * @param {*|Buffer|Uint8Array} response - Response of the Cothority
   * @returns {*}
   */
  decodeLatestBlockResponse(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('LatestBlockResponse', response);
  }

  /**
   * Create a message request to get a random number
   * @returns {*|Buffer|Uint8Array}
   */
  createRandomMessage() {
    return this.encodeMessage('RandomRequest');
  }

  /**
   * Return the decoded message of a random number request
   * @param {*|Buffer|Uint8Array} response - Response of the Cothority
   * @returns {*}
   */
  decodeRandomResponse(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('RandomResponse', response);
  }

  /**
   * Create an encoded message to make a PinRequest to a cothority node
   * @param pin previously generated by the conode
   * @param publicKey
   * @returns {*|Buffer|Uint8Array}
   */
  createPinRequest(pin, publicKey) {
    const fields = {
      pin: pin,
      public: publicKey
    };

    return this.encodeMessage('PinRequest', fields);
  }

  /**
   * Create an encoded message to store configuration information of a given PoP party
   * @param name
   * @param date
   * @param location
   * @param id
   * @param servers
   * @param aggregate
   * @returns {*|Buffer|Uint8Array}
   */
  createStoreConfig(name, date, location, id, servers, aggregate) {
    const fields = {
      desc: {
        name: name,
        dateTime: date,
        location: location,
        roster: {
          id: id,
          list: servers,
          aggregate: aggregate
        }
      }
    };

    return this.encodeMessage('StoreConfig', fields);
  }

  /**
   * Return the decoded response
   * @param response
   * @returns {*}
   */
  deccdeStoreConfigReply(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('StoreConfigReply', response);
  }

  /**
   * Create an encoded message to finalize on the given descid-popconfig
   * @param descId
   * @param attendees
   * @returns {*|Buffer|Uint8Array}
   */
  createFinalizeRequest(descId, attendees) {
    const fields = {
      descId: descId,
      attendees: attendees
    };

    return this.encodeMessage('FinalizeRequest', fields);
  }

  /**
   * Return the decoded response
   * @param response
   * @returns {*}
   */
  decodeFinalizeResponse(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('FinalizeResponse', response);
  }

  /**
   * Create a message request to get the config of a given conode
   * @param id
   * @returns {*|Buffer|Uint8Array}
   */
  createConfigUpdate(id) {
    const fields = {
      id: id
    };

    return this.encodeMessage('ConfigUpdate', fields);
  }

  /**
   * Return the decoded message of a config update
   * @param response
   * @returns {*}
   */
  decodeConfigUpdateReply(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('ConfigUpdateReply', response);
  }

  /**
   * Create a device structure, that may be added to a config
   * @param key
   * @returns {fields}
   */
  createDevice(key) {

    const model = this.getModel('Device');

    const fields = {
      point: key
    };

    return model.create(fields);
  }

  /**
   * Create a message request to propose an update to a config
   * @param id
   * @param config
   * @returns {*|Buffer|Uint8Array}
   */
  createProposeSend(id, config) {
    const fields = {
      id: id,
      config: {
        threshold: config.threshold,
        device: config.device,
        data: config.data
      }
    };

    return this.encodeMessage('ProposeSend', fields);
  }

  /**
   * Create a message request to get the current config update propositions
   * @param id
   * @returns {*|Buffer|Uint8Array}
   */
  createProposeUpdate(id) {
    const fields = {
      id: id
    };

    return this.encodeMessage('ProposeUpdate', fields);
  }

  /**
   * Return the decoded message of a propose update
   * @param response
   * @returns {*}
   */
  decodeProposeUpdateReply(response) {
    response = new Uint8Array(response);

    return this.decodeMessage('ProposeUpdateReply', response);
  }

  /**
   * Create a message request to vote an update to a config
   * @param id
   * @param signer
   * @param challenge
   * @param response
   * @returns {*|Buffer|Uint8Array}
   */
  createProposeVote(id, signer, challenge, response) {
    const fields = {
      id: id,
      signer: signer,
        signature: {
          challenge: challenge,
          response: response
        }
    };

    return this.encodeMessage('ProposeVote', fields);
  }
}

/**
 * Singleton
 */
var index = new CothorityMessages();

export default index;
