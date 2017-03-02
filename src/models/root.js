import protobuf from 'protobufjs'
const {Root} = protobuf;

import StatusResponse from './StatusResponse'
import Status from './status'
import ServerIdentity from './server-identity'
import Roster from './roster'
import SignatureRequest from './signature-request'
import SignatureResponse from './signature-response'

const root = new Root();
root.define("cothority")
  .add(Status)
  .add(ServerIdentity)
  .add(StatusResponse)
  .add(Roster)
  .add(SignatureRequest)
  .add(SignatureResponse);

export default root;