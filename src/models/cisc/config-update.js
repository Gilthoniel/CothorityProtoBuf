import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const configUpdate = new Type("ConfigUpdate")
    .add(new Field('id', 1, 'bytes'));


export default configUpdate;