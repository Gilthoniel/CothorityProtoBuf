import protobuf from "protobufjs";
import skeleton from './skeleton'
const {Root} = protobuf;

const root = Root.fromJSON(JSON.parse(skeleton));

export default root;