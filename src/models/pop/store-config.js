import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const storeConfig = new Type("StoreConfig")
    .add(new Field('desc', 1, 'popDesc'));

export default storeConfig;