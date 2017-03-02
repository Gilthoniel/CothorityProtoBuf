import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const roster = new Type("Roster")
  .add(new Field('id', 1, 'bytes'))
  .add(new Field('list', 2, 'ServerIdentity', 'repeated'))
  .add(new Field('aggregate', 3, 'bytes'));

export default roster;