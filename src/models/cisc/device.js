import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const device = new Type("Device")
    .add(new Field('point', 1, 'bytes'));


export default device;