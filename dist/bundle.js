var CothorityProtobuf = (function (protobuf) {
'use strict';

protobuf = 'default' in protobuf ? protobuf['default'] : protobuf;

var Type = protobuf.Type;
var Field = protobuf.Field;
var MapField = protobuf.MapField;


var StatusResponse = new Type('StatusResponse').add(new MapField('system', 1, 'string', 'Status')).add(new Field('server', 2, 'ServerIdentity'));

var Type$1 = protobuf.Type;
var MapField$1 = protobuf.MapField;


var status = new Type$1('Status').add(new MapField$1('field', 1, 'string', 'string'));

var Type$2 = protobuf.Type;
var Field$1 = protobuf.Field;


var serverIdentity = new Type$2('ServerIdentity').add(new Field$1('public', 1, 'bytes')).add(new Field$1('id', 2, 'bytes')).add(new Field$1('address', 3, 'string')).add(new Field$1('description', 4, 'string'));

var Type$3 = protobuf.Type;
var Field$2 = protobuf.Field;


var roster = new Type$3("Roster").add(new Field$2('id', 1, 'bytes')).add(new Field$2('list', 2, 'ServerIdentity', 'repeated')).add(new Field$2('aggregate', 3, 'bytes'));

var Type$4 = protobuf.Type;
var Field$3 = protobuf.Field;


var signatureRequest = new Type$4("SignatureRequest").add(new Field$3('message', 1, 'bytes')).add(new Field$3('roster', 2, 'Roster'));

var Type$5 = protobuf.Type;
var Field$4 = protobuf.Field;


var signatureResponse = new Type$5("SignatureResponse").add(new Field$4('hash', 1, 'bytes', 'required')).add(new Field$4('signature', 2, 'bytes', 'required'));

var Type$6 = protobuf.Type;
var Field$5 = protobuf.Field;


var StoreSkipBlockRequest = new Type$6("StoreSkipBlockRequest").add(new Field$5('LatestID', 1, 'bytes')).add(new Field$5('NewBlock', 2, 'SkipBlock'));

var Type$7 = protobuf.Type;
var Field$6 = protobuf.Field;


var StoreSkipBlockResponse = new Type$7("StoreSkipBlockResponse").add(new Field$6('Previous', 1, 'SkipBlock')).add(new Field$6('Latest', 2, 'SkipBlock'));

var Type$8 = protobuf.Type;
var Field$7 = protobuf.Field;


var LatestBlockRequest = new Type$8("LatestBlockRequest").add(new Field$7('LatestID', 1, 'bytes'));

var Type$9 = protobuf.Type;
var Field$8 = protobuf.Field;


var LatestBlockResponse = new Type$9("LatestBlockResponse").add(new Field$8('Update', 1, 'SkipBlock', 'repeated'));

var Type$10 = protobuf.Type;
var Field$9 = protobuf.Field;


var SkipBlock = new Type$10("SkipBlock").add(new Field$9('Index', 1, 'sint32')).add(new Field$9('Height', 2, 'sint32')).add(new Field$9('MaximumHeight', 3, 'sint32')).add(new Field$9('BaseHeight', 4, 'sint32')).add(new Field$9('BackLinkIDs', 5, 'bytes', 'repeated')).add(new Field$9('VerifierIDs', 6, 'bytes', 'repeated')).add(new Field$9('ParentBlockID', 7, 'bytes')).add(new Field$9('GenesisID', 8, 'bytes')).add(new Field$9('RespPublic', 9, 'bytes', 'repeated')).add(new Field$9('Data', 10, 'bytes')).add(new Field$9('Roster', 11, 'Roster')).add(new Field$9('Hash', 12, 'bytes')).add(new Field$9('ForwardLink', 13, 'BlockLink', 'repeated')).add(new Field$9('ChildSL', 14, 'bytes'));

var Type$11 = protobuf.Type;
var Field$10 = protobuf.Field;


var BlockLink = new Type$11("BlockLink").add(new Field$10('Hash', 1, 'bytes')).add(new Field$10('Signature', 2, 'bytes'));

var Type$12 = protobuf.Type;
var Field$11 = protobuf.Field;


var pinRequest = new Type$12("PinRequest").add(new Field$11('pin', 1, 'string')).add(new Field$11('public', 2, 'bytes'));

var Type$13 = protobuf.Type;
var Field$12 = protobuf.Field;


var storeConfig = new Type$13("StoreConfig").add(new Field$12('desc', 1, 'popDesc'));

var Type$14 = protobuf.Type;
var Field$13 = protobuf.Field;


var storeConfigReply = new Type$14("StoreConfigReply").add(new Field$13('id', 1, 'bytes'));

var Type$15 = protobuf.Type;
var Field$14 = protobuf.Field;


var finalizeRequest = new Type$15("FinalizeRequest").add(new Field$14('descId', 1, 'bytes')).add(new Field$14('attendees', 2, 'bytes'));

var Type$16 = protobuf.Type;
var Field$15 = protobuf.Field;


var finalizeResponse = new Type$16("FinalizeResponse").add(new Field$15('final', 1, 'finalStatement'));

var Type$17 = protobuf.Type;
var Field$16 = protobuf.Field;


var popDesc = new Type$17("PopDesc").add(new Field$16('name', 1, 'string')).add(new Field$16('dateTime', 2, 'string')).add(new Field$16('location', 3, 'string')).add(new Field$16('roster', 4, 'Roster'));

var Type$18 = protobuf.Type;
var Field$17 = protobuf.Field;


var finalStatement = new Type$18("FinalStatement").add(new Field$17('desc', 1, 'popDesc')).add(new Field$17('attendees', 2, 'bytes')).add(new Field$17('signature', 3, 'bytes'));

var Type$19 = protobuf.Type;
var Field$18 = protobuf.Field;
var MapField$2 = protobuf.MapField;


var config = new Type$19("Config").add(new Field$18('Threshold', 1, 'sint32')).add(new MapField$2('Device', 2, 'string', 'Device')).add(new MapField$2('Data', 3, 'string', 'string'));

var Type$20 = protobuf.Type;
var Field$19 = protobuf.Field;


var configUpdate = new Type$20("ConfigUpdate").add(new Field$19('id', 1, 'bytes'));

var Type$21 = protobuf.Type;
var Field$20 = protobuf.Field;


var configUpdateReply = new Type$21("ConfigUpdateReply").add(new Field$20('config', 1, 'Config'));

var Type$22 = protobuf.Type;
var Field$21 = protobuf.Field;


var proposeSend = new Type$22("ProposeSend").add(new Field$21('id', 1, 'bytes')).add(new Field$21('config', 2, 'Config', 'repeated'));

var Type$23 = protobuf.Type;
var Field$22 = protobuf.Field;


var device = new Type$23("Device").add(new Field$22('point', 1, 'bytes'));

var Root = protobuf.Root;


var root = new Root();
root.define("cothority").add(SkipBlock).add(serverIdentity).add(roster).add(BlockLink).add(LatestBlockRequest).add(LatestBlockResponse).add(StoreSkipBlockRequest).add(StoreSkipBlockResponse).add(status).add(StatusResponse).add(signatureRequest).add(signatureResponse).add(pinRequest).add(storeConfig).add(storeConfigReply).add(finalizeRequest).add(finalizeResponse).add(popDesc).add(finalStatement).add(device).add(config).add(configUpdate).add(configUpdateReply).add(proposeSend);

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();









var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var CothorityProtobuf = function () {
  function CothorityProtobuf() {
    classCallCheck(this, CothorityProtobuf);

    this.root = root;
  }

  /**
   * Encode a model to be transmitted over websocket
   * @param name
   * @param fields
   * @returns {*|Buffer|Uint8Array}
   */


  createClass(CothorityProtobuf, [{
    key: 'encodeMessage',
    value: function encodeMessage(name, fields) {
      var model = this.getModel(name);

      // Create the message with the model
      var msg = model.create(fields);

      // Encode the message in a BufferArray
      return model.encode(msg).finish();
    }

    /**
     * Decode a message coming from a websocket
     * @param name
     * @param buffer
     */

  }, {
    key: 'decodeMessage',
    value: function decodeMessage(name, buffer) {
      var model = this.getModel(name);
      return model.decode(buffer);
    }

    /**
     * Return the protobuf loaded model
     * @param name
     * @returns {ReflectionObject|?ReflectionObject|string}
     */

  }, {
    key: 'getModel',
    value: function getModel(name) {
      return this.root.lookup('cothority.' + name);
    }
  }]);
  return CothorityProtobuf;
}();

var CothorityMessages = function (_CothorityProtobuf) {
  inherits(CothorityMessages, _CothorityProtobuf);

  function CothorityMessages() {
    classCallCheck(this, CothorityMessages);
    return possibleConstructorReturn(this, (CothorityMessages.__proto__ || Object.getPrototypeOf(CothorityMessages)).apply(this, arguments));
  }

  createClass(CothorityMessages, [{
    key: 'createSignatureRequest',


    /**
     * Create an encoded message to make a sign request to a cothority node
     * @param message to sign stored in a Uint8Array
     * @param servers list of ServerIdentity
     * @returns {*|Buffer|Uint8Array}
     */
    value: function createSignatureRequest(message, servers) {
      if (!(message instanceof Uint8Array)) {
        throw new Error("message must be a instance of Uint8Array");
      }

      var fields = {
        message: message,
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

  }, {
    key: 'decodeSignatureResponse',
    value: function decodeSignatureResponse(response) {
      response = new Uint8Array(response);

      return this.decodeMessage('SignatureResponse', response);
    }

    /**
     * Return the decoded response
     * @param response
     * @returns {*}
     */

  }, {
    key: 'decodeStatusResponse',
    value: function decodeStatusResponse(response) {
      response = new Uint8Array(response);

      return this.decodeMessage('StatusResponse', response);
    }

    /**
     * Create an encoded message to make a PinRequest to a cothority node
     * @param pin previously generated by the conode
     * @param publicKey
     * @returns {*|Buffer|Uint8Array}
     */

  }, {
    key: 'createPinRequest',
    value: function createPinRequest(pin, publicKey) {
      var fields = {
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

  }, {
    key: 'createStoreConfig',
    value: function createStoreConfig(name, date, location, id, servers, aggregate) {
      var fields = {
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

  }, {
    key: 'deccdeStoreConfigReply',
    value: function deccdeStoreConfigReply(response) {
      response = new Uint8Array(response);

      return this.decodeMessage('StoreConfigReply', response);
    }

    /**
     * Create an encoded message to finalize on the given descid-popconfig
     * @param descId
     * @param attendees
     * @returns {*|Buffer|Uint8Array}
     */

  }, {
    key: 'createFinalizeRequest',
    value: function createFinalizeRequest(descId, attendees) {
      var fields = {
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

  }, {
    key: 'decodeFinalizeResponse',
    value: function decodeFinalizeResponse(response) {
      response = new Uint8Array(response);

      return this.decodeMessage('FinalizeResponse', response);
    }
  }, {
    key: 'createStoreSkipBlockRequest',
    value: function createStoreSkipBlockRequest(id, servers) {
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
  }, {
    key: 'decodeStoreSkipBlockResponse',
    value: function decodeStoreSkipBlockResponse(response) {
      response = new Uint8Array(response);

      return this.decodeMessage('StoreSkipBlockResponse', response);
    }
  }, {
    key: 'createLatestBlockRequest',
    value: function createLatestBlockRequest(id) {
      if (!(id instanceof Uint8Array)) {
        throw new Error("message must be a instance of Uint8Array");
      }

      return this.encodeMessage('LatestBlockRequest', {
        LatestID: id
      });
    }
  }, {
    key: 'decodeLatestBlockResponse',
    value: function decodeLatestBlockResponse(response) {
      response = new Uint8Array(response);

      return this.decodeMessage('LatestBlockResponse', response);
    }
  }, {
    key: 'createConfigUpdate',
    value: function createConfigUpdate(id) {
      var fields = {
        id: id
      };

      return this.encodeMessage('ConfigUpdate', fields);
    }
  }, {
    key: 'createDevice',
    value: function createDevice(key) {

      var model = this.getModel('Device');

      var fields = {
        point: key
      };

      return model.create(fields);
    }
  }, {
    key: 'decodeConfigUpdateReply',
    value: function decodeConfigUpdateReply(response) {
      response = new Uint8Array(response);

      return this.decodeMessage('ConfigUpdateReply', response);
    }
  }, {
    key: 'createProposeSend',
    value: function createProposeSend(id, config) {
      var fields = {
        id: id,
        config: {
          Threshold: config.Threshold,
          Device: config.Device,
          Data: config.Data
        }
      };

      return this.encodeMessage('ProposeSend', fields);
    }
  }]);
  return CothorityMessages;
}(CothorityProtobuf);

var index = new CothorityMessages();

return index;

}(protobuf));
