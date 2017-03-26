import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const LatestBlockRequest = new Type("LatestBlockRequest")
  .add(new Field('LatestID', 1, 'bytes'));

export default LatestBlockRequest;