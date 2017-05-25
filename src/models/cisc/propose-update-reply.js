import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const proposeUpdateReply = new Type("ProposeUpdateReply")
    .add(new Field('propose', 1, 'Config'));


export default proposeUpdateReply;