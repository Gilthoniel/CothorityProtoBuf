import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const finalizeRequest = new Type("FinalizeRequest")
    .add(new Field('descId', 1, 'bytes'))
    .add(new Field('attendees', 2, 'bytes' ));

export default finalizeRequest;