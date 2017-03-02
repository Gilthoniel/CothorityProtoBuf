import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const signatureRequest = new Type("SignatureRequest")
  .add(new Field('message', 1, 'bytes'))
  .add(new Field('roster', 2, 'Roster'));

export default signatureRequest;