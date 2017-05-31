import protobuf from 'protobufjs'
const {Type, Field, MapField} = protobuf;

const config = new Type("Config")
    .add(new Field('threshold', 1, 'sint32'))
    .add(new MapField('device', 2, 'string', 'Device'))
    .add(new MapField('data', 3, 'string', 'string'));


export default config;