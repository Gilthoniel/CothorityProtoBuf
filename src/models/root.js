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
  .add(SignatureResponse);

export default root;