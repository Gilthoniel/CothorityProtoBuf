import CothorityProtobuf from './index'

describe('Protobuf', () => {
  
  it('should encode and decode correctly', () => {
    CothorityProtobuf.wait().then(() => {
      const response = CothorityProtobuf.createMessage('StatusResponse', {
        system: {
          status1: {
            field: {
              field1: 'success'
            }
          }
        }
      });
      
      const encoded = CothorityProtobuf.encodeMessage('StatusResponse', response);
      const decoded = CothorityProtobuf.decodeMessage('StatusResponse', encoded);
      
      expect(decoded.system.status1.field.field1).toBe('success');
    });
  });
  
});