import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const signatureResponse = new Type("SignatureResponse")
  .add(new Field('hash', 1, 'bytes', 'required'))
  .add(new Field('signature', 2, 'bytes', 'required'));

export default signatureResponse;