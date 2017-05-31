import protobuf from 'protobufjs'
const {Type, Field} = protobuf;

const popDesc = new Type("PopDesc")
    .add(new Field('name', 1, 'string'))
    .add(new Field('dateTime', 2, 'string'))
    .add(new Field('location', 3, 'string'))
    .add(new Field('roster', 4, 'Roster'));


export default popDesc;