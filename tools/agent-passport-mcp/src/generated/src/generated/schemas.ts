import { z } from "zod";
import { StrKey } from "@stellar/stellar-sdk";

const contractIdOverride = z
  .string()
  .trim()
  .optional()
  .describe("Optional Soroban contract id (C...). Defaults to STELLAR_CONTRACT_ID.");

const sourceAccountField = z
  .string()
  .trim()
  .refine((value) => StrKey.isValidEd25519PublicKey(value), {
    message: "Invalid Stellar public key (expected G... source account)."
  })
  .describe("Source account public key (G...) used to build the transaction.");


export const initInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  admin: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument admin"),
  authorized_relayer: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument authorized_relayer")
};


export const get_agentInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  owner_address: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument owner_address")
};


export const get_configInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField
};


export const get_ratingInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  interaction_tx_hash: z.string().describe("Bytes as base64 or hex per simulation expectations").describe("Contract argument interaction_tx_hash")
};


export const add_relayerInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  admin: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument admin"),
  relayer: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument relayer")
};


export const list_agentsInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  from: z.number().int().min(0).max(4294967295).describe("Contract argument from"),
  limit: z.number().int().min(0).max(4294967295).describe("Contract argument limit")
};


export const accept_adminInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  new_admin: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument new_admin")
};


export const get_relayersInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField
};


export const submit_ratingInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  rating: z.unknown().describe("User-defined Soroban type; validated when building ScVals via Spec.funcArgsToScVals.").describe("Contract argument rating")
};


export const register_agentInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  owner_address: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument owner_address"),
  input: z.unknown().describe("User-defined Soroban type; validated when building ScVals via Spec.funcArgsToScVals.").describe("Contract argument input")
};


export const remove_relayerInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  admin: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument admin"),
  relayer: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument relayer")
};


export const transfer_adminInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  admin: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument admin"),
  new_admin: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument new_admin")
};


export const update_profileInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  owner_address: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument owner_address"),
  input: z.unknown().describe("User-defined Soroban type; validated when building ScVals via Spec.funcArgsToScVals.").describe("Contract argument input")
};


export const deregister_agentInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  owner_address: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument owner_address")
};


export const register_interactionInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  relayer: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument relayer"),
  interaction: z.unknown().describe("User-defined Soroban type; validated when building ScVals via Spec.funcArgsToScVals.").describe("Contract argument interaction")
};


export const cancel_admin_transferInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  admin: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument admin")
};


export const list_agent_interactionsInputSchema = {
  contractId: contractIdOverride,
  sourceAccount: sourceAccountField,
  provider_address: z.string().describe("Stellar address (G... public key or C... contract)").describe("Contract argument provider_address"),
  from_seq: z.number().int().min(0).max(4294967295).describe("Contract argument from_seq"),
  limit: z.number().int().min(0).max(4294967295).describe("Contract argument limit")
};

