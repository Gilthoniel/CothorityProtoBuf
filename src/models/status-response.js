import protobuf from 'protobufjs'
const {Type, Field, MapField} = protobuf;

const StatusResponse = new Type('StatusResponse')
  .add(new MapField('system', 1, 'string', 'Status'))
  .add(new Field('server', 2, 'ServerIdentity'));

export default StatusResponse;