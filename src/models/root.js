import protobuf from 'protobufjs'
const {Root} = protobuf;

import StatusResponse from './StatusResponse'
import Status from './status'
import ServerIdentity from './server-identity'
import Roster from './roster'
import SignatureRequest from './signature-request'
import SignatureResponse from './signature-response'
import PinRequest from './pop/pin-request'
import StoreConfig from './pop/store-config'
import StoreConfigReply from './pop/store-config-reply'
import FinalizeRequest from './pop/finalize-request'
import FinalizeResponse from './pop/finalize-response'
import PopDesc from './pop/pop-desc'
import FinalStatement from './pop/final-statement'

const root = new Root();
root.define("cothority")
    .add(Status)
    .add(ServerIdentity)
    .add(StatusResponse)
    .add(Roster)
    .add(SignatureRequest)
    .add(SignatureResponse)
    .add(PinRequest)
    .add(StoreConfig)
    .add(StoreConfigReply)
    .add(FinalizeRequest)
    .add(FinalizeResponse)
    .add(PopDesc)
    .add(FinalStatement);

export default root;