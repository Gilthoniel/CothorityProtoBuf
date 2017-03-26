import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const StoreSkipBlockRequest = new Type("StoreSkipBlockRequest")
  .add(new Field('LatestID', 1, 'bytes'))
  .add(new Field('NewBlock', 2, 'SkipBlock'));

export default StoreSkipBlockRequest;