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

const mockSignatureRequest = [{
  base64: "CiCAHxMpFWVDC2nQwYfKiXWtrOGwZRS0Aw9T/ZOkwK3ZwxLbBBJeCiDl4j5YU5oJ0yEdj6D7NHXUhlXgwG2D6TyObn0WqofBBhIQsgjTBrNHUfy7s9TpyGWI2RoXdGNwOi8vNzguNDYuMjI3LjYwOjc3NzAiD0luZWl0aSdzIHNlcnZlchJgCiADa/MW4epufpngu3E0GdFsC2eUv53EQsxM82w/k16TzxIQTHNdO8NjVVacTB09sXZd2hoXdGNwOi8vMTkyLjMzLjIxMC44Ojc3NzAiEUVQRkwvREVESVMgQ29ub2RlEm0KIJtU/fuzkTjwpFoI4XIatOslfg8kbJOichVNZRRUdWKQEhBmIqzF2XJbV4rFG+PINEI9Ghl0Y3A6Ly8xODUuMjYuMTU2LjQwOjYxMTE2IhxJc21haWwncyBjb25vZGUgKEB1YmVyc3BhY2UpEmsKIFLGp3x1bOXzvvNBQAbEVVautwhMDz5EZ90nEHknkSxREhAngVp8695Tmb7jB/s9xVgpGhd0Y3A6Ly81LjEzNS4xNjEuOTE6MjAwMCIcTmlra29sYXNnJ3Mgc2VydmVyIGNvdGhvcml0eRJXCiCC6GTQYjDaoukKGsJOxzi82eVFhnfnXx5kqbUUpxHWMBIQXO27l7XxWpuQkfy390DhRhoXdGNwOi8vODMuMjEyLjgyLjIzOjY3ODkiCExlZnRlcmlzEmIKIFiK3cH72cQDho4NCsIAPnx1ONCpFU+9s893KCLw68gnEhC+0DnGfqtY7Y3/oTc1XcN+Ghp0Y3A6Ly85NS4xNDMuMTcyLjI0MTo2MjMwNiIQRGFlaW5hcidzIENvbm9kZQ==",
  roster: 6,
  message: '801f13291565430b69d0c187ca8975adace1b06514b4030f53fd93a4c0add9c3'
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
    expect.assertions(mockStatusResponses.length * 5);
    
    return CothorityProtobuf.wait().then(() => {
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
  
  it('should decode a signature request correctly', () => {
    expect.assertions(2);
    
    return CothorityProtobuf.wait().then(() => {
      mockSignatureRequest.forEach((mock) => {
        const buffer = Uint8Array.from(atob(mock.base64), c => c.charCodeAt(0));
        const response = CothorityProtobuf.decodeMessage('SignatureRequest', buffer);
        
        expect(response.roster.list.length).toBe(mock.roster);
        expect(CothorityProtobuf.bufferToHex(response.message)).toBe(mock.message);
      });
    });
  });

});
