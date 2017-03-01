import CothorityProtobuf from './index'

const mockStatusResponses = [{
  base64: "CpsCCgZTdGF0dXMSkAIKOgoSQXZhaWxhYmxlX1NlcnZpY2VzEiRDb1NpLEd1YXJkLElkZW50aXR5LFNraXBjaGFpbixTdGF0dXMKFAoIVFh" +
  "fYnl0ZXMSCDMwMTc5NDQ3ChQKCFJYX2J5dGVzEgg0MjU5NTczNwoNCgRQb3J0EgU2MjMwNgofCgtEZXNjcmlwdGlvbhIQRGFlaW5hcidzIENvbm9" +
  "kZQoPCghDb25uVHlwZRIDdGNwCg4KB1ZlcnNpb24SAzEuMAodCgZTeXN0ZW0SE2xpbnV4L2FtZDY0L2dvMS43LjQKFgoESG9zdBIOOTUuMTQzLj" +
  "E3Mi4yNDEKHgoGVXB0aW1lEhQ0MTRoMzhtMzcuNjQxMjkzNTM1cxJiCiBYit3B+9nEA4aODQrCAD58dTjQqRVPvbPPdygi8OvIJxIQvtA5xn6rW" +
  "O2N/6E3NV3DfhoadGNwOi8vOTUuMTQzLjE3Mi4yNDE6NjIzMDYiEERhZWluYXIncyBDb25vZGU=",
  description: "Daeinar's Conode",
  public: "588addc1fbd9c403868e0d0ac2003e7c7538d0a9154fbdb3cf772822f0ebc827"
}];

describe('Protobuf', () => {

  it('should encode and decode correctly', () => {
    CothorityProtobuf.wait()
      .then(() => {
        const encoded = CothorityProtobuf.encodeMessage('StatusResponse', {
          system: {
            status1: {
              field: {
                field1: 'success'
              }
            }
          }
        });

        const decoded = CothorityProtobuf.decodeMessage('StatusResponse', encoded);

        expect(decoded.system.status1.field.field1).toBe('success');
      })
      .catch((e) => console.log(e));
  });

  it('should decode a status response correctly', () => {
    CothorityProtobuf.wait().then(() => {
      mockStatusResponses.forEach((mock) => {
        const buffer = Uint8Array.from(atob(mock.base64), c => c.charCodeAt(0));

        const response = CothorityProtobuf.decodeMessage('StatusResponse', buffer);

        expect(response.system).toBeDefined();
        expect(response.system.Status.field).toBeDefined();
        expect(response.system.Status.field.Description).toBe(mock.description);

        const pub = CothorityProtobuf.bufferToHex(response.server.public);
        expect(pub).toBe(mock.public);
      });
    });
  });

});
