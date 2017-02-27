import CothorityProtobuf from './index'

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
        console.log(encoded);
        const decoded = CothorityProtobuf.decodeMessage('StatusResponse', encoded);

        console.log(decoded);
        expect(decoded.system.status1.field.field1).toBe('success');
      })
      .catch((e) => console.log(e));
  });

});