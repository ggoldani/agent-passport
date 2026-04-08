extern crate std;

use crate::types::AgentProfileInput;
use crate::types::InteractionRecord;
use crate::types::RatingInput;
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal,
};
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
    let provider_input = AgentProfileInput {
        name: String::from_str(&env, "provider"),
        description: String::from_str(&env, "Provider profile"),
        tags: Vec::from_array(&env, [String::from_str(&env, "provider")]),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
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
    client.register_agent(&provider, &provider_input);
    client
        .mock_auths(&[MockAuth {
            address: &authorized_relayer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "register_interaction",
                args: (&authorized_relayer, &older).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .register_interaction(&authorized_relayer, &older);
    client
        .mock_auths(&[MockAuth {
            address: &authorized_relayer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "register_interaction",
                args: (&authorized_relayer, &newer).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .register_interaction(&authorized_relayer, &newer);

    let interactions = client.list_agent_interactions(&provider);
    assert_eq!(interactions.len(), 2);
    assert_eq!(interactions.get_unchecked(0).tx_hash, newer_tx_hash);
    assert_eq!(interactions.get_unchecked(1).tx_hash, older_tx_hash);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn only_authorized_relayer_can_register_interaction() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let authorized_relayer = Address::generate(&env);
    let attacker = Address::generate(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    let provider_input = AgentProfileInput {
        name: String::from_str(&env, "provider"),
        description: String::from_str(&env, "Provider profile"),
        tags: Vec::from_array(&env, [String::from_str(&env, "provider")]),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    let interaction = InteractionRecord {
        provider_address: provider,
        consumer_address: consumer,
        amount: 100,
        tx_hash: BytesN::from_array(&env, &[3; 32]),
        timestamp: 300,
        service_label: Some(String::from_str(&env, "unauthorized")),
    };

    client.init(&admin, &authorized_relayer);
    env.mock_all_auths();
    client.register_agent(&interaction.provider_address, &provider_input);
    client
        .mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "register_interaction",
                args: (&attacker, &interaction).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .register_interaction(&attacker, &interaction);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn register_interaction_rejects_duplicate_tx_hash() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let authorized_relayer = Address::generate(&env);
    let provider = Address::generate(&env);
    let first_consumer = Address::generate(&env);
    let second_consumer = Address::generate(&env);
    let provider_input = AgentProfileInput {
        name: String::from_str(&env, "provider"),
        description: String::from_str(&env, "Provider profile"),
        tags: Vec::from_array(&env, [String::from_str(&env, "provider")]),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    let duplicate_tx_hash = BytesN::from_array(&env, &[4; 32]);
    let first = InteractionRecord {
        provider_address: provider.clone(),
        consumer_address: first_consumer,
        amount: 100,
        tx_hash: duplicate_tx_hash.clone(),
        timestamp: 300,
        service_label: Some(String::from_str(&env, "first")),
    };
    let second = InteractionRecord {
        provider_address: provider.clone(),
        consumer_address: second_consumer,
        amount: 200,
        tx_hash: duplicate_tx_hash,
        timestamp: 400,
        service_label: Some(String::from_str(&env, "second")),
    };

    client.init(&admin, &authorized_relayer);
    env.mock_all_auths();
    client.register_agent(&provider, &provider_input);
    client
        .mock_auths(&[MockAuth {
            address: &authorized_relayer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "register_interaction",
                args: (&authorized_relayer, &first).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .register_interaction(&authorized_relayer, &first);
    client
        .mock_auths(&[MockAuth {
            address: &authorized_relayer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "register_interaction",
                args: (&authorized_relayer, &second).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .register_interaction(&authorized_relayer, &second);
}

#[test]
fn register_interaction_updates_provider_metrics() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let authorized_relayer = Address::generate(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    let provider_input = AgentProfileInput {
        name: String::from_str(&env, "provider"),
        description: String::from_str(&env, "Provider profile"),
        tags: Vec::from_array(&env, [String::from_str(&env, "provider")]),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    let interaction = InteractionRecord {
        provider_address: provider.clone(),
        consumer_address: consumer,
        amount: 500,
        tx_hash: BytesN::from_array(&env, &[5; 32]),
        timestamp: 500,
        service_label: Some(String::from_str(&env, "metrics")),
    };

    client.init(&admin, &authorized_relayer);
    env.mock_all_auths();
    client.register_agent(&provider, &provider_input);
    client
        .mock_auths(&[MockAuth {
            address: &authorized_relayer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "register_interaction",
                args: (&authorized_relayer, &interaction).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .register_interaction(&authorized_relayer, &interaction);

    let profile = client.get_agent(&provider);
    assert_eq!(profile.verified_interactions_count, 1);
    assert_eq!(profile.total_economic_volume, 500);
    assert_eq!(profile.unique_counterparties_count, 1);
    assert_eq!(profile.last_interaction_timestamp, 500);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn only_verified_counterparty_can_rate() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let authorized_relayer = Address::generate(&env);
    let provider = Address::generate(&env);
    let verified_consumer = Address::generate(&env);
    let attacker = Address::generate(&env);
    let provider_input = AgentProfileInput {
        name: String::from_str(&env, "provider"),
        description: String::from_str(&env, "Provider profile"),
        tags: Vec::from_array(&env, [String::from_str(&env, "provider")]),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    let interaction = InteractionRecord {
        provider_address: provider.clone(),
        consumer_address: verified_consumer,
        amount: 100,
        tx_hash: BytesN::from_array(&env, &[6; 32]),
        timestamp: 600,
        service_label: Some(String::from_str(&env, "rating-target")),
    };
    let rating = RatingInput {
        provider_address: provider,
        consumer_address: attacker.clone(),
        interaction_tx_hash: interaction.tx_hash.clone(),
        score: 80,
    };

    client.init(&admin, &authorized_relayer);
    env.mock_all_auths();
    client.register_agent(&interaction.provider_address, &provider_input);
    client
        .mock_auths(&[MockAuth {
            address: &authorized_relayer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "register_interaction",
                args: (&authorized_relayer, &interaction).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .register_interaction(&authorized_relayer, &interaction);
    client
        .mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "submit_rating",
                args: (&rating,).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .submit_rating(&rating);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn submit_rating_rejects_duplicate_rating_for_interaction() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let authorized_relayer = Address::generate(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    let provider_input = AgentProfileInput {
        name: String::from_str(&env, "provider"),
        description: String::from_str(&env, "Provider profile"),
        tags: Vec::from_array(&env, [String::from_str(&env, "provider")]),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    let interaction = InteractionRecord {
        provider_address: provider.clone(),
        consumer_address: consumer.clone(),
        amount: 100,
        tx_hash: BytesN::from_array(&env, &[7; 32]),
        timestamp: 700,
        service_label: Some(String::from_str(&env, "rating-dup")),
    };
    let first_rating = RatingInput {
        provider_address: provider.clone(),
        consumer_address: consumer.clone(),
        interaction_tx_hash: interaction.tx_hash.clone(),
        score: 80,
    };
    let second_rating = RatingInput {
        provider_address: provider,
        consumer_address: consumer.clone(),
        interaction_tx_hash: interaction.tx_hash.clone(),
        score: 90,
    };

    client.init(&admin, &authorized_relayer);
    env.mock_all_auths();
    client.register_agent(&interaction.provider_address, &provider_input);
    client
        .mock_auths(&[MockAuth {
            address: &authorized_relayer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "register_interaction",
                args: (&authorized_relayer, &interaction).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .register_interaction(&authorized_relayer, &interaction);
    client
        .mock_auths(&[MockAuth {
            address: &consumer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "submit_rating",
                args: (&first_rating,).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .submit_rating(&first_rating);
    client
        .mock_auths(&[MockAuth {
            address: &consumer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "submit_rating",
                args: (&second_rating,).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .submit_rating(&second_rating);
}
