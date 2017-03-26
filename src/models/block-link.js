import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const BlockLink = new Type("BlockLink")
  .add(new Field('Hash', 1, 'bytes'))
  .add(new Field('Signature', 2, 'bytes'));

export default BlockLink;