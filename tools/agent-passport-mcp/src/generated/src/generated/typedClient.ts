export type InitArgs = { admin: string; authorized_relayer: string };
export type Get_agentArgs = { owner_address: string };
export type Get_configArgs = Record<string, never>;
export type Get_ratingArgs = { interaction_tx_hash: string };
export type Add_relayerArgs = { admin: string; relayer: string };
export type List_agentsArgs = { from: number; limit: number };
export type Accept_adminArgs = { new_admin: string };
export type Get_relayersArgs = Record<string, never>;
export type Submit_ratingArgs = { rating: unknown };
export type Register_agentArgs = { owner_address: string; input: unknown };
export type Remove_relayerArgs = { admin: string; relayer: string };
export type Transfer_adminArgs = { admin: string; new_admin: string };
export type Update_profileArgs = { owner_address: string; input: unknown };
export type Deregister_agentArgs = { owner_address: string };
export type Register_interactionArgs = { relayer: string; interaction: unknown };
export type Cancel_admin_transferArgs = { admin: string };
export type List_agent_interactionsArgs = { provider_address: string; from_seq: number; limit: number };

/** Narrow helper for building `args` passed to Spec.funcArgsToScVals in custom integrations. */
export const GeneratedContractCalls = {
    "init": (args: InitArgs) => ({ admin: args.admin, authorized_relayer: args.authorized_relayer }),
    "get_agent": (args: Get_agentArgs) => ({ owner_address: args.owner_address }),
    "get_config": (_args?: Record<string, never>) => ({}),
    "get_rating": (args: Get_ratingArgs) => ({ interaction_tx_hash: args.interaction_tx_hash }),
    "add_relayer": (args: Add_relayerArgs) => ({ admin: args.admin, relayer: args.relayer }),
    "list_agents": (args: List_agentsArgs) => ({ from: args.from, limit: args.limit }),
    "accept_admin": (args: Accept_adminArgs) => ({ new_admin: args.new_admin }),
    "get_relayers": (_args?: Record<string, never>) => ({}),
    "submit_rating": (args: Submit_ratingArgs) => ({ rating: args.rating }),
    "register_agent": (args: Register_agentArgs) => ({ owner_address: args.owner_address, input: args.input }),
    "remove_relayer": (args: Remove_relayerArgs) => ({ admin: args.admin, relayer: args.relayer }),
    "transfer_admin": (args: Transfer_adminArgs) => ({ admin: args.admin, new_admin: args.new_admin }),
    "update_profile": (args: Update_profileArgs) => ({ owner_address: args.owner_address, input: args.input }),
    "deregister_agent": (args: Deregister_agentArgs) => ({ owner_address: args.owner_address }),
    "register_interaction": (args: Register_interactionArgs) => ({ relayer: args.relayer, interaction: args.interaction }),
    "cancel_admin_transfer": (args: Cancel_admin_transferArgs) => ({ admin: args.admin }),
    "list_agent_interactions": (args: List_agent_interactionsArgs) => ({ provider_address: args.provider_address, from_seq: args.from_seq, limit: args.limit })
} as const;

