import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const configUpdateReply = new Type("ConfigUpdateReply")
    .add(new Field('config', 1, 'Config'));


export default configUpdateReply;