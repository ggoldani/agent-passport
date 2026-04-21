extern crate std;

use crate::types::AgentProfileInput;
use crate::types::InteractionRecord;
use crate::types::RatingInput;
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal,
};
use soroban_sdk::{BytesN, String, Vec};

fn setup(env: &Env) -> (Address, AgentPassportClient, Address, Address) {
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let relayer = Address::generate(env);
    client.init(&admin, &relayer);
    (contract_id, client, admin, relayer)
}

fn register_agent(env: &Env, client: &AgentPassportClient, owner: &Address) {
    let input = AgentProfileInput {
        name: String::from_str(env, "test-agent"),
        description: String::from_str(env, "Test agent description"),
        tags: Vec::from_array(env, [String::from_str(env, "test")]),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    env.mock_all_auths();
    client.register_agent(owner, &input);
}

fn register_interaction_tx(
    env: &Env,
    client: &AgentPassportClient,
    contract_id: &Address,
    relayer: &Address,
    provider: &Address,
    consumer: &Address,
    amount: i128,
    tx_byte: u8,
) -> BytesN<32> {
    let tx_hash = BytesN::from_array(env, &[tx_byte; 32]);
    let interaction = InteractionRecord {
        provider_address: provider.clone(),
        consumer_address: consumer.clone(),
        amount,
        tx_hash: tx_hash.clone(),
        timestamp: 100,
        service_label: None,
    };
    client
        .mock_auths(&[MockAuth {
            address: relayer,
            invoke: &MockAuthInvoke {
                contract: contract_id,
                fn_name: "register_interaction",
                args: (relayer, &interaction).into_val(env),
                sub_invokes: &[],
            },
        }])
        .register_interaction(relayer, &interaction);
    tx_hash
}

fn submit_rating_tx(
    env: &Env,
    client: &AgentPassportClient,
    contract_id: &Address,
    consumer: &Address,
    provider: &Address,
    interaction_tx_hash: &BytesN<32>,
    score: u32,
) {
    let rating = RatingInput {
        provider_address: provider.clone(),
        consumer_address: consumer.clone(),
        interaction_tx_hash: interaction_tx_hash.clone(),
        score,
    };
    client
        .mock_auths(&[MockAuth {
            address: consumer,
            invoke: &MockAuthInvoke {
                contract: contract_id,
                fn_name: "submit_rating",
                args: (&rating,).into_val(env),
                sub_invokes: &[],
            },
        }])
        .submit_rating(&rating);
}

#[test]
fn init_persists_admin_and_relayer_config() {
    let env = Env::default();
    let (_, client, admin, relayer) = setup(&env);

    let config = client.get_config();
    assert_eq!(config.admin, admin);
    assert!(config.pending_admin.is_none());
    assert_eq!(config.admin_transfer_at, 0);

    let relayers = client.get_relayers();
    assert_eq!(relayers.len(), 1);
    assert_eq!(relayers.get_unchecked(0), relayer);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn init_rejects_reinitialization() {
    let env = Env::default();
    let (_, client, admin, relayer) = setup(&env);
    client.init(&admin, &relayer);
}

#[test]
fn get_relayers_returns_all_relayers() {
    let env = Env::default();
    let (_, client, admin, _relayer) = setup(&env);
    let relayer2 = Address::generate(&env);

    env.mock_all_auths();
    client.add_relayer(&admin, &relayer2);

    let relayers = client.get_relayers();
    assert_eq!(relayers.len(), 2);
}

#[test]
fn register_agent_persists_profile() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    let input = AgentProfileInput {
        name: String::from_str(&env, "stellar-intel"),
        description: String::from_str(&env, "Paid Stellar intelligence provider"),
        tags: Vec::from_array(&env, [String::from_str(&env, "stellar")]),
        service_url: Some(String::from_str(&env, "https://stellarintel.test/service")),
        mcp_server_url: Some(String::from_str(&env, "https://stellarintel.test/mcp")),
        payment_endpoint: Some(String::from_str(&env, "https://stellarintel.test/pay")),
    };

    env.mock_all_auths();
    client.register_agent(&owner, &input);

    let profile = client.get_agent(&owner);
    assert_eq!(profile.owner_address, owner);
    assert_eq!(profile.name, input.name);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn register_agent_rejects_duplicate() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    register_agent(&env, &client, &owner);

    let input = AgentProfileInput {
        name: String::from_str(&env, "second"),
        description: String::from_str(&env, "Dup"),
        tags: Vec::new(&env),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    env.mock_all_auths();
    client.register_agent(&owner, &input);
}

#[test]
#[should_panic(expected = "Error(Contract, #13)")]
fn register_agent_rejects_mcp_server_url_too_long() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    let long_url = String::from_str(&env, &"h".repeat(257));
    let input = AgentProfileInput {
        name: String::from_str(&env, "name"),
        description: String::from_str(&env, "desc"),
        tags: Vec::new(&env),
        service_url: None,
        mcp_server_url: Some(long_url),
        payment_endpoint: None,
    };
    env.mock_all_auths();
    client.register_agent(&owner, &input);
}

#[test]
#[should_panic(expected = "Error(Contract, #14)")]
fn register_agent_rejects_payment_endpoint_too_long() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    let long_url = String::from_str(&env, &"h".repeat(257));
    let input = AgentProfileInput {
        name: String::from_str(&env, "name"),
        description: String::from_str(&env, "desc"),
        tags: Vec::new(&env),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: Some(long_url),
    };
    env.mock_all_auths();
    client.register_agent(&owner, &input);
}

