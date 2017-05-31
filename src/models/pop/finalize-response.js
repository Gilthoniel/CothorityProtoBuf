import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const finalizeResponse = new Type("FinalizeResponse")
    .add(new Field('final', 1, 'finalStatement'));

export default finalizeResponse;