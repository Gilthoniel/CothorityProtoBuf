import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const storeConfigReply = new Type("StoreConfigReply")
    .add(new Field('id', 1, 'bytes'));

export default storeConfigReply;