#[test]
#[should_panic(expected = "Error(Contract, #17)")]
fn register_agent_rejects_empty_name() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    let input = AgentProfileInput {
        name: String::from_str(&env, ""),
        description: String::from_str(&env, "Has description"),
        tags: Vec::new(&env),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    env.mock_all_auths();
    client.register_agent(&owner, &input);
}

#[test]
#[should_panic(expected = "Error(Contract, #18)")]
fn register_agent_rejects_empty_description() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    let input = AgentProfileInput {
        name: String::from_str(&env, "has-name"),
        description: String::from_str(&env, ""),
        tags: Vec::new(&env),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    env.mock_all_auths();
    client.register_agent(&owner, &input);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn register_agent_rejects_name_too_long() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    let long_name = String::from_str(&env, &"a".repeat(129));
    let input = AgentProfileInput {
        name: long_name,
        description: String::from_str(&env, "desc"),
        tags: Vec::new(&env),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    env.mock_all_auths();
    client.register_agent(&owner, &input);
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn register_agent_rejects_description_too_long() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    let long_desc = String::from_str(&env, &"d".repeat(513));
    let input = AgentProfileInput {
        name: String::from_str(&env, "name"),
        description: long_desc,
        tags: Vec::new(&env),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    env.mock_all_auths();
    client.register_agent(&owner, &input);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")]
fn register_agent_rejects_service_url_too_long() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    let long_url = String::from_str(&env, &"h".repeat(257));
    let input = AgentProfileInput {
        name: String::from_str(&env, "name"),
        description: String::from_str(&env, "desc"),
        tags: Vec::new(&env),
        service_url: Some(long_url),
        mcp_server_url: None,
        payment_endpoint: None,
    };
    env.mock_all_auths();
    client.register_agent(&owner, &input);
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn register_agent_rejects_too_many_tags() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    let mut tags = Vec::new(&env);
    for _ in 0..21 {
        tags.push_back(String::from_str(&env, "t"));
    }
    let input = AgentProfileInput {
        name: String::from_str(&env, "name"),
        description: String::from_str(&env, "desc"),
        tags,
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    env.mock_all_auths();
    client.register_agent(&owner, &input);
}

#[test]
#[should_panic(expected = "Error(Contract, #16)")]
fn register_agent_rejects_tag_too_long() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    let long_tag = String::from_str(&env, &"x".repeat(33));
    let tags = Vec::from_array(&env, [long_tag]);
    let input = AgentProfileInput {
        name: String::from_str(&env, "name"),
        description: String::from_str(&env, "desc"),
        tags,
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    env.mock_all_auths();
    client.register_agent(&owner, &input);
}

#[test]
fn register_agent_accepts_max_boundary_values() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    let name = String::from_str(&env, &"a".repeat(128));
    let desc = String::from_str(&env, &"d".repeat(512));
    let url = String::from_str(&env, &"h".repeat(256));
    let mut tags = Vec::new(&env);
    for _ in 0..20 {
        tags.push_back(String::from_str(&env, &"t".repeat(32)));
    }
    let input = AgentProfileInput {
        name,
        description: desc,
        tags,
        service_url: Some(url),
        mcp_server_url: None,
        payment_endpoint: None,
    };
    env.mock_all_auths();
    client.register_agent(&owner, &input);

    let profile = client.get_agent(&owner);
    assert_eq!(profile.name.len(), 128);
}

#[test]
fn emits_lifecycle_events_for_registration_interaction_and_rating() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let owner = Address::generate(&env);
    let consumer = Address::generate(&env);
    let name = String::from_str(&env, "stellar-intel");
    let description = String::from_str(&env, "Paid Stellar intelligence provider");
    let tags = Vec::from_array(&env, [String::from_str(&env, "stellar")]);
    let agent_input = AgentProfileInput {
        name: name.clone(),
        description: description.clone(),
        tags: tags.clone(),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };

    env.mock_all_auths();
    client.register_agent(&owner, &agent_input);

    let events = env.events().all().filter_by_contract(&contract_id);
    assert_eq!(events.events().len(), 1);

    let tx_hash = register_interaction_tx(&env, &client, &contract_id, &relayer, &owner, &consumer, 275, 9);

    let events = env.events().all().filter_by_contract(&contract_id);
    assert_eq!(events.events().len(), 1);

    submit_rating_tx(&env, &client, &contract_id, &consumer, &owner, &tx_hash, 95);

    let events = env.events().all().filter_by_contract(&contract_id);
    assert_eq!(events.events().len(), 1);
}

#[test]
fn list_agents_returns_registered_profiles() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner1 = Address::generate(&env);
    let owner2 = Address::generate(&env);

    register_agent(&env, &client, &owner1);
    register_agent(&env, &client, &owner2);

    let agents = client.list_agents(&0, &10);
    assert_eq!(agents.len(), 2);
}

