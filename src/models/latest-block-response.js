import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const LatestBlockResponse = new Type("LatestBlockResponse")
  .add(new Field('Update', 1, 'SkipBlock', 'repeated'));

export default LatestBlockResponse;