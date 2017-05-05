var CothorityProtobuf = (function (protobuf) {
'use strict';

protobuf = 'default' in protobuf ? protobuf['default'] : protobuf;

var skeleton = '{"nested":{"cothority":{},"BlockLink":{"fields":{"Hash":{"rule":"required","type":"bytes","id":1},"Signature":{"rule":"required","type":"bytes","id":2}}},"LatestBlockRequest":{"fields":{"LatestID":{"rule":"required","type":"bytes","id":1}}},"LatestBlockResponse":{"fields":{"Update":{"rule":"repeated","type":"SkipBlock","id":1,"options":{"packed":false}}}},"Roster":{"fields":{"id":{"type":"bytes","id":1},"list":{"rule":"repeated","type":"ServerIdentity","id":2,"options":{"packed":false}},"aggregate":{"type":"bytes","id":3}}},"ServerIdentity":{"fields":{"public":{"rule":"required","type":"bytes","id":1},"id":{"rule":"required","type":"bytes","id":2},"address":{"rule":"required","type":"string","id":3},"description":{"rule":"required","type":"string","id":4}}},"SignatureRequest":{"fields":{"message":{"rule":"required","type":"bytes","id":1},"roster":{"rule":"required","type":"Roster","id":2}}},"SignatureResponse":{"fields":{"hash":{"rule":"required","type":"bytes","id":1},"signature":{"rule":"required","type":"bytes","id":2}}},"SkipBlock":{"fields":{"test":{"type":"sint32","id":1},"Height":{"type":"sint32","id":2},"MaximumHeight":{"type":"sint32","id":3},"BaseHeight":{"type":"sint32","id":4},"BackLinkIDs":{"rule":"repeated","type":"bytes","id":5,"options":{"packed":false}},"VerifierIDs":{"rule":"repeated","type":"bytes","id":6,"options":{"packed":false}},"ParentBlockID":{"type":"bytes","id":7},"GenesisID":{"type":"bytes","id":8},"Data":{"type":"bytes","id":9},"Roster":{"type":"Roster","id":10},"Hash":{"type":"bytes","id":11},"ForwardLink":{"rule":"repeated","type":"BlockLink","id":12,"options":{"packed":false}},"ChildSL":{"type":"bytes","id":13}}},"StatusResponse":{"fields":{"system":{"keyType":"string","type":"Status","id":1},"server":{"type":"ServerIdentity","id":2}},"nested":{"Status":{"fields":{"field":{"keyType":"string","type":"string","id":1}}}}},"StoreSkipBlockRequest":{"fields":{"LatestID":{"rule":"required","type":"bytes","id":1},"NewBlock":{"rule":"required","type":"SkipBlock","id":2}}},"StoreSkipBlockResponse":{"fields":{"Previous":{"rule":"required","type":"SkipBlock","id":1},"Latest":{"rule":"required","type":"SkipBlock","id":2}}}}}';

var Root = protobuf.Root;


var root = Root.fromJSON(JSON.parse(skeleton));

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
      return this.root.lookup('' + name);
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
  }]);
  return CothorityMessages;
}(CothorityProtobuf);

var index = new CothorityMessages();

return index;

}(protobuf));
