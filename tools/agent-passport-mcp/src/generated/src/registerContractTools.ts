import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Spec } from "@stellar/stellar-sdk/contract";

import type { AppConfig } from "./config.js";
import { invokeContractMethod } from "./lib/contractInvoke.js";
import { SPEC_ENTRIES } from "./generated/specEntries.js";
import * as G from "./generated/schemas.js";

const spec = new Spec([...SPEC_ENTRIES]);

export function registerContractTools(server: McpServer, config: AppConfig): void {
  server.tool(
    "ap_init",
    "Soroban contract method `init` (generated).",
    G.initInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "init",
        args: { admin: input.admin, authorized_relayer: input.authorized_relayer }
      });
    }
  );

  server.tool(
    "ap_get_agent",
    "Soroban contract method `get_agent` (generated).",
    G.get_agentInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "get_agent",
        args: { owner_address: input.owner_address }
      });
    }
  );

  server.tool(
    "ap_get_config",
    "Soroban contract method `get_config` (generated).",
    G.get_configInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "get_config",
        args: {}
      });
    }
  );

  server.tool(
    "ap_get_rating",
    "Soroban contract method `get_rating` (generated).",
    G.get_ratingInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "get_rating",
        args: { interaction_tx_hash: input.interaction_tx_hash }
      });
    }
  );

  server.tool(
    "ap_add_relayer",
    "Soroban contract method `add_relayer` (generated).",
    G.add_relayerInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "add_relayer",
        args: { admin: input.admin, relayer: input.relayer }
      });
    }
  );

  server.tool(
    "ap_list_agents",
    "Soroban contract method `list_agents` (generated).",
    G.list_agentsInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "list_agents",
        args: { from: input.from, limit: input.limit }
      });
    }
  );

  server.tool(
    "ap_accept_admin",
    "Soroban contract method `accept_admin` (generated).",
    G.accept_adminInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "accept_admin",
        args: { new_admin: input.new_admin }
      });
    }
  );

  server.tool(
    "ap_get_relayers",
    "Soroban contract method `get_relayers` (generated).",
    G.get_relayersInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "get_relayers",
        args: {}
      });
    }
  );

  server.tool(
    "ap_submit_rating",
    "Soroban contract method `submit_rating` (generated).",
    G.submit_ratingInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "submit_rating",
        args: { rating: input.rating }
      });
    }
  );

  server.tool(
    "ap_register_agent",
    "Soroban contract method `register_agent` (generated).",
    G.register_agentInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "register_agent",
        args: { owner_address: input.owner_address, input: input.input }
      });
    }
  );

  server.tool(
    "ap_remove_relayer",
    "Soroban contract method `remove_relayer` (generated).",
    G.remove_relayerInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "remove_relayer",
        args: { admin: input.admin, relayer: input.relayer }
      });
    }
  );

  server.tool(
    "ap_transfer_admin",
    "Soroban contract method `transfer_admin` (generated).",
    G.transfer_adminInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "transfer_admin",
        args: { admin: input.admin, new_admin: input.new_admin }
      });
    }
  );

  server.tool(
    "ap_update_profile",
    "Soroban contract method `update_profile` (generated).",
    G.update_profileInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "update_profile",
        args: { owner_address: input.owner_address, input: input.input }
      });
    }
  );

  server.tool(
    "ap_deregister_agent",
    "Soroban contract method `deregister_agent` (generated).",
    G.deregister_agentInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "deregister_agent",
        args: { owner_address: input.owner_address }
      });
    }
  );

  server.tool(
    "ap_register_interaction",
    "Soroban contract method `register_interaction` (generated).",
    G.register_interactionInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "register_interaction",
        args: { relayer: input.relayer, interaction: input.interaction }
      });
    }
  );

  server.tool(
    "ap_cancel_admin_transfer",
    "Soroban contract method `cancel_admin_transfer` (generated).",
    G.cancel_admin_transferInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "cancel_admin_transfer",
        args: { admin: input.admin }
      });
    }
  );

  server.tool(
    "ap_list_agent_interactions",
    "Soroban contract method `list_agent_interactions` (generated).",
    G.list_agent_interactionsInputSchema,
    async (input) => {
      const contractId = input.contractId ?? config.contractId;
      return invokeContractMethod(config, spec, {
        contractId,
        sourceAccount: input.sourceAccount,
        method: "list_agent_interactions",
        args: { provider_address: input.provider_address, from_seq: input.from_seq, limit: input.limit }
      });
    }
  );
}
