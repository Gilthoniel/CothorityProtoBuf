import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const pinRequest = new Type("PinRequest")
    .add(new Field('pin', 1, 'string'))
    .add(new Field('public', 2, 'bytes'));

export default pinRequest;