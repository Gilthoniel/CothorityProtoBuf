import protobuf from "protobufjs";
import StatusResponse from "./status-response";
import Status from "./status";
import ServerIdentity from "./server-identity";
import Roster from "./roster";
import SignatureRequest from "./signature-request";
import SignatureResponse from "./signature-response";
import StoreSkipBlockRequest from "./store-skipblock-request";
import StoreSkipBlockResponse from "./store-skipblock-response"
import LatestBlockRequest from "./latest-block-request";
import LatestBlockResponse from "./latest-block-response";
import SkipBlock from './skip-block'
import BlockLink from './block-link'
import PinRequest from './pop/pin-request'
import StoreConfig from './pop/store-config'
import StoreConfigReply from './pop/store-config-reply'
import FinalizeRequest from './pop/finalize-request'
import FinalizeResponse from './pop/finalize-response'
import PopDesc from './pop/pop-desc'
import FinalStatement from './pop/final-statement'
import Config from './cisc/config'
import ConfigUpdate from './cisc/config-update'
import ConfigUpdateReply from './cisc/config-update-reply'
import ProposeSend from './cisc/propose-send'
import Device from './cisc/device'

const {Root} = protobuf;

const root = new Root();
root.define("cothority")
    .add(SkipBlock)
    .add(ServerIdentity)
    .add(Roster)
    .add(BlockLink)
    .add(LatestBlockRequest)
    .add(LatestBlockResponse)
    .add(StoreSkipBlockRequest)
    .add(StoreSkipBlockResponse)
    .add(Status)
    .add(StatusResponse)
    .add(SignatureRequest)
    .add(SignatureResponse)
    .add(PinRequest)
    .add(StoreConfig)
    .add(StoreConfigReply)
    .add(FinalizeRequest)
    .add(FinalizeResponse)
    .add(PopDesc)
    .add(FinalStatement)
    .add(Device)
    .add(Config)
    .add(ConfigUpdate)
    .add(ConfigUpdateReply)
    .add(ProposeSend);

export default root;