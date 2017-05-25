import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const schnorrSig = new Type("SchnorrSig")
    .add(new Field('challenge', 1, 'bytes'))
    .add(new Field('response', 2, 'bytes'));

export default schnorrSig;
