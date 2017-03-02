import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const serverIdentity = new Type('ServerIdentity')
  .add(new Field('public', 1, 'bytes'))
  .add(new Field('id', 2, 'bytes'))
  .add(new Field('address', 3, 'string'))
  .add(new Field('description', 4, 'string'));

export default serverIdentity;