import protobuf from 'protobufjs'
const {Type, MapField} = protobuf;

const status = new Type('Status')
  .add(new MapField('field', 1, 'string', 'string'));

export default status;