#[test]
fn list_agents_with_pagination() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    for _ in 0..5 {
        let owner = Address::generate(&env);
        register_agent(&env, &client, &owner);
    }

    let page1 = client.list_agents(&0, &2);
    assert_eq!(page1.len(), 2);
    let page2 = client.list_agents(&2, &2);
    assert_eq!(page2.len(), 2);
    let page3 = client.list_agents(&4, &2);
    assert_eq!(page3.len(), 1);
    let empty = client.list_agents(&10, &10);
    assert_eq!(empty.len(), 0);
}

#[test]
fn list_agents_defaults_limit_when_zero() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    register_agent(&env, &client, &owner);

    let agents = client.list_agents(&0, &0);
    assert_eq!(agents.len(), 1);
}

#[test]
fn list_agent_interactions_returns_newest_first() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer1 = Address::generate(&env);
    let consumer2 = Address::generate(&env);
    register_agent(&env, &client, &provider);

    let older = register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer1, 100, 1);
    let newer = register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer2, 250, 2);

    let interactions = client.list_agent_interactions(&provider, &0, &10);
    assert_eq!(interactions.len(), 2);
    assert_eq!(interactions.get_unchecked(0).tx_hash, newer);
    assert_eq!(interactions.get_unchecked(1).tx_hash, older);
}

