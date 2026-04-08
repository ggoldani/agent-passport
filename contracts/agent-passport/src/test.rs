extern crate std;

use crate::types::AgentProfileInput;
use crate::types::InteractionRecord;
use soroban_sdk::{testutils::Address as _, Address, Env};
use soroban_sdk::{BytesN, String, Vec};

fn test_env() -> Env {
    Env::default()
}

#[test]
fn init_persists_admin_and_relayer_config() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::from_str(
        &env,
        "CBESJIMX7J53SWJGJ7WQ6QTLJI4S5LPPJNC2BNVD63GIKAYCDTDOO322",
    );
    let authorized_relayer = Address::from_str(
        &env,
        "CBESJIMX7J53SWJGJ7WQ6QTLJI4S5LPPJNC2BNVD63GIKAYCDTDOO322",
    );

    client.init(&admin, &authorized_relayer);

    let config = client.get_config();
    assert_eq!(config.admin, admin);
    assert_eq!(config.authorized_relayer, authorized_relayer);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn init_rejects_reinitialization() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::from_str(
        &env,
        "CBESJIMX7J53SWJGJ7WQ6QTLJI4S5LPPJNC2BNVD63GIKAYCDTDOO322",
    );
    let authorized_relayer = Address::from_str(
        &env,
        "CBESJIMX7J53SWJGJ7WQ6QTLJI4S5LPPJNC2BNVD63GIKAYCDTDOO322",
    );

    client.init(&admin, &authorized_relayer);
    client.init(&admin, &authorized_relayer);
}

#[test]
#[should_panic]
fn non_admin_cannot_update_relayer() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let authorized_relayer = Address::generate(&env);
    let attacker = Address::generate(&env);
    let next_relayer = Address::generate(&env);

    client.init(&admin, &authorized_relayer);
    env.mock_all_auths();
    client.update_relayer(&attacker, &next_relayer);
}

#[test]
fn register_agent_persists_profile_by_owner_address() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let authorized_relayer = Address::generate(&env);
    let owner = Address::generate(&env);
    let name = String::from_str(&env, "stellar-intel");
    let description = String::from_str(&env, "Paid Stellar intelligence provider");
    let service_url = String::from_str(&env, "https://stellarintel.test/service");
    let mcp_server_url = String::from_str(&env, "https://stellarintel.test/mcp");
    let payment_endpoint = String::from_str(&env, "https://stellarintel.test/pay");
    let input = AgentProfileInput {
        name: name.clone(),
        description: description.clone(),
        tags: Vec::from_array(&env, [String::from_str(&env, "stellar"), String::from_str(&env, "intel")]),
        service_url: Some(service_url.clone()),
        mcp_server_url: Some(mcp_server_url.clone()),
        payment_endpoint: Some(payment_endpoint.clone()),
    };

    client.init(&admin, &authorized_relayer);
    env.mock_all_auths();
    client.register_agent(&owner, &input);

    let profile = client.get_agent(&owner);
    assert_eq!(profile.owner_address, owner);
    assert_eq!(profile.name, name);
    assert_eq!(profile.description, description);
    assert_eq!(profile.service_url, Some(service_url));
    assert_eq!(profile.mcp_server_url, Some(mcp_server_url));
    assert_eq!(profile.payment_endpoint, Some(payment_endpoint));
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn register_agent_rejects_conflicting_existing_owner_profile() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let authorized_relayer = Address::generate(&env);
    let owner = Address::generate(&env);
    let first_input = AgentProfileInput {
        name: String::from_str(&env, "first-agent"),
        description: String::from_str(&env, "First profile"),
        tags: Vec::from_array(&env, [String::from_str(&env, "first")]),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    let second_input = AgentProfileInput {
        name: String::from_str(&env, "second-agent"),
        description: String::from_str(&env, "Conflicting profile"),
        tags: Vec::from_array(&env, [String::from_str(&env, "second")]),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };

    client.init(&admin, &authorized_relayer);
    env.mock_all_auths();
    client.register_agent(&owner, &first_input);
    client.register_agent(&owner, &second_input);
}

#[test]
fn list_agents_returns_registered_profiles() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let authorized_relayer = Address::generate(&env);
    let first_owner = Address::generate(&env);
    let second_owner = Address::generate(&env);
    let first_input = AgentProfileInput {
        name: String::from_str(&env, "first-agent"),
        description: String::from_str(&env, "First profile"),
        tags: Vec::from_array(&env, [String::from_str(&env, "first")]),
        service_url: Some(String::from_str(&env, "https://first.test/service")),
        mcp_server_url: None,
        payment_endpoint: None,
    };
    let second_input = AgentProfileInput {
        name: String::from_str(&env, "second-agent"),
        description: String::from_str(&env, "Second profile"),
        tags: Vec::from_array(&env, [String::from_str(&env, "second")]),
        service_url: None,
        mcp_server_url: Some(String::from_str(&env, "https://second.test/mcp")),
        payment_endpoint: Some(String::from_str(&env, "https://second.test/pay")),
    };

    client.init(&admin, &authorized_relayer);
    env.mock_all_auths();
    client.register_agent(&first_owner, &first_input);
    client.register_agent(&second_owner, &second_input);

    let agents = client.list_agents();
    assert_eq!(agents.len(), 2);
    assert!(agents.iter().any(|profile| profile.owner_address == first_owner));
    assert!(agents.iter().any(|profile| profile.owner_address == second_owner));
}

#[test]
fn list_agent_interactions_returns_newest_first_for_provider() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let authorized_relayer = Address::generate(&env);
    let provider = Address::generate(&env);
    let first_consumer = Address::generate(&env);
    let second_consumer = Address::generate(&env);
    let older_tx_hash = BytesN::from_array(&env, &[1; 32]);
    let newer_tx_hash = BytesN::from_array(&env, &[2; 32]);
    let older = InteractionRecord {
        provider_address: provider.clone(),
        consumer_address: first_consumer,
        amount: 100,
        tx_hash: older_tx_hash.clone(),
        timestamp: 100,
        service_label: Some(String::from_str(&env, "older")),
    };
    let newer = InteractionRecord {
        provider_address: provider.clone(),
        consumer_address: second_consumer,
        amount: 250,
        tx_hash: newer_tx_hash.clone(),
        timestamp: 200,
        service_label: Some(String::from_str(&env, "newer")),
    };

    client.init(&admin, &authorized_relayer);
    env.mock_all_auths();
    client.register_interaction(&older);
    client.register_interaction(&newer);

    let interactions = client.list_agent_interactions(&provider);
    assert_eq!(interactions.len(), 2);
    assert_eq!(interactions.get_unchecked(0).tx_hash, newer_tx_hash);
    assert_eq!(interactions.get_unchecked(1).tx_hash, older_tx_hash);
}
