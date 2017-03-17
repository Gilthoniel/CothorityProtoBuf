import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const finalStatement = new Type("FinalStatement")
    .add(new Field('desc', 1, 'popDesc'))
    .add(new Field('attendees', 2, 'bytes'))
    .add(new Field('signature', 3, 'bytes'));


export default finalStatement;