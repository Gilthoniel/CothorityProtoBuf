import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const StoreSkipBlockResponse = new Type("StoreSkipBlockResponse")
  .add(new Field('Previous', 1, 'SkipBlock'))
  .add(new Field('Latest', 2, 'SkipBlock'));

export default StoreSkipBlockResponse;