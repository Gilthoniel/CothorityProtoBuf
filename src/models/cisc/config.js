import protobuf from 'protobufjs'
const {Type, Field, MapField} = protobuf;

const config = new Type("Config")
    .add(new Field('Threshold', 1, 'sint32'))
    .add(new MapField('Device', 2, 'string', 'Device'))
    .add(new MapField('Data', 3, 'string', 'string'));


export default config;