import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const SkipBlock = new Type("SkipBlock")
  .add(new Field('Index', 1, 'sint32'))
  .add(new Field('Height', 2, 'sint32'))
  .add(new Field('MaximumHeight', 3, 'sint32'))
  .add(new Field('BaseHeight', 4, 'sint32'))
  .add(new Field('BackLinkIDs', 5, 'bytes', 'repeated'))
  .add(new Field('VerifierIDs', 6, 'bytes', 'repeated'))
  .add(new Field('ParentBlockID', 7, 'bytes'))
  .add(new Field('GenesisID', 8, 'bytes'))
  .add(new Field('RespPublic', 9, 'bytes', 'repeated'))
  .add(new Field('Data', 10, 'bytes'))
  .add(new Field('Roster', 11, 'Roster'))
  .add(new Field('Hash', 12, 'bytes'))
  .add(new Field('ForwardLink', 13, 'BlockLink', 'repeated'))
  .add(new Field('ChildSL', 14, 'bytes'));

export default SkipBlock;