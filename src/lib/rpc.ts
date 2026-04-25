import { Server } from "@stellar/stellar-sdk/rpc"

export function createRpcServer(rpcUrl: string): Server {
  const isLocal = rpcUrl.startsWith("http://localhost") || rpcUrl.startsWith("http://127.0.0.1")
  if (!isLocal && !rpcUrl.startsWith("https://")) {
    throw new Error("RPC URL must use HTTPS in production")
  }
  return new Server(rpcUrl, { allowHttp: isLocal })
}
