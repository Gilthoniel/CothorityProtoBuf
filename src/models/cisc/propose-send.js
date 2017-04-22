import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const proposeSend = new Type("ProposeSend")
    .add(new Field('id', 1, 'bytes'))
    .add(new Field('config', 2, 'Config', 'repeated'));


export default proposeSend;