#[test]
fn list_agent_interactions_with_pagination() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    register_agent(&env, &client, &provider);

    for i in 0..5u8 {
        register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer, 100, i + 10);
    }

    assert_eq!(client.list_agent_interactions(&provider, &0, &2).len(), 2);
    assert_eq!(client.list_agent_interactions(&provider, &2, &2).len(), 2);
    assert_eq!(client.list_agent_interactions(&provider, &4, &2).len(), 1);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn only_authorized_relayer_can_register_interaction() {
    let env = Env::default();
    let (contract_id, client, _, _relayer) = setup(&env);
    let attacker = Address::generate(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    register_agent(&env, &client, &provider);

    let interaction = InteractionRecord {
        provider_address: provider,
        consumer_address: consumer,
        amount: 100,
        tx_hash: BytesN::from_array(&env, &[3; 32]),
        timestamp: 300,
        service_label: None,
    };
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
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    register_agent(&env, &client, &provider);

    let dup_hash = BytesN::from_array(&env, &[4; 32]);
    let first = InteractionRecord {
        provider_address: provider.clone(),
        consumer_address: c1,
        amount: 100,
        tx_hash: dup_hash.clone(),
        timestamp: 300,
        service_label: None,
    };
    let second = InteractionRecord {
        provider_address: provider.clone(),
        consumer_address: c2,
        amount: 200,
        tx_hash: dup_hash,
        timestamp: 400,
        service_label: None,
    };

    client
        .mock_auths(&[MockAuth {
            address: &relayer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "register_interaction",
                args: (&relayer, &first).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .register_interaction(&relayer, &first);
    client
        .mock_auths(&[MockAuth {
            address: &relayer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "register_interaction",
                args: (&relayer, &second).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .register_interaction(&relayer, &second);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn register_interaction_rejects_nonexistent_provider() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);

    let interaction = InteractionRecord {
        provider_address: provider,
        consumer_address: consumer,
        amount: 100,
        tx_hash: BytesN::from_array(&env, &[50; 32]),
        timestamp: 300,
        service_label: None,
    };
    client
        .mock_auths(&[MockAuth {
            address: &relayer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "register_interaction",
                args: (&relayer, &interaction).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .register_interaction(&relayer, &interaction);
}

#[test]
fn register_interaction_updates_provider_metrics() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    register_agent(&env, &client, &provider);

    register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer, 500, 5);

    let profile = client.get_agent(&provider);
    assert_eq!(profile.verified_interactions_count, 1);
    assert_eq!(profile.total_economic_volume, 500);
    assert_eq!(profile.unique_counterparties_count, 1);
}

#[test]
fn register_interaction_uses_ledger_timestamp() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    register_agent(&env, &client, &provider);

    env.ledger().set_timestamp(9999);
    let tx_hash = register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer, 100, 55);

    let interactions = client.list_agent_interactions(&provider, &0, &10);
    assert_eq!(interactions.get_unchecked(0).timestamp, 9999);
    assert_eq!(interactions.get_unchecked(0).tx_hash, tx_hash);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn only_verified_counterparty_can_rate() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let verified_consumer = Address::generate(&env);
    let attacker = Address::generate(&env);
    register_agent(&env, &client, &provider);

    let interaction = InteractionRecord {
        provider_address: provider.clone(),
        consumer_address: verified_consumer,
        amount: 100,
        tx_hash: BytesN::from_array(&env, &[6; 32]),
        timestamp: 600,
        service_label: None,
    };
    client
        .mock_auths(&[MockAuth {
            address: &relayer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "register_interaction",
                args: (&relayer, &interaction).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .register_interaction(&relayer, &interaction);

    let rating = RatingInput {
        provider_address: provider,
        consumer_address: attacker.clone(),
        interaction_tx_hash: BytesN::from_array(&env, &[6; 32]),
        score: 80,
    };
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
fn submit_rating_rejects_duplicate() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    register_agent(&env, &client, &provider);

    let tx_hash = register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer, 100, 7);
    submit_rating_tx(&env, &client, &contract_id, &consumer, &provider, &tx_hash, 80);

    let rating2 = RatingInput {
        provider_address: provider,
        consumer_address: consumer.clone(),
        interaction_tx_hash: tx_hash,
        score: 90,
    };
    client
        .mock_auths(&[MockAuth {
            address: &consumer,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "submit_rating",
                args: (&rating2,).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .submit_rating(&rating2);
}

#[test]
fn submit_rating_updates_provider_score() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    register_agent(&env, &client, &provider);

    let tx_hash = register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer, 100, 8);
    submit_rating_tx(&env, &client, &contract_id, &consumer, &provider, &tx_hash, 80);

    assert_eq!(client.get_agent(&provider).score, 80);
}

#[test]
fn submit_rating_averages_multiple_ratings() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let c1 = Address::generate(&env);
    let c2 = Address::generate(&env);
    register_agent(&env, &client, &provider);

    let tx1 = register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &c1, 100, 20);
    let tx2 = register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &c2, 100, 21);

    submit_rating_tx(&env, &client, &contract_id, &c1, &provider, &tx1, 60);
    submit_rating_tx(&env, &client, &contract_id, &c2, &provider, &tx2, 100);

    assert_eq!(client.get_agent(&provider).score, 80);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn submit_rating_rejects_score_zero() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    register_agent(&env, &client, &provider);

    let tx_hash = register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer, 100, 30);
    let rating = RatingInput {
        provider_address: provider,
        consumer_address: consumer.clone(),
        interaction_tx_hash: tx_hash,
        score: 0,
    };
    client
        .mock_auths(&[MockAuth {
            address: &consumer,
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
#[should_panic(expected = "Error(Contract, #6)")]
fn submit_rating_rejects_score_over_100() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    register_agent(&env, &client, &provider);

    let tx_hash = register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer, 100, 31);
    let rating = RatingInput {
        provider_address: provider,
        consumer_address: consumer.clone(),
        interaction_tx_hash: tx_hash,
        score: 101,
    };
    client
        .mock_auths(&[MockAuth {
            address: &consumer,
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
fn submit_rating_accepts_score_boundary_100() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    register_agent(&env, &client, &provider);

    let tx_hash = register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer, 100, 33);
    submit_rating_tx(&env, &client, &contract_id, &consumer, &provider, &tx_hash, 100);

    assert_eq!(client.get_agent(&provider).score, 100);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn submit_rating_rejects_self_rating() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    register_agent(&env, &client, &provider);

    let tx_hash = register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &provider, 100, 32);
    let rating = RatingInput {
        provider_address: provider.clone(),
        consumer_address: provider.clone(),
        interaction_tx_hash: tx_hash,
        score: 50,
    };
    client
        .mock_auths(&[MockAuth {
            address: &provider,
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
fn get_rating_returns_persisted_record() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    register_agent(&env, &client, &provider);

    let tx_hash = register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer, 100, 9);
    submit_rating_tx(&env, &client, &contract_id, &consumer, &provider, &tx_hash, 90);

    let record = client.get_rating(&tx_hash).expect("rating should exist");
    assert_eq!(record.score, 90);
}

#[test]
fn register_interaction_handles_negative_amount() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    register_agent(&env, &client, &provider);

    register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer, -100, 40);

    assert_eq!(client.get_agent(&provider).total_economic_volume, 100);
}

#[test]
fn register_interaction_handles_i128_min_amount() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    register_agent(&env, &client, &provider);

    register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer, i128::MIN, 41);

    assert!(client.get_agent(&provider).total_economic_volume > 0);
}

#[test]
fn transfer_admin_sets_pending_and_timelock() {
    let env = Env::default();
    let (_, client, admin, _) = setup(&env);
    let new_admin = Address::generate(&env);

    env.mock_all_auths();
    client.transfer_admin(&admin, &new_admin);

    let config = client.get_config();
    assert_eq!(config.pending_admin, Some(new_admin));
    assert!(config.admin_transfer_at > 0);
}

#[test]
fn accept_admin_transfers_after_timelock() {
    let env = Env::default();
    let (contract_id, client, admin, _) = setup(&env);
    let new_admin = Address::generate(&env);

    env.mock_all_auths();
    client.transfer_admin(&admin, &new_admin);

    let config = client.get_config();
    env.ledger().set_timestamp(config.admin_transfer_at);

    client
        .mock_auths(&[MockAuth {
            address: &new_admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "accept_admin",
                args: (&new_admin,).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .accept_admin(&new_admin);

    let config = client.get_config();
    assert_eq!(config.admin, new_admin);
    assert!(config.pending_admin.is_none());
    assert_eq!(config.admin_transfer_at, 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #20)")]
fn accept_admin_rejects_before_timelock() {
    let env = Env::default();
    let (contract_id, client, admin, _) = setup(&env);
    let new_admin = Address::generate(&env);

    env.mock_all_auths();
    client.transfer_admin(&admin, &new_admin);

    client
        .mock_auths(&[MockAuth {
            address: &new_admin,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "accept_admin",
                args: (&new_admin,).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .accept_admin(&new_admin);
}

#[test]
#[should_panic(expected = "Error(Contract, #19)")]
fn accept_admin_rejects_wrong_address() {
    let env = Env::default();
    let (contract_id, client, admin, _) = setup(&env);
    let new_admin = Address::generate(&env);
    let wrong = Address::generate(&env);

    env.mock_all_auths();
    client.transfer_admin(&admin, &new_admin);

    let config = client.get_config();
    env.ledger().set_timestamp(config.admin_transfer_at);

    client
        .mock_auths(&[MockAuth {
            address: &wrong,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "accept_admin",
                args: (&wrong,).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .accept_admin(&wrong);
}

#[test]
fn cancel_admin_transfer_clears_pending() {
    let env = Env::default();
    let (_, client, admin, _) = setup(&env);
    let new_admin = Address::generate(&env);

    env.mock_all_auths();
    client.transfer_admin(&admin, &new_admin);
    client.cancel_admin_transfer(&admin);

    let config = client.get_config();
    assert!(config.pending_admin.is_none());
    assert_eq!(config.admin_transfer_at, 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #21)")]
fn non_admin_cannot_transfer_admin() {
    let env = Env::default();
    let (_, client, _, _) = setup(&env);
    let attacker = Address::generate(&env);
    let new_admin = Address::generate(&env);

    env.mock_all_auths();
    client.transfer_admin(&attacker, &new_admin);
}

#[test]
fn add_relayer_works() {
    let env = Env::default();
    let (_, client, admin, _) = setup(&env);
    let new_relayer = Address::generate(&env);

    env.mock_all_auths();
    client.add_relayer(&admin, &new_relayer);

    assert_eq!(client.get_relayers().len(), 2);
}

#[test]
fn remove_relayer_works() {
    let env = Env::default();
    let (_, client, admin, relayer) = setup(&env);

    env.mock_all_auths();
    client.remove_relayer(&admin, &relayer);

    assert_eq!(client.get_relayers().len(), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #22)")]
fn add_duplicate_relayer_rejected() {
    let env = Env::default();
    let (_, client, admin, relayer) = setup(&env);

    env.mock_all_auths();
    client.add_relayer(&admin, &relayer);
}

#[test]
#[should_panic(expected = "Error(Contract, #23)")]
fn remove_nonexistent_relayer_rejected() {
    let env = Env::default();
    let (_, client, admin, _) = setup(&env);
    let stranger = Address::generate(&env);

    env.mock_all_auths();
    client.remove_relayer(&admin, &stranger);
}

#[test]
fn update_profile_works() {
    let env = Env::default();
    let (contract_id, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    register_agent(&env, &client, &owner);

    let input = AgentProfileInput {
        name: String::from_str(&env, "updated-name"),
        description: String::from_str(&env, "Updated description"),
        tags: Vec::from_array(&env, [String::from_str(&env, "updated")]),
        service_url: Some(String::from_str(&env, "https://updated.test")),
        mcp_server_url: None,
        payment_endpoint: None,
    };
    client
        .mock_auths(&[MockAuth {
            address: &owner,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "update_profile",
                args: (&owner, &input).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .update_profile(&owner, &input);

    let profile = client.get_agent(&owner);
    assert_eq!(profile.name, String::from_str(&env, "updated-name"));
}

#[test]
#[should_panic(expected = "Error(Contract, #24)")]
fn update_profile_rejects_nonexistent() {
    let env = Env::default();
    let (contract_id, client, _, _) = setup(&env);
    let owner = Address::generate(&env);

    let input = AgentProfileInput {
        name: String::from_str(&env, "updated"),
        description: String::from_str(&env, "Up"),
        tags: Vec::new(&env),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    client
        .mock_auths(&[MockAuth {
            address: &owner,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "update_profile",
                args: (&owner, &input).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .update_profile(&owner, &input);
}

#[test]
#[should_panic(expected = "Error(Contract, #17)")]
fn update_profile_rejects_empty_name() {
    let env = Env::default();
    let (contract_id, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    register_agent(&env, &client, &owner);

    let input = AgentProfileInput {
        name: String::from_str(&env, ""),
        description: String::from_str(&env, "Has description"),
        tags: Vec::new(&env),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    client
        .mock_auths(&[MockAuth {
            address: &owner,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "update_profile",
                args: (&owner, &input).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .update_profile(&owner, &input);
}

#[test]
#[should_panic(expected = "Error(Contract, #18)")]
fn update_profile_rejects_empty_description() {
    let env = Env::default();
    let (contract_id, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    register_agent(&env, &client, &owner);

    let input = AgentProfileInput {
        name: String::from_str(&env, "has-name"),
        description: String::from_str(&env, ""),
        tags: Vec::new(&env),
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    client
        .mock_auths(&[MockAuth {
            address: &owner,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "update_profile",
                args: (&owner, &input).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .update_profile(&owner, &input);
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")]
fn update_profile_rejects_too_many_tags() {
    let env = Env::default();
    let (contract_id, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    register_agent(&env, &client, &owner);

    let mut tags = Vec::new(&env);
    for _ in 0..21 {
        tags.push_back(String::from_str(&env, "t"));
    }
    let input = AgentProfileInput {
        name: String::from_str(&env, "name"),
        description: String::from_str(&env, "desc"),
        tags,
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    client
        .mock_auths(&[MockAuth {
            address: &owner,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "update_profile",
                args: (&owner, &input).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .update_profile(&owner, &input);
}

#[test]
#[should_panic(expected = "Error(Contract, #16)")]
fn update_profile_rejects_tag_too_long() {
    let env = Env::default();
    let (contract_id, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    register_agent(&env, &client, &owner);

    let long_tag = String::from_str(&env, &"x".repeat(33));
    let tags = Vec::from_array(&env, [long_tag]);
    let input = AgentProfileInput {
        name: String::from_str(&env, "name"),
        description: String::from_str(&env, "desc"),
        tags,
        service_url: None,
        mcp_server_url: None,
        payment_endpoint: None,
    };
    client
        .mock_auths(&[MockAuth {
            address: &owner,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "update_profile",
                args: (&owner, &input).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .update_profile(&owner, &input);
}

#[test]
fn deregister_agent_removes_from_listing() {
    let env = Env::default();
    let (contract_id, client, _, _) = setup(&env);
    let owner = Address::generate(&env);
    register_agent(&env, &client, &owner);

    client
        .mock_auths(&[MockAuth {
            address: &owner,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "deregister_agent",
                args: (&owner,).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .deregister_agent(&owner);

    assert_eq!(client.list_agents(&0, &100).len(), 0);
}

#[test]
fn deregister_agent_preserves_interactions() {
    let env = Env::default();
    let (contract_id, client, _, relayer) = setup(&env);
    let provider = Address::generate(&env);
    let consumer = Address::generate(&env);
    register_agent(&env, &client, &provider);

    let tx_hash = register_interaction_tx(&env, &client, &contract_id, &relayer, &provider, &consumer, 100, 50);

    client
        .mock_auths(&[MockAuth {
            address: &provider,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "deregister_agent",
                args: (&provider,).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .deregister_agent(&provider);

    let interactions = client.list_agent_interactions(&provider, &0, &10);
    assert_eq!(interactions.len(), 1);
    assert_eq!(interactions.get_unchecked(0).tx_hash, tx_hash);
}

#[test]
#[should_panic(expected = "Error(Contract, #24)")]
fn deregister_agent_rejects_nonexistent() {
    let env = Env::default();
    let (contract_id, client, _, _) = setup(&env);
    let owner = Address::generate(&env);

    client
        .mock_auths(&[MockAuth {
            address: &owner,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "deregister_agent",
                args: (&owner,).into_val(&env),
                sub_invokes: &[],
            },
        }])
        .deregister_agent(&owner);
}
