import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const proposeVote = new Type("ProposeVote")
    .add(new Field('id', 1, 'bytes'))
    .add(new Field('signer', 2, 'string'))
    .add(new Field('signature', 3, 'SchnorrSig'));

export default proposeVote;