import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const proposeUpdate = new Type("ProposeUpdate")
    .add(new Field('id', 1, 'bytes'));

export default proposeUpdate;