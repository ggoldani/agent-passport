extern crate std;

use crate::types::AgentProfileInput;
use soroban_sdk::{testutils::Address as _, Address, Env};
use soroban_sdk::{String, Vec};

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
